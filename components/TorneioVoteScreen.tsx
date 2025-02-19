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
  Keyboard,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import * as Animatable from "react-native-animatable";
import { useTranslation } from "react-i18next";

const RED = "#E3350D";
const DARK_GRAY = "#1E1E1E";
const WHITE = "#FFFFFF";
const SCREEN_WIDTH = Dimensions.get("window").width;

interface VoteProps {
  visible: boolean;
  onClose: () => void;
  mesaId: string | null;
  leagueId: string;
  opponentName: string;
  p1Name?: string;
  p2Name?: string;
}

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

  // Ao abrir o modal, limpa o PIN e feedback
  useEffect(() => {
    if (visible) {
      setUserPin("");
      setFeedbackMessage("");

      async function fetchPlayers() {
        console.log("🔍 Buscando nomes dos jogadores...");

        if (!p1Name) {
          const storedP1 = await AsyncStorage.getItem("@player1Name");
          console.log("📌 [DEBUG] Valor salvo no AsyncStorage para Player 1:", storedP1);
          setPlayer1Name(storedP1 || "Jogador 1");
        }

        if (!p2Name) {
          const storedP2 = await AsyncStorage.getItem("@player2Name");
          console.log("📌 [DEBUG] Valor salvo no AsyncStorage para Player 2:", storedP2);
          setPlayer2Name(storedP2 || "Jogador 2");
        }
      }

      fetchPlayers();
    }
  }, [visible, p1Name, p2Name]);

  useEffect(() => {
    console.log("✅ Nome atualizado do Jogador 1:", player1Name);
    console.log("✅ Nome atualizado do Jogador 2:", player2Name);
  }, [player1Name, player2Name]);

  async function sendVote(result: string) {
    try {
      setLoading(true);
      setFeedbackMessage("");

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
        onClose();
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
      {/* Overlay com gradiente animado */}
      <Animatable.View
        style={styles.overlay}
        animation="fadeIn"
        duration={500}
        onTouchStart={() => Keyboard.dismiss()}
      >
        {/* Container principal do modal */}
        <Animatable.View
          style={styles.modalContainer}
          animation="zoomIn"
          duration={400}
          easing="ease-out"
        >
          {/* Cabeçalho do Modal */}
          <Animatable.View animation="fadeInDown" style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Mesa {mesaId ?? "?"}{" "}
              <Ionicons name="play" color="#FFD700" size={20} />
            </Text>
            <Text style={styles.modalSubtitle}>
              Jogadores
            </Text>
            <Text style={styles.playersText}>
              {player1Name || "Jogador 1"}{" "}
              <Ionicons name="flash" size={18} color="#FFD700" />
              {" vs "}
              <Ionicons name="flash" size={18} color="#FFD700" />
              {" "}
              {player2Name || "Jogador 2"}
            </Text>
          </Animatable.View>

          {/* Área do PIN */}
          <Animatable.View animation="fadeInUp" style={styles.inputArea}>
            <Text style={styles.modalLabel}>Digite seu PIN:</Text>
            <TextInput
              style={styles.pinInput}
              value={userPin}
              onChangeText={setUserPin}
              placeholder="Ex: 1234"
              placeholderTextColor="#888"
              secureTextEntry
            />
          </Animatable.View>

          {/* Área dos botões */}
          {loading ? (
            <ActivityIndicator color={RED} size="large" style={{ marginVertical: 20 }} />
          ) : (
            <>
              <Animatable.View animation="fadeInUp" delay={100} style={styles.voteContainer}>
                <TouchableOpacity
                  style={styles.voteButton}
                  onPress={() => sendVote("Vitória Jogador 1")}
                >
                  <MaterialCommunityIcons name="trophy" size={26} color="#4CAF50" />
                  <Text style={styles.voteText}>
                    Vitória: {player1Name || "Jogador 1"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.voteButton, { marginHorizontal: 8 }]}
                  onPress={() => sendVote("Vitória Jogador 2")}
                >
                  <MaterialCommunityIcons name="trophy" size={26} color="#F44336" />
                  <Text style={styles.voteText}>
                    Vitória: {player2Name || "Jogador 2"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.voteButton}
                  onPress={() => sendVote("Empate")}
                >
                  <Ionicons name="hand-left" size={26} color="#FFC107" />
                  <Text style={styles.voteText}>Empate</Text>
                </TouchableOpacity>
              </Animatable.View>

              <Animatable.View animation="fadeInUp" delay={150}>
                <TouchableOpacity style={styles.clearButton} onPress={clearVote}>
                  <Ionicons name="trash-bin" size={24} color="#fff" />
                  <Text style={styles.clearButtonText}>Limpar Resultado</Text>
                </TouchableOpacity>
              </Animatable.View>
            </>
          )}

          {/* Feedback visual para o usuário */}
          {feedbackMessage !== "" && (
            <Animatable.Text
              style={styles.feedbackText}
              animation="pulse"
              duration={500}
              easing="ease-in-out"
            >
              {feedbackMessage}
            </Animatable.Text>
          )}

          {/* Botão de Fechar */}
          <Animatable.View animation="fadeInUp" delay={200} style={styles.closeBtnContainer}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#FFF" />
              <Text style={styles.closeText}>Fechar</Text>
            </TouchableOpacity>
          </Animatable.View>
        </Animatable.View>
      </Animatable.View>
    </Modal>
  );
}

// ====================== ESTILOS ======================
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    // Gradient no background (fake gradient) + fallback
    backgroundColor: DARK_GRAY,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.88,
    backgroundColor: "#2D2D2D",
    borderRadius: 20,
    padding: 24,
    overflow: "hidden",
    elevation: 10,
  },
  modalHeader: {
    marginBottom: 16,
    alignItems: "center",
  },
  modalTitle: {
    color: WHITE,
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
  },
  modalSubtitle: {
    color: "#BBB",
    fontSize: 14,
    marginBottom: 8,
    textAlign: "center",
  },
  playersText: {
    color: WHITE,
    fontSize: 16,
    marginBottom: 8,
    textAlign: "center",
    fontWeight: "600",
  },
  inputArea: {
    marginBottom: 16,
  },
  modalLabel: {
    color: WHITE,
    fontSize: 14,
    marginBottom: 4,
  },
  pinInput: {
    backgroundColor: "#444",
    color: WHITE,
    fontSize: 16,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  voteContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 12,
  },
  voteButton: {
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: "#333",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    minWidth: 90,
  },
  voteText: {
    color: WHITE,
    marginTop: 6,
    fontSize: 13,
    textAlign: "center",
    fontWeight: "600",
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: RED,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: "center",
  },
  clearButtonText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  feedbackText: {
    color: WHITE,
    fontSize: 14,
    textAlign: "center",
    marginVertical: 12,
    fontWeight: "600",
  },
  closeBtnContainer: {
    alignItems: "center",
    marginTop: 8,
  },
  closeBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#444",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: "center",
  },
  closeText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: "bold",
    marginLeft: 6,
  },
});
