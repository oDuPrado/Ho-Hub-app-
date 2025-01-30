// app/(tabs)/torneio.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Linking,
  ScrollView,
  Platform,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useTranslation } from "react-i18next";
import { 
  Appbar, 
  Card, 
  Button 
} from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import LottieView from "lottie-react-native"; // <--- Lottie

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function TorneioScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>(t("torneio.info.none"));
  const [mesaNumber, setMesaNumber] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState<number | null>(null);
  const [linkReport, setLinkReport] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string | null>(null);

  const intervalRef = useRef<any>(null);
  const [fetchCount, setFetchCount] = useState(0);

  // Pedir permissão e buscar dados
  useEffect(() => {
    requestNotificationPermission();
    fetchTournamentData();

    // Define intervalo de 30s
    intervalRef.current = setInterval(() => {
      setFetchCount((prev) => prev + 1);
    }, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // A cada ciclo, recarrega
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
        Alert.alert(t("torneio.alerts.attention"), "Permissão de notificações não concedida.");
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
      if (!storedId) {
        Alert.alert(t("torneio.alerts.attention"), t("torneio.alerts.not_logged_in"));
        router.replace("/(auth)/login");
        return;
      }
      setUserName(storedName ?? t("torneio.info.none"));

      const res = await fetch("https://DuPrado.pythonanywhere.com/get-data");
      if (!res.ok) {
        throw new Error(`Falha ao obter dados do torneio: ${res.status}`);
      }
      const jsonTorneio = await res.json();

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
      let link: string | null = null;
      let foundOpponent: string | null = null;

      for (let tableId in tables) {
        const matchInfo = tables[tableId];
        const p1_id = matchInfo.player1_id;
        const p2_id = matchInfo.player2_id;

        if (p1_id === storedId) {
          foundMesa = tableId;
          link = `https://DuPrado.pythonanywhere.com/mesa/${tableId}`;
          foundOpponent = matchInfo.player2;
          break;
        } else if (p2_id === storedId) {
          foundMesa = tableId;
          link = `https://DuPrado.pythonanywhere.com/mesa/${tableId}`;
          foundOpponent = matchInfo.player1;
          break;
        }
      }

      setMesaNumber(foundMesa);
      setLinkReport(link);
      setOpponentName(foundOpponent);

      if (foundMesa) {
        await checkRoundAndNotify(maxRound, foundMesa, foundOpponent || "");
      }

      setLoading(false);
    } catch (err) {
      setLoading(false);
      console.log("Erro no Torneio:", err);
    }
  }

  async function checkRoundAndNotify(rnd: number, mesa: string, oppName: string) {
    try {
      const storedRound = await AsyncStorage.getItem("@lastNotifiedRound");
      const lastNotifiedRound = storedRound ? parseInt(storedRound, 10) : 0;

      if (rnd > lastNotifiedRound) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `${t("torneio.alerts.new_round")} (Rodada ${rnd})`,
            body: oppName
              ? `Você está na mesa ${mesa}, enfrentando ${oppName}. Boa sorte!`
              : `Você está na mesa ${mesa}. Boa sorte!`,
            data: { screen: "TorneioScreen" },
          },
          trigger: null,
        });
        await AsyncStorage.setItem("@lastNotifiedRound", String(rnd));
      }
    } catch (e) {
      console.log("Falha ao notificar round:", e);
    }
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

  if (loading) {
    return (
      <View style={styles.loader}>
        {/* Usando Lottie para loading */}
        <LottieView
          source={require("../../assets/images/lotties/loading.json")}
          autoPlay
          loop
          style={{ width: 200, height: 200 }}
        />
      </View>
    );
  }

  return (
    <>
      {/* AppBar com Logo centralizada */}
      <Appbar.Header style={styles.appBar}>
        <Image
          source={require("../../assets/images/logo.jpg")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Appbar.Content 
          title="Torneio"
          titleStyle={styles.appBarTitle}
        />
      </Appbar.Header>

      {/* Gradient de fundo */}
      <LinearGradient
        colors={[BLACK, "#121212", "#0A0A0A"]}
        style={styles.gradientBackground}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Título principal */}
          <Text style={styles.mainTitle}>
            {t("torneio.info.ongoing_title").toUpperCase()}
          </Text>

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
                  name="account"
                  size={40}
                  color={RED}
                />
              )}
              titleStyle={styles.cardTitle}
              subtitleStyle={styles.cardSubtitle}
            />
          </Card>

          {/* Card da Rodada */}
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

          {/* Botão para Reportar Resultado */}
          <View style={styles.btnContainer}>
            <Button
              mode="contained"
              onPress={handleOpenReport}
              style={styles.btnReport}
              labelStyle={{ color: WHITE, fontSize: 16 }}
              icon="check"
            >
              {t("torneio.buttons.report_result")}
            </Button>
          </View>
        </ScrollView>
      </LinearGradient>
    </>
  );
}

/* --------------------------
   PALETA DE CORES E ESTILOS
--------------------------- */
const RED = "#E3350D";
const BLACK = "#1E1E1E";
const WHITE = "#FFFFFF";
const DARK_GRAY = "#292929";

const styles = StyleSheet.create({
  appBar: {
    backgroundColor: BLACK,
    elevation: 6,
  },
  appBarTitle: {
    color: RED,
    fontWeight: "bold",
    fontSize: 20,
    textAlign: "center",
  },
  logo: {
    width: 50,
    height: 50,
    marginLeft: 10,
  },
  loader: {
    flex: 1,
    backgroundColor: BLACK,
    justifyContent: "center",
    alignItems: "center",
  },
  gradientBackground: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  mainTitle: {
    color: RED,
    fontSize: 22,
    fontWeight: "bold",
    marginVertical: 20,
    textAlign: "center",
  },
  card: {
    marginBottom: 12,
    backgroundColor: DARK_GRAY,
    borderRadius: 12,

    // Sombra no Android:
    elevation: 4,
    // Sombra no iOS:
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
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
    paddingVertical: 8,
    width: "75%",
  },
});
