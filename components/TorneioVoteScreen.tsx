// ====================== TorneioVoteScreen.tsx ======================
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Platform,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import * as Animatable from "react-native-animatable";
import { useTranslation } from "react-i18next";

const RED = "#E3350D";
const BLACK = "#1E1E1E";
const DARK_GRAY = "#292929";
const WHITE = "#FFFFFF";

interface VoteProps {
  visible: boolean;
  onClose: () => void;
  mesaId: string | null;
  leagueId: string;
  opponentName: string;
  // Caso os nomes sejam passados via props, eles serão usados;
  // se não, o modal buscará via AsyncStorage (get-data)
  p1Name?: string;
  p2Name?: string;
}

/**
 * Substitui "mesa.html". Permite votar com PIN e escolher vencedor
 * ou Empate, com layout estilizado e animações.
 */
export default function TorneioVoteScreen({
  visible,
  onClose,
  mesaId,
  leagueId,
  opponentName,
  p1Name,
  p2Name,
}: VoteProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const [userPin, setUserPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  // Estados para os nomes dos jogadores
  const [player1Name, setPlayer1Name] = useState<string>(p1Name || "");
  const [player2Name, setPlayer2Name] = useState<string>(p2Name || "");

  // Sempre que abrir o modal, limpa o PIN e feedback
  useEffect(() => {
    if (visible) {
      setUserPin("");
      setFeedbackMessage("");
      
      // Se os nomes não foram passados via props, tenta buscá-los do AsyncStorage
      async function fetchPlayers() {
        console.log("🔍 Buscando nomes dos jogadores...");
  
        if (!p1Name) {
          const storedP1 = await AsyncStorage.getItem("@player1Name");
          setPlayer1Name(storedP1 || "Jogador 1");
          console.log("✅ Nome do Jogador 1 obtido:", storedP1);
        }
  
        if (!p2Name) {
          const storedP2 = await AsyncStorage.getItem("@player2Name");
          setPlayer2Name(storedP2 || "Jogador 2");
          console.log("✅ Nome do Jogador 2 obtido:", storedP2);
        }
      }
  
      fetchPlayers();
    }
  }, [visible, p1Name, p2Name]);
  

  async function sendVote(result: string) {
    try {
      setLoading(true);
      setFeedbackMessage("");

      // 🔥 Obtém os dados necessários do AsyncStorage
      const storedLeagueId = await AsyncStorage.getItem("@leagueId");
      const firebaseToken = await AsyncStorage.getItem("@firebaseToken");
      const storedUserId = await AsyncStorage.getItem("@userId");

      if (!storedLeagueId || !mesaId || !firebaseToken || !storedUserId) {
        Alert.alert("Erro", "Dados incompletos. Verifique sua conta e tente novamente.");
        setLoading(false);
        return;
      }

      if (!userPin.trim()) {
        Alert.alert("Erro", "Digite seu PIN antes de votar!");
        setLoading(false);
        return;
      }

      const body = {
        league_id: storedLeagueId,
        mesa_id: mesaId,
        resultado: result,
        pin: userPin.trim(),
      };

      console.log("🔥 Enviando voto:", body);

      const resp = await fetch("https://Doprado.pythonanywhere.com/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firebaseToken}`,
        },
        body: JSON.stringify(body),
      });

      const json = await resp.json();

      if (!resp.ok) {
        console.error("❌ Erro ao votar:", json);
        Alert.alert("Erro", json.message || "Falha ao registrar voto.");
        setFeedbackMessage(json.message || "Erro ao registrar voto.");
      } else {
        console.log("✅ Voto registrado com sucesso!", json);
        Alert.alert("Sucesso", json.message || "Voto registrado!");
        setFeedbackMessage(json.message || "Voto registrado com sucesso!");
        onClose(); // Fecha o modal após o voto
      }
    } catch (err) {
      console.error("Erro no voto:", err);
      Alert.alert("Erro", "Não foi possível conectar ao servidor.");
      setFeedbackMessage("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function clearVote() {
    try {
      setLoading(true);
      setFeedbackMessage("");

      // Obtém dados necessários do AsyncStorage
      const storedLeagueId = await AsyncStorage.getItem("@leagueId");
      const firebaseToken = await AsyncStorage.getItem("@firebaseToken");

      if (!storedLeagueId || !mesaId || !firebaseToken) {
        Alert.alert("Erro", "Dados incompletos. Verifique sua conta e tente novamente.");
        setLoading(false);
        return;
      }

      const body = {
        league_id: storedLeagueId,
        mesa_id: mesaId,
      };

      console.log("🔥 Enviando requisição para limpar resultado:", body);

      const resp = await fetch("https://Doprado.pythonanywhere.com/clear-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firebaseToken}`,
        },
        body: JSON.stringify(body),
      });

      const json = await resp.json();

      if (!resp.ok) {
        console.error("❌ Erro ao limpar resultado:", json);
        Alert.alert("Erro", json.message || "Falha ao limpar resultado.");
        setFeedbackMessage(json.message || "Erro ao limpar resultado.");
      } else {
        console.log("✅ Resultado limpo com sucesso!", json);
        Alert.alert("Sucesso", json.message || "Resultado limpo!");
        setFeedbackMessage(json.message || "Resultado limpo com sucesso!");
      }
    } catch (err) {
      console.error("Erro ao limpar resultado:", err);
      Alert.alert("Erro", "Não foi possível conectar ao servidor.");
      setFeedbackMessage("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animatable.View
        style={styles.overlay}
        animation="fadeIn"
        duration={300}
        onTouchStart={() => Keyboard.dismiss()}
      >
        <Animatable.View style={styles.modalContainer} animation="zoomIn" duration={300}>
          <Text style={styles.modalTitle}>
            Mesa {mesaId ?? "?"} <Ionicons name="play" color="#FFD700" size={20} />
          </Text>
          <Text style={styles.modalSubtitle}>Jogadores:</Text>
          <Text style={styles.playersText}>
            {player1Name || "Jogador 1"} vs {player2Name || "Jogador 2"}
          </Text>

          <Text style={styles.modalLabel}>Digite seu PIN:</Text>
          <TextInput
            style={styles.pinInput}
            value={userPin}
            onChangeText={setUserPin}
            placeholder="Ex: 1234"
            placeholderTextColor="#888"
            secureTextEntry
          />

          {loading ? (
            <ActivityIndicator color={RED} size="large" style={{ marginVertical: 20 }} />
          ) : (
            <>
              <View style={styles.voteContainer}>
                <TouchableOpacity
                  style={styles.voteButton}
                  onPress={() => sendVote("Vitória Jogador 1")}
                >
                  <MaterialCommunityIcons name="trophy" size={24} color="#4CAF50" />
                  <Text style={styles.voteText}>
                    Vitória do: {player1Name || "Jogador 1"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.voteButton}
                  onPress={() => sendVote("Vitória Jogador 2")}
                >
                  <MaterialCommunityIcons name="trophy" size={24} color="#F44336" />
                  <Text style={styles.voteText}>
                    Vitória do: {player2Name || "Jogador 2"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.voteButton}
                  onPress={() => sendVote("Empate")}
                >
                  <Ionicons name="hand-left" size={24} color="#FFC107" />
                  <Text style={styles.voteText}>Empate</Text>
                </TouchableOpacity>
              </View>
              {/* Botão para limpar resultado */}
              <TouchableOpacity style={styles.clearButton} onPress={clearVote}>
                <Ionicons name="trash-bin" size={24} color="#fff" />
                <Text style={styles.clearButtonText}>Limpar Resultado</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Feedback visual para o usuário */}
          {feedbackMessage !== "" && (
            <Text style={styles.feedbackText}>{feedbackMessage}</Text>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Fechar</Text>
          </TouchableOpacity>
        </Animatable.View>
      </Animatable.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "85%",
    backgroundColor: DARK_GRAY,
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    color: WHITE,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    color: "#ccc",
    fontSize: 14,
    marginBottom: 4,
    textAlign: "center",
  },
  playersText: {
    color: WHITE,
    fontSize: 16,
    marginBottom: 16,
    textAlign: "center",
  },
  modalLabel: {
    color: WHITE,
    fontSize: 14,
    marginBottom: 6,
  },
  pinInput: {
    backgroundColor: "#444",
    color: WHITE,
    fontSize: 16,
    width: "100%",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  voteContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 8,
  },
  voteButton: {
    alignItems: "center",
    width: 90,
  },
  voteText: {
    color: WHITE,
    marginTop: 4,
    fontSize: 13,
    textAlign: "center",
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#555",
    borderRadius: 6,
    paddingVertical: 10,
    marginVertical: 12,
  },
  clearButtonText: {
    color: WHITE,
    fontSize: 14,
    marginLeft: 8,
  },
  feedbackText: {
    color: WHITE,
    fontSize: 14,
    textAlign: "center",
    marginVertical: 8,
  },
  closeBtn: {
    backgroundColor: RED,
    borderRadius: 6,
    padding: 12,
    alignItems: "center",
    marginTop: 16,
  },
  closeText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "bold",
  },
});
