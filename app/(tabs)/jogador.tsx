// app/(tabs)/jogador.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { doc, getDoc, collectionGroup, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";

// Importa o types e o array de títulos
import titles, { TitleItem, PlayerStats } from "../titlesConfig";

interface MatchData {
  id: string;
  outcomeNumber?: number;
  player1_id?: string;
  player2_id?: string;
}

/** Exemplo de página Jogador: sem histórico completo, mas com títulos e exibição básica */
export default function PlayerScreen() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("Jogador");
  const [loading, setLoading] = useState(true);

  // Agora PlayerStats terá **todos** os campos do titlesConfig.ts:
  const [stats, setStats] = useState<PlayerStats>({
    wins: 0,
    losses: 0,
    draws: 0,
    matchesTotal: 0,
    tournamentsPlayed: 0,
    top8Count: 0,
    positiveStreak: 0,
    negativeStreak: 0,
    uniqueOpponents: 0,
    comebackWins: 0,
    flawlessTournamentWins: 0,
    regionalWins: 0,
    bigTournamentWins: 0,
    helpedBeginners: 0,
    luckyWins: 0,
    memeDeckWins: 0,
    matchesAfterMidnight: 0,
    matchesAfterMidnightWins: 0,
    ownedTitlesCount: 0,
    beatAllPlayersInTournament: 0,
    firstTournamentWinner: false,
    firstAchieved: false,
  });

  // Rival
  const [mainRivalName, setMainRivalName] = useState("");
  // Busca "VS Jogador"
  const [searchId, setSearchId] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [confrontationData, setConfrontationData] = useState({
    total: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    rivalName: "",
  });

  // Títulos
  const [unlockedTitles, setUnlockedTitles] = useState<TitleItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const storedId = await AsyncStorage.getItem("@userId");
        const storedName = await AsyncStorage.getItem("@userName");
        if (!storedId) {
          router.replace("/(auth)/login");
          return;
        }
        setUserId(storedId);
        setUserName(storedName ?? "Jogador");

        // Carrega estatísticas
        const loadedStats = await loadStats(storedId);
        setStats(loadedStats);

        // Rival principal
        const rivalNm = await findMainRival(storedId);
        setMainRivalName(rivalNm ?? "Nenhum Rival");

        // Títulos
        const titlesUnlocked = computeTitles(loadedStats);
        setUnlockedTitles(titlesUnlocked);
      } catch (e) {
        console.log("Erro jogador init:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  /** 1) Carrega as Matches no Firestore e computa Stats */
  async function loadStats(uId: string): Promise<PlayerStats> {
    const arrMatches = await fetchAllMatches();
    const userMatches = arrMatches.filter(
      (m) => m.player1_id === uId || m.player2_id === uId
    );
    return computeBasicStats(uId, userMatches);
  }

  async function fetchAllMatches(): Promise<MatchData[]> {
    const snap = await getDocs(collectionGroup(db, "matches"));
    const arr: MatchData[] = [];
    snap.forEach((d) => {
      arr.push({ id: d.id, ...d.data() } as MatchData);
    });
    return arr;
  }

  /**
   * 2) Com base nas matches do usuário, preenche "todos" os campos do PlayerStats.
   *    Se alguns campos não são calculados, define 0 ou valor default.
   */
  function computeBasicStats(
    uId: string,
    userMatches: MatchData[]
  ): PlayerStats {
    let w = 0,
      l = 0,
      d = 0;
    let oppSet = new Set<string>();

    // Exemplos de contadores extras p/ titles:
    let cWins = 0;
    let flawlessWins = 0;
    let regWins = 0;
    let bigWins = 0;
    let helpBeg = 0;
    let luckW = 0;
    let memeW = 0;
    let afterMid = 0;
    let afterMidW = 0;
    let ownedTitles = 0;
    let beatAll = 0;
    let firstTw = false;

    userMatches.forEach((match) => {
      const { outcomeNumber, player1_id, player2_id } = match;
      if (!outcomeNumber) return;
      const isP1 = player1_id === uId;
      const rivalId = isP1 ? player2_id : player1_id;
      if (rivalId && rivalId !== "N/A") {
        oppSet.add(rivalId);
      }

      switch (outcomeNumber) {
        case 1: // Vit p1
          isP1 ? w++ : l++;
          break;
        case 2: // Vit p2
          isP1 ? l++ : w++;
          break;
        case 3:
          d++;
          break;
        case 10:
          l++;
          break;
      }
    });

    // Preenche PlayerStats completo
    return {
      wins: w,
      losses: l,
      draws: d,
      matchesTotal: userMatches.length,
      uniqueOpponents: oppSet.size,

      // Campos que não calculamos ainda -> 0 ou false
      tournamentsPlayed: 0,
      top8Count: 0,
      positiveStreak: 0,
      negativeStreak: 0,
      comebackWins: cWins,
      flawlessTournamentWins: flawlessWins,
      regionalWins: regWins,
      bigTournamentWins: bigWins,
      helpedBeginners: helpBeg,
      luckyWins: luckW,
      memeDeckWins: memeW,
      matchesAfterMidnight: afterMid,
      matchesAfterMidnightWins: afterMidW,
      ownedTitlesCount: ownedTitles,
      beatAllPlayersInTournament: beatAll,
      firstTournamentWinner: firstTw,
      firstAchieved: false,
    };
  }

  /** 3) Busca Rival principal */
  async function findMainRival(uId: string): Promise<string | null> {
    const arrMatches = await fetchAllMatches();
    const userMatches = arrMatches.filter(
      (m) => m.player1_id === uId || m.player2_id === uId
    );
    const countMap: Record<string, number> = {};
    let topRival = "";
    let topCount = 0;

    for (let m of userMatches) {
      const rid = m.player1_id === uId ? m.player2_id : m.player1_id;
      if (rid && rid !== "N/A") {
        countMap[rid] = (countMap[rid] ?? 0) + 1;
        if (countMap[rid] > topCount) {
          topCount = countMap[rid];
          topRival = rid;
        }
      }
    }
    if (!topRival) return null;
    const docRef = doc(db, "players", topRival);
    const snapRival = await getDoc(docRef);
    if (!snapRival.exists()) return null;
    const d = snapRival.data();
    return d.fullname ?? `ID ${topRival}`;
  }

  /** 4) Computa títulos */
  function computeTitles(ps: PlayerStats): TitleItem[] {
    const unlocked: TitleItem[] = [];
    for (let t of titles) {
      if (t.condition(ps)) {
        unlocked.push(t);
      }
    }
    return unlocked;
  }

  /** 5) Buscar Confronto vs outro ID (Modal) */
  async function handleSearch() {
    if (!searchId) {
      Alert.alert("Erro", "Digite um ID");
      return;
    }
    try {
      const pRef = doc(db, "players", searchId);
      const pSnap = await getDoc(pRef);
      if (!pSnap.exists()) {
        Alert.alert("Erro", "Jogador não encontrado");
        return;
      }
      const rivalData = pSnap.data();
      const rivalName = rivalData.fullname ?? `ID ${searchId}`;

      const arrMatches = await fetchAllMatches();
      const directMatches = arrMatches.filter(
        (m) =>
          (m.player1_id === userId && m.player2_id === searchId) ||
          (m.player2_id === userId && m.player1_id === searchId)
      );

      if (directMatches.length === 0) {
        Alert.alert("Confronto", `Nenhum jogo contra ${rivalName}`);
        return;
      }

      let w = 0,
        l = 0,
        dr = 0;
      directMatches.forEach((mm) => {
        if (!mm.outcomeNumber) return;
        const isP1 = mm.player1_id === userId;
        switch (mm.outcomeNumber) {
          case 1:
            isP1 ? w++ : l++;
            break;
          case 2:
            isP1 ? l++ : w++;
            break;
          case 3:
            dr++;
            break;
          case 10:
            l++;
            break;
        }
      });

      setConfrontationData({
        total: directMatches.length,
        wins: w,
        losses: l,
        draws: dr,
        rivalName,
      });
      setModalVisible(true);
    } catch (err) {
      console.log("handleSearch error:", err);
      Alert.alert("Erro", "Falha na busca");
    }
  }

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={RED} />
      </View>
    );
  }

  // Exemplo de WinRate
  const wr =
    stats.matchesTotal > 0
      ? ((stats.wins / stats.matchesTotal) * 100).toFixed(1)
      : "0";

  return (
    <ScrollView style={styles.mainContainer}>
      {/* MODAL (Confronto) */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              VS {confrontationData.rivalName}
            </Text>
            <Text style={styles.modalStats}>
              Partidas: {confrontationData.total} | Vitórias:{" "}
              {confrontationData.wins} | Derrotas: {confrontationData.losses} |
              Empates: {confrontationData.draws}
            </Text>
            <Pressable
              style={styles.closeModalBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeModalText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Text style={styles.title}>{userName}</Text>

      {/* Stats */}
      <View style={styles.statsBox}>
        <Text style={styles.lineText}>Vitórias: {stats.wins}</Text>
        <Text style={styles.lineText}>Derrotas: {stats.losses}</Text>
        <Text style={styles.lineText}>Empates: {stats.draws}</Text>
        <Text style={styles.lineText}>Partidas: {stats.matchesTotal}</Text>
        <Text style={styles.lineText}>WinRate: {wr}%</Text>
        <Text style={styles.lineText}>
          Oponentes Únicos: {stats.uniqueOpponents}
        </Text>
        <Text style={styles.lineText}>Rival: {mainRivalName}</Text>
      </View>

      {/* Buscar Confronto */}
      <View style={styles.searchBox}>
        <Text style={styles.searchTitle}>Buscar VS Jogador</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="ID do outro jogador"
          placeholderTextColor="#999"
          value={searchId}
          onChangeText={setSearchId}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>Buscar</Text>
        </TouchableOpacity>
      </View>

      {/* Títulos */}
      <View style={styles.titlesBox}>
        <Text style={styles.titlesHeader}>Títulos Desbloqueados</Text>
        {unlockedTitles.length === 0 ? (
          <Text style={styles.emptyTitles}>
            Nenhum título desbloqueado ainda.
          </Text>
        ) : (
          <ScrollView
            style={styles.titlesScroll}
            contentContainerStyle={styles.titlesContainer}
          >
            {unlockedTitles.map((t) => (
              <View key={t.id} style={styles.titleCard}>
                <Text style={styles.titleCardName}>{t.title}</Text>
                <Text style={styles.titleCardDesc}>{t.description}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </ScrollView>
  );
}

// ===================== STYLES ========================
const DARK_BG = "#1E1E1E"; // Fundo escuro
const PRIMARY = "#E3350D"; // Vermelho intenso
const SECONDARY = "#FFFFFF"; // Texto claro
const CARD_BG = "#292929"; // Fundo dos cards
const BORDER_COLOR = "#4D4D4D"; // Cor das bordas
const RED = "#E3350D"; // Vermelho pokébola

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    backgroundColor: DARK_BG,
    justifyContent: "center",
    alignItems: "center",
  },
  mainContainer: {
    flex: 1,
    backgroundColor: DARK_BG,
    padding: 16,
  },
  title: {
    color: PRIMARY,
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    textTransform: "uppercase",
  },
  statsBox: {
    backgroundColor: CARD_BG,
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  lineText: {
    color: SECONDARY,
    fontSize: 16,
    marginBottom: 4,
  },

  titlesScroll: {
    maxHeight: 300, // Define uma altura máxima para o scroll de títulos
    marginTop: 10,
  },
  titlesContainer: {
    paddingBottom: 10,
  },

  titlesBox: {
    backgroundColor: CARD_BG,
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  titlesHeader: {
    color: PRIMARY,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  emptyTitles: {
    color: SECONDARY,
    fontSize: 14,
    textAlign: "center",
  },
  titleCard: {
    backgroundColor: DARK_BG,
    borderColor: PRIMARY,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  titleCardName: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  titleCardDesc: {
    color: SECONDARY,
    fontSize: 14,
  },
  searchBox: {
    backgroundColor: CARD_BG,
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  searchTitle: {
    color: PRIMARY,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  searchInput: {
    borderColor: PRIMARY,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    color: SECONDARY,
    backgroundColor: DARK_BG,
    marginBottom: 10,
  },
  searchBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  searchBtnText: {
    color: SECONDARY,
    fontWeight: "bold",
    fontSize: 16,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  modalTitle: {
    color: PRIMARY,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  modalStats: {
    color: SECONDARY,
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  closeModalBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: "center",
  },
  closeModalText: {
    color: SECONDARY,
    fontWeight: "bold",
    fontSize: 16,
  },
});
