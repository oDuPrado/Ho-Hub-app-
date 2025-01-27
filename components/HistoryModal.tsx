//////////////////////////////////////
// ARQUIVO: HistoryModal.tsx
//////////////////////////////////////
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../lib/firebaseConfig";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  collectionGroup,
} from "firebase/firestore";

/** Interface para o histórico de torneios que o jogador jogou */
interface TournamentHistoryItem {
  tournamentId: string;
  tournamentName: string;
  place: number;
  totalPlayers: number;
  roundCount: number;
}

/** Interface para cada partida */
interface MatchDetail {
  id: string;
  player1_id: string;
  player2_id: string;
  outcomeNumber?: number;
}

/** Props para o modal */
type HistoryModalProps = {
  visible: boolean;
  onClose: () => void;
  userId: string;
};

export default function HistoryModal({ visible, onClose, userId }: HistoryModalProps) {
  // Estado do histórico (torneios)
  const [loading, setLoading] = useState(false);
  const [historyData, setHistoryData] = useState<TournamentHistoryItem[]>([]);
  const [error, setError] = useState("");

  // Submodal (detalhes do torneio)
  const [tournamentModalVisible, setTournamentModalVisible] = useState(false);
  const [selectedTournamentName, setSelectedTournamentName] = useState("");
  const [tournamentMatches, setTournamentMatches] = useState<MatchDetail[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);

  /**
   * Ao abrir o modal principal, carregamos o histórico
   * Ao fechar, limpamos o estado
   */
  useEffect(() => {
    if (visible) {
      loadHistory();
    } else {
      setHistoryData([]);
      setError("");
      closeTournamentModal(); // limpa submodal
    }
  }, [visible]);

  /** Carrega o histórico de torneios do jogador */
  async function loadHistory() {
    setLoading(true);
    try {
      const data = await fetchTournamentPlaces(userId);
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

  /** Abre submodal de detalhes do torneio (rodadas e mesas do jogador) */
  async function openTournamentDetail(item: TournamentHistoryItem) {
    setSelectedTournamentName(item.tournamentName);
    setTournamentModalVisible(true);
    setMatchesLoading(true);

    try {
      const matches = await fetchTournamentMatches(item.tournamentId, userId);
      setTournamentMatches(matches);
    } catch (err) {
      console.log("Erro ao buscar partidas:", err);
      setError("Falha ao carregar partidas.");
    } finally {
      setMatchesLoading(false);
    }
  }

  /** Fecha submodal e limpa estado */
  function closeTournamentModal() {
    setTournamentModalVisible(false);
    setTournamentMatches([]);
  }

  // =========================
  // FUNÇÕES AUXILIARES
  // =========================

  /** Busca as partidas (mesas) de um torneio, rodadas -> matches */
  async function fetchTournamentMatches(tId: string, uId: string): Promise<MatchDetail[]> {
    const result: MatchDetail[] = [];

    try {
      // Buscar as rodadas do torneio
      const roundsSnap = await getDocs(collection(db, "tournaments", tId, "rounds"));
      if (roundsSnap.empty) {
        console.log(`Nenhuma rodada encontrada para o torneio: ${tId}`);
        return result;
      }

      // Para cada rodada, busca as mesas (matches)
      for (const roundDoc of roundsSnap.docs) {
        const roundId = roundDoc.id;
        // console.log(`Buscando mesas da rodada: ${roundId} (torneio ${tId})`);

        const matchesSnap = await getDocs(
          collection(db, "tournaments", tId, "rounds", roundId, "matches")
        );
        if (matchesSnap.empty) {
          console.log(`Nenhuma mesa encontrada na rodada ${roundId}`);
          continue;
        }

        // Adiciona ao resultado as partidas em que o jogador participou
        matchesSnap.forEach((mDoc) => {
          const matchData = mDoc.data();
          if (matchData.player1_id === uId || matchData.player2_id === uId) {
            result.push({
              id: mDoc.id,
              ...matchData,
            } as MatchDetail);
          }
        });
      }
      // console.log(`Total de partidas encontradas no torneio (${tId}): ${result.length}`);
    } catch (error) {
      console.error("Erro ao buscar rodadas e mesas:", error);
      throw error;
    }

    return result;
  }

  /** Determina se o jogador venceu, perdeu ou empatou */
  function getMatchResult(m: MatchDetail): "win" | "loss" | "draw" {
    if (!m.outcomeNumber) return "draw";
    const isP1 = m.player1_id === userId;

    switch (m.outcomeNumber) {
      case 1:
        return isP1 ? "win" : "loss";
      case 2:
        return isP1 ? "loss" : "win";
      case 3:
        return "draw";
      case 10:
        // Exemplo: W.O => player2_id vence
        return isP1 ? "loss" : "win";
      default:
        return "draw";
    }
  }

  /** Retorna o nome (ID) do vencedor */
  function getMatchWinner(m: MatchDetail) {
    if (!m.outcomeNumber) return "Sem resultado";
    switch (m.outcomeNumber) {
      case 1:
        return m.player1_id;
      case 2:
        return m.player2_id;
      case 3:
        return "Empate";
      case 10:
        return m.player2_id;
      default:
        return "??";
    }
  }

  // =========================
  // RENDER
  // =========================
  return (
    <>
      {/* MODAL PRINCIPAL (Histórico de Torneios) */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBody}>
            {/* Botão Fechar */}
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
                {historyData.map((item) => (
                  <TouchableOpacity
                    key={item.tournamentId}
                    style={styles.tournamentItem}
                    onPress={() => openTournamentDetail(item)}
                  >
                    <Text style={styles.tournamentTitle}>{item.tournamentName}</Text>
                    <Text style={styles.tournamentDetails}>
                      Posição: {item.place} • Jogadores: {item.totalPlayers} • Rodadas:{" "}
                      {item.roundCount}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* SUBMODAL (Detalhes do Torneio - Partidas) */}
      <Modal
        visible={tournamentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeTournamentModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.submodal}>
            {/* Botão Fechar */}
            <TouchableOpacity style={styles.closeButton} onPress={closeTournamentModal}>
              <Ionicons name="close-circle" size={32} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.modalHeader}>{selectedTournamentName}</Text>

            {/* Carregando Matches */}
            {matchesLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#E3350D" />
                <Text style={styles.loadingText}>Carregando rodadas e partidas...</Text>
              </View>
            ) : tournamentMatches.length === 0 ? (
              <Text style={styles.emptyText}>
                Nenhuma partida encontrada para este torneio.
              </Text>
            ) : (
              <ScrollView contentContainerStyle={styles.matchesContainer}>
                {tournamentMatches.map((mt) => {
                  const result = getMatchResult(mt);
                  const winner = getMatchWinner(mt);

                  return (
                    <View
                      key={mt.id}
                      style={[
                        styles.matchCard,
                        result === "win" && styles.winCard,
                        result === "loss" && styles.lossCard,
                        result === "draw" && styles.drawCard,
                      ]}
                    >
                      <Text style={styles.matchPlayers}>
                        {mt.player1_id} vs {mt.player2_id}
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
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

// =========================
// Funções Auxiliares (Histórico de torneios)
// =========================

/** 
 * Busca os torneios que o jogador disputou (coleção places),
 * define totalPlayers, roundCount e ajusta nome do torneio.
 */
async function fetchTournamentPlaces(uId: string): Promise<TournamentHistoryItem[]> {
  const placesDocs = await getDocs(collectionGroup(db, "places"));

  // Filtra apenas docs de 'places' onde o userid = uId
  const userPlaces = placesDocs.docs.filter((docSnap) => {
    const d = docSnap.data();
    return d.userid === uId;
  });

  const results: TournamentHistoryItem[] = [];

  for (const docSnap of userPlaces) {
    const data = docSnap.data();
    // O ID do doc em places costuma ser a colocação
    const placeNum = parseInt(docSnap.id, 10) || 0;

    // path ex: "tournaments/ABC123/places/1"
    const pathParts = docSnap.ref.path.split("/");
    const tId = pathParts[1]; // ID do torneio (ABC123 nesse ex.)

    // Buscar nome do torneio no doc de "tournaments"
    let rawTournamentName = tId;
    try {
      const tDoc = await getDoc(doc(db, "tournaments", tId));
      if (tDoc.exists()) {
        const tData = tDoc.data();
        if (tData.name) rawTournamentName = tData.name;
      }
    } catch {
      // Se falhar, mantém tId
      console.log(`Falha ao buscar nome do torneio: ${tId}`);
    }

    // Ajusta nome do torneio (até "#XX" + remove "_")
    const tournamentName = parseTournamentName(rawTournamentName);

    // Conta jogadores únicos
    let totalPlayers = 0;
    try {
      const allPlacesSnap = await getDocs(collection(db, "tournaments", tId, "places"));
      const uniqueUserSet = new Set<string>();
      allPlacesSnap.forEach((pDoc) => {
        const pd = pDoc.data();
        if (pd.userid) {
          uniqueUserSet.add(pd.userid);
        }
      });
      totalPlayers = uniqueUserSet.size;
    } catch (err) {
      console.log("Falha ao contar jogadores no torneio:", err);
    }

    // Conta rodadas
    let roundCount = 0;
    try {
      const allRoundsSnap = await getDocs(collection(db, "tournaments", tId, "rounds"));
      roundCount = allRoundsSnap.docs.length;
    } catch (err) {
      console.log("Falha ao contar rodadas do torneio:", err);
    }

    results.push({
      tournamentId: tId,
      tournamentName,
      place: placeNum,
      totalPlayers,
      roundCount,
    });
  }

  // Ordena pelo menor lugar (1º lugar primeiro)
  results.sort((a, b) => a.place - b.place);
  return results;
}

/** Formata o nome do torneio para ficar até "#XX" e remover underscores.
 *  Ex: "4Fun_Championship_#30_25-01-010980" => "4Fun_Championship_#30"
 *  E então remove underscores: => "4FunChampionship#30"
 */
function parseTournamentName(original: string): string {
  // Tenta capturar tudo até "# + 2 dígitos"
  // Ex: "MyTourn #05_Testando" => match[1] = "MyTourn #05"
  const match = original.match(/^(.*?#\d{2})/);
  let baseName: string;

  if (match) {
    baseName = match[1]; 
  } else {
    // Se não bater a regex, mantém o original
    baseName = original;
  }

  // Remove todos underscores
  return baseName.replace(/_/g, "");
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
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 1,
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
  tournamentItem: {
    backgroundColor: "#3A3A3A",
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  tournamentTitle: {
    color: RED,
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
  },
  matchResult: {
    color: "#FFFFFF",
    marginTop: 5,
    fontSize: 12,
  },
  matchWinner: {
    color: "#CCCCCC",
    fontSize: 12,
    marginTop: 3,
  },
});
