////////////////////////////////////////
// ARQUIVO: TorneioScreen.tsx
////////////////////////////////////////
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
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as Animatable from "react-native-animatable";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { Button, ActivityIndicator as PaperActivityIndicator } from "react-native-paper";

import { fetchRoleMembers, HOST_PLAYER_IDS } from "../hosts";
import JudgeScreen from "../../components/TorneioReportsScreen";
import VoteScreen from "../../components/TorneioVoteScreen";
import HostVoteModal from "../../components/HostVoteModal";


// =========== [INÍCIO] ADMIN ===========
const AUTH_USERS = ["4893989", "4729671"];
const RASPBERRY_API = "http://100.80.36.66:5000"; // Ajuste para seu IP Tailscale
// =========== [FIM] ADMIN ==============

// Notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Temas e Cores
const RED = "#E3350D";
const BLACK = "#1E1E1E";
const DARK_GRAY = "#292929";
const WHITE = "#FFFFFF";
const SCREEN_WIDTH = Dimensions.get("window").width;

/** Componente Principal */
export default function TorneioScreen() {
  const router = useRouter();

  // 1) ESTADOS
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>("Jogador");
  const [mesaNumber, setMesaNumber] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState<number | null>(null);
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [linkReport, setLinkReport] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("Torneio");

  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState("");
  const [noTournament, setNoTournament] = useState(false);
  const [notPlaying, setNotPlaying] = useState(false);

  const [voteModalVisible, setVoteModalVisible] = useState(false);
  const [reportsModalVisible, setReportsModalVisible] = useState(false);

  // Controla a visibilidade do modal de voto para Host
  const [hostVoteModalVisible, setHostVoteModalVisible] = useState(false);

  // Foco da tela
  const [inFocus, setInFocus] = useState(false);

  // Interval
  const intervalRef = useRef<any>(null);
  const [fetchCount, setFetchCount] = useState(0);

  // =========== ADMIN ===========
  const [isAuthUser, setIsAuthUser] = useState(false);
  const [adminPanelVisible, setAdminPanelVisible] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("");
  const [consoleOutput, setConsoleOutput] = useState("");
  const [customCommand, setCustomCommand] = useState("");
  const [isHost, setIsHost] = useState(false);

  // 2) ANIMAÇÕES (Fundo, Ícone Admin, Formas)
  const fadeAnim = useRef(new Animated.Value(0)).current; // Transição principal da tela
  const adminIconSpin = useRef(new Animated.Value(0)).current; // Ícone admin
  const shapeAnim1 = useRef(new Animated.Value(0)).current; // Forma animada #1
  const shapeAnim2 = useRef(new Animated.Value(0)).current; // Forma animada #2

  // 3) LÓGICA DE ADMIN (IDÊNTICA)
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

  async function handleShowConsole() {
    try {
      const response = await fetch(`${RASPBERRY_API}/console`);
      const json = await response.json();
      setConsoleOutput(json.output || "Sem saída.");
    } catch (error) {
      setConsoleOutput("Erro ao obter console.");
    }
  }

  async function handleExecuteCommand() {
    if (!customCommand.trim()) {
      Alert.alert("Atenção", "Digite um comando primeiro.");
      return;
    }
    try {
      const response = await fetch(`${RASPBERRY_API}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  // 4) USEEFFECTS DE ANIMAÇÃO E FOCUS
  useEffect(() => {
    // Fade In
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Ícone admin
    Animated.loop(
      Animated.timing(adminIconSpin, {
        toValue: 1,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Formas animadas
    Animated.loop(
      Animated.sequence([
        Animated.timing(shapeAnim1, { toValue: 1, duration: 5000, useNativeDriver: false }),
        Animated.timing(shapeAnim1, { toValue: 0, duration: 5000, useNativeDriver: false }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(shapeAnim2, { toValue: 1, duration: 7000, useNativeDriver: false }),
        Animated.timing(shapeAnim2, { toValue: 0, duration: 7000, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setInFocus(true);
      console.log("==> [TorneioScreen] Focus in. Atualizando dados...");
      fetchTournamentData(); // Atualiza os dados ao entrar na tela
  
      // Limpa qualquer intervalo existente antes de criar um novo
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
  
      // Agora cria um novo intervalo
      intervalRef.current = setInterval(() => {
        console.log("==> [TorneioScreen] Atualizando dados automaticamente...");
        fetchTournamentData();
      }, 36000000);
  
      return () => {
        console.log("==> [TorneioScreen] Focus out. Limpando intervalo.");
        setInFocus(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null; // Garante que o intervalo foi zerado
        }
      };
    }, [])
  );   

  useEffect(() => {
    requestNotificationPermission();
    fetchTournamentData();

    intervalRef.current = setInterval(() => {
      setFetchCount((prev) => prev + 1);
    }, 36000000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    fetchTournamentData();
  }, [fetchCount]);

  // 5) NOTIFICAÇÕES
  async function requestNotificationPermission() {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        Alert.alert("Atenção", "Permissão de notificações não concedida.");
      }
    } catch (error) {
      console.log("Erro ao solicitar permissões de notificação:", error);
    }
  }

  // 6) CARREGAMENTO DE DADOS DO TORNEIO (LÓGICA ORIGINAL)
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
        showErrorModal("Você não está logado.");
        setLoading(false);
        return;
      }
      setUserName(storedName ?? "Jogador");

      setIsAuthUser(AUTH_USERS.includes(storedId));

      if (!leagueId) {
        showErrorModal("Nenhuma liga selecionada. Selecione na Home.");
        setLoading(false);
        return;
      }
      await checkIfHostFallback(leagueId, storedId);

      // Pegando dados do torneio
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

      if (!jsonTorneio.round || Object.keys(jsonTorneio.round).length === 0) {
        console.log("⚠️ Nenhum torneio ativo.");
        setNoTournament(true);
        setLoading(false);
        return;
      }

      const allRounds = jsonTorneio.round;
      const roundKeys = Object.keys(allRounds).map((rk) => parseInt(rk, 10));
      if (roundKeys.length === 0) {
        setNoTournament(true);
        setLoading(false);
        return;
      }

      const maxRound = Math.max(...roundKeys);
      setCurrentRound(maxRound);
      const divisions = allRounds[maxRound];
      const divKeys = Object.keys(divisions);
      const currentDiv = divKeys[0] ?? "None";
      const tables = divisions[currentDiv].table;

      let foundMesa: string | null = null;
      let foundOpponent: string | null = null;

      // Pega só as chaves das mesas que existem nessa rodada
      const tableKeys = Object.keys(tables);

      for (const tableId of tableKeys) {
        const matchInfo = tables[tableId];

        // Se faltar algum ID, ignora
        if (!matchInfo.player1_id || !matchInfo.player2_id) {
          continue;
        }

        console.log("Stored ID:", storedId, "table:", tableId);
        console.log("Match player1_id:", matchInfo.player1_id, "Match player2_id:", matchInfo.player2_id);

        // Se ainda não setamos a mesa (pra evitar sobrescrever se houver duplicado)
        if (!foundMesa) {
          if (matchInfo.player1_id === storedId) {
            // Usuário é Player 1
            foundMesa = tableId;
            foundOpponent = matchInfo.player2;
            console.log("-> [DEBUG] Definindo AsyncStorage (sou P1)");
            await AsyncStorage.setItem("@player1Name", storedName ?? "Jogador 1");
            await AsyncStorage.setItem("@player2Name", matchInfo.player2 ?? "Jogador 2");
            break; // Sai do loop, pois já achamos a mesa certa
          } else if (matchInfo.player2_id === storedId) {
            // Usuário é Player 2
            foundMesa = tableId;
            foundOpponent = matchInfo.player1;
            console.log("-> [DEBUG] Definindo AsyncStorage (sou P2)");
            await AsyncStorage.setItem("@player1Name", matchInfo.player1 ?? "Jogador 1");
            await AsyncStorage.setItem("@player2Name", storedName ?? "Jogador 2");
            break; // Sai do loop
          }
        }
      }

      // Depois do loop, se foundMesa estiver null, não achou nada
      if (!foundMesa) {
        console.log("-> [DEBUG] Não achamos nenhuma mesa para o usuário");
        // Lida com essa situação (user não está jogando)
      }


      if (!foundMesa) {
        console.log(`⚠️ Não está jogando na rodada ${maxRound}.`);
        setNotPlaying(true);
        setLoading(false);
      } else {
        setMesaNumber(null);
        setOpponentName(null);
        setNotPlaying(false);
        setTimeout(() => {
          setMesaNumber(foundMesa);
          setOpponentName(foundOpponent ?? null);
        }, 10);

        const link = `https://doprado.pythonanywhere.com/${leagueId}/mesa/${foundMesa}`;
        setLinkReport(link);

        await checkRoundAndNotify(maxRound, foundMesa, foundOpponent || "");
      }

      // Info da liga
      const infoRes = await fetch(`https://doprado.pythonanywhere.com/get-league-info`, {
        method: "GET",
        headers: { Authorization: firebaseToken ? `Bearer ${firebaseToken}` : "" },
      });
      if (infoRes.ok) {
        const infoData = await infoRes.json();
        setLeagueName(infoData.leagueName || "Torneio");
      }

      setLoading(false);
    } catch (err) {
      console.log("Erro no torneio:", err);
      showErrorModal("Falha ao carregar dados do torneio.");
      setLoading(false);
    }
  }

  async function checkIfHostFallback(leagueId: string, storedUserId: string) {
    try {
      let isHostLocal = false;
      // 1) Tenta buscar no Firebase
      try {
        const hostMembers = await fetchRoleMembers(leagueId, "host");
        if (hostMembers.some((h) => h.userId === storedUserId)) {
          isHostLocal = true;
        }
      } catch {
        console.log("Erro ao buscar hosts no Firebase, fallback local.");
      }
      // 2) Fallback local
      if (!isHostLocal) {
        if (HOST_PLAYER_IDS.includes(storedUserId)) {
          isHostLocal = true;
        }
      }
      setIsHost(isHostLocal);
    } catch (err) {
      console.log("Erro fallback host:", err);
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
            title: `Nova Rodada - Rodada ${rnd}`,
            body: oppName
              ? `Oponente: ${oppName}\nMesa: ${mesa}\nBoa Sorte!`
              : `Você está na mesa ${mesa}.\nBoa Sorte!`,
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

  // Relatório / Voto
  function openVoteModal() {
    setVoteModalVisible(true);
  }
  function handleOpenReport() {
    if (!linkReport) {
      Alert.alert("Atenção", "Mesa não encontrada");
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
      Alert.alert("Erro", "Não foi possível abrir a página de report.");
    }
  }

  // 7) RENDER
  // Animação ícone admin
  const spin = adminIconSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Formas animadas no fundo
  const shape1Y = shapeAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: [150, -50],
  });
  const shape2X = shapeAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, SCREEN_WIDTH],
  });

  if (loading) {
    return (
      <Animated.View style={[styles.loader, { opacity: fadeAnim }]}>
        <PaperActivityIndicator animating={true} size="large" color={RED} />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* ======== Formas animadas de fundo ======== */}
      <Animated.View style={[styles.shape1, { transform: [{ translateY: shape1Y }] }]} />
      <Animated.View style={[styles.shape2, { transform: [{ translateX: shape2X }] }]} />

      {/* ======== Modal de Erro ======== */}
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

      {/* ======== Voto + Judge ======== */}
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

      <HostVoteModal
        visible={hostVoteModalVisible}
        onClose={() => setHostVoteModalVisible(false)}
      />
      
      {/* ======== ADMIN PANEL ======== */}
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

     {/* ======= Header Custom ======= */}
<View style={styles.customHeader}>
  <Image
    source={require("../../assets/images/logo.jpg")}
    style={styles.logo}
  />

  {/* Botão de Atualizar */}
  <TouchableOpacity onPress={fetchTournamentData} style={styles.refreshButton}>
    <MaterialCommunityIcons name="refresh" size={28} color="white" />
  </TouchableOpacity>

  {/* Botão de Voto para Host (aparece apenas se isHost for true) */}
  {isHost && (
    <TouchableOpacity
      onPress={() => setHostVoteModalVisible(true)}
      style={[styles.refreshButton, { marginLeft: 6 }]}
    >
      <MaterialCommunityIcons name="account-check" size={28} color="white" />
    </TouchableOpacity>
  )}

  <Text style={styles.headerUserName}>{userName}</Text>

  {/* Botão Admin (se isAuthUser for true) */}
  {isAuthUser && (
    <TouchableOpacity onPress={() => setAdminPanelVisible(true)}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <MaterialCommunityIcons
          name="shield-lock"
          size={32}
          color="#FFD700"
          style={{ marginLeft: 10 }}
        />
      </Animated.View>
    </TouchableOpacity>
  )}
</View>

{/* Caso não tenha torneio (somente se em foco) */}
{noTournament && inFocus && (
  <View style={styles.noTournamentContainer}>
    <MaterialCommunityIcons name="alert" size={60} color={RED} />
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
)}

{/* Se há torneio... */}
{!noTournament && (
  <ScrollView style={styles.contentContainer}>
    <Animatable.Text animation="fadeInDown" style={styles.leagueName}>
      {leagueName}
    </Animatable.Text>
    <Animatable.Text animation="fadeIn" style={styles.leagueSub}>
      Torneio em Andamento
    </Animatable.Text>

    {/* notPlaying */}
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

    {/* Se estiver jogando */}
    {!notPlaying && (
      <>
        <Animatable.View animation="fadeInUp" delay={100} style={styles.card}>
          <MaterialCommunityIcons name="account" size={40} color={RED} />
          <Text style={styles.cardTitle}>{userName}</Text>
          <Text style={styles.cardSubtitle}>Jogador</Text>
        </Animatable.View>

        <Animatable.View animation="fadeInUp" delay={200} style={styles.card}>
          <MaterialCommunityIcons name="sword-cross" size={40} color={RED} />
          <Text style={styles.cardTitle}>{opponentName || "?"}</Text>
          <Text style={styles.cardSubtitle}>Oponente</Text>
        </Animatable.View>

        <Animatable.View animation="fadeInUp" delay={300} style={styles.card}>
          <MaterialCommunityIcons name="flag-checkered" size={40} color={RED} />
          <Text style={styles.cardTitle}>
            {currentRound ? currentRound : "?"}
          </Text>
          <Text style={styles.cardSubtitle}>Rodada Atual</Text>
        </Animatable.View>

        <Animatable.View animation="fadeInUp" delay={400} style={styles.card}>
          <MaterialCommunityIcons name="table" size={40} color={RED} />
          <Text style={styles.cardTitle}>{mesaNumber || "?"}</Text>
          <Text style={styles.cardSubtitle}>Sua Mesa</Text>
        </Animatable.View>

        {/* Botões */}
        <View style={styles.buttonArea}>
          <Animatable.View animation="pulse" iterationCount="infinite" style={styles.gradientButton}>
            <TouchableOpacity onPress={openVoteModal}>
              <Text style={styles.gradientButtonText}>Reportar Resultado</Text>
            </TouchableOpacity>
          </Animatable.View>

          {isHost && (
            <View style={[styles.gradientButton, { marginTop: 12 }]}>
              <TouchableOpacity onPress={() => setReportsModalVisible(true)}>
                <Text style={styles.gradientButtonText}>Ver Resultados</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </>
    )}
  </ScrollView>
)}
    </Animated.View>
  );
}

// ====================== ESTILOS ======================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BLACK,
  },
  loader: {
    flex: 1,
    backgroundColor: BLACK,
    justifyContent: "center",
    alignItems: "center",
  },
  // Formas animadas
  shape1: {
    position: "absolute",
    width: 300,
    height: 300,
    backgroundColor: "#ff0044",
    borderRadius: 150,
    opacity: 0.2,
    top: -100,
    left: -50,
  },
  shape2: {
    position: "absolute",
    width: 200,
    height: 200,
    backgroundColor: "#00eaff",
    borderRadius: 100,
    opacity: 0.15,
    bottom: 20,
  },

  // Header Custom
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    padding: 10,
    
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 10,
    marginBottom: 8,
  },
  headerUserName: {
    flex: 1,
    color: WHITE,
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 6,
    textAlign: "center",
  },

  // Conteúdo Principal
  contentContainer: {
    padding: 16,
  },
  leagueName: {
    color: RED,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 10,
  },
  leagueSub: {
    color: "#f77",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    marginTop: 2,
  },

  // Cards Futuristas
  card: {
    backgroundColor: DARK_GRAY,
    borderWidth: 2,
    borderColor: RED,
    borderRadius: 16,
    alignItems: "center",
    padding: 20,
    marginBottom: 12,
  },
  cardTitle: {
    color: WHITE,
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 8,
  },
  cardSubtitle: {
    color: "#CCC",
    fontSize: 14,
    marginTop: 4,
  },

  // Botões com gradiente
  buttonArea: {
    marginTop: 20,
    marginBottom: 50,
    alignItems: "center",
  },
  gradientButton: {
    width: "70%",
    paddingVertical: 12,
    borderRadius: 30,
    backgroundColor: RED,
    alignItems: "center",
  },
  gradientButtonText: {
    color: WHITE,
    fontWeight: "bold",
    fontSize: 16,
  },

  // Sem torneio
  noTournamentContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  noTournamentText: {
    color: WHITE,
    fontSize: 16,
    textAlign: "center",
    marginVertical: 15,
    maxWidth: "80%",
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
    marginTop: 30,
  },
  notPlayingText: {
    color: WHITE,
    fontSize: 16,
    textAlign: "center",
    marginVertical: 15,
    maxWidth: "80%",
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

  // ADMIN
  adminModalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
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
  refreshButton: {
  marginLeft: 10,
  padding: 8,
  borderRadius: 50, // Deixa o botão circular
  backgroundColor: "rgba(255, 255, 255, 0.15)", // Fundo mais sutil
  borderWidth: 1,
  borderColor: "rgba(255, 255, 255, 0.3)", // Bordas suaves
  justifyContent: "center",
  alignItems: "center",
},
});
