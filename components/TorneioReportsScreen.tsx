// ====================== TorneioReportsScreen.tsx ======================
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  BackHandler,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Animatable from "react-native-animatable";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

// Função para buscar membros do role host – ajuste o caminho conforme necessário
import { fetchRoleMembers } from "../app/hosts";

// ======== Cores/Constantes ========
const RED = "#E3350D";
const DARK_GRAY = "#1E1E1E";
const LIGHT_GRAY = "#444";
const WHITE = "#FFFFFF";
const SUCCESS_GREEN = "#4CAF50";
const WARNING_YELLOW = "#FFC107";
const DANGER_RED = "#F44336";

interface ReportData {
  final: Record<string, string>;
  partial: Record<string, Record<string, string>>;
}

interface TorneioReportsScreenProps {
  visible: boolean;
  onClose: () => void;
}

export default function TorneioReportsScreen({
  visible,
  onClose,
}: TorneioReportsScreenProps) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState<boolean>(true);
  const [reports, setReports] = useState<ReportData>({ final: {}, partial: {} });
  const [mesaData, setMesaData] = useState<Record<string, any>>({});
  const [isHost, setIsHost] = useState<boolean>(false);
  const [leagueName, setLeagueName] = useState<string>("Torneio");
  const [userName, setUserName] = useState<string>("Jogador");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Fechar modal com o botão físico (BackHandler)
  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => {
      backHandler.remove();
    };
  }, [onClose]);

  // Carrega os dados assim que o modal fica visível
  useEffect(() => {
    if (visible) {
      loadReports();
    }
  }, [visible]);

  async function loadReports() {
    try {
      setLoading(true);
      setErrorMsg("");

      // Obtém dados do AsyncStorage
      const leagueId = await AsyncStorage.getItem("@leagueId");
      const firebaseToken = await AsyncStorage.getItem("@firebaseToken");
      const storedName = await AsyncStorage.getItem("@userName");
      setUserName(storedName || "Jogador");

      if (!leagueId) {
        setErrorMsg("Nenhuma liga selecionada no app.");
        setLoading(false);
        return;
      }

      // Verifica se o usuário é host
      await checkIfHost(leagueId);

      // 1. Busca os resultados via API get-resultados
      const resResults = await fetch(
        `https://Doprado.pythonanywhere.com/get-resultados?league_id=${leagueId}`,
        {
          method: "GET",
          headers: { Authorization: firebaseToken ? `Bearer ${firebaseToken}` : "" },
        }
      );
      if (!resResults.ok) {
        const errText = await resResults.text();
        setErrorMsg(`Erro ao buscar resultados: ${resResults.status} - ${errText}`);
        setLoading(false);
        return;
      }
      const dataResults = await resResults.json();
      if (dataResults.error) {
        setErrorMsg(dataResults.error);
        setLoading(false);
        return;
      }
      setReports({
        final: dataResults.final || {},
        partial: dataResults.partial || {},
      });

      // 2. Busca informações adicionais da liga (get-league-info)
      const resLeagueInfo = await fetch(`https://Doprado.pythonanywhere.com/get-league-info`, {
        method: "GET",
        headers: { Authorization: firebaseToken ? `Bearer ${firebaseToken}` : "" },
      });
      if (resLeagueInfo.ok) {
        const infoData = await resLeagueInfo.json();
        setLeagueName(infoData.leagueName || "Torneio");
      }

      // 3. Busca os dados do torneio para obter todas as mesas (get-data)
      const resTorneio = await fetch(`https://Doprado.pythonanywhere.com/get-data/${leagueId}`, {
        method: "GET",
        headers: { Authorization: firebaseToken ? `Bearer ${firebaseToken}` : "" },
      });
      if (resTorneio.ok) {
        const dataTorneio = await resTorneio.json();
        // Extraímos as mesas da rodada atual
        const roundObj = dataTorneio.round ?? {};
        const roundKeys = Object.keys(roundObj).map((rk) => parseInt(rk, 10));
        if (roundKeys.length > 0) {
          const latestRound = Math.max(...roundKeys);
          const divisions = roundObj[String(latestRound)] || {};
          const divisionKeys = Object.keys(divisions);
          if (divisionKeys.length > 0) {
            const currentDivision = divisionKeys[0];
            const tables = divisions[currentDivision]?.table ?? {};
            setMesaData(tables);
          } else {
            setMesaData({});
          }
        } else {
          setMesaData({});
        }
      }
      setLoading(false);
    } catch (error: any) {
      setErrorMsg("Falha ao carregar resultados do torneio.");
      setLoading(false);
    }
  }

  async function checkIfHost(leagueId: string) {
    try {
      const userId = await AsyncStorage.getItem("@userId");
      if (!userId) {
        setIsHost(false);
        return;
      }
      const hostMembers = await fetchRoleMembers(leagueId, "host");
      const found = hostMembers.find((h: any) => h.userId === userId);
      setIsHost(!!found);
    } catch (err) {
      setIsHost(false);
    }
  }

  async function handleLimparResultados() {
    try {
      const firebaseToken = await AsyncStorage.getItem("@firebaseToken");
      const res = await fetch("https://Doprado.pythonanywhere.com/limpar-resultados", {
        method: "POST",
        headers: { Authorization: firebaseToken ? `Bearer ${firebaseToken}` : "" },
      });
      const json = await res.json();
      Alert.alert("Info", json.message || "Resultados limpos!");
      await loadReports();
    } catch (error) {
      Alert.alert("Erro", "Falha ao limpar resultados.");
    }
  }

  async function handleClearResultForMesa(mesa: string) {
    try {
      const leagueId = await AsyncStorage.getItem("@leagueId");
      const firebaseToken = await AsyncStorage.getItem("@firebaseToken");
      if (!leagueId) {
        Alert.alert("Erro", "Liga não encontrada.");
        return;
      }
      const body = { league_id: leagueId, mesa_id: mesa };
      const res = await fetch("https://Doprado.pythonanywhere.com/clear-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: firebaseToken ? `Bearer ${firebaseToken}` : "",
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      Alert.alert("Info", json.message || "Resultado limpo!");
      await loadReports();
    } catch (error) {
      Alert.alert("Erro", "Falha ao limpar o resultado.");
    }
  }

  // Renderiza o card de cada mesa
  function renderResultCard(mesa: string) {
    // Dados da mesa
    const tableInfo = mesaData[mesa];
    const p1Name = tableInfo?.player1 || "Jogador 1";
    const p2Name = tableInfo?.player2 || "Jogador 2";

    // Obtém votos
    const finalResult = reports.final[mesa];
    const partialVotes = reports.partial[mesa];

    // Valores padrões
    let voteP1 = "Aguardando voto";
    let voteP2 = "Aguardando voto";
    let statusText = "";
    let statusIcon = null;
    let cardBorderColor = WARNING_YELLOW; // aguardando

    if (!finalResult && !partialVotes) {
      statusText = "Status da mesa: Jogando";
    } else if (partialVotes) {
      const voteEntries = Object.entries(partialVotes);
      if (voteEntries.length === 1) {
        // Um voto
        const votedPlayerId = voteEntries[0][0];
        const votedVote = voteEntries[0][1];
        if (tableInfo && tableInfo.player1_id === votedPlayerId) {
          voteP1 = votedVote;
        } else {
          voteP2 = votedVote;
        }
        statusText = "Status da mesa: Aguardando outro Voto";
      } else if (voteEntries.length === 2) {
        // Dois votos
        const votes = voteEntries.map(([, vote]) => vote);
        voteP1 = partialVotes[tableInfo.player1_id] || "Aguardando voto";
        voteP2 = partialVotes[tableInfo.player2_id] || "Aguardando voto";
        if (votes[0] === votes[1]) {
          statusText = `Status da mesa: Vencedor: ${votes[0]}`;
          cardBorderColor = SUCCESS_GREEN;
          statusIcon = (
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={22}
              color={SUCCESS_GREEN}
            />
          );
        } else {
          statusText = "Status da mesa: Votos divergentes";
          cardBorderColor = DANGER_RED;
          statusIcon = (
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={22}
              color={DANGER_RED}
            />
          );
        }
      }
    } else if (finalResult) {
      // Resultado final
      voteP1 =
        partialVotes && partialVotes[tableInfo.player1_id]
          ? partialVotes[tableInfo.player1_id]
          : "Voto confirmado";
      voteP2 =
        partialVotes && partialVotes[tableInfo.player2_id]
          ? partialVotes[tableInfo.player2_id]
          : "Voto confirmado";
      statusText = `Status da mesa: Resultado Final: ${finalResult}`;
      cardBorderColor = SUCCESS_GREEN;
      statusIcon = (
        <MaterialCommunityIcons
          name="check-circle-outline"
          size={22}
          color={SUCCESS_GREEN}
        />
      );
    }

    // Card estilizado + animação
    return (
      <Animatable.View
        key={mesa}
        style={[styles.resultCard, { borderColor: cardBorderColor }]}
        animation="fadeInUp"
        duration={600}
      >
        <Text style={styles.cardLine}>
          <Text style={styles.label}>Mesa:</Text> {mesa}
        </Text>
        <Text style={styles.cardLine}>
          <Text style={styles.label}>Jogadores:</Text> {p1Name} vs {p2Name}
        </Text>
        <Text style={styles.cardLine}>
          <Text style={styles.label}>Jogador 1:</Text> {voteP1}
        </Text>
        <Text style={styles.cardLine}>
          <Text style={styles.label}>Jogador 2:</Text> {voteP2}
        </Text>
        <View style={styles.statusContainer}>
          {statusIcon}
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
        {isHost && (
          <Animatable.View animation="pulse" duration={1000} iterationCount="infinite">
            <TouchableOpacity
              style={styles.cardClearButton}
              onPress={() => handleClearResultForMesa(mesa)}
            >
              <MaterialCommunityIcons name="trash-can" size={20} color={WHITE} />
              <Text style={styles.cardClearButtonText}>Limpar</Text>
            </TouchableOpacity>
          </Animatable.View>
        )}
      </Animatable.View>
    );
  }

  const mesas = Object.keys(mesaData);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Overlay com visual modernão */}
      <Animatable.View
        style={styles.overlay}
        animation="fadeIn"
        duration={400}
        onTouchEnd={() => {}}
      >
        {/* Container principal */}
        <Animatable.View
          style={styles.modalContainer}
          animation="zoomInUp"
          duration={500}
          easing="ease-out"
        >
          <View style={styles.headerArea}>
            <Ionicons name="trophy-outline" size={32} color="#FFD700" />
            <Text style={styles.modalHeader}>
              {`${userName}, bem-vindo à ${leagueName}`}
            </Text>
          </View>

          <Animatable.Text
            style={styles.modalTitle}
            animation="fadeInDown"
            duration={600}
          >
            Resultados do Torneio
          </Animatable.Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={RED} />
              <Text style={styles.loadingText}>Carregando resultados...</Text>
            </View>
          ) : errorMsg ? (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={48}
                color={WHITE}
              />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : mesas.length === 0 ? (
            <View style={styles.infoContainer}>
              <Text style={styles.infoText}>Nenhuma mesa encontrada.</Text>
            </View>
          ) : (
            // Scroll com as mesas
            <ScrollView contentContainerStyle={styles.resultsContainer}>
              {mesas.map((mesa) => renderResultCard(mesa))}
            </ScrollView>
          )}

          {/* Botões Extras para o Host */}
          {/* Botão de Voltar */}
          <Animatable.View animation="fadeInUp" delay={200} style={styles.footerArea}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="arrow-back" size={20} color={WHITE} />
              <Text style={styles.closeButtonText}>Voltar</Text>
            </TouchableOpacity>
          </Animatable.View>
        </Animatable.View>
      </Animatable.View>
    </Modal>
  );
}

