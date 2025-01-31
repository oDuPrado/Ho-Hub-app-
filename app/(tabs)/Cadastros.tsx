// app/(tabs)/players.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Import do Firebase
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";

// Import da tradução (se precisar)
import { useTranslation } from "react-i18next";

// Import do array de "hosts" e a função "fetchHostsInfo" (se precisar)
import { HOST_PLAYER_IDS, fetchHostsInfo } from "../hosts"; 

// Paleta de cores
const RED = "#E3350D";
const BLACK = "#1E1E1E";
const DARK_GRAY = "#292929";
const WHITE = "#FFFFFF";

interface PlayerData {
  userid: string;       // Ex: "1258446"
  name?: string;        // Ex: "Sá Júnior"
  fullname?: string;    // Ex: "Sá Júnior"
  birthdate?: string;   // Ex: "01/01/1990"
  pin?: string;         // Ex: "0364"
  [key: string]: any;   // Caso tenha mais campos
}

export default function PlayersScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);

  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerData | null>(null);

  // Modal para CRIAR ou EDITAR
  const [modalVisible, setModalVisible] = useState(false);
  // Define se estamos criando ou editando
  const [isEditing, setIsEditing] = useState(false);

  // Campos do formulário (para criar/editar)
  const [formUserid, setFormUserid] = useState("");
  const [formName, setFormName] = useState("");
  const [formFullname, setFormFullname] = useState("");
  const [formBirthdate, setFormBirthdate] = useState("");
  const [formPin, setFormPin] = useState("");

  useEffect(() => {
    (async function checkAccessAndFetch() {
      try {
        // Verificar se o user logado está em HOST_PLAYER_IDS
        const storedId = await AsyncStorage.getItem("@userId");
        if (!storedId) {
          router.replace("/(auth)/login");
          return;
        }

        // Se userId não estiver no array de hosts => bloquear
        const isUserHost = HOST_PLAYER_IDS.includes(storedId);
        setIsHost(isUserHost);

        if (!isUserHost) {
          setLoading(false);
          return; // Sai sem carregar players
        }

        // Se for host => carrega jogadores
        await fetchPlayers();
      } catch (error) {
        console.log("Erro ao verificar host ou carregar players:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function fetchPlayers() {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "players"));
      const data: PlayerData[] = [];
      snapshot.forEach((docSnap) => {
        const player = docSnap.data() as PlayerData;
        // Se no Firestore o doc ID for relevante, você pode usar docSnap.id
        data.push(player);
      });
      setPlayers(data);
    } catch (error) {
      console.log("Erro ao buscar players:", error);
      Alert.alert("Erro", "Não foi possível carregar os jogadores.");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setIsEditing(false);
    setFormUserid("");
    setFormName("");
    setFormFullname("");
    setFormBirthdate("");
    setFormPin("");
    setModalVisible(true);
  }

  function openEditModal(player: PlayerData) {
    setIsEditing(true);
    setSelectedPlayer(player);

    setFormUserid(player.userid || "");
    setFormName(player.name || "");
    setFormFullname(player.fullname || "");
    setFormBirthdate(player.birthdate || "");
    setFormPin(player.pin || "");

    setModalVisible(true);
  }

  async function handleSave() {
    try {
      if (!formUserid) {
        Alert.alert("Atenção", "O campo 'userid' é obrigatório!");
        return;
      }
      const docRef = doc(db, "players", formUserid);

      const newData: PlayerData = {
        userid: formUserid,
        name: formName,
        fullname: formFullname,
        birthdate: formBirthdate,
        pin: formPin,
      };

      // Se estamos editando, usa updateDoc; se estamos criando, usa setDoc (override)
      await setDoc(docRef, newData, { merge: true }); 
      // Ou: await updateDoc(docRef, newData) se quiser apenas atualizar campos existentes

      Alert.alert("Sucesso", isEditing ? "Jogador atualizado!" : "Jogador criado!");
      setModalVisible(false);
      await fetchPlayers();
    } catch (error) {
      console.log("Erro ao salvar jogador:", error);
      Alert.alert("Erro", "Não foi possível salvar o jogador.");
    }
  }

  async function handleDelete(player: PlayerData) {
    Alert.alert(
      "Confirmação",
      `Tem certeza que deseja excluir o jogador ${player.fullname || player.userid}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "players", player.userid));
              Alert.alert("Sucesso", "Jogador excluído!");
              await fetchPlayers();
            } catch (error) {
              console.log("Erro ao excluir jogador:", error);
              Alert.alert("Erro", "Não foi possível excluir o jogador.");
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={RED} />
      </View>
    );
  }

  if (!isHost) {
    return (
      <View style={styles.notAuthorizedContainer}>
        <Text style={styles.notAuthorizedText}>
          Você não tem permissão para acessar esta página.
        </Text>
      </View>
    );
  }

  return (
    <ImageBackground
      source={require("../../assets/images/background_login.jpg")} // Ajuste para uma imagem que você queira
      style={styles.background}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gerenciar Jogadores</Text>
        <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
          <Text style={styles.addButtonText}>+ Novo</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={players}
        keyExtractor={(item) => item.userid}
        contentContainerStyle={styles.listContainer}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{item.fullname || "Sem nome completo"}</Text>
              <Text style={styles.cardSubtitle}>UserID: {item.userid}</Text>
              {item.birthdate ? (
                <Text style={styles.cardSubtitle}>Nascimento: {item.birthdate}</Text>
              ) : null}
              {item.pin ? <Text style={styles.cardSubtitle}>PIN: {item.pin}</Text> : null}
            </View>
            <View style={styles.cardButtons}>
              <TouchableOpacity
                style={[styles.cardBtn, { backgroundColor: "#4CAF50" }]}
                onPress={() => openEditModal(item)}
              >
                <Text style={styles.cardBtnText}>Editar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cardBtn, { backgroundColor: "#E3350D" }]}
                onPress={() => handleDelete(item)}
              >
                <Text style={styles.cardBtnText}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Modal de Criar/Editar Jogador */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {isEditing ? "Editar Jogador" : "Novo Jogador"}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="UserID (ex: 1258446)"
              placeholderTextColor="#999"
              value={formUserid}
              onChangeText={(txt) => setFormUserid(txt)}
              editable={!isEditing} 
            />
            <TextInput
              style={styles.input}
              placeholder="Nome (ex: Sá Júnior)"
              placeholderTextColor="#999"
              value={formName}
              onChangeText={(txt) => setFormName(txt)}
            />
            <TextInput
              style={styles.input}
              placeholder="Nome completo (fullname)"
              placeholderTextColor="#999"
              value={formFullname}
              onChangeText={(txt) => setFormFullname(txt)}
            />
            <TextInput
              style={styles.input}
              placeholder="Data de Nascimento (birthdate)"
              placeholderTextColor="#999"
              value={formBirthdate}
              onChangeText={(txt) => setFormBirthdate(txt)}
            />
            <TextInput
              style={styles.input}
              placeholder="PIN"
              placeholderTextColor="#999"
              value={formPin}
              onChangeText={(txt) => setFormPin(txt)}
              keyboardType="number-pad"
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#999" }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: RED }]}
                onPress={handleSave}
              >
                <Text style={styles.modalBtnText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  notAuthorizedContainer: {
    flex: 1,
    backgroundColor: BLACK,
    justifyContent: "center",
    alignItems: "center",
  },
  notAuthorizedText: {
    color: WHITE,
    fontSize: 16,
    textAlign: "center",
    marginHorizontal: 20,
  },

  background: {
    flex: 1,
    resizeMode: "cover",
  },
  header: {
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    color: RED,
    fontSize: 22,
    fontWeight: "bold",
  },
  addButton: {
    backgroundColor: RED,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addButtonText: {
    color: WHITE,
    fontWeight: "bold",
    fontSize: 16,
  },

  listContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: DARK_GRAY,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#444",
  },
  cardInfo: {
    marginBottom: 10,
  },
  cardTitle: {
    color: WHITE,
    fontSize: 18,
    fontWeight: "bold",
  },
  cardSubtitle: {
    color: "#ccc",
    fontSize: 14,
    marginTop: 2,
  },
  cardButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  cardBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginLeft: 10,
  },
  cardBtnText: {
    color: WHITE,
    fontWeight: "bold",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "85%",
    backgroundColor: BLACK,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: "#444",
  },
  modalTitle: {
    color: RED,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  input: {
    backgroundColor: DARK_GRAY,
    color: WHITE,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  modalButtonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  modalBtnText: {
    color: WHITE,
    fontWeight: "bold",
  },

  container: {
    flex: 1,
    backgroundColor: BLACK,
  },
});
