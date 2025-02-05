import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next"; // <--- i18n
import * as Animatable from "react-native-animatable";
import { Ionicons } from "@expo/vector-icons";

const SENDGRID_API_KEY = "SUA_API_KEY_AQUI"; // lembre de ocultar

export default function SuggestionScreen() {
  const { t } = useTranslation(); // <--- i18n

  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("Bugs");
  const [lastSent, setLastSent] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const storedName = await AsyncStorage.getItem("@userName");
      const storedId = await AsyncStorage.getItem("@userId");
      const lastSentTimestamp = await AsyncStorage.getItem("@lastSentEmail");

      setUserName(storedName || "Usuário");
      setUserId(storedId || "ID desconhecido");
      setLastSent(lastSentTimestamp ? parseInt(lastSentTimestamp) : null);
    })();
  }, []);

  const canSendEmail = (): boolean => {
    if (!lastSent) return true;
    const now = Date.now();
    const oneDayInMs = 24 * 60 * 60 * 1000;
    return now - lastSent > oneDayInMs;
  };

  const handleSendEmail = async () => {
    if (!message.trim()) {
      Alert.alert(t("common.error"), t("sugestao.warnings.empty_message"));
      return;
    }

    if (!canSendEmail()) {
      Alert.alert(t("common.error"), t("sugestao.warnings.daily_limit"));
      return;
    }

    try {
      const emailBody = {
        personalizations: [
          {
            to: [{ email: "seu-email@exemplo.com" }],
            subject: subject,
          },
        ],
        from: {
          email: "sender@exemplo.com",
          name: userName,
        },
        content: [
          {
            type: "text/plain",
            value: `Sugestão enviada por:
Nome: ${userName}
ID: ${userId}
Assunto: ${subject}
Mensagem: ${message}`,
          },
        ],
      };

      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Erro ao enviar e-mail:", errorText);
        throw new Error(`Falha ao enviar e-mail: ${response.statusText}`);
      }

      Alert.alert(t("common.success"), t("sugestao.success"));

      const now = Date.now();
      setLastSent(now);
      await AsyncStorage.setItem("@lastSentEmail", now.toString());

      setMessage("");
    } catch (error) {
      console.error("Erro ao enviar e-mail:", error);
      Alert.alert(t("common.error"), t("sugestao.error"));
    }
  };

  return (
    <View style={styles.container}>
      <Animatable.View
        animation="bounceInDown"
        duration={800}
        style={styles.headerContainer}
      >
        <Ionicons name="mail" size={28} color="#FFD700" style={styles.headerIcon} />
        <Text style={styles.header}>{t("sugestao.header")}</Text>
      </Animatable.View>

      <Text style={styles.label}>{t("sugestao.labels.subject")}</Text>
      <TextInput
        style={styles.input}
        value={subject}
        onChangeText={setSubject}
        placeholder={t("sugestao.placeholders.subject") || ""}
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>{t("sugestao.labels.message")}</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={message}
        onChangeText={setMessage}
        placeholder={t("sugestao.placeholders.message") || ""}
        placeholderTextColor="#999"
        multiline
        numberOfLines={6}
      />

      <Animatable.View animation="pulse" iterationCount="infinite" duration={1500}>
        <TouchableOpacity style={styles.button} onPress={handleSendEmail}>
          <Ionicons name="send" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.buttonText}>{t("sugestao.buttons.send")}</Text>
        </TouchableOpacity>
      </Animatable.View>

      {!canSendEmail() && (
        <Animatable.Text animation="fadeIn" duration={800} style={styles.warning}>
          {t("sugestao.warnings.daily_limit")}
        </Animatable.Text>
      )}
    </View>
  );
}

const DARK = "#1E1E1E";
const PRIMARY = "#E3350D";
const WHITE = "#FFFFFF";
const BORDER = "#4D4D4D";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK,
    padding: 20,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    justifyContent: "center",
  },
  headerIcon: {
    marginRight: 10,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFD700",
    textAlign: "center",
  },
  label: {
    color: WHITE,
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#292929",
    borderRadius: 8,
    padding: 12,
    color: WHITE,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  button: {
    flexDirection: "row",
    backgroundColor: PRIMARY,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
    justifyContent: "center",
  },
  buttonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "bold",
  },
  warning: {
    color: "#FF6F61",
    fontSize: 14,
    marginTop: 20,
    textAlign: "center",
  },
});
