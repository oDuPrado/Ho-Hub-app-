import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  TextInput,
  FlatList,
  Image,
  Dimensions,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import {
  collection,
  doc,
  onSnapshot,
  deleteDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  getDocs
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import moment from "moment";
import { db } from "../../lib/firebaseConfig";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import * as Animatable from "react-native-animatable";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native"; // <-- Importado para foco

/**
 * Neste arquivo, NÃO iremos mais usar "collection(db, 'trade')".
 * Agora, precisamos buscar nas subcoleções:
 *   /leagues/{leagueId}/trades
 * se e somente se filterType = "league".
 *
 * Se filterType for "city" ou "all", exibimos uma mensagem indicando
 * que não há trocas disponíveis nesse modo.
 */

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

interface TradePost {
  id: string;
  cardName: string;
  cardImage: string;
  type: "sale" | "trade" | "want";
  price: string;
  obs: string;
  ownerId: string;
  ownerName: string;
  interested: string[];
  createdAt: number;
}

export default function UserTradeFeed() {
  const { t } = useTranslation();
  const router = useRouter();

  const [playerId, setPlayerId] = useState("");
  const [posts, setPosts] = useState<TradePost[]>([]);
  const [cachedPosts, setCachedPosts] = useState<TradePost[] | null>(null); // <-- Cache
  const [updateCount, setUpdateCount] = useState(0); // <-- Contador para o cache

  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState<"all" | "sale" | "trade" | "want">("all");
  const [onlyMine, setOnlyMine] = useState(false);

  // Filtro geral
  const [globalFilterType, setGlobalFilterType] = useState<string>(""); // "all"|"city"|"league"
  const [leagueStored, setLeagueStored] = useState<string>("");

  // Modal de Detalhes
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailPost, setDetailPost] = useState<TradePost | null>(null);

  // ---------------- useFocusEffect para sempre recarregar league/filter ao focar -------------
  useFocusEffect(
    useCallback(() => {
        let isActive = true;

        (async () => {
            try {
                const pid = await AsyncStorage.getItem("@userId");
                if (isActive && pid) setPlayerId(pid);

                const fType = (await AsyncStorage.getItem("@filterType")) || "";
                const lId = (await AsyncStorage.getItem("@leagueId")) || "";

                if (isActive) {
                    setGlobalFilterType(fType as string);
                    setLeagueStored(lId);
                }

                if (fType === "league" && lId) {
                    // Aqui passamos o estado atualizado do cache para evitar loop infinito
                    loadTradesForLeague(lId, isActive, cachedPosts);
                } else {
                    if (isActive) setPosts([]);
                }
            } catch (err) {
                console.log("Erro ao ler dados do AsyncStorage:", err);
            }
        })();

        return () => {
            isActive = false;
        };
    }, []) // Removemos dependências que poderiam fazer o `useFocusEffect` rodar constantemente
);

/** Lê todos os trades na coleção /leagues/{lId}/trades */
async function loadTradesForLeague(lId: string, isActive: boolean, cache: TradePost[] | null) {
    try {
        const tradesRef = collection(db, `leagues/${lId}/trades`);
        const snap = await getDocs(tradesRef);

        let tempPosts: TradePost[] = [];
        const now = Date.now();

        snap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.createdAt && now - data.createdAt > 3 * 86400000) {
                return; // Remove posts com mais de 3 dias
            }
            tempPosts.push({
                id: docSnap.id,
                cardName: data.cardName,
                cardImage: data.cardImage,
                type: data.type,
                price: data.price,
                obs: data.obs || "",
                ownerId: data.ownerId,
                ownerName: data.ownerName || "Jogador",
                interested: data.interested || [],
                createdAt: data.createdAt,
            });
        });

        // Organiza por data
        tempPosts.sort((a, b) => b.createdAt - a.createdAt);

        if (isActive) {
            // Comparação com cache para evitar atualizações desnecessárias
            if (cache && JSON.stringify(tempPosts) === JSON.stringify(cache)) {
                if (updateCount >= 5) {
                    console.log("Dados inalterados 5 vezes, forçando atualização do cache...");
                    setCachedPosts(tempPosts);
                    setUpdateCount(0);
                    setPosts(tempPosts);
                } else {
                    console.log("Usando cache (sem atualização)...");
                    setUpdateCount((prev) => prev + 1);
                }
            } else {
                console.log("Dados atualizados, salvando no cache...");
                setCachedPosts(tempPosts);
                setUpdateCount(0);
                setPosts(tempPosts);
            }
        }
    } catch (err) {
        console.log("Erro ao carregar trades da liga:", err);
    }
}

  // ============ Filtra => onlyMine + type + searchText =============
  function getFilteredPosts(): TradePost[] {
    return posts.filter((p) => {
      if (onlyMine && p.ownerId !== playerId) return false;
      if (filterType !== "all" && p.type !== filterType) return false;
      if (searchText.trim()) {
        const txt = searchText.trim().toLowerCase();
        if (!p.cardName.toLowerCase().includes(txt)) return false;
      }
      return true;
    });
  }

  // ============================ DETALHE ============================
  async function openDetailModal(post: TradePost) {
    // Precisamos buscar "interested" -> converter em Nomes
    let interestedNames: string[] = [];
    if (post.interested.length > 0) {
      for (const pId of post.interested) {
        try {
          const pRef = doc(db, `leagues/${leagueStored}/players/${pId}`);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            interestedNames.push(pSnap.data().fullname || `Desconhecido ${pId}`);
          } else {
            interestedNames.push(`Desconhecido ${pId}`);
          }
        } catch (err) {
          interestedNames.push(`Desconhecido ${pId}`);
        }
      }
    }
    setDetailPost({ ...post, interested: interestedNames });
    setDetailModalVisible(true);
  }

  function closeDetailModal() {
    setDetailPost(null);
    setDetailModalVisible(false);
  }

  /** Registra interesse do userId no post */
  async function handleInterest(post: TradePost) {
    if (!playerId) {
      Alert.alert("Erro", "Você não está logado.");
      return;
    }
    if (post.ownerId === playerId) {
      Alert.alert("Aviso", "Você já é o dono deste post.");
      return;
    }

    try {
      const docRef = doc(db, `leagues/${leagueStored}/trades`, post.id);
      await updateDoc(docRef, {
        interested: arrayUnion(playerId),
      });

      Alert.alert("Sucesso", "Interesse registrado!");
    } catch (err) {
      console.log("Erro ao registrar interesse:", err);
      Alert.alert("Erro", "Falha ao registrar interesse.");
    }
  }

  /** Deleta post do Firestore */
  async function handleDeletePost(post: TradePost) {
    Alert.alert(
      "Confirmação",
      `Deseja excluir a carta ${post.cardName}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              const docRef = doc(db, `leagues/${leagueStored}/trades`, post.id);
              await deleteDoc(docRef);
              Alert.alert("Sucesso", "Carta excluída.");
            } catch (err) {
              console.log("Erro ao excluir card:", err);
              Alert.alert("Erro", "Não foi possível excluir.");
            }
          },
        },
      ]
    );
  }

  /** Abre chat com o user */
  function handleOpenChat(targetName: string) {
    Alert.alert("Chat", `Abrir chat com: ${targetName} (futuro)...`);
  }

  // ============ Ícones e cores p/ cada tipo ============
  function getTypeIconAndColor(type: "sale"|"trade"|"want"): {icon: JSX.Element; borderColor: string} {
    switch (type) {
      case "sale":
        return {
          icon: <Ionicons name="cart" size={18} color="#4CAF50" />,
          borderColor: "#4CAF50",
        };
      case "trade":
        return {
          icon: <Ionicons name="swap-horizontal" size={18} color="#2196F3" />,
          borderColor: "#2196F3",
        };
      case "want":
      default:
        return {
          icon: <Ionicons name="heart" size={18} color="#FBC02D" />,
          borderColor: "#FBC02D",
        };
    }
  }

  // ====================== RENDER ITEM ======================
  function renderItem({ item }: { item: TradePost }) {
    const { icon, borderColor } = getTypeIconAndColor(item.type);

    return (
      <Animatable.View
        animation="fadeInUp"
        duration={800}
        style={{ width: CARD_WIDTH, marginBottom: 14 }}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => openDetailModal(item)}
          style={[
            styles.postCard,
            {
              borderColor,
            },
          ]}
        >
          <Animatable.View animation="pulse" iterationCount="infinite" duration={4000}>
            <Image
              source={{ uri: item.cardImage }}
              style={styles.postCardImage}
              resizeMode="contain"
            />
          </Animatable.View>

          <Text style={styles.postCardName} numberOfLines={1}>
            {item.cardName}
          </Text>
          <View style={styles.ownerRow}>
            <Ionicons name="person-circle" size={16} color="#ccc" />
            <Text style={styles.postCardOwner} numberOfLines={1}>
              {item.ownerName}
            </Text>
          </View>

          <View style={styles.typeRow}>
            {icon}
            {item.type === "want" ? (
              <Text style={[styles.postTypeLabel, { color: "#FBC02D" }]}>
                Quero
              </Text>
            ) : item.type === "sale" ? (
              <Text style={[styles.postTypeLabel, { color: "#4CAF50" }]} numberOfLines={1}>
                {item.price}
              </Text>
            ) : (
              <Text style={[styles.postTypeLabel, { color: "#2196F3" }]}>
                Troca
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </Animatable.View>
    );
  }

  // ====================== RENDER PRINCIPAL ======================
  if (globalFilterType !== "league" || !leagueStored) {
    // Se user está em city ou all => exibe mensagem
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ padding: 16 }}>
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "bold" }}>
            Sistema de Trocas/Posts indisponível para esse tipo de filtro.
          </Text>
          <Text style={{ color: "#999", marginTop: 10 }}>
            Selecione uma LIGA específica para ver as cartas listadas.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayedPosts = getFilteredPosts();

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Trocas / Vendas</Text>

        <TouchableOpacity
          style={[
            styles.switchMyCards,
            onlyMine && styles.switchMyCardsActive,
          ]}
          onPress={() => setOnlyMine((prev) => !prev)}
        >
          <Ionicons
            name={onlyMine ? "checkmark-circle" : "checkmark-circle-outline"}
            size={18}
            color="#FFF"
          />
          <Text style={styles.switchMyCardsText}>
            {onlyMine ? "Meus Cards" : "Todos"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filtros */}
      <View style={styles.filterContainer}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={20} color="#999" style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por Nome"
            placeholderTextColor="#888"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
        
        <View style={styles.filterRow}>
          {["all","trade","sale","want"].map((ft) => {
            const isActive = ft === filterType;
            let label = "Todos";
            let iconName = "layers";
            let color = "#FFF";

            if(ft === "trade") {
              label = "Troca";
              iconName = "swap-horizontal";
              color = "#2196F3";
            } else if(ft === "sale") {
              label = "Venda";
              iconName = "cart";
              color = "#4CAF50";
            } else if(ft === "want") {
              label = "Quero";
              iconName = "heart";
              color = "#FBC02D";
            }

            return (
              <TouchableOpacity
                key={ft}
                style={[
                  styles.filterButton,
                  isActive && styles.filterButtonActive,
                ]}
                onPress={() => setFilterType(ft as typeof filterType)}
              >
                <Ionicons name={iconName as any} size={18} color={color} />
                <Text style={[styles.filterButtonText, { marginLeft: 4 }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Lista */}
      <FlatList
        data={displayedPosts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between", paddingHorizontal: 12 }}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 60, paddingTop: 6 }}
        ListEmptyComponent={() => (
          <View style={{ alignItems: "center", marginTop: 20 }}>
            <Text style={{ color: "#ccc" }}>
              Nenhum post encontrado.
            </Text>
          </View>
        )}
      />

      {/* MODAL DETALHES */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        onRequestClose={closeDetailModal}
        transparent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {!detailPost ? (
              <ActivityIndicator size="large" color="#E3350D" />
            ) : (
              <ScrollView style={{ padding: 16 }}>
                <Text style={styles.modalTitle}>{detailPost.cardName}</Text>

                <Animatable.View
                  animation="fadeIn"
                  duration={600}
                  style={{ alignItems: "center", marginBottom: 12 }}
                >
                  <Image
                    source={{ uri: detailPost.cardImage }}
                    style={styles.detailImage}
                    resizeMode="contain"
                  />
                </Animatable.View>

                <View style={styles.modalRow}>
                  <Ionicons name="person-circle-outline" size={20} color="#ccc" style={{marginRight: 6}}/>
                  <Text style={styles.modalLabel}>
                    Dono: {detailPost.ownerName}
                  </Text>
                </View>

                {detailPost.type === "want" ? (
                  <View style={styles.modalRow}>
                    <Ionicons name="heart" size={20} color="#FBC02D" style={{marginRight: 6}}/>
                    <Text style={[styles.modalLabel, { color: "#FBC02D" }]}>
                      Quero
                    </Text>
                  </View>
                ) : detailPost.type === "sale" ? (
                  <View style={styles.modalRow}>
                    <Ionicons name="cart" size={20} color="#4CAF50" style={{marginRight: 6}}/>
                    <Text style={[styles.modalLabel, { color: "#4CAF50" }]}>
                      {detailPost.price}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.modalRow}>
                    <Ionicons name="swap-horizontal" size={20} color="#2196F3" style={{marginRight: 6}}/>
                    <Text style={[styles.modalLabel, { color: "#2196F3" }]}>
                      Troca
                    </Text>
                  </View>
                )}

                {!!detailPost.obs && (
                  <Text style={[styles.modalLabel, { marginTop: 8 }]}>
                    Obs: {detailPost.obs}
                  </Text>
                )}

                {detailPost.ownerId === playerId ? (
                  <>
                    <Text style={[styles.modalLabel, { marginTop: 8, fontWeight:"bold" }]}>
                      Interessados:
                    </Text>
                    {detailPost.interested.length === 0 ? (
                      <Text style={{ color: "#ccc" }}>
                        Nenhum interessado ainda.
                      </Text>
                    ) : (
                      detailPost.interested.map((name, idx) => (
                        <TouchableOpacity
                          key={`intr-${idx}`}
                          style={styles.interestedItem}
                          onPress={() => handleOpenChat(name)}
                        >
                          <Ionicons name="chatbox-ellipses" size={16} color="#fff" style={{marginRight:4}}/>
                          <Text style={{ color: "#fff", textDecorationLine: "underline" }}>
                            {name}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                    {/* Botão de Excluir */}
                    <TouchableOpacity
                      style={[styles.button, { backgroundColor: "#FF5555", marginTop: 20 }]}
                      onPress={() => {
                        closeDetailModal();
                        handleDeletePost(detailPost);
                      }}
                    >
                      <Text style={styles.buttonText}>Excluir</Text>
                    </TouchableOpacity>
                  </>
                ) : (
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
                  style={[styles.button, { backgroundColor: "#999", marginTop: 16 }]}
                  onPress={closeDetailModal}
                >
                  <Text style={styles.buttonText}>Fechar</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/** ESTILOS */
const DARK = "#1E1E1E";
const PRIMARY = "#E3350D";

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: DARK,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
    backgroundColor: "#000",
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  switchMyCards: {
    flexDirection: "row",
    backgroundColor: "#444",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
  },
  switchMyCardsActive: {
    backgroundColor: "#666",
  },
  switchMyCardsText: {
    color: "#FFF",
    fontWeight: "bold",
    marginLeft: 6,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: DARK,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  searchRow: {
    flexDirection: "row",
    backgroundColor: "#2A2A2A",
    borderRadius: 6,
    alignItems: "center",
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: "#FFF",
    paddingVertical: 6,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginVertical: 4,
  },
  filterButton: {
    flexDirection: "row",
    backgroundColor: "#444",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 6,
    alignItems: "center",
  },
  filterButtonActive: {
    backgroundColor: "#666",
  },
  filterButtonText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  postCard: {
    backgroundColor: "#3A3A3A",
    borderWidth: 2,
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
  },
  postCardImage: {
    width: CARD_WIDTH * 0.75,
    height: CARD_WIDTH * 1.05,
    marginBottom: 8,
  },
  postCardName: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },
  ownerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  postCardOwner: {
    color: "#ccc",
    fontSize: 12,
    marginLeft: 4,
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  postTypeLabel: {
    marginLeft: 4,
    fontWeight: "bold",
    fontSize: 12,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
  },
  modalContent: {
    flex: 1,
    backgroundColor: DARK,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    marginTop: 60,
  },
  modalTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
  },
  detailImage: {
    width: 180,
    height: 240,
  },
  modalRow: {
    flexDirection: "row",
    marginTop: 6,
    alignItems: "center",
  },
  modalLabel: {
    color: "#FFF",
    fontSize: 14,
  },
  interestedItem: {
    marginVertical: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  button: {
    backgroundColor: PRIMARY,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: "center",
    marginTop: 6,
  },
  buttonText: {
    color: "#FFF",
    fontWeight: "bold",
  },
});
