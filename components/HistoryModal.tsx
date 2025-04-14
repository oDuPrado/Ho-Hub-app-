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
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Animatable from "react-native-animatable";
import { StyleSheet } from "react-native";

import { fetchPlayerHistory, TournamentHistoryItem } from "../lib/matchService";

// Props
type HistoryModalProps = {
  visible: boolean;
  onClose: () => void;
  userId: string;
};

export default function HistoryModal({ visible, onClose, userId }: HistoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [historyData, setHistoryData] = useState<TournamentHistoryItem[]>([]);
  const [error, setError] = useState("");

  // Cache local: se o user abrir e fechar o modal rapidamente, não precisa recarregar.
  // Podemos usar um state 'lastLeague' e 'cachedHistory'.
  const [cachedLeague, setCachedLeague] = useState<string>("");
  const [cachedHistory, setCachedHistory] = useState<TournamentHistoryItem[]>([]);

  useEffect(() => {
    if (visible) {
      loadHistory();
    } else {
      setHistoryData([]);
      setError("");
    }
  }, [visible]);

  async function loadHistory() {
    setLoading(true);
    try {
      const leagueStored = await AsyncStorage.getItem("@leagueId");
      if (!leagueStored) {
        setError("Liga não encontrada.");
        return;
      }
  
      if (cachedLeague === leagueStored && cachedHistory.length > 0) {
        console.log("Usando histórico em cache...");
        setHistoryData(cachedHistory);
        setLoading(false);
        return;
      }
  
      console.log("Buscando histórico no Firestore...");
      const data = await fetchPlayerHistory(leagueStored, userId);
  
  +   // Ordena do mais recente para o mais antigo
  +   data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
      setHistoryData(data);
      setCachedLeague(leagueStored);
      setCachedHistory(data);
  
      if (data.length === 0) {
        setError("Nenhum torneio encontrado.");
      } else {
        setError("");
      }
    } catch (err) {
      console.log("Erro ao carregar histórico:", err);
      setError("Falha ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  }  

  return (
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
                  key={item.tournamentId + "-" + idx}
                  animation="fadeInUp"
                  delay={100 * idx}
                >
                  <View style={styles.tournamentItem}>
                    <Text style={styles.tournamentTitle}>
                      {item.tournamentName}
                    </Text>
                    <Text style={styles.tournamentDetails}>
                      Posição: {item.place} • Jogadores: {item.totalPlayers} • Rodadas:{" "}
                      {item.roundCount}
                    </Text>
                    <Text style={styles.tournamentDate}>
                      Data: {new Date(item.date).toLocaleDateString("pt-BR")}
                    </Text>
                  </View>
                </Animatable.View>
              ))}
            </ScrollView>
          )}
        </Animatable.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBody: {
    backgroundColor: "#292929",
    width: "90%",
    maxHeight: "80%",
    borderRadius: 12,
    padding: 20,
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
  tournamentItem: {
    backgroundColor: "#3A3A3A",
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
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
  tournamentDate: {
    color: "#AAAAAA",
    fontSize: 12,
    marginTop: 3,
  },
  errorText: {
    color: "#FF4444",
    textAlign: "center",
    marginTop: 20,
  },
});
