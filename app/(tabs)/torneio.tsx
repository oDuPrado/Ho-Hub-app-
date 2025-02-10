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
  Platform,
  Modal,
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
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Animatable from "react-native-animatable";

import { db } from "../../lib/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

// Importação do fallback e das funções
import { HOST_PLAYER_IDS, fetchRoleMembers } from "../hosts";

import JudgeScreen from "../../components/TorneioReportsScreen";
import VoteScreen from "../../components/TorneioVoteScreen";

// Configurações de notificação
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

  const [loading, setLoading] = useState(true);
  const [noTournament, setNoTournament] = useState(false);
  const [userNotInRound, setUserNotInRound] = useState(false);

  const [userName, setUserName] = useState(t("torneio.info.none"));
  const [mesaNumber, setMesaNumber] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState<number | null>(null);
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [linkReport, setLinkReport] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [leagueName, setLeagueName] = useState("Torneio");

  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState("");

  const [voteModalVisible, setVoteModalVisible] = useState(false);
  const [reportsModalVisible, setReportsModalVisible] = useState(false);

  const intervalRef = useRef<any>(null);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    requestNotificationPermission();
    fetchTournamentData();
    intervalRef.current = setInterval(() => {
      setFetchCount((prev) => prev + 1);
    }, 60000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

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
        setLoading(false);
        return;
      }
      setUserName(storedName ?? t("torneio.info.none"));

      if (!leagueId) {
        showErrorModal("Nenhuma liga selecionada. Vá em configurações.");
        setLoading(false);
        return;
      }

      // 🔥 Verifica se o usuário é host (SEM varrer TODAS as ligas)
      await checkIfHostOnlyThisLeague(leagueId, storedId);

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
      if (!jsonTorneio.round || Object.keys(jsonTorneio.round).length === 0) {
        setNoTournament(true);
        setLoading(false);
        return;
      }

      const storedUserId = storedId;
      const allRounds = jsonTorneio.round ?? {};
      const availableRoundKeys = Object.keys(allRounds)
        .map((rk) => parseInt(rk, 10))
        .sort((a, b) => b - a);

      if (availableRoundKeys.length === 0) {
        setNoTournament(true);
        setLoading(false);
        return;
      }

      const latestRoundKey = availableRoundKeys[0];
      const latestRoundTables = allRounds[latestRoundKey]?.None?.table ?? {};

      let userMesaId = null;
      let player1Name = "Jogador 1";
      let player2Name = "Jogador 2";

      for (const mesaId in latestRoundTables) {
        const mesa = latestRoundTables[mesaId];
        if (mesa.player1_id === storedUserId || mesa.player2_id === storedUserId) {
          player1Name = jsonTorneio.players[mesa.player1_id]?.fullname || "Jogador 1";
          player2Name = jsonTorneio.players[mesa.player2_id]?.fullname || "Jogador 2";
          userMesaId = mesaId;
          await AsyncStorage.setItem("@player1Name", player1Name);
          await AsyncStorage.setItem("@player2Name", player2Name);
          await AsyncStorage.setItem("@mesaId", mesaId);
          break;
        }
      }

      if (!userMesaId) {
        setUserNotInRound(true);
        setCurrentRound(latestRoundKey);
        setLoading(false);
        return;
      }

      const roundObj = jsonTorneio.round ?? {};
      const roundKeys = Object.keys(roundObj).map((rk) => parseInt(rk, 10));

      if (roundKeys.length === 0) {
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

        if (p1_id === storedUserId) {
          foundMesa = tableId;
          foundOpponent = jsonTorneio.players[p2_id]?.fullname || "";
          break;
        } else if (p2_id === storedUserId) {
          foundMesa = tableId;
          foundOpponent = jsonTorneio.players[p1_id]?.fullname || "";
          break;
        }
      }

      setMesaNumber(foundMesa);
      setOpponentName(foundOpponent || null);

      if (foundMesa) {
        const link = `https://Doprado.pythonanywhere.com/${leagueId}/mesa/${foundMesa}`;
        setLinkReport(link);
        await checkRoundAndNotify(maxRound, foundMesa, foundOpponent || "");
      } else {
        setLinkReport(null);
      }

      // Lê nome da liga
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

  /**
   * Verifica se o usuário é host olhando SOMENTE a liga obtida do AsyncStorage
   * e, se não achar no Firebase, faz fallback na lista estática.
   */
  async function checkIfHostOnlyThisLeague(leagueId: string, userId: string) {
    try {
      // 1) Busca no Firebase (subcoleção /roles/host/members)
      const hostSnap = await getDocs(collection(db, `leagues/${leagueId}/roles/host/members`));
      const foundFirebase = hostSnap.docs.some((doc) => doc.id === userId);

      if (foundFirebase) {
        console.log(`✅ Encontrado como host no Firebase (Liga: ${leagueId}).`);
        setIsHost(true);
        return;
      }

      // 2) Se não achou no Firebase, tenta fallback
      if (HOST_PLAYER_IDS.includes(userId)) {
        console.log("🟡 Não encontrado no Firebase. Usando fallback da lista estática (HOST_PLAYER_IDS).");
        setIsHost(true);
      } else {
        console.log("🚫 Usuário não é host nem no Firebase nem no fallback.");
        setIsHost(false);
      }
    } catch (error) {
      console.log("Erro ao verificar host na liga específica:", error);
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

  function openVoteModal() {
    setVoteModalVisible(true);
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <PaperActivityIndicator animating size="large" color={RED} />
      </View>
    );
  }

  if (noTournament) {
    return (
      <View style={styles.noTournamentContainer}>
        <MaterialCommunityIcons name="alert" size={50} color={RED} style={{ marginBottom: 8 }} />
        <Text style={styles.noTournamentText}>Nenhum torneio em andamento nesta liga.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace("/(tabs)/home")}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (userNotInRound) {
    return (
      <>
        <Appbar.Header style={{ backgroundColor: BLACK }}>
          <Image source={require("../../assets/images/logo.jpg")} style={styles.logo} resizeMode="contain" />
          <Appbar.Content
            title={userName}
            titleStyle={{ color: RED, fontWeight: "bold", fontSize: 20 }}
          />
        </Appbar.Header>
        <View style={styles.notInRoundContainer}>
          <MaterialCommunityIcons name="account-cancel" size={60} color={RED} style={{ marginBottom: 12 }} />
          <Text style={styles.notInRoundText}>
            Você não está jogando nesta rodada{currentRound ? ` (#${currentRound})` : ""}.
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace("/(tabs)/home")}>
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Modal
        animationType="fade"
        transparent
        visible={errorModalVisible}
        onRequestClose={handleCloseErrorModal}
      >
        <Animatable.View style={styles.errorOverlay} animation="fadeIn" duration={300} easing="ease-in-out">
          <Animatable.View style={styles.errorModalContent} animation="zoomIn" duration={300} easing="ease-in-out">
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={48}
              color="#FFF"
              style={{ marginBottom: 10 }}
            />
            <Text style={styles.errorTitle}>Ops!</Text>
            <Text style={styles.errorMessage}>{errorModalMessage}</Text>
            <TouchableOpacity style={styles.errorButton} onPress={handleCloseErrorModal}>
              <Text style={styles.errorButtonText}>Voltar</Text>
            </TouchableOpacity>
          </Animatable.View>
        </Animatable.View>
      </Modal>

      <VoteScreen
        visible={voteModalVisible}
        onClose={() => setVoteModalVisible(false)}
        mesaId={mesaNumber}
        leagueId={""}
        opponentName={opponentName || ""}
      />

      <JudgeScreen
        visible={reportsModalVisible}
        onClose={() => setReportsModalVisible(false)}
      />

      <Appbar.Header style={{ backgroundColor: BLACK }}>
        <Image source={require("../../assets/images/logo.jpg")} style={styles.logo} resizeMode="contain" />
        <Appbar.Content
          title={userName}
          titleStyle={{ color: RED, fontWeight: "bold", fontSize: 20 }}
        />
      </Appbar.Header>

      <ScrollView style={styles.container}>
        <Text style={styles.mainTitle}>
          {t("torneio.info.ongoing_title").toUpperCase()} - {leagueName}
        </Text>

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
  noTournamentContainer: {
    flex: 1,
    backgroundColor: BLACK,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  noTournamentText: {
    color: WHITE,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  notInRoundContainer: {
    flex: 1,
    backgroundColor: BLACK,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  notInRoundText: {
    color: WHITE,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: RED,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backButtonText: {
    color: WHITE,
    fontWeight: "bold",
    fontSize: 16,
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
