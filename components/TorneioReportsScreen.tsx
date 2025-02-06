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

const RED = "#E3350D";
const DARK_GRAY = "#292929";
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

  // Renderiza o card de cada mesa com layout estilizado
  function renderResultCard(mesa: string) {
    // Obtém dados da mesa do torneio (números e nomes dos jogadores)
    const tableInfo = mesaData[mesa];
    const p1Name = tableInfo?.player1 || "Jogador 1";
    const p2Name = tableInfo?.player2 || "Jogador 2";

    // Obtém os votos para a mesa
    const finalResult = reports.final[mesa];
    const partialVotes = reports.partial[mesa];

    // Variáveis para armazenar os votos de cada jogador
    let voteP1 = "Aguardando voto";
    let voteP2 = "Aguardando voto";
    let statusText = "";
    let statusIcon = null;
    let cardBorderColor = WARNING_YELLOW; // padrão: aguardando

    if (!finalResult && !partialVotes) {
      statusText = "Status da mesa: Jogando";
    } else if (partialVotes) {
      const voteEntries = Object.entries(partialVotes);
      if (voteEntries.length === 1) {
        // Apenas um voto registrado
        const votedPlayerId = voteEntries[0][0];
        const votedVote = voteEntries[0][1];
        if (tableInfo && tableInfo.player1_id === votedPlayerId) {
          voteP1 = votedVote;
        } else {
          voteP2 = votedVote;
        }
        statusText = "Status da mesa: Aguardando outro Voto";
      } else if (voteEntries.length === 2) {
        // Dois votos registrados
        const votes = voteEntries.map(([, vote]) => vote);
        // Assume que tableInfo possui os IDs
        voteP1 = partialVotes[tableInfo.player1_id] || "Aguardando voto";
        voteP2 = partialVotes[tableInfo.player2_id] || "Aguardando voto";
        if (votes[0] === votes[1]) {
          statusText = `Status da mesa: Vencedor: ${votes[0]}`;
          cardBorderColor = SUCCESS_GREEN;
          statusIcon = <MaterialCommunityIcons name="check-circle-outline" size={20} color={SUCCESS_GREEN} />;
        } else {
          statusText = "Status da mesa: Votos divergentes";
          cardBorderColor = DANGER_RED;
          statusIcon = <MaterialCommunityIcons name="alert-circle-outline" size={20} color={DANGER_RED} />;
        }
      }
    } else if (finalResult) {
      // Resultado final já definido
      voteP1 = partialVotes && partialVotes[tableInfo.player1_id] ? partialVotes[tableInfo.player1_id] : "Voto confirmado";
      voteP2 = partialVotes && partialVotes[tableInfo.player2_id] ? partialVotes[tableInfo.player2_id] : "Voto confirmado";
      statusText = `Status da mesa: Resultado Final: ${finalResult}`;
      cardBorderColor = SUCCESS_GREEN;
      statusIcon = <MaterialCommunityIcons name="check-circle-outline" size={20} color={SUCCESS_GREEN} />;
    }

    return (
      <Animatable.View
        key={mesa}
        style={[styles.resultCard, { borderColor: cardBorderColor }]}
        animation="fadeInUp"
        duration={600}
      >
        <Text style={styles.cardLine}><Text style={styles.label}>Mesa:</Text> {mesa}</Text>
        <Text style={styles.cardLine}><Text style={styles.label}>Jogadores:</Text> {p1Name} vs {p2Name}</Text>
        <Text style={styles.cardLine}><Text style={styles.label}>Jogador 1:</Text> {voteP1}</Text>
        <Text style={styles.cardLine}><Text style={styles.label}>Jogador 2:</Text> {voteP2}</Text>
        <View style={styles.statusContainer}>
          {statusIcon}
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
        {isHost && (
          <TouchableOpacity style={styles.cardClearButton} onPress={() => handleClearResultForMesa(mesa)}>
            <MaterialCommunityIcons name="trash-can" size={20} color={WHITE} />
            <Text style={styles.cardClearButtonText}>Limpar</Text>
          </TouchableOpacity>
        )}
      </Animatable.View>
    );
  }

  // Lista de mesas obtida dos dados do torneio
  const mesas = Object.keys(mesaData);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Animatable.View style={styles.overlay} animation="fadeIn" duration={300}>
        <Animatable.View style={styles.modalContainer} animation="zoomIn" duration={300}>
          <Text style={styles.modalHeader}>{`${userName}, bem-vindo à ${leagueName}`}</Text>
          <Text style={styles.modalTitle}>Resultados do Torneio</Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={RED} />
              <Text style={styles.loadingText}>Carregando resultados...</Text>
            </View>
          ) : errorMsg ? (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle-outline" size={48} color={WHITE} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : mesas.length === 0 ? (
            <View style={styles.infoContainer}>
              <Text style={styles.infoText}>Nenhuma mesa encontrada.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.resultsContainer}>
              {mesas.map((mesa) => renderResultCard(mesa))}
            </ScrollView>
          )}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Voltar</Text>
          </TouchableOpacity>
        </Animatable.View>
      </Animatable.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    flex: 1,
    width: "100%",
    backgroundColor: DARK_GRAY,
    padding: 20,
  },
  modalHeader: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
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
    marginTop: 6,
  },
  statusText: {
    fontSize: 16,
    color: WHITE,
    marginLeft: 6,
  },
  cardClearButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: RED,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 12,
    alignSelf: "flex-end",
  },
  cardClearButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 4,
  },
  clearButton: {
    backgroundColor: RED,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    alignSelf: "center",
  },
  clearButtonText: {
    color: WHITE,
    fontSize: 18,
    fontWeight: "bold",
  },
  closeButton: {
    backgroundColor: RED,
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignSelf: "center",
    marginTop: 20,
  },
  closeButtonText: {
    color: WHITE,
    fontSize: 18,
    fontWeight: "bold",
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
});
