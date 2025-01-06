import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ScrollView,
  Modal,
  TextInput,
  Switch,
  Image,
  FlatList,
  Dimensions,
} from "react-native";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  arrayUnion,
  deleteDoc,
} from "firebase/firestore";
import moment from "moment";
import "moment/locale/pt-br";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "../../lib/firebaseConfig";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2; // 2 colunas c/ margin

interface TradePost {
  id: string;
  cardName: string;
  cardImage: string;
  type: "sale" | "trade";
  price: string; // ex. "R$ 15,00" ou "Liga - 10%"
  obs: string;
  ownerId: string;
  ownerName: string;
  interested: string[]; // array de user IDs
  createdAt: number; // epoch ms
}

/** Componente principal: feed de trocas/vendas */
export default function UserTradeFeed() {
  const [playerId, setPlayerId] = useState("");
  const [playerName, setPlayerName] = useState("Jogador"); // ou busque do Firestore
  const [posts, setPosts] = useState<TradePost[]>([]);
  const [filterType, setFilterType] = useState<"sale" | "trade" | "all">("all");
  const [searchText, setSearchText] = useState("");

  // Modal de criação/edição
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCardName, setEditCardName] = useState("");
  const [editCardImage, setEditCardImage] = useState("");
  const [editType, setEditType] = useState<"sale" | "trade">("sale");
  const [editPriceMode, setEditPriceMode] = useState<"manual" | "liga">(
    "manual"
  );
  const [editPriceValue, setEditPriceValue] = useState(""); // ex "R$ 10,00"
  const [editLigaPercent, setEditLigaPercent] = useState("5%"); // ex. "5%", "10%", ...
  const [editObs, setEditObs] = useState("");

  // Modal de detalhes do card
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailPost, setDetailPost] = useState<TradePost | null>(null);

  useEffect(() => {
    moment.locale("pt-br");

    // Carrega do AsyncStorage ou do Firestore
    (async () => {
      const pid = await AsyncStorage.getItem("@userId");
      const pname = await AsyncStorage.getItem("@userName");
      if (pid) setPlayerId(pid);
      if (pname) setPlayerName(pname);
    })();

    // Observa a coleção global "trade" ou "trade/<uid>/cards"
    const collRef = collection(db, "trade");
    // Se quiser por user, seria: collection(db, "trade", playerId, "cards")

    const unsub = onSnapshot(collRef, (snapshot) => {
      const arr: TradePost[] = [];
      const now = Date.now();
      snapshot.forEach((ds) => {
        const data = ds.data();
        // Filtra docs antigos (3 dias = 259200000 ms)
        if (data.createdAt && now - data.createdAt > 259200000) {
          // Ignora (ou poderia deletar auto)
          return;
        }
        arr.push({
          id: ds.id,
          cardName: data.cardName,
          cardImage: data.cardImage,
          type: data.type,
          price: data.price,
          obs: data.obs || "",
          ownerId: data.ownerId,
          ownerName: data.ownerName,
          interested: data.interested || [],
          createdAt: data.createdAt,
        });
      });
      // Ordena por createdAt desc
      arr.sort((a, b) => b.createdAt - a.createdAt);
      setPosts(arr);
    });

    return () => unsub();
  }, []);

  /** Filtro final de exibição, aplicando "filterType" e "searchText" */
  function getFilteredPosts(): TradePost[] {
    return posts.filter((p) => {
      // se filterType != "all", filtra p.type
      if (filterType !== "all" && p.type !== filterType) return false;

      // se searchText presente, filtra por cardName (case-insensitive)
      if (searchText.trim()) {
        const txt = searchText.trim().toLowerCase();
        if (!p.cardName.toLowerCase().includes(txt)) return false;
      }
      return true;
    });
  }

  // --------------- CRIAR/EDITAR ---------------
  async function openCreateModal() {
    // Verifica se user tem < 5 posts
    const userPostsCount = posts.filter((p) => p.ownerId === playerId).length;
    if (userPostsCount >= 5) {
      Alert.alert("Limite atingido", "Você só pode ter 5 cartas ativas.");
      return;
    }
    setEditId(null);
    setEditCardName("");
    setEditCardImage("");
    setEditType("sale");
    setEditPriceMode("manual");
    setEditPriceValue("");
    setEditLigaPercent("5%");
    setEditObs("");
    setModalVisible(true);
  }

  function openEditModal(post: TradePost) {
    setEditId(post.id);
    setEditCardName(post.cardName);
    setEditCardImage(post.cardImage);
    setEditType(post.type);
    // Se price começa com "Liga -", assume editPriceMode = "liga"
    if (post.price.startsWith("Liga -")) {
      setEditPriceMode("liga");
      setEditLigaPercent(post.price.replace("Liga - ", "") || "5%");
      setEditPriceValue("");
    } else {
      setEditPriceMode("manual");
      setEditPriceValue(post.price);
      setEditLigaPercent("5%");
    }
    setEditObs(post.obs);
    setModalVisible(true);
  }

  async function handleSavePost() {
    if (!playerId) {
      Alert.alert("Erro", "Você não está logado ou sem playerId.");
      return;
    }
    if (!editCardName.trim()) {
      Alert.alert("Erro", "Informe o nome da carta.");
      return;
    }
    if (!editCardImage.trim()) {
      Alert.alert("Erro", "Informe a URL da imagem da carta.");
      return;
    }
    // Monta o price final
    let finalPrice = "";
    if (editType === "sale") {
      if (editPriceMode === "manual") {
        if (!editPriceValue.trim()) {
          Alert.alert("Erro", "Informe o valor manual.");
          return;
        }
        finalPrice = editPriceValue.trim();
      } else {
        // "liga"
        finalPrice = `Liga - ${editLigaPercent}`;
      }
    } else {
      // se é "trade", não precisa de price
      finalPrice = "Troca";
    }

    // Se for user sub-col, poderia ser doc(db, "trade", playerId, "cards", ???)
    const collRef = collection(db, "trade"); // colecao global

    try {
      if (editId) {
        // update
        const docRef = doc(collRef, editId);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) {
          Alert.alert("Erro", "Documento não existe mais.");
          setModalVisible(false);
          return;
        }
        // Se dono != playerId, proíbe
        const ownerIdCheck = snapshot.data().ownerId;
        if (ownerIdCheck !== playerId) {
          Alert.alert("Erro", "Você não é dono deste post.");
          setModalVisible(false);
          return;
        }
        await updateDoc(docRef, {
          cardName: editCardName.trim(),
          cardImage: editCardImage.trim(),
          type: editType,
          price: finalPrice,
          obs: editObs.trim(),
        });
      } else {
        // create
        const userPostsCount = posts.filter(
          (p) => p.ownerId === playerId
        ).length;
        if (userPostsCount >= 5) {
          Alert.alert("Limite atingido", "Você só pode ter 5 cartas ativas.");
          setModalVisible(false);
          return;
        }
        await setDoc(doc(collRef), {
          cardName: editCardName.trim(),
          cardImage: editCardImage.trim(),
          type: editType,
          price: finalPrice,
          obs: editObs.trim(),
          ownerId: playerId,
          ownerName: playerName,
          interested: [],
          createdAt: Date.now(),
        });
      }
      setModalVisible(false);
    } catch (error) {
      console.log("Erro ao salvar post:", error);
      Alert.alert("Erro", "Falha ao salvar post.");
    }
  }

  // --------------- EXCLUIR ---------------
  async function handleDeletePost(post: TradePost) {
    Alert.alert("Confirmar", `Deseja excluir "${post.cardName}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            const collRef = collection(db, "trade");
            const docRef = doc(collRef, post.id);
            await deleteDoc(docRef);
            Alert.alert("Sucesso", "Post excluído!");
          } catch (err) {
            console.log("Erro ao excluir post:", err);
            Alert.alert("Erro", "Falha ao excluir post.");
          }
        },
      },
    ]);
  }

  // --------------- Detalhes do Card (Modal) ---------------
  function openDetailModal(post: TradePost) {
    setDetailPost(post);
    setDetailModalVisible(true);
  }

  function closeDetailModal() {
    setDetailPost(null);
    setDetailModalVisible(false);
  }

  // Se for dono do post, mostra interessados
  // Se não for dono, mostra "Tenho Interesse"
  async function handleInterest(post: TradePost) {
    if (!playerId) {
      Alert.alert("Erro", "Você não está logado.");
      return;
    }
    if (post.ownerId === playerId) {
      // Ele é o dono -> exibe "você é dono"
      return;
    }
    // Adiciona no array interested
    const collRef = collection(db, "trade");
    const docRef = doc(collRef, post.id);
    await updateDoc(docRef, {
      interested: arrayUnion(playerId),
    });
    Alert.alert("Ok", "Interesse registrado!");
  }

  // --------------- Render do feed ---------------
  /** Render do item no FlatList em 2 colunas */
  function renderItem({ item }: { item: TradePost }) {
    return (
      <TouchableOpacity
        style={styles.postCard}
        onPress={() => openDetailModal(item)}
      >
        <Image
          source={{ uri: item.cardImage }}
          style={styles.postCardImage}
          resizeMode="contain"
        />
        <Text style={styles.postCardName} numberOfLines={1}>
          {item.cardName}
        </Text>
        <Text style={styles.postCardOwner} numberOfLines={1}>
          {item.ownerName}
        </Text>
        <Text style={styles.postCardPrice} numberOfLines={1}>
          {item.type === "sale" ? item.price : "Para Troca"}
        </Text>
      </TouchableOpacity>
    );
  }

  const displayedPosts = getFilteredPosts();

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trocas e Vendas</Text>
        <TouchableOpacity style={styles.createBtn} onPress={openCreateModal}>
          <Text style={styles.createBtnText}>+Novo</Text>
        </TouchableOpacity>
      </View>

      {/* Barra de busca + switch de filter */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar carta..."
          placeholderTextColor="#888"
          value={searchText}
          onChangeText={setSearchText}
        />
        {/* Botões de filtrar: all/trade/sale */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterType === "all" && styles.filterButtonActive,
            ]}
            onPress={() => setFilterType("all")}
          >
            <Text style={styles.filterButtonText}>Todos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterType === "trade" && styles.filterButtonActive,
            ]}
            onPress={() => setFilterType("trade")}
          >
            <Text style={styles.filterButtonText}>Troca</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterType === "sale" && styles.filterButtonActive,
            ]}
            onPress={() => setFilterType("sale")}
          >
            <Text style={styles.filterButtonText}>Venda</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista em 2 colunas */}
      <FlatList
        data={displayedPosts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between", padding: 8 }}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 80 }}
      />

      {/* Modal CRIAR/EDITAR */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView style={{ padding: 16 }}>
            <Text style={styles.modalTitle}>
              {editId ? "Editar Publicação" : "Nova Publicação"}
            </Text>

            <Text style={styles.modalLabel}>Nome da Carta</Text>
            <TextInput
              style={styles.modalInput}
              value={editCardName}
              onChangeText={setEditCardName}
              placeholder="Ex: Pikachu VMAX"
              placeholderTextColor="#888"
            />

            <Text style={styles.modalLabel}>URL da Imagem</Text>
            <TextInput
              style={styles.modalInput}
              value={editCardImage}
              onChangeText={setEditCardImage}
              placeholder="http://..."
              placeholderTextColor="#888"
            />

            <Text style={styles.modalLabel}>Tipo</Text>
            <View style={{ flexDirection: "row", marginBottom: 10 }}>
              <TouchableOpacity
                style={[
                  styles.switchTypeButton,
                  editType === "sale" && styles.switchTypeButtonActive,
                ]}
                onPress={() => setEditType("sale")}
              >
                <Text style={styles.switchTypeText}>Venda</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.switchTypeButton,
                  editType === "trade" && styles.switchTypeButtonActive,
                ]}
                onPress={() => setEditType("trade")}
              >
                <Text style={styles.switchTypeText}>Troca</Text>
              </TouchableOpacity>
            </View>

            {editType === "sale" && (
              <>
                <Text style={styles.modalLabel}>Preço</Text>
                <View style={{ flexDirection: "row", marginBottom: 12 }}>
                  <TouchableOpacity
                    style={[
                      styles.switchTypeButton,
                      editPriceMode === "manual" &&
                        styles.switchTypeButtonActive,
                    ]}
                    onPress={() => setEditPriceMode("manual")}
                  >
                    <Text style={styles.switchTypeText}>Manual</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.switchTypeButton,
                      editPriceMode === "liga" && styles.switchTypeButtonActive,
                    ]}
                    onPress={() => setEditPriceMode("liga")}
                  >
                    <Text style={styles.switchTypeText}>Liga - %</Text>
                  </TouchableOpacity>
                </View>

                {editPriceMode === "manual" ? (
                  <TextInput
                    style={styles.modalInput}
                    value={editPriceValue}
                    onChangeText={setEditPriceValue}
                    placeholder="Ex: R$ 15,00"
                    placeholderTextColor="#888"
                  />
                ) : (
                  <View style={{ flexDirection: "row" }}>
                    {["5%", "10%", "15%", "20%"].map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.switchTypeButton,
                          editLigaPercent === opt &&
                            styles.switchTypeButtonActive,
                        ]}
                        onPress={() => setEditLigaPercent(opt)}
                      >
                        <Text style={styles.switchTypeText}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            <Text style={styles.modalLabel}>Observações</Text>
            <TextInput
              style={[styles.modalInput, { height: 60 }]}
              multiline
              value={editObs}
              onChangeText={setEditObs}
              placeholder="Detalhes sobre a condição, idioma, etc..."
              placeholderTextColor="#888"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: "#999" }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={handleSavePost}>
                <Text style={styles.buttonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal de Detalhes */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        onRequestClose={closeDetailModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          {detailPost && (
            <ScrollView style={{ padding: 16 }}>
              <Text style={styles.modalTitle}>{detailPost.cardName}</Text>
              <View style={{ alignItems: "center", marginBottom: 12 }}>
                <Image
                  source={{ uri: detailPost.cardImage }}
                  style={styles.detailImage}
                  resizeMode="contain"
                />
              </View>

              <Text style={styles.modalLabel}>
                Tipo: {detailPost.type === "sale" ? "Venda" : "Troca"}
              </Text>
              {detailPost.type === "sale" && (
                <Text style={styles.modalLabel}>Preço: {detailPost.price}</Text>
              )}
              <Text style={styles.modalLabel}>
                Dono: {detailPost.ownerName}
              </Text>
              <Text style={styles.modalLabel}>
                Obs: {detailPost.obs || "-"}
              </Text>

              {/* Se for dono, exibe interessados + botões editar/excluir */}
              {detailPost.ownerId === playerId ? (
                <>
                  <Text style={[styles.modalLabel, { marginTop: 10 }]}>
                    Interessados:
                  </Text>
                  {detailPost.interested.length === 0 ? (
                    <Text style={{ color: "#ccc" }}>Ninguém interessado.</Text>
                  ) : (
                    detailPost.interested.map((iid) => (
                      <Text key={iid} style={{ color: "#fff" }}>
                        {iid} (aqui idealmente mapeia p/ nome)
                      </Text>
                    ))
                  )}

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.button, { backgroundColor: "#777" }]}
                      onPress={() => {
                        closeDetailModal();
                        openEditModal(detailPost);
                      }}
                    >
                      <Text style={styles.buttonText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, { backgroundColor: "#FF3333" }]}
                      onPress={() => {
                        closeDetailModal();
                        handleDeletePost(detailPost);
                      }}
                    >
                      <Text style={styles.buttonText}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                // Se não é dono, exibe "Tenho Interesse"
                <TouchableOpacity
                  style={[styles.button, { marginTop: 20 }]}
                  onPress={() => {
                    handleInterest(detailPost);
                    closeDetailModal();
                  }}
                >
                  <Text style={styles.buttonText}>Tenho Interesse</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.button,
                  { marginTop: 20, backgroundColor: "#999" },
                ]}
                onPress={closeDetailModal}
              >
                <Text style={styles.buttonText}>Fechar</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

/** Estilos */
const DARK = "#1E1E1E";
const PRIMARY = "#E3350D";
const SECONDARY = "#FFFFFF";
const GRAY = "#2A2A2A";

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: DARK,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  headerTitle: {
    fontSize: 20,
    color: SECONDARY,
    fontWeight: "bold",
  },
  createBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  createBtnText: {
    color: SECONDARY,
    fontWeight: "bold",
  },
  searchContainer: {
    paddingHorizontal: 16,
  },
  searchInput: {
    backgroundColor: GRAY,
    color: SECONDARY,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 10,
  },
  filterButton: {
    backgroundColor: "#444",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
  },
  filterButtonActive: {
    backgroundColor: "#666",
  },
  filterButtonText: {
    color: SECONDARY,
    fontWeight: "bold",
  },
  postCard: {
    backgroundColor: "#3A3A3A",
    borderRadius: 8,
    width: CARD_WIDTH,
    marginBottom: 12,
    padding: 8,
    alignItems: "center",
  },
  postCardImage: {
    width: CARD_WIDTH * 0.8,
    height: CARD_WIDTH * 1.1,
    marginBottom: 6,
  },
  postCardName: {
    color: SECONDARY,
    fontSize: 14,
    fontWeight: "bold",
  },
  postCardOwner: {
    color: "#ccc",
    fontSize: 12,
  },
  postCardPrice: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: DARK,
  },
  modalTitle: {
    fontSize: 20,
    color: SECONDARY,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  modalLabel: {
    color: SECONDARY,
    fontSize: 14,
    marginTop: 10,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: "#444",
    color: SECONDARY,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
  },
  button: {
    backgroundColor: PRIMARY,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  buttonText: {
    color: SECONDARY,
    fontWeight: "bold",
  },
  switchTypeButton: {
    backgroundColor: "#444",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  switchTypeButtonActive: {
    backgroundColor: "#666",
  },
  switchTypeText: {
    color: SECONDARY,
    fontWeight: "bold",
  },
  detailImage: {
    width: 180,
    height: 240,
    marginBottom: 10,
  },
});
