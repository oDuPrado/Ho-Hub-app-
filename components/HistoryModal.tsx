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
  Pressable,
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
import { TournamentHistoryItem } from "../app/(tabs)/jogador"; // Ajuste o caminho

type HistoryModalProps = {
  visible: boolean;
  onClose: () => void;
  userId: string;
};

interface MatchDetail {
  id: string;
  player1_id: string;
  player2_id: string;
  outcomeNumber?: number;
  // etc
}

export default function HistoryModal({ visible, onClose, userId }: HistoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [historyData, setHistoryData] = useState<TournamentHistoryItem[]>([]);
  const [error, setError] = useState("");

  // Submodal de detalhes do torneio
  const [tournamentModalVisible, setTournamentModalVisible] = useState(false);
  const [selectedTournamentName, setSelectedTournamentName] = useState("");
  const [tournamentMatches, setTournamentMatches] = useState<MatchDetail[]>([]);

  useEffect(() => {
    if (visible) {
      // Carrega o histórico
      loadHistory();
    } else {
      // limpar
      setHistoryData([]);
      setError("");
    }
  }, [visible]);

  async function loadHistory() {
    setLoading(true);
    try {
      const data = await fetchTournamentPlaces(userId);
      setHistoryData(data);
      if (data.length === 0) {
        setError("Nenhum torneio encontrado para você.");
      } else {
        setError("");
      }
    } catch (err) {
      setError("Falha ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  }

  // Carrega submodal com as partidas do jogador
  async function openTournamentDetail(item: TournamentHistoryItem) {
    setSelectedTournamentName(item.tournamentName);
    setTournamentModalVisible(true);

    try {
      const matches = await fetchTournamentMatches(item.tournamentId, userId);
      setTournamentMatches(matches);
    } catch (err) {
      console.log("Erro ao buscar matches do torneio:", err);
    }
  }

  // Busca as matches do torneio em que o userId participou
  async function fetchTournamentMatches(tId: string, uId: string): Promise<MatchDetail[]> {
    const result: MatchDetail[] = [];
    // Exemplo: assumindo que cada torneio tem subcoleções "rounds" e cada "round" tem "matches"
    // Ajuste a lógica conforme seu schema real
    const roundsSnap = await getDocs(collection(db, "tournaments", tId, "rounds"));
    for (const roundDoc of roundsSnap.docs) {
      const matchesSnap = await getDocs(
        collection(db, "tournaments", tId, "rounds", roundDoc.id, "matches")
      );
      matchesSnap.forEach((mDoc) => {
        const md = mDoc.data();
        if (md.player1_id === uId || md.player2_id === uId) {
          result.push({ id: mDoc.id, ...md } as MatchDetail);
        }
      });
    }
    return result;
  }

  // Determina se foi vitória ou derrota do user
  function getMatchResult(m: MatchDetail): "win" | "loss" | "draw" {
    if (!m.outcomeNumber) return "draw";
    const isP1 = m.player1_id === userId;
    if (m.outcomeNumber === 1) {
      return isP1 ? "win" : "loss";
    } else if (m.outcomeNumber === 2) {
      return isP1 ? "loss" : "win";
    } else if (m.outcomeNumber === 3) {
      return "draw";
    } else if (m.outcomeNumber === 10) {
      return "loss";
    }
    return "draw";
  }

  // Retorna o nome do vencedor
  function getMatchWinner(m: MatchDetail) {
    if (!m.outcomeNumber) return "Sem resultado";
    if (m.outcomeNumber === 1) return m.player1_id;
    if (m.outcomeNumber === 2) return m.player2_id;
    if (m.outcomeNumber === 3) return "Empate";
    if (m.outcomeNumber === 10) return m.player2_id; // W.O, ex
    return "??";
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBody}>
          {/* Botão fechar */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close-circle" size={32} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.modalHeader}>Histórico de Torneios</Text>

          {loading ? (
            <ActivityIndicator size="large" color={RED} />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <ScrollView>
              {historyData.map((item) => (
                <TouchableOpacity
                  key={item.tournamentId}
                  style={styles.tournamentItem}
                  onPress={() => openTournamentDetail(item)}
                >
                  <Text style={styles.tournamentTitle}>{item.tournamentName}</Text>
                  <Text style={styles.tournamentPos}>
                    Posição: {item.place} / {item.totalPlayers}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Submodal - Detalhes do Torneio */}
        <Modal
          visible={tournamentModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setTournamentModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBody, { width: "90%" }]}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setTournamentModalVisible(false)}
              >
                <Ionicons name="close-circle" size={32} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.modalHeader}>{selectedTournamentName}</Text>

              <ScrollView style={{ maxHeight: 400 }}>
                {tournamentMatches.map((mt) => {
                  const result = getMatchResult(mt);
                  const winner = getMatchWinner(mt);

                  // Determina cor da borda
                  let borderColor = "#ccc";
                  if (result === "win") borderColor = "green";
                  if (result === "loss") borderColor = "red";

                  return (
                    <View
                      key={mt.id}
                      style={[styles.matchCard, { borderColor }]}
                    >
                      <Text style={styles.matchText}>
                        {mt.player1_id} vs {mt.player2_id}
                      </Text>
                      <Text style={styles.matchText}>Vencedor: {winner}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

// Função para buscar torneios jogados
async function fetchTournamentPlaces(uId: string): Promise<TournamentHistoryItem[]> {
  const placesDocs = await getDocs(collectionGroup(db, "places"));
  const userPlaces = placesDocs.docs.filter((docSnap) => {
    const d = docSnap.data();
    return d.userid === uId;
  });

  const results: TournamentHistoryItem[] = [];
  for (const docSnap of userPlaces) {
    const data = docSnap.data();
    const placeNum = parseInt(docSnap.id, 10) || 0;

    const pathParts = docSnap.ref.path.split("/");
    const tId = pathParts[1];

    let tournamentName = tId;
    try {
      const tDoc = await getDoc(doc(db, "tournaments", tId));
      if (tDoc.exists()) {
        const tData = tDoc.data();
        if (tData.name) tournamentName = tData.name;
      }
    } catch {
      // ignora
    }

    // Exemplo. Se quiser, conte roundCount etc. (já temos no item, se quiser)
    results.push({
      tournamentId: tId,
      tournamentName,
      place: placeNum,
      totalPlayers: data.totalPlayers || 0,
      roundCount: data.roundCount || 0,
    });
  }

  results.sort((a, b) => a.place - b.place);
  return results;
}

// ESTILOS
const DARK_BG = "#1E1E1E";
const CARD_BG = "#292929";
const BORDER_COLOR = "#4D4D4D";
const RED = "#E3350D";
const WHITE = "#FFFFFF";

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
  },
  modalBody: {
    flex: 1,
    margin: 0,
    backgroundColor: DARK_BG,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    padding: 16,
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
  },
  modalHeader: {
    fontSize: 20,
    fontWeight: "bold",
    color: WHITE,
    textAlign: "center",
    marginTop: 10,
  },
  errorText: {
    color: RED,
    fontSize: 16,
    textAlign: "center",
    marginTop: 20,
  },
  tournamentItem: {
    backgroundColor: CARD_BG,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    padding: 12,
    marginVertical: 6,
  },
  tournamentTitle: {
    color: RED,
    fontSize: 16,
    fontWeight: "bold",
  },
  tournamentPos: {
    color: WHITE,
    fontSize: 14,
  },
  matchCard: {
    backgroundColor: DARK_BG,
    borderWidth: 2,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  matchText: {
    color: WHITE,
    fontSize: 14,
    marginBottom: 4,
  },
});
