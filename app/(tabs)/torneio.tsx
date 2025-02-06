// TorneioScreen.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Image,
  TextInput,
  Keyboard,
  Platform,
  Modal
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useTranslation } from "react-i18next";

import {
  Appbar,
  Card,
  Button,
  ActivityIndicator as PaperActivityIndicator,
} from "react-native-paper";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import * as Animatable from "react-native-animatable";

// Função para buscar membros do role host
import { fetchRoleMembers } from "../hosts"; // ajuste o caminho conforme necessário

// Importa os modais (JudgeScreen e VoteScreen) já criados
import JudgeScreen from "../../components/TorneioReportsScreen";
import VoteScreen from "../../components/TorneioVoteScreen";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const RED = "#E3350D";
const BLACK = "#1E1E1E";
const DARK_GRAY = "#292929";
const WHITE = "#FFFFFF";

export default function TorneioScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  // Estados principais
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>(t("torneio.info.none"));
  const [mesaNumber, setMesaNumber] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState<number | null>(null);
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [linkReport, setLinkReport] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [leagueName, setLeagueName] = useState("Torneio");

  // Modal de erro
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState("");

  // Modal de voto via app
  const [voteModalVisible, setVoteModalVisible] = useState(false);
  const [userPin, setUserPin] = useState("");
  const [voting, setVoting] = useState(false);

  // Modal de resultados (JudgeScreen)
  const [reportsModalVisible, setReportsModalVisible] = useState(false);

  const intervalRef = useRef<any>(null);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    requestNotificationPermission();
    fetchTournamentData();

    // Atualiza a cada 10 segundos
    intervalRef.current = setInterval(() => {
      setFetchCount((prev) => prev + 1);
    }, 60000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Sempre que fetchCount mudar, refaz a busca
  useEffect(() => {
    fetchTournamentData();
  }, [fetchCount]);

  async function requestNotificationPermission() {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        Alert.alert(
          t("torneio.alerts.attention"),
          "Permissão de notificações não concedida."
        );
      }
    } catch (error) {
      console.log("Erro ao solicitar permissões de notificação:", error);
    }
  }

  async function fetchTournamentData() {
    try {
      setLoading(true);

      const storedId = await AsyncStorage.getItem("@userId");
      const storedName = await AsyncStorage.getItem("@userName");
      const leagueId = await AsyncStorage.getItem("@leagueId");
      const firebaseToken = await AsyncStorage.getItem("@firebaseToken");

      if (!storedId) {
        showErrorModal(t("torneio.alerts.not_logged_in"));
        return;
      }
      setUserName(storedName ?? t("torneio.info.none"));

      if (!leagueId) {
        showErrorModal("Nenhuma liga selecionada. Vá em configurações.");
        return;
      }

      // Verifica se o usuário é host
      await checkIfHost(leagueId);

      // Consulta ao backend para obter os dados do torneio
      const url = `https://Doprado.pythonanywhere.com/get-data/${leagueId}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: firebaseToken ? `Bearer ${firebaseToken}` : "",
        },
      });
      if (!res.ok) {
        throw new Error(`Falha ao obter dados do torneio: ${res.status}`);
      }

      const jsonTorneio = await res.json();
      const storedUserId = await AsyncStorage.getItem("@userId"); // ID do usuário logado
      const allRounds = jsonTorneio.round ?? {}; // Pega todas as rodadas

      // 🔹 Obtém todas as rodadas disponíveis
      const availableRoundKeys = Object.keys(allRounds).map((rk) => parseInt(rk, 10)).sort((a, b) => b - a);

      if (availableRoundKeys.length === 0) {
        console.log("⚠️ Nenhuma rodada encontrada.");
        return;
      }

      const latestRoundKey = availableRoundKeys[0]; // 🔥 Pega a rodada mais recente
      const latestRoundTables = allRounds[latestRoundKey]?.None?.table ?? {}; // Pega apenas as mesas da última rodada

      let player1Name = "Jogador 1";
      let player2Name = "Jogador 2";
      let userMesaId = null;

      // 🔹 Percorre apenas as mesas da última rodada
      for (const mesaId in latestRoundTables) {
        const mesa = latestRoundTables[mesaId];

        // 🔹 Verifica se o usuário está nessa mesa
        if (mesa.player1_id === storedUserId || mesa.player2_id === storedUserId) {
          player1Name = jsonTorneio.players[mesa.player1_id]?.fullname || "Jogador 1";
          player2Name = jsonTorneio.players[mesa.player2_id]?.fullname || "Jogador 2";
          userMesaId = mesaId;

          console.log(`🎯 Mesa encontrada na RODADA ${latestRoundKey} (Mesa ${mesaId}):`);
          console.log(`   ✅ Jogador 1: ${player1Name} (ID: ${mesa.player1_id})`);
          console.log(`   ✅ Jogador 2: ${player2Name} (ID: ${mesa.player2_id})`);

          // 🔹 Salva no AsyncStorage para ser usado no modal
          await AsyncStorage.setItem("@player1Name", player1Name);
          await AsyncStorage.setItem("@player2Name", player2Name);
          await AsyncStorage.setItem("@mesaId", mesaId); // Opcional, caso precise no modal

          break; // 🔥 Sai do loop após encontrar a mesa do usuário
        }
      }

      if (!userMesaId) {
        console.log(`⚠️ Usuário não está jogando na rodada ${latestRoundKey}.`);
      }


      const roundObj = jsonTorneio.round ?? {};
      const roundKeys = Object.keys(roundObj).map((rk) => parseInt(rk, 10));
      if (roundKeys.length === 0) {
        setMesaNumber(null);
        setOpponentName(null);
        setCurrentRound(null);
        setLinkReport(null);
        setLoading(false);
        return;
      }

      const maxRound = Math.max(...roundKeys);
      setCurrentRound(maxRound);

      const divisions = roundObj[maxRound];
      const divKeys = Object.keys(divisions);
      const currentDiv = divKeys[0] ?? "None";
      const tables = divisions[currentDiv].table;

      let foundMesa: string | null = null;
      let foundOpponent: string | null = null;

      for (const tableId in tables) {
        const matchInfo = tables[tableId];
        const p1_id = matchInfo.player1_id;
        const p2_id = matchInfo.player2_id;

        if (p1_id === storedId) {
          foundMesa = tableId;
          foundOpponent = matchInfo.player2;
          break;
        } else if (p2_id === storedId) {
          foundMesa = tableId;
          foundOpponent = matchInfo.player1;
          break;
        }
      }

      setMesaNumber(foundMesa);
      setOpponentName(foundOpponent || null);

      if (foundMesa) {
        // Cria link para a mesa (caso seja necessário abrir em web)
        const link = `https://Doprado.pythonanywhere.com/${leagueId}/mesa/${foundMesa}`;
        setLinkReport(link);
        await checkRoundAndNotify(maxRound, foundMesa, foundOpponent || "");
      } else {
        setLinkReport(null);
      }

      // Opcional: busca informações adicionais da liga para o título
      const infoRes = await fetch(`https://Doprado.pythonanywhere.com/get-league-info`, {
        method: "GET",
        headers: { Authorization: firebaseToken ? `Bearer ${firebaseToken}` : "" },
      });
      if (infoRes.ok) {
        const infoData = await infoRes.json();
        setLeagueName(infoData.leagueName || "Torneio");
      }

      setLoading(false);
    } catch (err) {
      setLoading(false);
      console.log("Erro no Torneio:", err);
      showErrorModal("Falha ao carregar dados do torneio.");
    }
  }

  async function checkRoundAndNotify(rnd: number, mesa: string, oppName: string) {
    try {
      const storedRound = await AsyncStorage.getItem("@lastNotifiedRound");
      const lastNotifiedRound = storedRound ? parseInt(storedRound, 10) : 0;

      if (rnd > lastNotifiedRound) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `🔥 ${t("torneio.alerts.new_round")} - Rodada ${rnd}`,
            body: oppName
              ? `🎭 Oponente: ${oppName}\n📍 Mesa: ${mesa}\n🏆 Boa sorte!`
              : `📍 Você está na mesa ${mesa}.\n🏆 Boa sorte!`,
            data: { screen: "TorneioScreen" },
            color: RED,
            sound: "default",
            vibrate: [200, 100, 200],
            priority: "high",
          },
          trigger: null,
        });
        await AsyncStorage.setItem("@lastNotifiedRound", String(rnd));
      }
    } catch (e) {
      console.log("Falha ao notificar round:", e);
    }
  }

  async function checkIfHost(leagueId: string) {
    try {
      const userId = await AsyncStorage.getItem("@userId");
      if (!userId) return setIsHost(false);
      const hostMembers = await fetchRoleMembers(leagueId, "host");
      const found = hostMembers.find((h) => h.userId === userId);
      setIsHost(!!found);
    } catch (err) {
      console.log("Erro ao verificar se é host:", err);
      setIsHost(false);
    }
  }

  function showErrorModal(msg: string) {
    setErrorModalMessage(msg);
    setErrorModalVisible(true);
  }

  function handleCloseErrorModal() {
    setErrorModalVisible(false);
    router.replace("/(tabs)/home");
  }

  function handleOpenReport() {
    if (!linkReport) {
      Alert.alert(t("torneio.alerts.attention"), t("torneio.alerts.no_table"));
      return;
    }
    try {
      if (Platform.OS === "web") {
        window.open(linkReport, "_blank");
      } else {
        Linking.openURL(linkReport);
      }
    } catch (err) {
      console.log("Erro ao abrir link:", err);
      Alert.alert(t("common.error"), "Não foi possível abrir a página de report.");
    }
  }

  // Abre o modal de voto (VoteScreen)
  function openVoteModal() {
    setVoteModalVisible(true);
    setUserPin("");
  }

  async function sendVote(result: string) {
    try {
      setVoting(true);

      const leagueId = await AsyncStorage.getItem("@leagueId");
      const firebaseToken = await AsyncStorage.getItem("@firebaseToken");

      if (!leagueId || !mesaNumber || !firebaseToken) {
        Alert.alert("Erro", "Dados incompletos para votar.");
        setVoting(false);
        return;
      }

      if (!userPin.trim()) {
        Alert.alert("Erro", "Digite seu PIN para votar.");
        setVoting(false);
        return;
      }

      const response = await fetch("https://Doprado.pythonanywhere.com/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firebaseToken}`,
        },
        body: JSON.stringify({
          league_id: leagueId,
          mesa_id: mesaNumber,
          resultado: result,
          pin: userPin.trim(),
        }),
      });

      const json = await response.json();
      if (response.ok) {
        Alert.alert("Sucesso", json.message || "Voto registrado com sucesso!");
        setVoteModalVisible(false);
      } else {
        Alert.alert("Erro", json.message || "Falha ao registrar voto.");
      }
    } catch (error) {
      console.error("Erro ao votar:", error);
      Alert.alert("Erro", "Falha ao conectar ao servidor.");
    } finally {
      setVoting(false);
    }
  }

  // ====================== Render ======================
  if (loading) {
    return (
      <View style={styles.loader}>
        <PaperActivityIndicator animating={true} size="large" color={RED} />
      </View>
    );
  }

  return (
    <>
      {/* Modal de Erro */}
      <Modal
        animationType="fade"
        transparent
        visible={errorModalVisible}
        onRequestClose={handleCloseErrorModal}
      >
        <Animatable.View style={styles.errorOverlay} animation="fadeIn" duration={300} easing="ease-in-out">
          <Animatable.View style={styles.errorModalContent} animation="zoomIn" duration={300} easing="ease-in-out">
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#FFF" style={{ marginBottom: 10 }} />
            <Text style={styles.errorTitle}>Ops!</Text>
            <Text style={styles.errorMessage}>{errorModalMessage}</Text>
            <TouchableOpacity style={styles.errorButton} onPress={handleCloseErrorModal}>
              <Text style={styles.errorButtonText}>Voltar</Text>
            </TouchableOpacity>
          </Animatable.View>
        </Animatable.View>
      </Modal>

      {/* Modal de Voto via App */}
      <VoteScreen
        visible={voteModalVisible}
        onClose={() => setVoteModalVisible(false)}
        mesaId={mesaNumber}
        leagueId={""}  // Opcional: se você já tiver salvo no AsyncStorage, pode pegar aqui
        opponentName={opponentName || ""}
      />

      {/* Modal de Resultados (JudgeScreen) */}
      <JudgeScreen
        visible={reportsModalVisible}
        onClose={() => setReportsModalVisible(false)}
      />

      {/* AppBar */}
      <Appbar.Header style={{ backgroundColor: BLACK }}>
        <Image source={require("../../assets/images/logo.jpg")} style={styles.logo} resizeMode="contain" />
        <Appbar.Content
          title={userName}
          titleStyle={{ color: RED, fontWeight: "bold", fontSize: 20 }}
        />
      </Appbar.Header>

      {/* Conteúdo Principal */}
      <ScrollView style={styles.container}>
        <Text style={styles.mainTitle}>{t("torneio.info.ongoing_title").toUpperCase()}</Text>

        {/* Card do Jogador */}
        <Card style={styles.card}>
          <Card.Title
            title={userName}
            subtitle={t("torneio.info.player_label")}
            left={(props) => (
              <MaterialCommunityIcons {...props} name="account" size={40} color={RED} />
            )}
            titleStyle={styles.cardTitle}
            subtitleStyle={styles.cardSubtitle}
          />
        </Card>

        {/* Card do Oponente */}
        <Card style={styles.card}>
          <Card.Title
            title={opponentName ?? t("torneio.alerts.no_opponent")}
            subtitle={t("torneio.info.opponent_label")}
            left={(props) => (
              <MaterialCommunityIcons {...props} name="sword-cross" size={40} color={RED} />
            )}
            titleStyle={styles.cardTitle}
            subtitleStyle={styles.cardSubtitle}
          />
        </Card>

        {/* Card da Rodada Atual */}
        <Card style={styles.card}>
          <Card.Title
            title={currentRound ? String(currentRound) : t("torneio.alerts.no_round")}
            subtitle={t("torneio.info.current_round")}
            left={(props) => (
              <MaterialCommunityIcons {...props} name="flag-checkered" size={40} color={RED} />
            )}
            titleStyle={styles.cardTitle}
            subtitleStyle={styles.cardSubtitle}
          />
        </Card>

        {/* Card da Mesa */}
        <Card style={styles.card}>
          <Card.Title
            title={mesaNumber ?? t("torneio.info.not_found")}
            subtitle={t("torneio.info.your_table")}
            left={(props) => (
              <MaterialCommunityIcons {...props} name="table" size={40} color={RED} />
            )}
            titleStyle={styles.cardTitle}
            subtitleStyle={styles.cardSubtitle}
          />
        </Card>

        {/* Botões de Reportar e Ver Resultados */}
        <View style={styles.btnContainer}>
          <Button
            mode="contained"
            onPress={openVoteModal}
            style={styles.btnReport}
            labelStyle={{ color: WHITE, fontSize: 16 }}
            icon="check"
          >
            Reportar Resultado
          </Button>
          {isHost && (
            <Button
              mode="contained"
              onPress={() => setReportsModalVisible(true)}
              style={[styles.btnReport, { marginTop: 12 }]}
              labelStyle={{ color: WHITE, fontSize: 16 }}
              icon="chart-bar"
            >
              Ver Resultados
            </Button>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: BLACK,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    backgroundColor: BLACK,
    padding: 16,
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 8,
  },
  mainTitle: {
    color: RED,
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    marginTop: 20,
  },
  card: {
    marginBottom: 10,
    backgroundColor: DARK_GRAY,
  },
  cardTitle: {
    color: WHITE,
    fontSize: 18,
    fontWeight: "bold",
  },
  cardSubtitle: {
    color: "#ccc",
  },
  btnContainer: {
    marginTop: 20,
    alignItems: "center",
  },
  btnReport: {
    backgroundColor: RED,
    borderRadius: 8,
    paddingVertical: 6,
    width: "70%",
  },
  // Modal de Erro
  errorOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  errorModalContent: {
    backgroundColor: DARK_GRAY,
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    width: "80%",
  },
  errorTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  errorMessage: {
    color: "#FFF",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  errorButton: {
    backgroundColor: RED,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  errorButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "bold",
  },
});

export { }; 
