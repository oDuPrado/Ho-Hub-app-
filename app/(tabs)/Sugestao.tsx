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

const SENDGRID_API_KEY = "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";

export default function SuggestionScreen() {
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("Bugs");
  const [lastSent, setLastSent] = useState<number | null>(null);

  useEffect(() => {
    // Carrega informações do usuário e última data de envio
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
    const oneDayInMs = 24 * 60 * 60 * 1000; // 1 dia
    return now - lastSent > oneDayInMs; // Verifica se passou 1 dia
  };

  const handleSendEmail = async () => {
    if (!message.trim()) {
      Alert.alert("Erro", "A mensagem não pode estar vazia.");
      return;
    }

    if (!canSendEmail()) {
      Alert.alert(
        "Limite Atingido",
        "Você só pode enviar uma sugestão por dia."
      );
      return;
    }

    try {
      const emailBody = {
        personalizations: [
          {
            to: [{ email: "ma.macedo11@hotmail.com" }], // Seu e-mail de destino
            subject: subject,
          },
        ],
        from: {
          email: "ma.macedo11@hotmail.com", // Use um e-mail válido
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

      Alert.alert("Sucesso", "Sugestão enviada com sucesso!");

      // Atualiza a data do último envio
      const now = Date.now();
      setLastSent(now);
      await AsyncStorage.setItem("@lastSentEmail", now.toString());

      // Limpa o campo de mensagem
      setMessage("");
    } catch (error) {
      console.error("Erro ao enviar e-mail:", error);
      Alert.alert("Erro", "Não foi possível enviar sua sugestão.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Sugestões</Text>

      <Text style={styles.label}>Assunto</Text>
      <TextInput
        style={styles.input}
        value={subject}
        onChangeText={setSubject}
        placeholder="Digite o assunto"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>Mensagem</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={message}
        onChangeText={setMessage}
        placeholder="Digite sua sugestão"
        placeholderTextColor="#999"
        multiline
        numberOfLines={6}
      />

      <TouchableOpacity style={styles.button} onPress={handleSendEmail}>
        <Text style={styles.buttonText}>Enviar</Text>
      </TouchableOpacity>

      {!canSendEmail() && (
        <Text style={styles.warning}>
          Você já enviou uma sugestão hoje. Tente novamente amanhã.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFD700",
    textAlign: "center",
    marginBottom: 20,
  },
  label: {
    color: "#FFF",
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#292929",
    borderRadius: 8,
    padding: 12,
    color: "#FFF",
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#4D4D4D",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: "#E3350D",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#FFF",
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
