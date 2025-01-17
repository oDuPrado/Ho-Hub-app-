// app/(tabs)/torneio.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Platform,
  Button,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

import * as Notifications from "expo-notifications";
import { useTranslation } from "react-i18next"; // <--- i18n

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function TorneioScreen() {
  const router = useRouter();
  const { t } = useTranslation(); // <--- i18n

  const [loading, setLoading] = useState(true);

  const [userName, setUserName] = useState<string>(t("torneio.info.none"));
  const [mesaNumber, setMesaNumber] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState<number | null>(null);
  const [linkReport, setLinkReport] = useState<string | null>(null);
  const [opponentName, setOpponentName] = useState<string | null>(null);

  const intervalRef = useRef<any>(null);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    requestNotificationPermission();
    fetchTournamentData();

    intervalRef.current = setInterval(() => {
      setFetchCount((prev) => prev + 1);
    }, 10000);

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
      // Para PWAs
      window.open(linkReport, "_blank");
    } else {
      // Para aplicativos nativos (Android/iOS)
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
        <ActivityIndicator size="large" color={RED} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{t("torneio.info.ongoing_title")}</Text>

      <View style={styles.infoBox}>
        <Text style={styles.label}>{t("torneio.info.player_label")}:</Text>
        <Text style={styles.value}>{userName}</Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.label}>{t("torneio.info.opponent_label")}:</Text>
        <Text style={styles.value}>{opponentName ?? t("torneio.alerts.no_opponent")}</Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.label}>{t("torneio.info.current_round")}:</Text>
        <Text style={styles.value}>
          {currentRound ?? t("torneio.alerts.no_round")}
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.label}>{t("torneio.info.your_table")}:</Text>
        <Text style={styles.value}>{mesaNumber ?? t("torneio.info.not_found")}</Text>
      </View>

      <View style={styles.actions}>
        <Button
          title={t("torneio.buttons.report_result")}
          color={RED}
          onPress={handleOpenReport}
        />
      </View>
    </ScrollView>
  );
}

const RED = "#E3350D";
const BLACK = "#1E1E1E";
const WHITE = "#FFFFFF";
const DARK_GRAY = "#292929";
const LIGHT_GRAY = "#4D4D4D";

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
