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
import { useTranslation } from "react-i18next"; // <--- i18n

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
  const { t } = useTranslation(); // <--- i18n

  const [playerId, setPlayerId] = useState("");
  const [posts, setPosts] = useState<TradePost[]>([]);
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState<"all" | "sale" | "trade" | "want">("all");
  const [onlyMine, setOnlyMine] = useState(false);

  // Modal
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
            interestedNames.push(userDoc.data().name || "Desconhecido");
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
        {item.type === "want" ? (
          <Text style={[styles.postCardPrice, { color: "#FDC30B" }]}>{t("trocas.filters.want")}</Text>
        ) : item.type === "sale" ? (
          <Text style={styles.postCardPrice} numberOfLines={1}>
            {item.price}
          </Text>
        ) : (
          <Text style={styles.postCardPrice}>{t("trocas.filters.trade")}</Text>
        )}
      </TouchableOpacity>
    );
  }

  const displayedPosts = getFilteredPosts();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{t("trocas.header")}</Text>
        <TouchableOpacity
          style={[
            styles.switchMyCards,
            onlyMine && styles.switchMyCardsActive,
          ]}
          onPress={() => setOnlyMine((prev) => !prev)}
        >
          <Text style={styles.switchMyCardsText}>
            {onlyMine ? t("trocas.buttons.my_cards") : t("trocas.buttons.all_cards")}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t("trocas.placeholders.search") || ""}
          placeholderTextColor="#888"
          value={searchText}
          onChangeText={setSearchText}
        />
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterButton, filterType === "all" && styles.filterButtonActive]}
            onPress={() => setFilterType("all")}
          >
            <Text style={styles.filterButtonText}>{t("trocas.filters.all")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterType === "trade" && styles.filterButtonActive]}
            onPress={() => setFilterType("trade")}
          >
            <Text style={styles.filterButtonText}>{t("trocas.filters.trade")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterType === "sale" && styles.filterButtonActive]}
            onPress={() => setFilterType("sale")}
          >
            <Text style={styles.filterButtonText}>{t("trocas.filters.sale")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterType === "want" && styles.filterButtonActive]}
            onPress={() => setFilterType("want")}
          >
            <Text style={styles.filterButtonText}>{t("trocas.filters.want")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={displayedPosts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between", padding: 8 }}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 60 }}
      />

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
              {detailPost.type === "want" ? (
                <Text style={[styles.modalLabel, { color: "#FDC30B" }]}>
                  {t("trocas.filters.want")}
                </Text>
              ) : detailPost.type === "sale" ? (
                <Text style={styles.modalLabel}>
                  {t("trocas.filters.sale")}: {detailPost.price}
                </Text>
              ) : (
                <Text style={styles.modalLabel}>
                  {t("trocas.filters.trade")}
                </Text>
              )}
              <Text style={styles.modalLabel}>
                Dono: {detailPost.ownerName}
              </Text>
              <Text style={styles.modalLabel}>
                Observações: {detailPost.obs || "(Nenhuma)"}
              </Text>

              {detailPost.ownerId === playerId ? (
                <>
                  <Text style={[styles.modalLabel, { marginTop: 8 }]}>
                    Interessados:
                  </Text>
                  {detailPost.interested.length === 0 ? (
                    <Text style={{ color: "#ccc" }}>
                      Ninguém se interessou ainda
                    </Text>
                  ) : (
                    detailPost.interested.map((name) => (
                      <Text key={name} style={{ color: "#fff" }}>
                        {name}
                      </Text>
                    ))
                  )}

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
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const DARK = "#1E1E1E";
const PRIMARY = "#E3350D";
const SECONDARY = "#FFFFFF";
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
    padding: 16,
  },
  headerTitle: {
    color: SECONDARY,
    fontSize: 20,
    fontWeight: "bold",
  },
  switchMyCards: {
    backgroundColor: "#444",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  switchMyCardsActive: {
    backgroundColor: "#666",
  },
  switchMyCardsText: {
    color: SECONDARY,
    fontWeight: "bold",
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 4,
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
    marginBottom: 8,
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
    width: CARD_WIDTH * 0.75,
    height: CARD_WIDTH * 1.05,
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
    color: SECONDARY,
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  modalLabel: {
    color: SECONDARY,
    fontSize: 14,
    marginVertical: 5,
  },
  detailImage: {
    width: 180,
    height: 240,
  },
  button: {
    backgroundColor: PRIMARY,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: "center",
  },
  buttonText: {
    color: SECONDARY,
    fontWeight: "bold",
  },
});
