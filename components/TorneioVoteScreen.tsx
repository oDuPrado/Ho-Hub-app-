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
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import * as Animatable from "react-native-animatable";
import CustomModal from "../components/CustomModal"; // Importa o modal estilizado

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

/**
 * Este componente permite que o jogador envie votos para a mesa.
 * Agora, ele carrega automaticamente o PIN do usuário do AsyncStorage
 * e exibe um botão "Oponente votar" para quem quiser digitar outro PIN manualmente.
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
  // PIN do usuário, carregado automaticamente do AsyncStorage
  const [userPin, setUserPin] = useState("");

  // Se estiver true, mostramos o campo para digitar manualmente um PIN (ex: para o oponente)
  const [showPinInput, setShowPinInput] = useState(false);

  // Indicador de loading durante o envio de votos
  const [loading, setLoading] = useState(false);

  // Mensagem de feedback, mostra se o voto foi aceito ou houve algum erro
  const [feedbackMessage, setFeedbackMessage] = useState("");

  // Armazena o resultado do voto do usuário, para exibir abaixo dos botões
  const [votedResult, setVotedResult] = useState<string | null>(null);

  // Nomes dos jogadores (buscados do AsyncStorage ou props)
  const [player1Name, setPlayer1Name] = useState<string>(p1Name || "");
  const [player2Name, setPlayer2Name] = useState<string>(p2Name || "");

  // Estados para o modal personalizado
  const [showOpponentVoteModal, setShowOpponentVoteModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  // Estados do modal de confirmação
const [showConfirmReportModal, setShowConfirmReportModal] = useState(false);
const [selectedReport, setSelectedReport] = useState<string | null>(null);

// Estados do modal de Limpar Resultdos
const [showConfirmClearModal, setShowConfirmClearModal] = useState(false);

  /**
   * Ao abrir o modal (visible = true), limpamos o feedback,
   * carregamos o PIN do AsyncStorage e obtemos os nomes dos jogadores.
   */
  useEffect(() => {
    if (visible) {
      setFeedbackMessage("");
      setVotedResult(null);

      // Carrega o PIN automaticamente do AsyncStorage
      async function fetchUserPinFromStorage() {
        try {
          const storedPin = await AsyncStorage.getItem("@userPin");
          if (storedPin) {
            setUserPin(storedPin);
            // Se temos PIN salvo, não mostramos o campo para digitar, a não ser que oponha "Oponente votar"
            setShowPinInput(false);
          } else {
            // Se não temos PIN salvo, forçamos a exibição do campo
            setUserPin("");
            setShowPinInput(true);
          }
        } catch (error) {
          console.log("Erro ao buscar PIN do AsyncStorage:", error);
          // Em caso de erro, exibimos o input para não travar o usuário
          setUserPin("");
          setShowPinInput(true);
        }
      }

      // Busca nomes de jogador1 e jogador2, caso não venham via props
      async function fetchPlayerNames() {
        if (!p1Name) {
          const storedP1 = await AsyncStorage.getItem("@player1Name");
          setPlayer1Name(storedP1 || "Jogador 1");
        }
        if (!p2Name) {
          const storedP2 = await AsyncStorage.getItem("@player2Name");
          setPlayer2Name(storedP2 || "Jogador 2");
        }
      }

      // Executa as duas buscas em paralelo
      fetchUserPinFromStorage();
      fetchPlayerNames();
    }
  }, [visible, p1Name, p2Name]);

  // Debug dos nomes no console
  useEffect(() => {
    console.log("Nome atualizado do Jogador 1:", player1Name);
    console.log("Nome atualizado do Jogador 2:", player2Name);
  }, [player1Name, player2Name]);

  useEffect(() => {
    console.log("📌 votedResult recebido:", votedResult);
  }, [votedResult]);

  /**
   * Envia o voto para a API, usando o PIN (pode ser o salvo ou digitado).
   */
  async function sendVote(result: string) {
    try {
      setLoading(true);
      setFeedbackMessage("");
  
      const storedLeagueId = await AsyncStorage.getItem("@leagueId");
      const firebaseToken = await AsyncStorage.getItem("@firebaseToken");
      const storedUserId = await AsyncStorage.getItem("@userId");
  
      console.log("🔍 Enviando voto...", {
        league_id: storedLeagueId,
        mesa_id: mesaId,
        resultado: result,
        pin: userPin,
        token: firebaseToken ? "EXISTE" : "NÃO EXISTE",
      });
  
      if (!storedLeagueId || !mesaId || !firebaseToken || !storedUserId) {
        Alert.alert("Erro", "Dados incompletos. Verifique sua conta e tente novamente.");
        console.error("⛔ Erro: Dados incompletos antes da requisição!");
        setLoading(false);
        return;
      }
  
      if (!userPin.trim()) {
        Alert.alert("Erro", "Digite seu PIN antes de votar!");
        console.error("⛔ Erro: PIN não preenchido!");
        setLoading(false);
        return;
      }
  
      const body = {
        league_id: storedLeagueId,
        mesa_id: mesaId,
        resultado: result,
        pin: userPin.trim(),
      };
  
      console.log("📡 Enviando requisição para API...", body);
  
      const resp = await fetch("https://Doprado.pythonanywhere.com/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firebaseToken}`,
        },
        body: JSON.stringify(body),
      });
  
      const json = await resp.json();
  
      console.log("📩 Resposta da API:", json);
  
      if (resp.status === 409) {
        Alert.alert("Erro", "⚠️ Você já registrou um voto nesta mesa.");
        setFeedbackMessage("⚠️ Você já votou!");
      } else if (!resp.ok) {
        console.error("⛔ Erro ao votar:", json);
        Alert.alert("Erro", json.message || "Falha ao registrar reporte.");
        setFeedbackMessage(json.message || "Erro ao registrar reporte.");
      } else {
        console.log("✅ Reporte registrado com sucesso!", json);
  
        // ✅ Se ainda não há resultado final, exibir o próprio voto do jogador
        if (json.final_outcome === null) {
          setFeedbackMessage("✅ Seu voto foi registrado! Aguardando o outro jogador.");
          setVotedResult(result); // Exibe o que o jogador votou ao invés de "Aguardando outro jogador..."
        } else {
          setFeedbackMessage(json.message || "Reporte registrado com sucesso!");
          setVotedResult(json.final_outcome); // Agora pega o resultado correto!
        }
      }
    } catch (err) {
      console.error("⛔ Erro no reporte:", err);
      Alert.alert("Erro", "Não foi possível conectar ao servidor.");
      setFeedbackMessage("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }      
  
  /**
   * Limpa o voto (clear-report) para a mesa atual, chamando a API.
   */
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

      console.log("Enviando requisição para limpar resultado:", body);

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
        console.error("Erro ao limpar resultado:", json);
        Alert.alert("Erro", json.message || "Falha ao limpar resultado.");
        setFeedbackMessage(json.message || "Erro ao limpar resultado.");
      } else {
        console.log("Resultado limpo com sucesso!", json);
        setFeedbackMessage(json.message || "Resultado limpo com sucesso!");
        setVotedResult(null);
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
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Overlay com fundo escuro */}
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
              Mesa {mesaId ?? "?"} <Ionicons name="play" color="#FFD700" size={20} />
            </Text>
            <Text style={styles.modalSubtitle}>Jogadores</Text>
            <Text style={styles.playersText}>
              {player1Name || "Jogador 1"} <Ionicons name="flash" size={18} color="#FFD700" />
              {" vs "}
              <Ionicons name="flash" size={18} color="#FFD700" />{" "}
              {player2Name || "Jogador 2"}
            </Text>
          </Animatable.View>

          {/* Caso o PIN esteja carregado e não tenhamos clicado em "Outro jogador votar", mostramos um aviso + botão para abrir o input */}
          {!showPinInput && userPin ? (
            <Animatable.View animation="fadeIn" style={styles.autoPinContainer}>
              <Ionicons name="key" size={22} color={WHITE} style={{ marginBottom: 4 }} />
              <Text style={styles.autoPinText}>
                Seu PIN foi carregado automaticamente. 
                Caso oponente queira votar neste dispositivo, clique abaixo:
              </Text>
              <TouchableOpacity
                style={styles.opponentVoteButton}
                onPress={() => {
                  setModalTitle("Reporte do Oponente");
                  setModalMessage(
                    "Se você quiser liberar para seu oponente reportar por este dispositivo, ele pode inserir o PIN manualmente no campo em branco."
                  );
                  setShowOpponentVoteModal(true);
                }}
              >
                <Ionicons name="person-add" size={20} color={WHITE} />
                <Text style={styles.opponentVoteText}>Reporte do Oponente</Text>
              </TouchableOpacity>
                
              {/* Exibe Modal De alerta */}
              <CustomModal
              visible={showOpponentVoteModal}
              onClose={() => setShowOpponentVoteModal(false)} // Fecha o modal sem alterar nada
              title={modalTitle}
              message={modalMessage}
              buttons={[
                {
                  text: "Permitir",
                  onPress: () => {
                    setShowOpponentVoteModal(false);
                    setShowPinInput(true);
                    setUserPin(""); // Limpa o campo PIN
                  },
                },
                {
                  text: "Cancelar",
                  onPress: () => setShowOpponentVoteModal(false),
                  style: "cancel", // Define estilo para botão secundário
                },
              ]}
            />
            </Animatable.View>
          ) : (
            /* Área do PIN para digitar manualmente */
            <Animatable.View animation="fadeInUp" style={styles.inputArea}>
              <Text style={styles.modalLabel}>Digite seu PIN:</Text>
              <TextInput
                style={styles.pinInput}
                value={userPin}
                onChangeText={(text) => setUserPin(text.replace(/[^0-9]/g, ""))}
                keyboardType="numeric"
                placeholder="Ex: 1234"
                placeholderTextColor="#888"
                secureTextEntry
              />
            </Animatable.View>
          )}


          {/* Área dos botões (Votos e Limpar) */}
          {loading ? (
            <ActivityIndicator color={RED} size="large" style={{ marginVertical: 20 }} />
          ) : (
            <>
              <Animatable.View animation="fadeInUp" delay={100} style={styles.voteContainer}>
              <TouchableOpacity
                style={styles.voteButton}
                onPress={() => {
                  setSelectedReport(`Vitória: ${player1Name || "Jogador 1"}`);
                  setShowConfirmReportModal(true);
                }}
              >
                <MaterialCommunityIcons name="trophy" size={26} color="#4CAF50" />
                <Text style={styles.voteText}>
                  Vitória: {player1Name || "Jogador 1"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.voteButton}
                onPress={() => {
                  setSelectedReport("Empate");
                  setShowConfirmReportModal(true);
                }}
              >
                <Ionicons name="hand-left" size={26} color="#FFC107" />
                <Text style={styles.voteText}>Empate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.voteButton, { marginHorizontal: 8 }]}
                onPress={() => {
                  setSelectedReport(`Vitória: ${player2Name || "Jogador 2"}`);
                  setShowConfirmReportModal(true);
                }}
              >
                <MaterialCommunityIcons name="trophy" size={26} color="#F44336" />
                <Text style={styles.voteText}>
                  Vitória: {player2Name || "Jogador 2"}
                </Text>
              </TouchableOpacity>
            </Animatable.View>

                {/* Modal de Confirmação de Reporte */}
            <CustomModal
              visible={showConfirmReportModal}
              onClose={() => setShowConfirmReportModal(false)}
              title="Confirmar Reporte"
              message={
                <View style={{ alignItems: "center" }}>
                  <Text style={{ color: "#FFD700", fontSize: 18, fontWeight: "bold" }}>
                    {selectedReport}
                  </Text>
                  <Text style={{ color: "#FFF", fontSize: 16, marginTop: 4 }}>
                    Confirma?
                  </Text>
                </View>
              }                         
              buttons={[
                {
                  text: "Sim",
                  onPress: () => {
                    if (selectedReport) {
                      const result = selectedReport.includes("Vitória")
                        ? selectedReport.replace("Vitória: ", "Vitória ")
                        : selectedReport;
              
                      sendVote(result);
                      setShowConfirmReportModal(false);
                    }
                  },
                },
                {
                  text: "Não",
                  onPress: () => setShowConfirmReportModal(false),
                  style: "cancel",
                },
              ]}
            />
            <Animatable.View animation="fadeInUp" delay={150}>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setShowConfirmClearModal(true)} // Abre o modal de confirmação
              >
                <Ionicons name="trash-bin" size={24} color="#fff" />
                <Text style={styles.clearButtonText}>Limpar Resultado</Text>
              </TouchableOpacity>
            </Animatable.View>
            </>
          )}

           {/* Modal de Limpar reportes */}
           <CustomModal
            visible={showConfirmClearModal}
            onClose={() => setShowConfirmClearModal(false)} // Fecha o modal ao cancelar
            title="Confirmar Limpeza"
            message="Limpando Resultados das Mesas."
            buttons={[
              {
                text: "Sim",
                onPress: () => {
                  clearVote();
                  setShowConfirmClearModal(false);
                },
              },
              {
                text: "Cancelar",
                onPress: () => setShowConfirmClearModal(false),
                style: "cancel",
              },
            ]}
          />

          {/* Feedback do voto (quem já votou) */}
          {votedResult && (
          <Animatable.Text
            style={styles.votedResultText}
            animation="fadeIn"
            duration={600}
            easing="ease-in-out"
          >
            Seu reporte atual:{" "}
            {votedResult.startsWith("Vitória ") // Se começa com "Vitória "
              ? votedResult // Exibe o nome do jogador corretamente
              : votedResult === "Empate"
              ? "Empate"
              : "Erro ao processar resultado"}
          </Animatable.Text>
        )}

          {/* Feedback geral (erros ou sucesso do servidor) */}
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
  autoPinContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  autoPinText: {
    color: WHITE,
    fontSize: 15,
    marginTop: 8,
  },
  opponentVoteButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: RED,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  opponentVoteText: {
    color: WHITE,
    fontSize: 15,
    marginLeft: 6,
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
    justifyContent: "space-around",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  voteButton: {
    flex: 1,
    marginHorizontal: 4,
    alignItems: "center",
    backgroundColor: "#333",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  voteText: {
    color: WHITE,
    marginTop: 6,
    fontSize: 13,
    textAlign: "center",
    fontWeight: "800",
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
  votedResultText: {
    color: "#FFD700",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 12,
    marginBottom: 2,
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
