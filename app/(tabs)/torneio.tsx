// app/(tabs)/torneio.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Button,
  Alert,
  Linking,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

// Expo Notifications
import * as Notifications from "expo-notifications";

// Configura como as notificações serão tratadas mesmo em segundo plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,    // exibe banner/alerta
    shouldPlaySound: true,    // reproduz som
    shouldSetBadge: false,    // não altera badge
  }),
});

/**
 * Componente principal da tela de Torneio.
 * Faz polling no servidor a cada 10s p/ descobrir se há nova rodada,
 * notifica o jogador se surgir uma nova e exibe dados básicos (mesa, oponente).
 */
export default function TorneioScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [userName, setUserName] = useState<string>("Jogador");
  const [mesaNumber, setMesaNumber] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState<number | null>(null);
  const [linkReport, setLinkReport] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string | null>(null);

  // Para controlar o polling
  const intervalRef = useRef<any>(null);
  const [fetchCount, setFetchCount] = useState(0);

  // -------------------------------------------------
  // Efeito inicial: p/ pedir permissões e iniciar poll
  // -------------------------------------------------
  useEffect(() => {
    requestNotificationPermission();

    // Faz o primeiro fetch imediato
    fetchTournamentData();

    // Polling a cada 10 segundos
    intervalRef.current = setInterval(() => {
      setFetchCount((prev) => prev + 1);
    }, 10_000);

    return () => {
      // Limpa o interval ao desmontar
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------
  // Efeito: toda vez que fetchCount mudar, refaz fetch
  // ---------------------------------------------
  useEffect(() => {
    fetchTournamentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchCount]);

  // -------------------------
  // Pedir permissão de notificação
  // -------------------------
  async function requestNotificationPermission() {
    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
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

  // -------------------------
  // fetchTournamentData: busca dados do servidor (main_2)
  // -------------------------
  async function fetchTournamentData() {
    try {
      setLoading(true);

      // Recupera ID e Nome do jogador
      const storedId = await AsyncStorage.getItem("@userId");
      const storedName = await AsyncStorage.getItem("@userName");
      if (!storedId) {
        router.replace("/(auth)/login");
        return;
      }
      setUserName(storedName ?? "Jogador");

      // Busca dados do main_2
      const res = await fetch("https://DuPrado.pythonanywhere.com/get-data");
      if (!res.ok) {
        throw new Error(`Falha ao obter dados do torneio: ${res.status}`);
      }
      const jsonTorneio = await res.json();

      // Verifica rodadas
      const roundObj = jsonTorneio.round ?? {};
      const roundKeys = Object.keys(roundObj).map((rk) => parseInt(rk, 10));
      if (roundKeys.length === 0) {
        // Nenhuma rodada encontrada
        setMesaNumber(null);
        setOpponentName(null);
        setCurrentRound(null);
        setLinkReport(null);
        setLoading(false);
        return;
      }

      // Round máximo
      const maxRound = Math.max(...roundKeys);
      setCurrentRound(maxRound);

      // Pega divisões
      const divisions = roundObj[maxRound];
      const divKeys = Object.keys(divisions);
      const currentDiv = divKeys[0] ?? "None";
      const tables = divisions[currentDiv].table;

      // Identifica mesa e oponente
      let foundMesa: string | null = null;
      let link: string | null = null;
      let foundOpponent: string | null = null;

      for (let tableId in tables) {
        const matchInfo = tables[tableId];
        const p1_id = matchInfo.player1_id;
        const p2_id = matchInfo.player2_id;

        if (p1_id === storedId) {
          foundMesa = tableId;
          link = `https://DuPrado.pythonanywhere.com/mesa/${tableId}`;
          foundOpponent = matchInfo.player2; // Nome do player2
          break;
        } else if (p2_id === storedId) {
          foundMesa = tableId;
          link = `https://DuPrado.pythonanywhere.com/mesa/${tableId}`;
          foundOpponent = matchInfo.player1; // Nome do player1
          break;
        }
      }

      setMesaNumber(foundMesa);
      setLinkReport(link);
      setOpponentName(foundOpponent);

      // Dispara notificação somente se a mesa foi encontrada
      if (foundMesa) {
        await checkRoundAndNotify(maxRound, foundMesa, foundOpponent);
      }

      setLoading(false);
    } catch (err) {
      setLoading(false);
      console.log("Erro no Torneio:", err);
    }
  }

  // -------------------------------------------------
  // checkRoundAndNotify: compara round com o local e notifica se novo
  // -------------------------------------------------
  async function checkRoundAndNotify(
    rnd: number,
    mesa: string,
    oppName: string | null
  ) {
    try {
      // Lê round notificado anteriormente
      const storedRound = await AsyncStorage.getItem("@lastNotifiedRound");
      const lastNotifiedRound = storedRound ? parseInt(storedRound, 10) : 0;

      if (rnd > lastNotifiedRound) {
        // Notifica com estilo e cores do projeto
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Rodada Lançada! (Rodada ${rnd})`,
            body: oppName
              ? `Você está na mesa ${mesa}, enfrentando ${oppName}. Boa sorte!`
              : `Você está na mesa ${mesa}. Boa sorte!`,
            // Em Android, podemos forçar cor do LED / smallIcon etc. se desejar
            // "color" define a cor do ícone em alguns launchers
            data: { screen: "TorneioScreen" }, // Ao clicar, abre o app nessa tela
          },
          trigger: null, // dispara imediatamente
        });
        // Salva esse round como notificado
        await AsyncStorage.setItem("@lastNotifiedRound", String(rnd));
      }
    } catch (e) {
      console.log("Falha ao checar/notificar round:", e);
    }
  }

  // -------------------------
  // handleOpenReport: abre link da mesa p/ report
  // -------------------------
  function handleOpenReport() {
    if (!linkReport) {
      Alert.alert("Aviso", "Não foi encontrada uma mesa para você.");
      return;
    }
    Linking.openURL(linkReport).catch((err) => {
      console.log("Erro openURL:", err);
      Alert.alert("Erro", "Não foi possível abrir a página de report.");
    });
  }

  // -------------------------
  // Render principal
  // -------------------------
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={RED} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Torneio em Andamento</Text>

      <View style={styles.infoBox}>
        <Text style={styles.label}>Jogador:</Text>
        <Text style={styles.value}>{userName}</Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.label}>Oponente:</Text>
        <Text style={styles.value}>{opponentName ?? "Nenhum"}</Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.label}>Rodada Atual:</Text>
        <Text style={styles.value}>{currentRound ?? "Nenhuma"}</Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.label}>Sua Mesa:</Text>
        <Text style={styles.value}>{mesaNumber ?? "Não Encontrada"}</Text>
      </View>

      <View style={styles.actions}>
        <Button
          title="Reportar Resultado"
          color={RED}
          onPress={handleOpenReport}
        />
      </View>
    </ScrollView>
  );
}

// -------------------- ESTILOS --------------------
const RED = "#E3350D"; // Vermelho intenso do projeto
const BLACK = "#1E1E1E"; // Fundo escuro
const WHITE = "#FFFFFF"; // Texto claro
const DARK_GRAY = "#292929"; // Fundo dos cards
const LIGHT_GRAY = "#4D4D4D"; // Borda dos cards

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
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  title: {
    color: RED,
    fontSize: 24,
    textAlign: "center",
    fontWeight: "bold",
    marginBottom: 20,
    textTransform: "uppercase",
  },
  infoBox: {
    backgroundColor: DARK_GRAY,
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: LIGHT_GRAY,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "bold",
  },
  value: {
    color: RED,
    fontSize: 16,
    fontWeight: "bold",
  },
  actions: {
    marginVertical: 20,
    alignItems: "center",
  },
});
