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
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { signOut } from "firebase/auth";
import { auth, db } from "../../lib/firebaseConfig";
import { collectionGroup, getDocs, doc, getDoc } from "firebase/firestore";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next"; // <--- i18n

interface MatchData {
  player1_id: string;
  player2_id: string;
  outcomeNumber: number;
  outcome: string;
}
interface CollectionData {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  legalities: {
    standard?: string;
  };
  ptcgoCode: string;
  releaseDate: string;
  images: {
    symbol: string;
    logo: string;
  };
  rotationDate?: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation(); // <--- i18n

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

  const [collectionsModalVisible, setCollectionsModalVisible] = useState(false);
  const [validCollections, setValidCollections] = useState<CollectionData[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);

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
      };
      fetchData();
      return () => {};
    }, [router])
  );

  async function loadStats(uId: string) {
    const matchesRef = collectionGroup(db, "matches");
    const snap = await getDocs(matchesRef);

    let arrMatches: MatchData[] = [];
    snap.forEach((docSnap) => {
      const m = docSnap.data() as MatchData;
      arrMatches.push(m);
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

  async function loadValidCollections() {
    setLoadingCollections(true);
    try {
      const response = await fetch("https://api.pokemontcg.io/v2/sets");
      const data = await response.json();

      if (data && data.data) {
        const validSets = data.data.filter(
          (set: CollectionData) => set.legalities?.standard === "Legal"
        );

        const setsWithRotation = validSets.map((set: CollectionData) => {
          try {
            if (!set.releaseDate) {
              return { ...set, rotationDate: t("home.collections_modal.error_loading") };
            }
            const [year, month, day] = set.releaseDate.split("/").map(Number);
            if (!year || !month || !day) {
              return { ...set, rotationDate: "Indefinida" };
            }
            const releaseDateFormatted = `${day
              .toString()
              .padStart(2, "0")}/${month.toString().padStart(2, "0")}/${year}`;

            const rotationYear = month === 1 ? year + 2 : year + 3;

            return {
              ...set,
              releaseDate: releaseDateFormatted,
              rotationDate: `${rotationYear}`,
            };
          } catch (error) {
            console.error(`Erro ao calcular rotação:`, error);
            return { ...set, rotationDate: "Erro" };
          }
        });

        setValidCollections(setsWithRotation);
      }
    } catch (error) {
      console.error("Erro ao carregar coleções válidas:", error);
    } finally {
      setLoadingCollections(false);
    }
  }

  function openCollectionModal() {
    setCollectionsModalVisible(true);
    loadValidCollections();
  }
  function closeCollectionModal() {
    setCollectionsModalVisible(false);
  }

  function openCollectionPage(name: string) {
    const formattedName = name.replace(/\s+/g, "-");
    const url = `https://www.pokellector.com/${formattedName}-Expansion/`;
    Linking.openURL(url);
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
    <ScrollView contentContainerStyle={styles.container}>
      <Animated.Image
        source={require("../../assets/images/pokemon_ms_logo.jpg")}
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
            onPress={() =>
              Linking.openURL("https://picpay.me/marco.macedo10/0.5")
            }
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
          <Text style={styles.modalTitle}>{t("home.collections_modal.title")}</Text>
          {loadingCollections ? (
            <ActivityIndicator size="large" color="#E3350D" />
          ) : (
            validCollections.map((set) => (
              <TouchableOpacity
                key={set.id}
                style={styles.collectionCard}
                onPress={() => openCollectionPage(set.name)}
              >
                <View style={styles.collectionHeader}>
                  <Image
                    source={{ uri: set.images.symbol }}
                    style={styles.collectionImage}
                  />
                  <Text style={styles.collectionName}>{set.name}</Text>
                </View>
                <Text style={styles.collectionSeries}>
                  {t("home.collections_modal.serie")}: {set.series}
                </Text>
                <Text style={styles.collectionTotal}>
                  {t("home.collections_modal.total_cards")}: {set.total}
                </Text>
                <Text style={styles.collectionReleaseDate}>
                  {t("home.collections_modal.released")}: {set.releaseDate}
                </Text>
                <Text style={styles.collectionRotationDate}>
                  {t("home.collections_modal.rotation")}: {set.rotationDate}
                </Text>
              </TouchableOpacity>
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
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flexGrow: 1,
    backgroundColor: "#1E1E1E",
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
    backgroundColor: "#2A2A2A",
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
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 5,
    elevation: 3,
    marginBottom: 15,
  },
  collectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  collectionImage: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  collectionName: {
    fontSize: 18,
    color: "#FFF",
    fontWeight: "bold",
    flex: 1,
    textAlign: "left",
  },
  collectionSeries: {
    color: "#CCC",
    fontSize: 14,
  },
  collectionTotal: {
    color: "#CCC",
    fontSize: 14,
  },
  collectionReleaseDate: {
    color: "#CCC",
    fontSize: 14,
  },
  collectionRotationDate: {
    color: "#4CAF50",
    fontSize: 14,
    fontWeight: "bold",
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
});