// ====================== Estilos ======================
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    flex: 1,
    width: "100%",
    backgroundColor: DARK_GRAY,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerArea: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalHeader: {
    color: WHITE,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginLeft: 8,
  },
  modalTitle: {
    color: RED,
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
  },
  loadingContainer: {
    alignItems: "center",
    marginVertical: 20,
  },
  loadingText: {
    color: WHITE,
    marginTop: 10,
    fontSize: 16,
  },
  resultsContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  infoContainer: {
    alignItems: "center",
    marginVertical: 20,
  },
  infoText: {
    color: "#ccc",
    fontSize: 16,
    textAlign: "center",
  },
  errorContainer: {
    alignItems: "center",
    marginVertical: 20,
  },
  errorText: {
    color: WHITE,
    fontSize: 18,
    textAlign: "center",
    marginTop: 10,
  },

  // Cartões
  resultCard: {
    backgroundColor: LIGHT_GRAY,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
  },
  cardLine: {
    fontSize: 16,
    marginBottom: 4,
    color: WHITE,
  },
  label: {
    fontWeight: "bold",
    color: RED,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  statusText: {
    fontSize: 16,
    color: WHITE,
    marginLeft: 8,
  },
  cardClearButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: RED,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    marginTop: 12,
    alignSelf: "flex-end",
  },
  cardClearButtonText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: "bold",
    marginLeft: 6,
  },

  // Botão para limpar TODOS (Host)
  hostButtonContainer: {
    marginVertical: 10,
    alignItems: "center",
  },
  clearAllButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DANGER_RED,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  clearAllButtonText: {
    color: WHITE,
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "bold",
  },

  // Rodapé
  footerArea: {
    alignItems: "center",
    marginTop: 10,
  },
  closeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: RED,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: "center",
  },
  closeButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 6,
  },
});
