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

// Se você usa essa função para buscar membros do role host
import { fetchRoleMembers } from "../app/hosts";

// Cores/Constantes
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

  // Fecha modal ao apertar botão físico de voltar
  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => {
      backHandler.remove();
    };
  }, [onClose]);

  // Carrega dados assim que o modal fica visível
  useEffect(() => {
    if (visible) {
      loadReports();
    }
  }, [visible]);

  async function loadReports() {
    try {
      setLoading(true);
      setErrorMsg("");

      const leagueId = await AsyncStorage.getItem("@leagueId");
      const firebaseToken = await AsyncStorage.getItem("@firebaseToken");
      const storedName = await AsyncStorage.getItem("@userName");
      setUserName(storedName || "Jogador");

      if (!leagueId) {
        setErrorMsg("Nenhuma liga selecionada no app.");
        setLoading(false);
        return;
      }

      await checkIfHost(leagueId);

      // 1. Busca resultados
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

      // 2. Busca info da liga
      const resLeagueInfo = await fetch(
        "https://Doprado.pythonanywhere.com/get-league-info",
        {
          method: "GET",
          headers: { Authorization: firebaseToken ? `Bearer ${firebaseToken}` : "" },
        }
      );
      if (resLeagueInfo.ok) {
        const infoData = await resLeagueInfo.json();
        setLeagueName(infoData.leagueName || "Torneio");
      }

      // 3. Busca dados do torneio (mesas visuais finais)
      const resTorneio = await fetch(
        `https://Doprado.pythonanywhere.com/get-data/${leagueId}`,
        {
          method: "GET",
          headers: { Authorization: firebaseToken ? `Bearer ${firebaseToken}` : "" },
        }
      );
      if (resTorneio.ok) {
        const dataTorneio = await resTorneio.json();
        const roundObj = dataTorneio.round ?? {};
        const roundKeys = Object.keys(roundObj).map((rk) => parseInt(rk, 10));
        if (roundKeys.length > 0) {
          const latestRound = Math.max(...roundKeys);
          const divisions = roundObj[String(latestRound)] || {};
          const divisionKeys = Object.keys(divisions);
          if (divisionKeys.length > 0) {
            const currentDivision = divisionKeys[0];
            const tables = divisions[currentDivision]?.table ?? {};
            // Estas "tables" já devem conter APENAS as mesas visuais (ex: "10" em vez de "2")
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

  // Mostramos SOMENTE as mesas que estão no mesaData (versão final/visual).
  function getVisualMesas(): string[] {
    return Object.keys(mesaData);
  }

  function renderResultCard(mesaVisual: string) {
    // Se a mesa não existe em mesaData (visual), não renderiza
    const tableInfo = mesaData[mesaVisual];
    if (!tableInfo) {
      return null;
    }

    const p1Name = tableInfo.player1 || "Jogador 1";
    const p2Name = tableInfo.player2 || "Jogador 2";

    // Votos e resultados dessa mesa (visual)
    const finalResult = reports.final[mesaVisual];
    const partialVotes = reports.partial[mesaVisual];

    let voteP1 = "Aguardando voto";
    let voteP2 = "Aguardando voto";
    let statusText = "";
    let statusIcon = null;
    let cardBorderColor = WARNING_YELLOW; // estado default (aguardando)

    if (!finalResult && !partialVotes) {
      statusText = "Status da mesa: Jogando";
    } else if (partialVotes) {
      const voteEntries = Object.entries(partialVotes);
      if (voteEntries.length === 1) {
        const [votedPlayerId, votedVote] = voteEntries[0];
        if (tableInfo.player1_id === votedPlayerId) {
          voteP1 = votedVote;
        } else {
          voteP2 = votedVote;
        }
        statusText = "Status da mesa: Aguardando outro Voto";
      } else if (voteEntries.length === 2) {
        const votes = voteEntries.map(([, v]) => v);
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

    return (
      <Animatable.View
        key={mesaVisual}
        style={[styles.resultCard, { borderColor: cardBorderColor }]}
        animation="fadeInUp"
        duration={600}
      >
        <Text style={styles.cardLine}>
          <Text style={styles.label}>Mesa:</Text> {mesaVisual}
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
              onPress={() => handleClearResultForMesa(mesaVisual)}
            >
              <MaterialCommunityIcons name="trash-can" size={20} color={WHITE} />
              <Text style={styles.cardClearButtonText}>Limpar</Text>
            </TouchableOpacity>
          </Animatable.View>
        )}
      </Animatable.View>
    );
  }

  const mesas = getVisualMesas();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Animatable.View style={styles.overlay} animation="fadeIn" duration={400}>
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
            <ScrollView contentContainerStyle={styles.resultsContainer}>
              {mesas.map((m) => renderResultCard(m))}
            </ScrollView>
          )}

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
  },
  closeButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 6,
  },
});
