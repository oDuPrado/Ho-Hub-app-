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
  Linking, // Import para abrir link de doação
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { signOut } from "firebase/auth";

import { auth, db } from "../../lib/firebaseConfig";
import { collectionGroup, getDocs, doc, getDoc } from "firebase/firestore";

interface MatchData {
  player1_id: string;
  player2_id: string;
  outcomeNumber: number;
  outcome: string;
}

/**
 * Tela Home com tema baseado em uma Pokébola:
 * - Fundo BRANCO
 * - Destaques em VERMELHO e PRETO
 * - Botão de Doar e Logout
 * - Estatísticas de vitórias, derrotas, empates, maior rival etc.
 */
export default function HomeScreen() {
  const router = useRouter();

  const [userName, setUserName] = useState("...");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  const [winsCount, setWinsCount] = useState(0);
  const [lossesCount, setLossesCount] = useState(0);
  const [drawCount, setDrawCount] = useState(0);
  const [biggestRival, setBiggestRival] = useState("...");
  const [matchesTotal, setMatchesTotal] = useState(0);

  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    (async () => {
      try {
        // Lê do AsyncStorage
        const storedId = await AsyncStorage.getItem("@userId");
        const storedName = await AsyncStorage.getItem("@userName");
        if (!storedId) {
          // Se não estiver logado, redireciona
          router.replace("/(auth)/login");
          return;
        }
        setUserId(storedId);
        setUserName(storedName || "Jogador");

        // Carrega estatísticas do Firestore
        await loadStats(storedId);

        // Animações de fade e loop no scale
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
  }, [fadeAnim, scaleAnim]);

  /** Carrega todas as matches do usuário e computa estatísticas. */
  async function loadStats(uId: string) {
    // Perfomance: se houver muitos torneios, poderia usar index/queries mais refinadas
    const matchesRef = collectionGroup(db, "matches");
    const snap = await getDocs(matchesRef);

    let arrMatches: MatchData[] = [];
    snap.forEach((docSnap) => {
      const m = docSnap.data() as MatchData;
      arrMatches.push(m);
    });

    // Filtra do user
    let userMatches = arrMatches.filter(
      (m) => m.player1_id === uId || m.player2_id === uId
    );

    // Conta vitórias, derrotas, empates, e maior rival
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
        // Derrota dupla => conta como "derrota" (ou ignora, a critério)
        l++;
      }
    });

    setWinsCount(w);
    setLossesCount(l);
    setDrawCount(d);
    setMatchesTotal(userMatches.length);

    // Acha o rival
    let max = 0;
    let rivalMax = "";
    for (let rid of Object.keys(rivalCount)) {
      if (rivalCount[rid] > max) {
        max = rivalCount[rid];
        rivalMax = rid;
      }
    }
    if (!rivalMax) {
      setBiggestRival("Nenhum rival encontrado");
    } else {
      // Carrega nome do rival
      const docSnap = await getDoc(doc(db, "players", rivalMax));
      if (!docSnap.exists()) {
        setBiggestRival(`Jogador ${rivalMax} (${max} partidas)`);
      } else {
        const data = docSnap.data();
        const rName = data.fullname || `Jogador ${rivalMax}`;
        setBiggestRival(`${rName} (${max} partidas)`);
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
      Alert.alert("Erro", "Não foi possível sair.");
      console.log(err);
    }
  }

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#E3350D" />
      </View>
    );
  }

  // Calcula WinRate
  const total = matchesTotal;
  const wr = total > 0 ? ((winsCount / total) * 100).toFixed(1) : "0";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Logo animada */}
      <Animated.Image
        source={require("../../assets/images/pokemon_ms_logo.jpg")}
        style={[styles.logo, { transform: [{ scale: scaleAnim }] }]}
        resizeMode="contain"
      />

      {/* Título animado */}
      <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>
        Bem-vindo, {userName}!
      </Animated.Text>

      {/* Estatísticas */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Suas Estatísticas</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{winsCount}</Text>
            <Text style={styles.statLabel}>Vitórias</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{lossesCount}</Text>
            <Text style={styles.statLabel}>Derrotas</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{drawCount}</Text>
            <Text style={styles.statLabel}>Empates</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{total}</Text>
            <Text style={styles.statLabel}>Partidas</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{wr}%</Text>
            <Text style={styles.statLabel}>Winrate</Text>
          </View>
        </View>

        <View style={styles.rivalContainer}>
          <Text style={styles.rivalLabel}>Maior Rival:</Text>
          <Text style={styles.rivalValue}>{biggestRival}</Text>
        </View>
      </View>

      {/* Botões */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={styles.donateButton}
          onPress={() =>
            Linking.openURL("https://picpay.me/marco.macedo10/0.5")
          }
        >
          <Text style={styles.donateText}>Doar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const BACKGROUND = "#1E1E1E"; // Fundo escuro para visual competitivo
const PRIMARY = "#E3350D"; // Vermelho intenso
const SECONDARY = "#FFFFFF"; // Branco para contraste
const ACCENT = "#FF6F61"; // Vermelho mais claro para detalhes
const CARD_BORDER = "#4D4D4D"; // Cinza metálico para bordas

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    backgroundColor: BACKGROUND,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flexGrow: 1,
    backgroundColor: BACKGROUND,
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
    color: PRIMARY,
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 20,
    textTransform: "uppercase", // Deixa o título em maiúsculas
  },
  statsSection: {
    width: "100%",
    padding: 15,
    backgroundColor: "#2A2A2A", // Cinza escuro para destacar
    borderRadius: 8, // Bordas mais discretas
    borderWidth: 1.5,
    borderColor: CARD_BORDER,
    marginBottom: 20,
  },
  sectionTitle: {
    color: SECONDARY,
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between", // Espaçamento uniforme
    marginVertical: 10,
  },
  statCard: {
    backgroundColor: "#292929", // Fundo mais escuro
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: "center",
    width: 90,
    borderWidth: 1.5,
    borderColor: PRIMARY,
  },
  statNumber: {
    color: SECONDARY,
    fontSize: 20,
    fontWeight: "bold",
  },
  statLabel: {
    color: "#D9D9D9", // Cinza claro para descrição
    fontSize: 14,
    textAlign: "center",
    marginTop: 5,
  },
  rivalContainer: {
    marginTop: 10,
    alignItems: "center",
  },
  rivalLabel: {
    color: SECONDARY,
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },
  rivalValue: {
    color: PRIMARY,
    fontSize: 16,
    marginTop: 5,
    textAlign: "center",
  },
  buttonsContainer: {
    flexDirection: "row",
    marginTop: 20,
    justifyContent: "space-between", // Mantém os botões afastados
  },
  donateButton: {
    backgroundColor: SECONDARY, // Branco
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    marginHorizontal: 10,
    borderWidth: 1.5,
    borderColor: PRIMARY,
  },
  donateText: {
    color: PRIMARY,
    fontWeight: "bold",
    fontSize: 16,
  },
  logoutButton: {
    backgroundColor: PRIMARY, // Vermelho intenso
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    marginHorizontal: 10,
    borderWidth: 1.5,
    borderColor: SECONDARY,
  },
  logoutText: {
    color: SECONDARY, // Branco
    fontWeight: "bold",
    fontSize: 16,
  },
});
