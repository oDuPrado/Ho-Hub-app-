//////////////////////////////////////
// ARQUIVO: HistoryModal.tsx
//////////////////////////////////////
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../lib/firebaseConfig";
import {
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Animatable from "react-native-animatable";

/////////////////////////////////////////////////
//     TIPOS E INTERFACES
/////////////////////////////////////////////////

/** Estrutura de histórico de torneio que o jogador jogou */
interface TournamentHistoryItem {
  leagueId: string; // Liga a que o torneio pertence
  tournamentId: string;
  tournamentName: string;
  place: number;
  totalPlayers: number;
  roundCount: number;
}

/** Estrutura para cada partida */
interface MatchDetail {
  id: string;
  roundNumber?: string;      // Agora guardaremos o número da rodada
  player1_id: string;
  player2_id: string;
  player1_name?: string;     // Nome do jogador 1
  player2_name?: string;     // Nome do jogador 2
  outcomeNumber?: number;
}

/** Estrutura para standings (pódio) */
interface PlaceData {
  userid: string;
  fullname: string;
  place: number;
}

/////////////////////////////////////////////////
//     PROPS DO COMPONENTE
/////////////////////////////////////////////////
type HistoryModalProps = {
  visible: boolean;
  onClose: () => void;
  userId: string;
};

/////////////////////////////////////////////////
//     COMPONENTE PRINCIPAL
/////////////////////////////////////////////////
export default function HistoryModal({ visible, onClose, userId }: HistoryModalProps) {
  // Estado do histórico (torneios) e loading/erro
  const [loading, setLoading] = useState(false);
  const [historyData, setHistoryData] = useState<TournamentHistoryItem[]>([]);
  const [error, setError] = useState("");

  // Submodal - Detalhes de Partidas
  const [tournamentModalVisible, setTournamentModalVisible] = useState(false);
  const [selectedTournamentName, setSelectedTournamentName] = useState("");
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [tournamentMatches, setTournamentMatches] = useState<MatchDetail[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);

  // Submodal - Standings (Pódio)
  const [standingsModalVisible, setStandingsModalVisible] = useState(false);
  const [standingsData, setStandingsData] = useState<PlaceData[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(false);

  /////////////////////////////////////////////////////
  //      EFEITO PRINCIPAL: Carregar Histórico
  /////////////////////////////////////////////////////
  useEffect(() => {
    if (visible) {
      loadHistory();
    } else {
      // Reseta
      setHistoryData([]);
      setError("");
      closeTournamentModal();
      closeStandingsModal();
    }
  }, [visible]);

  /////////////////////////////////////////////////////
  //      FUNÇÃO: Carregar histórico
  /////////////////////////////////////////////////////
  async function loadHistory() {
    setLoading(true);
    try {
      const data = await fetchFilteredTournamentPlaces(userId);
      setHistoryData(data);
      if (data.length === 0) {
        setError("Nenhum torneio encontrado.");
      } else {
        setError("");
      }
    } catch (err) {
      console.log("Erro loadHistory:", err);
      setError("Falha ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  }

  /////////////////////////////////////////////////////
  //      FUNÇÃO: Ao clicar em um torneio
  /////////////////////////////////////////////////////
  async function openTournamentDetail(item: TournamentHistoryItem) {
    setSelectedTournamentName(item.tournamentName);
    setSelectedLeagueId(item.leagueId);
    setSelectedTournamentId(item.tournamentId);
    setTournamentModalVisible(true);
    setMatchesLoading(true);

    try {
      // Buscar partidas do usuário naquele torneio
      const matches = await fetchTournamentMatches(item.leagueId, item.tournamentId, userId);
      setTournamentMatches(matches);
    } catch (err) {
      console.log("Erro ao buscar partidas:", err);
      setError("Falha ao carregar partidas.");
    } finally {
      setMatchesLoading(false);
    }
  }

  function closeTournamentModal() {
    setTournamentModalVisible(false);
    setTournamentMatches([]);
    setSelectedTournamentId("");
    setSelectedLeagueId("");
  }

  /////////////////////////////////////////////////////
  //      STANDINGS (PÓDIO)
  /////////////////////////////////////////////////////
  async function openStandings() {
    // Exibe modal do pódio
    setStandingsModalVisible(true);
    setStandingsLoading(true);

    try {
      const data = await fetchTournamentStandings(selectedLeagueId, selectedTournamentId);
      setStandingsData(data);
    } catch (err) {
      console.log("Erro ao carregar standings:", err);
      Alert.alert("Erro", "Falha ao carregar pódio.");
    } finally {
      setStandingsLoading(false);
    }
  }

  function closeStandingsModal() {
    setStandingsModalVisible(false);
    setStandingsData([]);
  }

  /////////////////////////////////////////////////////
  //      FUNÇÃO: Retorna 'win', 'loss' ou 'draw'
  /////////////////////////////////////////////////////
  function getMatchResult(m: MatchDetail): "win"|"loss"|"draw" {
    if (!m.outcomeNumber) return "draw";
    const isP1 = (m.player1_id === userId);
    switch (m.outcomeNumber) {
      case 1: return isP1 ? "win" : "loss";
      case 2: return isP1 ? "loss" : "win";
      case 3: return "draw";
      case 10: return isP1 ? "loss" : "win";
      default: return "draw";
    }
  }

  /////////////////////////////////////////////////////
  //      FUNÇÃO: Nome do vencedor
  /////////////////////////////////////////////////////
  function getMatchWinner(m: MatchDetail) {
    if (!m.outcomeNumber) return "Sem resultado";
    switch (m.outcomeNumber) {
      case 1: return m.player1_name || m.player1_id;
      case 2: return m.player2_name || m.player2_id;
      case 3: return "Empate";
      case 10: return m.player2_name || m.player2_id; // WO
      default: return "??";
    }
  }

  /////////////////////////////////////////////////////
  //      RENDER PRINCIPAL
  /////////////////////////////////////////////////////
  return (
    <>
      {/* MODAL PRINCIPAL - HISTÓRICO */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <Animatable.View animation="fadeInDown" style={styles.modalBody}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close-circle" size={32} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.modalHeader}>Histórico de Torneios</Text>

            {loading ? (
              <ActivityIndicator size="large" color="#E3350D" />
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : (
              <ScrollView contentContainerStyle={styles.scrollContent}>
                {historyData.map((item, idx) => (
                  <Animatable.View
                    key={`${item.leagueId}-${item.tournamentId}`}
                    animation="fadeInUp"
                    delay={100 * idx}
                  >
                    {/* Timeline: bolinha + linha */}
                    <View style={styles.timelineRow}>
                      <View style={styles.timelineIndicator}>
                        <View style={styles.timelineCircle} />
                        {idx < historyData.length - 1 && <View style={styles.timelineLine} />}
                      </View>

                      <TouchableOpacity
                        style={styles.tournamentItem}
                        onPress={() => openTournamentDetail(item)}
                      >
                        <Text style={styles.tournamentTitle}>{item.tournamentName}</Text>
                        <Text style={styles.tournamentDetails}>
                          Posição: {item.place} • Jogadores: {item.totalPlayers} • Rodadas:{" "}
                          {item.roundCount}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </Animatable.View>
                ))}
              </ScrollView>
            )}
          </Animatable.View>
        </View>
      </Modal>

      {/* SUBMODAL - DETALHES DO TORNEIO (PARTIDAS) */}
      <Modal
        visible={tournamentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeTournamentModal}
      >
        <View style={styles.modalOverlay}>
          <Animatable.View animation="fadeInUp" style={styles.submodal}>
            {/* Botão Fechar */}
            <TouchableOpacity style={styles.closeButton} onPress={closeTournamentModal}>
              <Ionicons name="close-circle" size={32} color="#fff" />
            </TouchableOpacity>

            {/* Nome do Torneio */}
            <Text style={styles.modalHeader}>{selectedTournamentName}</Text>

            {/* Botão Standings (pódio) */}
            <TouchableOpacity
              style={styles.standingsButton}
              onPress={openStandings}
            >
              <Ionicons name="ribbon" size={20} color="#fff" />
              <Text style={styles.standingsButtonText}> Standings</Text>
            </TouchableOpacity>

            {matchesLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#E3350D" />
                <Text style={styles.loadingText}>Carregando rodadas e partidas...</Text>
              </View>
            ) : tournamentMatches.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma partida encontrada.</Text>
            ) : (
              <ScrollView contentContainerStyle={styles.matchesContainer}>
                {tournamentMatches.map((mt, idx) => {
                  const result = getMatchResult(mt);
                  const winner = getMatchWinner(mt);

                  return (
                    <Animatable.View
                      key={mt.id}
                      style={[
                        styles.matchCard,
                        result === "win" && styles.winCard,
                        result === "loss" && styles.lossCard,
                        result === "draw" && styles.drawCard,
                      ]}
                      animation="fadeInRight"
                      delay={80 * idx}
                    >
                      {/* Exemplo de exibição do número da rodada */}
                      <Text style={styles.roundNumber}>
                        Round #{mt.roundNumber || "?"}
                      </Text>

                      <Text style={styles.matchPlayers}>
                        {mt.player1_name} vs {mt.player2_name}
                      </Text>

                      <Text style={styles.matchResult}>
                        Resultado:{" "}
                        {result === "win"
                          ? "Vitória"
                          : result === "loss"
                          ? "Derrota"
                          : "Empate"}
                      </Text>
                      <Text style={styles.matchWinner}>Vencedor: {winner}</Text>
                    </Animatable.View>
                  );
                })}
              </ScrollView>
            )}
          </Animatable.View>
        </View>
      </Modal>

      {/* SUBMODAL - STANDINGS (PÓDIO) */}
      <Modal
        visible={standingsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeStandingsModal}
      >
        <View style={styles.modalOverlay}>
          <Animatable.View animation="pulse" style={styles.standingsModal}>
            {/* Botão Fechar */}
            <TouchableOpacity style={styles.closeButton} onPress={closeStandingsModal}>
              <Ionicons name="close-circle" size={32} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.standingsHeader}>Pódio</Text>

            {standingsLoading ? (
              <ActivityIndicator size="large" color="#E3350D" />
            ) : standingsData.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma colocação encontrada.</Text>
            ) : (
              <View style={styles.standingsContent}>
                {standingsData.slice(0,8).map((pl, index) => {
                  // Destaque se for o user
                  const isUser = (pl.userid === userId);
                  return (
                    <Animatable.View
                      key={pl.userid}
                      style={[
                        styles.standingsItem,
                        isUser && { borderColor: "#E3350D", borderWidth: 2 },
                      ]}
                      animation="fadeInDown"
                      delay={index * 200}
                    >
                      <Ionicons
                          name={
                            index === 0
                              ? "trophy"
                              : index === 1
                              ? "medal"
                              : index === 2
                              ? "ribbon"
                              : "person-circle" // Ícone padrão para outros jogadores
                          }
                          size={24}
                          color={
                            index === 0
                              ? "#FFD700"
                              : index === 1
                              ? "#C0C0C0"
                              : index === 2
                              ? "#CD7F32"
                              : "#FFFFFF" // Cor branca para os demais jogadores
                          }
                          style={{ marginRight: 6 }}
                        />

                      <Text style={styles.standingsPlace}>
                        {pl.place}º - {pl.fullname}
                      </Text>
                    </Animatable.View>
                  );
                })}
              </View>
            )}
          </Animatable.View>
        </View>
      </Modal>
    </>
  );
}

///////////////////////////////////////////////////////////////////////////////
//                             FUNÇÕES AUXILIARES
///////////////////////////////////////////////////////////////////////////////

/**
 * Busca o histórico de torneios (places) do usuário, respeitando o filtro:
 *  - "all": todas as ligas
 *  - "city": ligas de certa cidade
 *  - "league": liga específica
 */
async function fetchFilteredTournamentPlaces(uId: string): Promise<TournamentHistoryItem[]> {
  // 1) Carregar filtro
  const filterType = await AsyncStorage.getItem("@filterType");
  const cityStored = await AsyncStorage.getItem("@selectedCity");
  const leagueStored = await AsyncStorage.getItem("@leagueId");

  // 2) Obter ligas
  let leaguesToFetch: string[] = [];

  if (!filterType || filterType === "all") {
    // TUDO
    const leaguesSnap = await getDocs(collection(db, "leagues"));
    leaguesSnap.forEach((docSnap) => {
      leaguesToFetch.push(docSnap.id);
    });
  } else if (filterType === "city" && cityStored) {
    // CITY
    const qCity = query(collection(db, "leagues"), where("city", "==", cityStored));
    const citySnapshot = await getDocs(qCity);
    citySnapshot.forEach((docSnap) => {
      leaguesToFetch.push(docSnap.id);
    });
  } else if (filterType === "league" && leagueStored) {
    // LIGA específica
    leaguesToFetch.push(leagueStored);
  }

  const finalResults: TournamentHistoryItem[] = [];

  // 3) Para cada liga, pegar subcoleção "tournaments"
  for (const leagueId of leaguesToFetch) {
    const tournamentsColl = collection(db, "leagues", leagueId, "tournaments");
    const tSnap = await getDocs(tournamentsColl);
    if (tSnap.empty) continue;

    // 4) Para cada torneio, buscar subcoleção "places"
    for (const tDoc of tSnap.docs) {
      const tId = tDoc.id;
      const placesColl = collection(db, "leagues", leagueId, "tournaments", tId, "places");
      const placesSnap = await getDocs(placesColl);

      // 5) Filtrar lugar do jogador
      const userPlaceDoc = placesSnap.docs.find((plDoc) => {
        const dd = plDoc.data();
        return dd.userid === uId;
      });

      if (!userPlaceDoc) continue; // user não jogou esse torneio

      // 6) Montar item
      const placeData = userPlaceDoc.data();
      const placeNum = parseInt(userPlaceDoc.id, 10) || 0;

      // Buscar info do torneio (nome, players_count, rounds_count)
      const tournamentData = tDoc.data();
      const name = tournamentData.tournament_name || tId;
      const totalPlayers = tournamentData.players_count || 0;
      const roundCount = tournamentData.rounds_count || 0;

      finalResults.push({
        leagueId,
        tournamentId: tId,
        tournamentName: name,
        place: placeNum,
        totalPlayers,
        roundCount,
      });
    }
  }

  // Ordenar 1º lugar primeiro
  finalResults.sort((a, b) => a.place - b.place);
  return finalResults;
}

/**
 * Busca todas as partidas do usuário em um torneio,
 * salvando roundNumber e nomes de cada player.
 */
async function fetchTournamentMatches(
  leagueId: string,
  tId: string,
  uId: string
): Promise<MatchDetail[]> {
  let result: MatchDetail[] = [];

  // 1) Pega rounds
  const roundsRef = collection(db, "leagues", leagueId, "tournaments", tId, "rounds");
  const rSnap = await getDocs(roundsRef);
  if (rSnap.empty) return [];

  // 2) Para cada round
  for (const roundDoc of rSnap.docs) {
    const roundId = roundDoc.id;
    const matchesRef = collection(db, "leagues", leagueId, "tournaments", tId, "rounds", roundId, "matches");
    const mSnap = await getDocs(matchesRef);

    if (mSnap.empty) continue;

    mSnap.forEach((docSnap) => {
      const data = docSnap.data() as MatchDetail;

      // Filtra só partidas do user
      if (data.player1_id === uId || data.player2_id === uId) {
        result.push({
          ...data,
          id: docSnap.id,
          roundNumber: roundId, // Salvar o ID da rodada como roundNumber
        });
      }
    });
  }

  // 3) Buscar nomes
  for (let i = 0; i < result.length; i++) {
    result[i].player1_name = await getPlayerFullName(leagueId, result[i].player1_id);
    result[i].player2_name = await getPlayerFullName(leagueId, result[i].player2_id);
  }

  return result;
}

/**
 * Retorna o pódio (standings) do torneio inteiro (top 3).
 * Pega subcoleção "places" e ordena.
 */
async function fetchTournamentStandings(
  leagueId: string,
  tId: string
): Promise<PlaceData[]> {
  const finalArr: PlaceData[] = [];

  const placesRef = collection(db, "leagues", leagueId, "tournaments", tId, "places");
  const placesSnap = await getDocs(placesRef);

  // Monta array completo
  placesSnap.forEach((ds) => {
    const d = ds.data();
    finalArr.push({
      userid: d.userid,
      fullname: d.fullname || d.userid,
      place: parseInt(ds.id, 10),
    });
  });

  // Ordena
  finalArr.sort((a, b) => a.place - b.place);
  return finalArr;
}

/** Busca fullname de um player em /leagues/<leagueId>/players/<playerId> */
async function getPlayerFullName(leagueId: string, playerId: string): Promise<string> {
  if (!playerId) return "???";
  try {
    const playerRef = doc(db, `leagues/${leagueId}/players/${playerId}`);
    const snap = await getDoc(playerRef);
    if (snap.exists()) {
      const data = snap.data();
      return data.fullname || playerId;
    }
  } catch (err) {
    console.log("Erro getPlayerFullName:", err);
  }
  return playerId;
}

/////////////////////////////////////////////////
//               ESTILOS
/////////////////////////////////////////////////
import { StyleSheet } from "react-native";
import { collection } from "firebase/firestore";

const DARK_BG = "#1E1E1E";
const CARD_BG = "#292929";

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBody: {
    backgroundColor: CARD_BG,
    width: "90%",
    maxHeight: "80%",
    borderRadius: 12,
    padding: 20,
  },
  submodal: {
    backgroundColor: "#333",
    width: "90%",
    maxHeight: "80%",
    borderRadius: 12,
    padding: 20,
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 10,
  },
  modalHeader: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  timelineIndicator: {
    width: 20,
    alignItems: "center",
  },
  timelineCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FFF",
    marginBottom: 2,
  },
  timelineLine: {
    width: 2,
    height: 40,
    backgroundColor: "#FFF",
    marginTop: 2,
  },
  tournamentItem: {
    backgroundColor: "#3A3A3A",
    borderRadius: 8,
    padding: 15,
    marginLeft: 5,
    flex: 1,
  },
  tournamentTitle: {
    color: "#E3350D",
    fontSize: 16,
    fontWeight: "600",
  },
  tournamentDetails: {
    color: "#CCCCCC",
    fontSize: 12,
    marginTop: 5,
  },
  errorText: {
    color: "#FF4444",
    textAlign: "center",
    marginTop: 20,
  },
  loadingContainer: {
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 10,
  },
  emptyText: {
    color: "#CCCCCC",
    textAlign: "center",
    marginTop: 20,
  },
  matchesContainer: {
    paddingBottom: 20,
  },
  matchCard: {
    backgroundColor: "#454545",
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#777",
  },
  winCard: {
    borderLeftColor: "#4CAF50",
  },
  lossCard: {
    borderLeftColor: "#F44336",
  },
  drawCard: {
    borderLeftColor: "#FFC107",
  },
  matchPlayers: {
    color: "#FFFFFF",
    fontWeight: "500",
    marginTop: 8,
  },
  matchResult: {
    color: "#FFFFFF",
    marginTop: 4,
    fontSize: 12,
  },
  matchWinner: {
    color: "#CCCCCC",
    fontSize: 12,
    marginTop: 2,
  },
  roundNumber: {
    color: "#FFFFFF",
    fontSize: 13,
    fontStyle: "italic",
  },
  standingsButton: {
    backgroundColor: "#E3350D",
    borderRadius: 8,
    flexDirection: "row",
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
  },
  standingsButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 4,
  },
  standingsModal: {
    backgroundColor: CARD_BG,
    width: "85%",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  standingsHeader: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  standingsContent: {
    width: "100%",
    marginTop: 10,
  },
  standingsItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#444",
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  standingsPlace: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "500",
  },
});
