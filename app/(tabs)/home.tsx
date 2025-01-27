import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Alert,
  ActivityIndicator,
  Linking,
  Modal,
  FlatList,
  ImageBackground,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { signOut } from "firebase/auth";
import { auth, db } from "../../lib/firebaseConfig";
import { collectionGroup, getDocs, doc, getDoc } from "firebase/firestore";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { FontAwesome5 } from "@expo/vector-icons"; // Ícone de sininho

interface NotificationItem {
  id: number;
  title: string;
  body: string;
  timestamp: number;
}

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [userName, setUserName] = useState("...");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  const [winsCount, setWinsCount] = useState(0);
  const [lossesCount, setLossesCount] = useState(0);
  const [drawCount, setDrawCount] = useState(0);
  const [biggestRival, setBiggestRival] = useState("...");
  const [matchesTotal, setMatchesTotal] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Modal de coleções
  const [collectionsModalVisible, setCollectionsModalVisible] = useState(false);
  const [validCollections, setValidCollections] = useState<any[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);

  // Modal de Notificações
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const storedId = await AsyncStorage.getItem("@userId");
        const storedName = await AsyncStorage.getItem("@userName");
        if (!storedId) {
          router.replace("/(auth)/login");
          return;
        }
        setUserId(storedId);
        setUserName(storedName || "Jogador");

        await loadStats(storedId);

        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.loop(
            Animated.sequence([
              Animated.timing(scaleAnim, {
                toValue: 1.07,
                duration: 900,
                easing: Easing.ease,
                useNativeDriver: true,
              }),
              Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 900,
                easing: Easing.ease,
                useNativeDriver: true,
              }),
            ])
          ),
        ]).start();
      } catch (err) {
        console.log("Erro ao carregar stats:", err);
        router.replace("/(auth)/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [fadeAnim, scaleAnim, router]);

  useFocusEffect(
    React.useCallback(() => {
      const fetchData = async () => {
        const storedId = await AsyncStorage.getItem("@userId");
        if (storedId) {
          setLoading(true);
          await loadStats(storedId);
          setLoading(false);
        }
        // Ao focar, recarrega contagem de notificações
        await loadNotifications();
      };
      fetchData();
      return () => {};
    }, [])
  );

  async function loadNotifications() {
    const notifsStr = await AsyncStorage.getItem("@notifications");
    if (notifsStr) {
      const arr: NotificationItem[] = JSON.parse(notifsStr);
      // Ordena por data desc
      arr.sort((a, b) => b.timestamp - a.timestamp);
      setNotifications(arr);
      setNotificationCount(arr.length);
    } else {
      setNotifications([]);
      setNotificationCount(0);
    }
  }

  async function clearNotifications() {
    await AsyncStorage.setItem("@notifications", JSON.stringify([]));
    setNotifications([]);
    setNotificationCount(0);
  }

  async function loadStats(uId: string) {
    const matchesRef = collectionGroup(db, "matches");
    const snap = await getDocs(matchesRef);

    let arrMatches: any[] = [];
    snap.forEach((docSnap) => {
      arrMatches.push(docSnap.data());
    });

    let userMatches = arrMatches.filter(
      (m) => m.player1_id === uId || m.player2_id === uId
    );

    let w = 0,
      l = 0,
      d = 0;
    let rivalCount: Record<string, number> = {};

    userMatches.forEach((match) => {
      const { player1_id, player2_id, outcomeNumber } = match;
      const isP1 = player1_id === uId;
      const isP2 = player2_id === uId;
      const rivalId = isP1 ? player2_id : player1_id;

      if (rivalId && rivalId !== "N/A") {
        rivalCount[rivalId] = (rivalCount[rivalId] || 0) + 1;
      }

      if (outcomeNumber === 3) {
        d++;
      } else if (outcomeNumber === 1) {
        if (isP1) w++;
        else if (isP2) l++;
      } else if (outcomeNumber === 2) {
        if (isP2) w++;
        else if (isP1) l++;
      } else if (outcomeNumber === 10) {
        l++;
      }
    });

    setWinsCount(w);
    setLossesCount(l);
    setDrawCount(d);
    setMatchesTotal(userMatches.length);

    let max = 0;
    let rivalMax = "";
    for (let rid of Object.keys(rivalCount)) {
      if (rivalCount[rid] > max) {
        max = rivalCount[rid];
        rivalMax = rid;
      }
    }

    if (!rivalMax) {
      setBiggestRival(t("home.stats.none_rival"));
    } else {
      const docSnap = await getDoc(doc(db, "players", rivalMax));
      if (!docSnap.exists()) {
        setBiggestRival(`${t("home.stats.rival")}: ${rivalMax} (${max}x)`);
      } else {
        const data = docSnap.data();
        const rName = data.fullname || `Jogador ${rivalMax}`;
        setBiggestRival(`${rName} (${max}x)`);
      }
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth);
      await AsyncStorage.removeItem("@userId");
      await AsyncStorage.removeItem("@userName");
      router.replace("/(auth)/login");
    } catch (err) {
      Alert.alert(t("common.error"), t("home.alerts.no_logout"));
      console.log(err);
    }
  }

  /** Exemplo de abrir modal de coleções */
  function openCollectionModal() {
    setCollectionsModalVisible(true);
    loadValidCollections();
  }

  async function loadValidCollections() {
    setLoadingCollections(true);
    try {
      const response = await fetch("https://api.pokemontcg.io/v2/sets");
      const data = await response.json();
      if (data && data.data) {
        const validSets = data.data.filter(
          (set: any) => set.legalities?.standard === "Legal"
        );
        setValidCollections(validSets);
      }
    } catch (error) {
      console.error("Erro ao carregar coleções válidas:", error);
    } finally {
      setLoadingCollections(false);
    }
  }

  function closeCollectionModal() {
    setCollectionsModalVisible(false);
  }

  function openNotificationsModal() {
    setNotifModalVisible(true);
  }

  function closeNotificationsModal() {
    setNotifModalVisible(false);
  }

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#E3350D" />
      </View>
    );
  }

  const total = matchesTotal;
  const wr = total > 0 ? ((winsCount / total) * 100).toFixed(1) : "0";

  return (
    // Background usando ImageBackground
    <ImageBackground
      source={require("../../assets/images/background_login.jpg")}
      style={styles.backgroundImage}
    >
      {/* View principal, para empilhar conteúdo */}
      <View style={{ flex: 1 }}>
        {/* Ícone de sininho no canto superior direito */}
        <View style={styles.notificationContainer}>
          <TouchableOpacity style={styles.notifButton} onPress={openNotificationsModal}>
            <FontAwesome5 name="bell" size={26} color="#FFF" />
            {notificationCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{notificationCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.container}>
          {/* Logo */}
          <Animated.Image
            source={require("../../assets/images/logo.jpg")}
            style={[styles.logo, { transform: [{ scale: scaleAnim }] }]}
            resizeMode="contain"
          />

          <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>
            {t("home.welcome", { username: userName })}
          </Animated.Text>

          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>{t("home.stats.total_matches")}</Text>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{winsCount}</Text>
                <Text style={styles.statLabel}>{t("home.stats.wins")}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{lossesCount}</Text>
                <Text style={styles.statLabel}>{t("home.stats.losses")}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{drawCount}</Text>
                <Text style={styles.statLabel}>{t("home.stats.draws")}</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{total}</Text>
                <Text style={styles.statLabel}>{t("home.stats.total_matches")}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{wr}%</Text>
                <Text style={styles.statLabel}>{t("home.stats.winrate")}</Text>
              </View>
            </View>

            <View style={styles.rivalContainer}>
              <Text style={styles.rivalLabel}>{t("home.stats.rival")}:</Text>
              <Text style={styles.rivalValue}>{biggestRival}</Text>
            </View>
          </View>

          <View style={styles.buttonsContainer}>
            <TouchableOpacity style={styles.collectionsButton} onPress={openCollectionModal}>
              <Text style={styles.collectionsButtonText}>
                {t("home.buttons.collections", "Coleções Validas")}
              </Text>
            </TouchableOpacity>

            <View style={styles.bottomButtonsRow}>
              <TouchableOpacity
                style={styles.donateButton}
                onPress={() => Linking.openURL("https://picpay.me/marco.macedo10/0.5")}
              >
                <Text style={styles.donateText}>{t("home.buttons.donate", "Doar")}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>{t("home.buttons.logout")}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Modal de Coleções */}
          <Modal visible={collectionsModalVisible} animationType="slide">
            <ScrollView contentContainerStyle={styles.modalContainer}>
              <Text style={styles.modalTitle}>
                {t("home.collections_modal.title", "Coleções Válidas")}
              </Text>
              {loadingCollections ? (
                <ActivityIndicator size="large" color="#E3350D" />
              ) : (
                validCollections.map((set) => (
                  <View key={set.id} style={styles.collectionCard}>
                    <Text style={styles.collectionName}>{set.name}</Text>
                    <Text style={styles.collectionSeries}>{set.series}</Text>
                  </View>
                ))
              )}
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={closeCollectionModal}
              >
                <Text style={styles.modalCloseButtonText}>{t("common.close")}</Text>
              </TouchableOpacity>
            </ScrollView>
          </Modal>
        </ScrollView>
      </View>

      {/* Modal de Notificações */}
      <Modal visible={notifModalVisible} animationType="slide" transparent>
        <View style={styles.notifModalOverlay}>
          <View style={styles.notifModalContainer}>
            <Text style={styles.notifModalTitle}>Notificações</Text>

            {notifications.length === 0 ? (
              <Text style={styles.noNotifText}>Nenhuma notificação</Text>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => String(item.id)}
                style={{ maxHeight: 300, marginBottom: 20 }}
                renderItem={({ item }) => (
                  <View style={styles.notifCard}>
                    <Text style={styles.notifCardTitle}>{item.title}</Text>
                    <Text style={styles.notifCardBody}>{item.body}</Text>
                  </View>
                )}
              />
            )}

            <View style={styles.notifModalButtonsRow}>
              <TouchableOpacity
                style={[styles.notifBtn, { backgroundColor: "#999" }]}
                onPress={clearNotifications}
              >
                <Text style={styles.notifBtnText}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.notifBtn, { backgroundColor: "#E3350D" }]}
                onPress={closeNotificationsModal}
              >
                <Text style={styles.notifBtnText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    resizeMode: "cover",
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
    alignItems: "center",
  },
  notificationContainer: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 999,
  },
  notifButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  notifBadge: {
    backgroundColor: "#E3350D",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  notifBadgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  container: {
    flexGrow: 1,
    alignItems: "center",
    padding: 20,
  },
  logo: {
    width: 120,
    height: 120,
    marginTop: 40,
    marginBottom: 20,
  },
  title: {
    color: "#E3350D",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 20,
    textTransform: "uppercase",
  },
  statsSection: {
    width: "100%",
    padding: 15,
    backgroundColor: "rgba(42,42,42,0.9)",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#4D4D4D",
    marginBottom: 20,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 10,
  },
  statCard: {
    backgroundColor: "#292929",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: "center",
    width: 90,
    borderWidth: 1.5,
    borderColor: "#E3350D",
  },
  statNumber: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  statLabel: {
    color: "#D9D9D9",
    fontSize: 14,
    textAlign: "center",
    marginTop: 5,
  },
  rivalContainer: {
    marginTop: 10,
    alignItems: "center",
  },
  rivalLabel: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  rivalValue: {
    color: "#E3350D",
    fontSize: 16,
    marginTop: 5,
    textAlign: "center",
  },
  buttonsContainer: {
    alignItems: "center",
    marginTop: 20,
    width: "100%",
  },
  collectionsButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#FFF",
    marginBottom: 10,
  },
  collectionsButtonText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  bottomButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 20,
  },
  donateButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: "#E3350D",
    alignItems: "center",
  },
  donateText: {
    color: "#E3350D",
    fontWeight: "bold",
    fontSize: 16,
  },
  logoutButton: {
    flex: 1,
    backgroundColor: "#E3350D",
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 10,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
  },
  logoutText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  modalContainer: {
    flexGrow: 1,
    backgroundColor: "#1E1E1E",
    alignItems: "center",
    padding: 20,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 20,
  },
  collectionCard: {
    backgroundColor: "#333",
    width: "100%",
    padding: 20,
    borderRadius: 8,
    marginBottom: 15,
  },
  collectionName: {
    fontSize: 18,
    color: "#FFF",
    fontWeight: "bold",
    marginBottom: 6,
  },
  collectionSeries: {
    color: "#CCC",
    fontSize: 14,
  },
  modalCloseButton: {
    backgroundColor: "#E3350D",
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
    alignSelf: "center",
  },
  modalCloseButtonText: {
    color: "#FFF",
    textAlign: "center",
    fontWeight: "bold",
  },

  // Modal de Notificações
  notifModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  notifModalContainer: {
    width: "80%",
    backgroundColor: "#1E1E1E",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  },
  notifModalTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  notifModalButtonsRow: {
    flexDirection: "row",
    marginTop: 10,
  },
  notifBtn: {
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  notifBtnText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  noNotifText: {
    color: "#ccc",
    fontStyle: "italic",
    marginTop: 8,
    marginBottom: 16,
  },
  notifCard: {
    backgroundColor: "#333",
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
  },
  notifCardTitle: {
    color: "#E3350D",
    fontSize: 16,
    fontWeight: "bold",
  },
  notifCardBody: {
    color: "#FFF",
    fontSize: 14,
    marginTop: 4,
  },
});
