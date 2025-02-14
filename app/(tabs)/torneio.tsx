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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native"; // Para atualizar ao entrar na tela

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
  const [noTournament, setNoTournament] = useState(false); // Se não existir rodadas
  const [notPlaying, setNotPlaying] = useState(false); // Se o usuário não estiver em mesa alguma

  // Modal de voto
  const [voteModalVisible, setVoteModalVisible] = useState(false);

  // Modal de resultados (JudgeScreen)
  const [reportsModalVisible, setReportsModalVisible] = useState(false);

  // Interval para atualizar periodicamente
  const intervalRef = useRef<any>(null);
  const [fetchCount, setFetchCount] = useState(0);

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

    // A cada 60s, atualiza
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

      // Se não houver liga selecionada, erro
      if (!leagueId) {
        showErrorModal("Nenhuma liga selecionada. Selecione uma liga na pagina home.");
        setLoading(false);
        return;
      }

      // Verifica se é host (com fallback)
      await checkIfHostFallback(leagueId, storedId);

      // Consulta ao backend
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

      // console.log("📌 [DEBUG] Dados recebidos da API:", jsonTorneio);

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

      console.log("📌 [DEBUG] Atualizando Estado -> Mesa:", foundMesa, "Oponente:", foundOpponent);

      if (!foundMesa) {
        console.log(`⚠️ Usuário não está jogando na rodada ${maxRound}.`);
        setMesaNumber(null);
        setOpponentName(null);
        setNotPlaying(true);
        setLoading(false);
      } else {
        console.log(`✅ Mesa encontrada: ${foundMesa}, Oponente: ${foundOpponent}`);
      
        // Reseta os valores para forçar a atualização
        setMesaNumber(null);
        setOpponentName(null);
        setNotPlaying(false);
      
        // 🔥 Obtém o nome do usuário autenticado antes de salvar no AsyncStorage
        const storedUserName = await AsyncStorage.getItem("@userName");
        const player1Name = storedUserName || "Jogador 1"; // Se não encontrar, define um padrão
      
        // 🔥 Salva os nomes corretamente no AsyncStorage
        if (foundMesa && foundOpponent) {
          console.log(`📌 [DEBUG] Salvando novos nomes no AsyncStorage: ${foundOpponent} e ${player1Name}`);
          await AsyncStorage.setItem("@player1Name", player1Name);
          await AsyncStorage.setItem("@player2Name", foundOpponent);
        }
      
        // Pequeno delay para garantir que o React perceba a mudança
        setTimeout(() => {
          setMesaNumber(foundMesa);
          setOpponentName(foundOpponent ?? null);
        }, 10);

        // link da mesa
        const link = `https://Doprado.pythonanywhere.com/${leagueId}/mesa/${foundMesa}`;
        setLinkReport(link);

        // Notifica caso rodada seja nova
        await checkRoundAndNotify(maxRound, foundMesa, foundOpponent || "");
        setLoading(false);
      }

      // Pega info da liga pra exibir no título
      const infoRes = await fetch(`https://Doprado.pythonanywhere.com/get-league-info`, {
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

      // 2. Fallback
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
        <TouchableOpacity style={styles.noTournamentButton} onPress={() => router.replace("/(tabs)/home")}>
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
});
