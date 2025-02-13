// TorneioScreen.tsx
import React, { useEffect, useState, useRef, useCallback } from "react";
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
  TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";

import {
  Appbar,
  Card,
  Button,
  ActivityIndicator as PaperActivityIndicator,
} from "react-native-paper";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import * as Animatable from "react-native-animatable";

// Busca hosts + fallback
import { fetchRoleMembers, HOST_PLAYER_IDS } from "../hosts";

// Modais
import JudgeScreen from "../../components/TorneioReportsScreen";
import VoteScreen from "../../components/TorneioVoteScreen";

// =========== [INÍCIO] ADMIN ===========
// Lista de usuários que podem ver o botão de admin
const AUTH_USERS = ["4893989", "4729671"];

// IP/URL do servidor Flask no Raspberry (via Tailscale)
const RASPBERRY_API = "http://100.80.36.66:5000"; // Ajuste para seu IP Tailscale real
// =========== [FIM] ADMIN ==============

// Configurações de Notificações
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
  const [userName, setUserName] = useState<string>(t("torneio.info.none"));
  const [mesaNumber, setMesaNumber] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState<number | null>(null);
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [linkReport, setLinkReport] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [leagueName, setLeagueName] = useState("Torneio");

  // Controle de erros / status
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState("");
  const [noTournament, setNoTournament] = useState(false);
  const [notPlaying, setNotPlaying] = useState(false);

  // Modal de voto
  const [voteModalVisible, setVoteModalVisible] = useState(false);

  // Modal de resultados (JudgeScreen)
  const [reportsModalVisible, setReportsModalVisible] = useState(false);

  // Interval para atualizar periodicamente
  const intervalRef = useRef<any>(null);
  const [fetchCount, setFetchCount] = useState(0);

  // =========== [INÍCIO] ADMIN ===========
  // Estado para saber se o usuário é "admin" (autorizado a ver o painel)
  const [isAuthUser, setIsAuthUser] = useState(false);

  // Controla a exibição do Modal de Admin
  const [adminPanelVisible, setAdminPanelVisible] = useState(false);

  // Estados para mostrar resultado das ações
  const [connectionStatus, setConnectionStatus] = useState("");
  const [consoleOutput, setConsoleOutput] = useState("");
  const [customCommand, setCustomCommand] = useState("");

  // Função para testar conexão (faz GET /ping)
  async function testConnection() {
    try {
      setConnectionStatus("Testando conexão...");
      const response = await fetch(`${RASPBERRY_API}/ping`);
      const json = await response.json();
      if (json.message === "Server is up") {
        setConnectionStatus("Conexão OK! Server is up.");
      } else {
        setConnectionStatus("Falha inesperada na resposta do servidor.");
      }
    } catch (error) {
      console.log("Erro ao testar conexão:", error);
      setConnectionStatus("Erro ao conectar. Verifique se o Flask está rodando.");
    }
  }

  // Função para reiniciar
  async function handleRestart() {
    try {
      const response = await fetch(`${RASPBERRY_API}/restart`, {
        method: "POST",
      });
      const json = await response.json();
      Alert.alert("Resposta", json.message || "Sem mensagem");
    } catch (error) {
      Alert.alert("Erro", "Não foi possível reiniciar o Raspberry");
    }
  }

  // Função para desligar
  async function handleShutdown() {
    try {
      const response = await fetch(`${RASPBERRY_API}/shutdown`, {
        method: "POST",
      });
      const json = await response.json();
      Alert.alert("Resposta", json.message || "Sem mensagem");
    } catch (error) {
      Alert.alert("Erro", "Não foi possível desligar o Raspberry");
    }
  }

  // Função para ler console (ps -ef | grep python)
  async function handleShowConsole() {
    try {
      const response = await fetch(`${RASPBERRY_API}/console`);
      const json = await response.json();
      setConsoleOutput(json.output || "Sem saída.");
    } catch (error) {
      setConsoleOutput("Erro ao obter console.");
    }
  }

  // Função para executar comando personalizado
  async function handleExecuteCommand() {
    if (!customCommand.trim()) {
      Alert.alert("Atenção", "Digite um comando primeiro.");
      return;
    }
    try {
      const response = await fetch(`${RASPBERRY_API}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command: customCommand }),
      });
      const json = await response.json();
      if (json.output) {
        setConsoleOutput(json.output);
      } else if (json.error) {
        setConsoleOutput(`Erro: ${json.error}`);
      } else {
        setConsoleOutput("Nenhuma saída retornada.");
      }
    } catch (error) {
      setConsoleOutput("Erro ao executar comando.");
    }
  }
  // =========== [FIM] ADMIN =============

  // === useFocusEffect: toda vez que a tela entra em foco, recarrega ===
  useFocusEffect(
    useCallback(() => {
      console.log("==> [TorneioScreen] Entrou em foco, atualizando dados...");
      fetchTournamentData();
      return () => {};
    }, [])
  );

  // Primeiro carregamento + interval de 60s
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

  // Sempre que fetchCount mudar, refaz a busca
  useEffect(() => {
    fetchTournamentData();
  }, [fetchCount]);

  // ====== Pede permissão de notificação =====
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

  // =============== Função principal que carrega o torneio ===============
  async function fetchTournamentData() {
    try {
      setLoading(true);
      setNoTournament(false);
      setNotPlaying(false);

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

      // === [INÍCIO] Verifica se userID está em AUTH_USERS:
      setIsAuthUser(AUTH_USERS.includes(storedId));
      // === [FIM]

      // Se não houver liga selecionada, erro
      if (!leagueId) {
        showErrorModal("Nenhuma liga selecionada. Selecione uma liga na pagina home.");
        setLoading(false);
        return;
      }

      // Verifica se é host (com fallback)
      await checkIfHostFallback(leagueId, storedId);

      // Consulta ao backend do torneio
      const url = `https://doprado.pythonanywhere.com/get-data/${leagueId}`;
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

      // Se não houver rodadas, avisa
      if (!jsonTorneio.round || Object.keys(jsonTorneio.round).length === 0) {
        console.log("⚠️ Nenhum torneio em andamento nesta liga.");
        setNoTournament(true);
        setLoading(false);
        return;
      }

      // Pega a lista de rodadas
      const allRounds = jsonTorneio.round;
      const roundKeys = Object.keys(allRounds).map((rk) => parseInt(rk, 10));
      if (roundKeys.length === 0) {
        setNoTournament(true);
        setLoading(false);
        return;
      }

      // Rodada ativa (maior round)
      const maxRound = Math.max(...roundKeys);
      setCurrentRound(maxRound);

      // Pega a divisão (no caso pega a 1a se existir)
      const divisions = allRounds[maxRound];
      const divKeys = Object.keys(divisions);
      const currentDiv = divKeys[0] ?? "None";
      const tables = divisions[currentDiv].table;

      // Tenta achar a mesa do usuário
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

      // Se não achou mesa, não está jogando
      if (!foundMesa) {
        console.log(`⚠️ Usuário não está jogando na rodada ${maxRound}.`);
        setMesaNumber(null);
        setOpponentName(null);
        setNotPlaying(true);
        setLoading(false);
      } else {
        setMesaNumber(foundMesa);
        setOpponentName(foundOpponent ?? null);

        // link da mesa
        const link = `https://doprado.pythonanywhere.com/${leagueId}/mesa/${foundMesa}`;
        setLinkReport(link);

        // Notifica caso rodada seja nova
        await checkRoundAndNotify(maxRound, foundMesa, foundOpponent || "");
        setLoading(false);
      }

      // Pega info da liga pra exibir no título
      const infoRes = await fetch(`https://doprado.pythonanywhere.com/get-league-info`, {
        method: "GET",
        headers: { Authorization: firebaseToken ? `Bearer ${firebaseToken}` : "" },
      });
      if (infoRes.ok) {
        const infoData = await infoRes.json();
        setLeagueName(infoData.leagueName || "Torneio");
      }
    } catch (err) {
      console.log("Erro no Torneio:", err);
      showErrorModal("Falha ao carregar dados do torneio.");
      setLoading(false);
    }
  }

  // =============== Fallback do Host ===============
  async function checkIfHostFallback(leagueId: string, storedUserId: string) {
    try {
      let isHostLocal = false;

      // 1. Tenta buscar no Firebase
      try {
        const hostMembers = await fetchRoleMembers(leagueId, "host");
        if (hostMembers.some((h) => h.userId === storedUserId)) {
          isHostLocal = true;
          console.log(`✅ Encontrado como host no Firebase (Liga: ${leagueId})`);
        }
      } catch (error) {
        console.log("⚠️ Erro ao buscar hosts no Firebase, tentando fallback.", error);
      }

      // 2. Fallback local
      if (!isHostLocal) {
        if (HOST_PLAYER_IDS.includes(storedUserId)) {
          isHostLocal = true;
          console.log("🟡 Fallback da lista estática. Usuário é host.");
        } else {
          console.log("🚫 Usuário não é host.");
        }
      }

      setIsHost(isHostLocal);
    } catch (err) {
      console.log("❌ Erro no fallback de host:", err);
      setIsHost(false);
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

  // ====================== Render ======================
  if (loading) {
    return (
      <View style={styles.loader}>
        <PaperActivityIndicator animating={true} size="large" color={RED} />
      </View>
    );
  }

  if (noTournament) {
    // Mensagem de nenhum torneio ativo
    return (
      <View style={styles.noTournamentContainer}>
        <MaterialCommunityIcons name="alert" size={50} color={RED} />
        <Text style={styles.noTournamentText}>
          Nenhum torneio em andamento nesta liga.
        </Text>
        <TouchableOpacity
          style={styles.noTournamentButton}
          onPress={() => router.replace("/(tabs)/home")}
        >
          <Text style={styles.noTournamentButtonText}>Voltar</Text>
        </TouchableOpacity>
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
        <Animatable.View
          style={styles.errorOverlay}
          animation="fadeIn"
          duration={300}
          easing="ease-in-out"
        >
          <Animatable.View
            style={styles.errorModalContent}
            animation="zoomIn"
            duration={300}
            easing="ease-in-out"
          >
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

      {/* Modal de Voto via App */}
      <VoteScreen
        visible={voteModalVisible}
        onClose={() => setVoteModalVisible(false)}
        mesaId={mesaNumber}
        leagueId={""} // se precisar
        opponentName={opponentName || ""}
      />

      {/* Modal de Resultados (JudgeScreen) */}
      <JudgeScreen
        visible={reportsModalVisible}
        onClose={() => setReportsModalVisible(false)}
      />

      {/* ========== MODAL DE ADMIN ========== */}
<Modal
  visible={adminPanelVisible}
  animationType="slide"
  onRequestClose={() => setAdminPanelVisible(false)}
  transparent
>
  <Animatable.View
    style={styles.adminModalBackground}
    animation="fadeIn"
    duration={400}
  >
    <Animatable.View
      style={styles.adminContainer}
      animation="fadeInUp"
      duration={600}
    >
      <View style={styles.adminHeader}>
        <Animatable.Text
          style={styles.adminHeaderText}
          animation="pulse"
          easing="ease-out"
          iterationCount="infinite"
        >
          Painel de Controle
        </Animatable.Text>
        <TouchableOpacity onPress={() => setAdminPanelVisible(false)}>
          <MaterialCommunityIcons name="close-circle-outline" size={36} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
        <Button
          mode="contained"
          onPress={testConnection}
          style={styles.adminButton}
          labelStyle={styles.adminButtonLabel}
          icon="wifi"
        >
          Conectar/Ping
        </Button>
        <Text style={styles.statusText}>{connectionStatus}</Text>

        <Button
          mode="contained"
          onPress={handleRestart}
          style={[styles.adminButton, { backgroundColor: "#E69900" }]}
          labelStyle={styles.adminButtonLabel}
          icon="restart"
        >
          Reiniciar
        </Button>

        <Button
          mode="contained"
          onPress={handleShutdown}
          style={[styles.adminButton, { backgroundColor: "#A81D16" }]}
          labelStyle={styles.adminButtonLabel}
          icon="power"
        >
          Desligar
        </Button>

        <Button
          mode="contained"
          onPress={handleShowConsole}
          style={styles.adminButton}
          labelStyle={styles.adminButtonLabel}
          icon="console-line"
        >
          Ver Console
        </Button>

        <ScrollView style={styles.consoleArea}>
          <Text style={{ color: "#FFF" }}>{consoleOutput}</Text>
        </ScrollView>

        <Text style={[styles.statusText, { marginTop: 20 }]}>
          Comando Personalizado:
        </Text>
        <TextInput
          value={customCommand}
          onChangeText={setCustomCommand}
          placeholder="Digite um comando (ex: kill 1234)"
          placeholderTextColor="#CCC"
          style={styles.commandInput}
        />

        <Button
          mode="contained"
          onPress={handleExecuteCommand}
          style={styles.adminButton}
          labelStyle={styles.adminButtonLabel}
          icon="code-tags"
        >
          Executar Comando
        </Button>
      </ScrollView>
    </Animatable.View>
  </Animatable.View>
</Modal>
{/* ========== FIM DO MODAL DE ADMIN ========== */}


      {/* AppBar */}
      <Appbar.Header style={{ backgroundColor: BLACK }}>
        <Image
          source={require("../../assets/images/logo.jpg")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Appbar.Content
          title={userName}
          titleStyle={{ color: RED, fontWeight: "bold", fontSize: 20 }}
        />

        {/* Ícone especial (laranja) que só aparece se isAuthUser = true */}
        {isAuthUser && (
          <TouchableOpacity onPress={() => setAdminPanelVisible(true)}>
            <MaterialCommunityIcons
              name="shield-lock"
              size={32}
              color="orange"
              style={{ marginRight: 10 }}
            />
          </TouchableOpacity>
        )}
      </Appbar.Header>

      {/* Conteúdo Principal */}
      <ScrollView style={styles.container}>
        <Text style={styles.mainTitle}>{leagueName}</Text>
        <Text style={styles.subTitle}>
          {t("torneio.info.ongoing_title").toUpperCase()}
        </Text>

        {/* Caso o usuário não esteja jogando */}
        {notPlaying && (
          <View style={styles.notPlayingContainer}>
            <MaterialCommunityIcons name="alert" size={50} color={RED} />
            <Text style={styles.notPlayingText}>
              Você não está jogando nesta rodada.
            </Text>
            <TouchableOpacity
              style={styles.noTournamentButton}
              onPress={() => router.replace("/(tabs)/home")}
            >
              <Text style={styles.noTournamentButtonText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        )}

        {!notPlaying && (
          <>
            {/* Card do Jogador */}
            <Card style={styles.card}>
              <Card.Title
                title={userName}
                subtitle={t("torneio.info.player_label")}
                left={(props) => (
                  <MaterialCommunityIcons
                    {...props}
                    name="account"
                    size={40}
                    color={RED}
                  />
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
                  <MaterialCommunityIcons
                    {...props}
                    name="sword-cross"
                    size={40}
                    color={RED}
                  />
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
                  <MaterialCommunityIcons
                    {...props}
                    name="flag-checkered"
                    size={40}
                    color={RED}
                  />
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
                  <MaterialCommunityIcons
                    {...props}
                    name="table"
                    size={40}
                    color={RED}
                  />
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
          </>
        )}
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
    textAlign: "center",
  },
  subTitle: {
    color: RED,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
    marginTop: 4,
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
  // Erro
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

  // Nenhum Torneio
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
    marginVertical: 15,
  },
  noTournamentButton: {
    backgroundColor: RED,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  noTournamentButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "bold",
  },

  // Não jogando
  notPlayingContainer: {
    alignItems: "center",
    marginTop: 40,
  },
  notPlayingText: {
    color: WHITE,
    fontSize: 16,
    textAlign: "center",
    marginVertical: 15,
    maxWidth: "80%",
  },

  // Fundo semitransparente para o modal
  adminModalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  // Container principal do painel
  adminContainer: {
    width: "90%",
    height: "85%",
    backgroundColor: "#222",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  adminHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#444",
    paddingBottom: 8,
  },
  adminHeaderText: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "bold",
  },
  adminButton: {
    backgroundColor: RED,
    borderRadius: 12,
    marginTop: 12,
    paddingVertical: 8,
  },
  adminButtonLabel: {
    color: WHITE,
    fontSize: 16,
  },
  statusText: {
    marginTop: 10,
    color: "#FFF",
    fontSize: 16,
    textAlign: "center",
  },
  consoleArea: {
    backgroundColor: "#333",
    marginTop: 12,
    padding: 12,
    minHeight: 100,
    maxHeight: 180,
    borderRadius: 8,
  },
  commandInput: {
    backgroundColor: "#444",
    color: "#FFF",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
});
