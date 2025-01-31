import React, { useEffect, useState } from "react";
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
  Animated,
} from "react-native";
import {
  collection,
  doc,
  onSnapshot,
  deleteDoc,
  getDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import moment from "moment";
import { db } from "../../lib/firebaseConfig";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import * as Animatable from "react-native-animatable";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

/** Mantendo a lógica e as interfaces originais **/
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

  const [playerId, setPlayerId] = useState("");
  const [posts, setPosts] = useState<TradePost[]>([]);
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState<"all" | "sale" | "trade" | "want">("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const router = useRouter();

  // Modal de Detalhes
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailPost, setDetailPost] = useState<TradePost | null>(null);

  useEffect(() => {
    moment.locale("pt-br");
    (async () => {
      const pid = await AsyncStorage.getItem("@userId");
      if (pid) setPlayerId(pid);
    })();

    const collRef = collection(db, "trade");
    const unsub = onSnapshot(collRef, (snap) => {
      const arr: TradePost[] = [];
      const now = Date.now();
      snap.forEach((ds) => {
        const data = ds.data();
        // remove posts com +3 dias
        if (data.createdAt && now - data.createdAt > 3 * 86400000) {
          return; // filtra
        }
        arr.push({
          id: ds.id,
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
      arr.sort((a, b) => b.createdAt - a.createdAt);
      setPosts(arr);
    });
    return () => unsub();
  }, []);

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

  async function openDetailModal(post: TradePost) {
    const interestedNames: string[] = [];
  
    if (post.interested.length > 0) {
      try {
        for (const pId of post.interested) {
          const userDocRef = doc(db, "players", pId);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            interestedNames.push(userDoc.data().fullname || "Desconhecido"); // ✅ Correção aqui!
          } else {
            interestedNames.push("Desconhecido");
          }
        }
      } catch (err) {
        console.error("Erro ao buscar nomes dos interessados:", err);
      }
    }
  
    setDetailPost({ ...post, interested: interestedNames });
    setDetailModalVisible(true);
  }  

  function closeDetailModal() {
    setDetailPost(null);
    setDetailModalVisible(false);
  }

  async function handleInterest(post: TradePost) {
    if (!playerId) {
      Alert.alert(t("common.error"), t("trocas.alerts.not_logged_in"));
      return;
    }
    if (post.ownerId === playerId) {
      Alert.alert(t("common.error"), t("trocas.alerts.owner"));
      return;
    }
    const collRef = collection(db, "trade");
    const docRef = doc(collRef, post.id);
    await updateDoc(docRef, {
      interested: arrayUnion(playerId),
    });
    Alert.alert(
      t("common.success"),
      t("trocas.alerts.interest_registered")
    );
  }

  function handleOpenChat(targetId: string) {
    router.push({
      pathname: "/(tabs)/chats",
      params: { userId: targetId },
    });
  }

  async function handleDeletePost(post: TradePost) {
    Alert.alert(
      t("common.confirmation_title"),
      t("trocas.alerts.delete_confirm", { cardName: post.cardName }),
      [
        { text: t("calendar.form.cancel_button"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const collRef = collection(db, "trade");
              await deleteDoc(doc(collRef, post.id));
              Alert.alert(t("common.success"), t("trocas.alerts.deleted"));
            } catch (err) {
              console.log("Erro ao excluir card:", err);
              Alert.alert(t("common.error"), t("trocas.alerts.delete_failed"));
            }
          },
        },
      ]
    );
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

  // ====================== Render Item ======================
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
                {t("trocas.filters.want")}
              </Text>
            ) : item.type === "sale" ? (
              <Text style={[styles.postTypeLabel, { color: "#4CAF50" }]} numberOfLines={1}>
                {item.price}
              </Text>
            ) : (
              <Text style={[styles.postTypeLabel, { color: "#2196F3" }]}>
                {t("trocas.filters.trade")}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </Animatable.View>
    );
  }

  const displayedPosts = getFilteredPosts();

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{t("trocas.header")}</Text>

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
            {onlyMine ? t("trocas.buttons.my_cards") : t("trocas.buttons.all_cards")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filtros */}
      <View style={styles.filterContainer}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={20} color="#999" style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("trocas.placeholders.search") || ""}
            placeholderTextColor="#888"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
        
        <View style={styles.filterRow}>
          {["all","trade","sale","want"].map((ft) => {
            const isActive = ft === filterType;
            let label = t("trocas.filters.all");
            let iconName = "layers"; // genérico
            let color = "#FFF";

            if(ft === "trade") {
              label = t("trocas.filters.trade");
              iconName = "swap-horizontal";
              color = "#2196F3";
            } else if(ft === "sale") {
              label = t("trocas.filters.sale");
              iconName = "cart";
              color = "#4CAF50";
            } else if(ft === "want") {
              label = t("trocas.filters.want");
              iconName = "heart";
              color = "#FBC02D";
            } else {
              // "all"
              label = t("trocas.filters.all");
              iconName = "layers";
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
            <Text style={{ color: "#ccc" }}>{t("trocas.alerts.no_posts")}</Text>
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
                    {t("trocas.details.owner")}: {detailPost.ownerName}
                  </Text>
                </View>

                {detailPost.type === "want" ? (
                  <View style={styles.modalRow}>
                    <Ionicons name="heart" size={20} color="#FBC02D" style={{marginRight: 6}}/>
                    <Text style={[styles.modalLabel, { color: "#FBC02D" }]}>
                      {t("trocas.filters.want")}
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
                      {t("trocas.filters.trade")}
                    </Text>
                  </View>
                )}

                {!!detailPost.obs && (
                  <Text style={[styles.modalLabel, { marginTop: 8 }]}>
                    {t("trocas.details.obs")}: {detailPost.obs}
                  </Text>
                )}

                {detailPost.ownerId === playerId ? (
                  <>
                    <Text style={[styles.modalLabel, { marginTop: 8, fontWeight:"bold" }]}>
                      {t("trocas.details.interested")}:
                    </Text>
                    {detailPost.interested.length === 0 ? (
                      <Text style={{ color: "#ccc" }}>
                        {t("trocas.details.no_interested")}
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
                      <Text style={styles.buttonText}>{t("trocas.buttons.delete")}</Text>
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
                    <Text style={styles.buttonText}>{t("trocas.buttons.interest")}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.button, { backgroundColor: "#999", marginTop: 16 }]}
                  onPress={closeDetailModal}
                >
                  <Text style={styles.buttonText}>{t("trocas.buttons.close")}</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/** ESTILOS REFEITOS PARA MELHOR APARÊNCIA **/
const DARK = "#1E1E1E";
const PRIMARY = "#E3350D";
const GRAY = "#2A2A2A";

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
    backgroundColor: GRAY,
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
