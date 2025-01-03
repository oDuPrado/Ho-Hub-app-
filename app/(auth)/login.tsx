import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Switch,
  KeyboardAvoidingView,
  SafeAreaView,
  Platform,
  Animated,
  Easing,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { doc, getDoc } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";

import { db, auth } from "../../lib/firebaseConfig";

const { width, height } = Dimensions.get("window");

export default function LoginScreen() {
  const router = useRouter();

  const [playerId, setPlayerId] = useState("");
  const [pin, setPin] = useState("");
  const [stayLogged, setStayLogged] = useState(false);

  const logoScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Autenticação anônima
    (async () => {
      try {
        await signInAnonymously(auth);
        console.log("Usuário anônimo autenticado com sucesso.");
      } catch (err) {
        console.log("Falha ao autenticar anonimamente:", err);
        Alert.alert("Erro", "Não foi possível autenticar anonimamente.");
      }
    })();

    // Animação de pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.05,
          duration: 800,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 800,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [logoScale]);

  const handleLogin = async () => {
    if (!playerId || !pin) {
      Alert.alert("Erro", "Preencha seu ID e PIN.");
      return;
    }
    try {
      const docRef = doc(db, "players", playerId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        Alert.alert("Erro", "Jogador não encontrado.");
        return;
      }
      const data = snap.data();
      if (data.pin !== pin) {
        Alert.alert("Erro", "PIN incorreto.");
        return;
      }

      await AsyncStorage.setItem("@userId", playerId);
      await AsyncStorage.setItem("@userName", data.fullname || "Jogador");

      Alert.alert("Sucesso", `Bem-vindo, ${data.fullname || "Jogador"}!`);
      router.push("/(tabs)/home");
    } catch (err) {
      console.log("Erro no login:", err);
      Alert.alert("Erro", "Falha ao efetuar login.");
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Logo animada */}
        <Animated.Image
          source={require("../../assets/images/pokemon_ms_logo.jpg")}
          style={[styles.logo, { transform: [{ scale: logoScale }] }]}
          resizeMode="contain"
        />

        <Text style={styles.title}>Login</Text>

        <Text style={styles.label}>ID do Jogador</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: 5062577"
          placeholderTextColor={INPUT_BORDER}
          value={playerId}
          onChangeText={setPlayerId}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Senha</Text>
        <TextInput
          style={styles.input}
          placeholder="****"
          placeholderTextColor={INPUT_BORDER}
          secureTextEntry
          value={pin}
          onChangeText={setPin}
          keyboardType="numeric"
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchText}>Continuar Conectado</Text>
          <Switch
            value={stayLogged}
            onValueChange={setStayLogged}
            trackColor={{ false: SWITCH_TRACK, true: PRIMARY }}
            thumbColor={stayLogged ? SWITCH_THUMB : "#ccc"}
          />
        </View>

        {/* Botão estilizado */}
        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Conectar</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const BACKGROUND = "#1E1E1E"; // Fundo escuro
const PRIMARY = "#E3350D"; // Vermelho intenso
const SECONDARY = "#FFFFFF"; // Branco
const INPUT_BG = "#292929"; // Fundo do input
const INPUT_BORDER = "#4D4D4D"; // Borda metálica
const SWITCH_TRACK = "#555555"; // Cor do Switch
const SWITCH_THUMB = PRIMARY; // Vermelho intenso

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  container: {
    flex: 1,
    padding: 20,
    alignItems: "center",
  },
  logo: {
    width: width * 0.4, // Responsivo
    height: height * 0.2, // Responsivo
    marginTop: 40,
    marginBottom: 30,
  },
  title: {
    color: PRIMARY,
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 24,
    textTransform: "uppercase", // Texto em maiúsculas para destaque
  },
  label: {
    alignSelf: "flex-start",
    marginLeft: 5,
    color: SECONDARY,
    fontSize: 16,
    marginTop: 12,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    padding: 10,
    marginTop: 4,
    borderRadius: 8,
    color: SECONDARY,
    fontSize: 16,
    backgroundColor: INPUT_BG,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  switchText: {
    color: SECONDARY,
    fontSize: 16,
    marginRight: 8,
  },
  button: {
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8, // Menos arredondado, mais forte
    marginTop: 20,
    shadowColor: SECONDARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  buttonText: {
    color: SECONDARY,
    fontSize: 16,
    fontWeight: "bold",
  },
});
