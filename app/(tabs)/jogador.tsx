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
import {
  doc,
  getDoc,
  getDocs,
  collectionGroup,
  collection,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";
import titles, { TitleItem, PlayerStats } from "../titlesConfig";

/** Estrutura p/ dados de partidas. */
interface MatchData {
  id: string;
  outcomeNumber?: number;
  player1_id?: string;
  player2_id?: string;
}

/** Estrutura p/ histórico de torneios (subcoleção `places`). */
interface TournamentHistoryItem {
  tournamentId: string;
  tournamentName: string;
  place: number;
  totalPlayers: number;
  roundCount: number;
}

/** Estrutura p/ dados de jogador ao buscar no Firestore. */
interface PlayerInfo {
  userid: string;
  fullname: string;
}

/** Estrutura p/ rivalidade. */
interface RivalryData {
  matchesCount: number;
  wins: number;
  losses: number;
  draws: number;
  rivalryFactor: number;
  rivalName: string;
}

export default function PlayerScreen() {
  const router = useRouter();

  // ID e Nome do usuário
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("Jogador");

  const [loading, setLoading] = useState(true);

  // Estatísticas
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

  // Sequência de vitórias (matches) e derrotas (matches)
  const [winStreak, setWinStreak] = useState(0);
  const [lossStreak, setLossStreak] = useState(0);

  // Títulos
  const [unlockedTitles, setUnlockedTitles] = useState<TitleItem[]>([]);

  // Modal de histórico
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<TournamentHistoryItem[]>([]);

  // Barra de busca de jogador
  const [searchText, setSearchText] = useState("");
  const [playersResult, setPlayersResult] = useState<PlayerInfo[]>([]);
  // Modal Rival
  const [rivalModalVisible, setRivalModalVisible] = useState(false);
  const [rivalData, setRivalData] = useState<RivalryData | null>(null);

  // ===========================
  // Montagem da tela
  // ===========================
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // Carrega do AsyncStorage
        const storedId = await AsyncStorage.getItem("@userId");
        const storedName = await AsyncStorage.getItem("@userName");
        if (!storedId) {
          router.replace("/(auth)/login");
          return;
        }
        setUserId(storedId);
        setUserName(storedName ?? "Jogador");

        // Carrega matches e computa stats
        const allMatches = await fetchAllMatches();
        const userMatches = allMatches.filter(
          (m) => m.player1_id === storedId || m.player2_id === storedId
        );

        const computedStats = computeBasicStats(storedId, userMatches);
        setStats(computedStats);

        // Computa streaks (uma abordagem simplificada)
        const { wStreak, lStreak } = computeMatchStreaks(storedId, userMatches);
        setWinStreak(wStreak);
        setLossStreak(lStreak);

        // Títulos
        const titlesUnlocked = computeTitles(computedStats);
        setUnlockedTitles(titlesUnlocked);
      } catch (err) {
        console.log("Erro init:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // ===========================
  // BUSCA DE MATCHES / STATS
  // ===========================
  async function fetchAllMatches(): Promise<MatchData[]> {
    const snap = await getDocs(collectionGroup(db, "matches"));
    const arr: MatchData[] = [];
    snap.forEach((docSnap) => {
      arr.push({ id: docSnap.id, ...docSnap.data() } as MatchData);
    });
    return arr;
  }

  function computeBasicStats(
    uId: string,
    userMatches: MatchData[]
  ): PlayerStats {
    let w = 0,
      l = 0,
      d = 0;
    const oppSet = new Set<string>();

    userMatches.forEach((mm) => {
      if (!mm.outcomeNumber) return;
      const isP1 = mm.player1_id === uId;
      const rivalId = isP1 ? mm.player2_id : mm.player1_id;
      if (rivalId && rivalId !== "N/A") oppSet.add(rivalId);

      switch (mm.outcomeNumber) {
        case 1:
          isP1 ? w++ : l++;
          break;
        case 2:
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

    return {
      wins: w,
      losses: l,
      draws: d,
      matchesTotal: userMatches.length,
      uniqueOpponents: oppSet.size,

      tournamentsPlayed: 0,
      top8Count: 0,
      positiveStreak: 0,
      negativeStreak: 0,
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
    };
  }

  /**
   * Computa uma “sequência” de vitórias/derrotas simplificada.
   * Sem data/hora, faremos:
   *  - Ordena userMatches pelo id (não é ideal, mas exemplifica).
   *  - Varre e soma consecutivos.
   */
  function computeMatchStreaks(uId: string, userMatches: MatchData[]) {
    // Ordena “arbitrariamente” pelo ID da match
    userMatches.sort((a, b) => (a.id < b.id ? -1 : 1));

    let bestWin = 0,
      bestLoss = 0;
    let currWin = 0,
      currLoss = 0;

    for (const mm of userMatches) {
      if (!mm.outcomeNumber) continue;
      const isP1 = mm.player1_id === uId;
      let isWin = false;
      if (mm.outcomeNumber === 1 && isP1) isWin = true;
      else if (mm.outcomeNumber === 2 && !isP1) isWin = true;

      if (isWin) {
        currWin++;
        bestWin = Math.max(bestWin, currWin);
        // Assim que vence, zera sequência de derrotas
        currLoss = 0;
      } else {
        currLoss++;
        bestLoss = Math.max(bestLoss, currLoss);
        // Assim que perde, zera sequência de vitórias
        currWin = 0;
      }
    }

    return { wStreak: bestWin, lStreak: bestLoss };
  }

  function computeTitles(ps: PlayerStats): TitleItem[] {
    const result: TitleItem[] = [];
    for (let t of titles) {
      if (t.condition(ps)) result.push(t);
    }
    return result;
  }

  // ===========================
  // HISTÓRICO DE TORNEIOS
  // ===========================
  const [historyError, setHistoryError] = useState("");

  async function handleShowHistory() {
    setHistoryModalVisible(true);
    setHistoryLoading(true);
    try {
      const arr = await fetchTournamentPlaces(userId);
      setHistoryData(arr);
      if (arr.length === 0) {
        setHistoryError("Nenhum torneio encontrado para você.");
      } else {
        setHistoryError("");
      }
    } catch (err) {
      console.log("Erro handleShowHistory:", err);
      setHistoryError("Falha ao carregar histórico.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function fetchTournamentPlaces(
    uId: string
  ): Promise<TournamentHistoryItem[]> {
    const placesDocs = await getDocs(collectionGroup(db, "places"));
    const userPlaces = placesDocs.docs.filter((docSnap) => {
      const d = docSnap.data();
      return d.userid === uId; // se for do user
    });

    const results: TournamentHistoryItem[] = [];

    // Monta info p/ cada doc
    for (const docSnap of userPlaces) {
      const data = docSnap.data();
      const placeNum = parseInt(docSnap.id, 10) || 0;

      // path: "tournaments/{tId}/places/{docId}"
      const pathParts = docSnap.ref.path.split("/");
      const tId = pathParts[1]; // doc tournaments/tId

      // Tenta nome do torneio
      let tournamentName = tId;
      // se doc principal tiver "nome"
      try {
        const tDoc = await getDoc(doc(db, "tournaments", tId));
        if (tDoc.exists()) {
          const tData = tDoc.data();
          if (tData.name) tournamentName = tData.name;
        }
      } catch {
        // ignora
      }

      // totalPlayers = count "places"
      const totalPlayers = await countPlacesInTournament(tId);
      // roundCount = count "rounds"
      const roundCount = await countRoundsInTournament(tId);

      results.push({
        tournamentId: tId,
        tournamentName,
        place: placeNum,
        totalPlayers,
        roundCount,
      });
    }

    // Ordena por place ASC
    results.sort((a, b) => a.place - b.place);

    return results;
  }

  async function countPlacesInTournament(tId: string): Promise<number> {
    try {
      const snap = await getDocs(collection(db, "tournaments", tId, "places"));
      return snap.size;
    } catch {
      return 0;
    }
  }
  async function countRoundsInTournament(tId: string): Promise<number> {
    try {
      const snap = await getDocs(collection(db, "tournaments", tId, "rounds"));
      return snap.size;
    } catch {
      return 0;
    }
  }

  // ===========================
  // BUSCA DE JOGADOR p/ Rival
  // ===========================
  const [playerSearchLoading, setPlayerSearchLoading] = useState(false);

  async function handleSearchPlayers() {
    if (!searchText.trim()) {
      Alert.alert("Digite algo para buscar.");
      return;
    }
    try {
      setPlayerSearchLoading(true);
      // Faz query em "players" p/ fullname contendo searchText
      // ex.: where("fullname", ">=", searchText).where("fullname", "<=", searchText + "\uf8ff")
      // Mas se no Firestore não tiver index, dá erro. Faremos algo simples: pegamos tudo e filtramos local.
      // *Ou* se volume for grande, é melhor exibir aviso.
      const all = await getDocs(collection(db, "players"));
      const arr: PlayerInfo[] = [];
      all.forEach((ds) => {
        const d = ds.data();
        const full = d.fullname || ds.id;
        if (full.toLowerCase().includes(searchText.toLowerCase())) {
          arr.push({ userid: ds.id, fullname: full });
        }
      });
      setPlayersResult(arr);
      if (arr.length === 0) {
        Alert.alert("Busca", "Nenhum jogador encontrado.");
      }
    } catch (err) {
      console.log("Erro handleSearchPlayers:", err);
      Alert.alert("Erro", "Falha na busca de jogadores.");
    } finally {
      setPlayerSearchLoading(false);
    }
  }

  // Rival modal
  const [rivalError, setRivalError] = useState("");

  async function handleCheckRival(userid: string, fullname: string) {
    try {
      setRivalModalVisible(true);
      setRivalData(null);
      setRivalError("");

      const allMatches = await fetchAllMatches();
      const userMatches = allMatches.filter(
        (m) => m.player1_id === userId || m.player2_id === userId
      );
      const direct = userMatches.filter(
        (m) =>
          (m.player1_id === userId && m.player2_id === userid) ||
          (m.player2_id === userId && m.player1_id === userid)
      );

      let w = 0,
        l = 0,
        d = 0;
      direct.forEach((mm) => {
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
            d++;
            break;
          case 10:
            l++;
            break;
        }
      });

      const matchesEntreEles = direct.length;
      const totalMatchesUser = userMatches.length;
      const rivalryFactor = 100 * (matchesEntreEles / (totalMatchesUser + 1));

      setRivalData({
        matchesCount: matchesEntreEles,
        wins: w,
        losses: l,
        draws: d,
        rivalryFactor,
        rivalName: fullname,
      });
    } catch (err) {
      console.log("Erro handleCheckRival:", err);
      setRivalError("Falha ao calcular rivalidade.");
    }
  }

  // ===========================
  // RENDER
  // ===========================
  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={RED} />
      </View>
    );
  }

  const totalMatches = stats.matchesTotal;
  const wr =
    totalMatches > 0 ? ((stats.wins / totalMatches) * 100).toFixed(1) : "0";

  return (
    <View style={styles.mainContainer}>
      {/* HISTÓRICO */}
      <Modal
        visible={historyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Histórico de Torneios</Text>
            {historyLoading ? (
              <ActivityIndicator size="large" color={RED} />
            ) : (
              <>
                {historyError ? (
                  <Text style={styles.modalSub}>{historyError}</Text>
                ) : (
                  <ScrollView style={{ maxHeight: 400 }}>
                    {historyData.map((item, idx) => (
                      <View key={idx} style={styles.historyCard}>
                        <Text style={styles.historyCardTitle}>
                          {item.tournamentName}
                        </Text>
                        <Text style={styles.historyCardText}>
                          Posição: {item.place} / {item.totalPlayers}
                        </Text>
                        <Text style={styles.historyCardText}>
                          Rodadas: {item.roundCount}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </>
            )}
            <Pressable
              style={styles.closeModalBtn}
              onPress={() => setHistoryModalVisible(false)}
            >
              <Text style={styles.closeModalText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* RIVALIDADE */}
      <Modal
        visible={rivalModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRivalModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rivalidade</Text>
            {!rivalData && !rivalError && (
              <ActivityIndicator size="large" color={RED} />
            )}
            {rivalError ? (
              <Text style={styles.modalSub}>{rivalError}</Text>
            ) : rivalData ? (
              <>
                <Text style={styles.modalSub}>
                  Confronto vs {rivalData.rivalName}
                </Text>
                <Text style={styles.modalSub}>
                  Partidas: {rivalData.matchesCount} | Vitórias:{" "}
                  {rivalData.wins} | Derrotas: {rivalData.losses} | Empates:{" "}
                  {rivalData.draws}
                </Text>
                <Text style={styles.modalSub}>
                  Fator de Rivalidade: {rivalData.rivalryFactor.toFixed(1)}%
                </Text>
              </>
            ) : null}

            <Pressable
              style={styles.closeModalBtn}
              onPress={() => setRivalModalVisible(false)}
            >
              <Text style={styles.closeModalText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        <Text style={styles.title}>{userName}</Text>

        {/* Estatísticas */}
        <View style={styles.statsBox}>
          <Text style={styles.statLine}>Vitórias (Matches): {stats.wins}</Text>
          <Text style={styles.statLine}>
            Derrotas (Matches): {stats.losses}
          </Text>
          <Text style={styles.statLine}>Empates (Matches): {stats.draws}</Text>
          <Text style={styles.statLine}>
            Partidas Totais: {stats.matchesTotal}
          </Text>
          <Text style={styles.statLine}>WinRate: {wr}%</Text>
          <Text style={styles.statLine}>
            Sequência Vitórias (Matches): {winStreak}
          </Text>
          <Text style={styles.statLine}>
            Sequência Derrotas (Matches): {lossStreak}
          </Text>
        </View>

        {/* Botão p/ ver histórico de torneios */}
        <TouchableOpacity
          style={styles.historyButton}
          onPress={handleShowHistory}
        >
          <Text style={styles.historyButtonText}>
            Ver Histórico de Torneios
          </Text>
        </TouchableOpacity>

        {/* Títulos */}
        <View style={styles.titlesBox}>
          <Text style={styles.titlesHeader}>Títulos Desbloqueados</Text>
          {unlockedTitles.length === 0 ? (
            <Text style={styles.emptyTitles}>Nenhum título ainda.</Text>
          ) : (
            unlockedTitles.map((t) => (
              <View key={t.id} style={styles.titleCard}>
                <Text style={styles.titleCardName}>{t.title}</Text>
                <Text style={styles.titleCardDesc}>{t.description}</Text>
              </View>
            ))
          )}
        </View>

        {/* BUSCA JOGADOR */}
        <View style={styles.searchBox}>
          <Text style={styles.searchTitle}>Buscar Jogador p/ Rivalidade</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Digite parte do nome..."
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
          />
          <TouchableOpacity
            style={styles.searchBtn}
            onPress={handleSearchPlayers}
          >
            <Text style={styles.searchBtnText}>Buscar</Text>
          </TouchableOpacity>
          {playerSearchLoading && (
            <ActivityIndicator size="small" color={RED} />
          )}
          {playersResult.map((pl) => (
            <TouchableOpacity
              key={pl.userid}
              style={styles.playerItem}
              onPress={() => handleCheckRival(pl.userid, pl.fullname)}
            >
              <Text style={styles.playerItemText}>
                {pl.fullname} (ID: {pl.userid})
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// =========================
// ESTILOS
// =========================
const DARK_BG = "#1E1E1E";
const CARD_BG = "#292929";
const BORDER_COLOR = "#4D4D4D";
const RED = "#E3350D";
const WHITE = "#FFFFFF";

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
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    color: RED,
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
    textTransform: "uppercase",
  },

  // Stats
  statsBox: {
    backgroundColor: CARD_BG,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  statLine: {
    color: WHITE,
    fontSize: 15,
    marginBottom: 4,
  },

  // History Button
  historyButton: {
    backgroundColor: RED,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginVertical: 10,
  },
  historyButtonText: {
    color: WHITE,
    fontWeight: "bold",
    fontSize: 16,
  },

  // Títulos
  titlesBox: {
    backgroundColor: CARD_BG,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    marginBottom: 20,
  },
  titlesHeader: {
    color: RED,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyTitles: {
    color: WHITE,
    fontSize: 14,
    textAlign: "center",
  },
  titleCard: {
    backgroundColor: DARK_BG,
    borderWidth: 1,
    borderColor: RED,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  titleCardName: {
    color: RED,
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  titleCardDesc: {
    color: WHITE,
    fontSize: 14,
  },

  // Busca
  searchBox: {
    backgroundColor: CARD_BG,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    padding: 12,
    marginBottom: 20,
  },
  searchTitle: {
    color: RED,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 6,
    textAlign: "center",
  },
  searchInput: {
    backgroundColor: DARK_BG,
    borderWidth: 1,
    borderColor: RED,
    borderRadius: 8,
    color: WHITE,
    padding: 10,
    marginBottom: 10,
  },
  searchBtn: {
    backgroundColor: RED,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 8,
  },
  searchBtnText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: "bold",
  },
  playerItem: {
    backgroundColor: "#444",
    borderRadius: 6,
    padding: 8,
    marginVertical: 4,
  },
  playerItemText: {
    color: WHITE,
    fontSize: 14,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  modalTitle: {
    color: RED,
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  modalSub: {
    color: WHITE,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
  },
  closeModalBtn: {
    backgroundColor: RED,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignSelf: "center",
    marginTop: 10,
  },
  closeModalText: {
    color: WHITE,
    fontWeight: "bold",
    fontSize: 14,
  },

  // Cards do histórico
  historyCard: {
    backgroundColor: DARK_BG,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  historyCardTitle: {
    color: RED,
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  historyCardText: {
    color: WHITE,
    fontSize: 14,
  },
});
