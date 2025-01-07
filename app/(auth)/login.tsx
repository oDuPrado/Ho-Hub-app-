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
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signOut,
  User,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

import { auth, db } from "../../lib/firebaseConfig";

// --------------- Funções Auxiliares (validação) ---------------

function checkPasswordStrength(password: string) {
  let score = 0;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (password.length >= 8) score++;

  if (score <= 1) return "Fraca";
  if (score === 2) return "Média";
  if (score === 3) return "Forte";
  if (score >= 4) return "Muito Forte";
  return "Fraca";
}

function getPasswordStrengthColor(strength: string): string {
  if (strength === "Fraca") return "#E3350D"; // Vermelho
  if (strength === "Média") return "#FFC107"; // Amarelo
  if (strength === "Forte") return "#4CAF50"; // Verde
  if (strength === "Muito Forte") return "#009688"; // Verde mais escuro
  return SECONDARY;
}

function validateEmail(mail: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(mail);
}
function validatePassword(pw: string): boolean {
  // Ao menos 1 maiúscula, 1 minúscula, 1 dígito, 1 especial, >=8 chars
  const upper = /[A-Z]/.test(pw);
  const lower = /[a-z]/.test(pw);
  const digit = /\d/.test(pw);
  const special = /[^A-Za-z0-9]/.test(pw);
  return upper && lower && digit && special && pw.length >= 8;
}

// --------------- Componente Principal ---------------
export default function LoginScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");

  // Campos do formulário
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [playerId, setPlayerId] = useState(""); // só no signup
  const [pin, setPin] = useState(""); // só no signup
  const [playerName, setPlayerName] = useState(""); // NOVO: nome do jogador

  const [stayLogged, setStayLogged] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Auxiliares
  const [passwordStrength, setPasswordStrength] = useState("Fraca");
  const [loading, setLoading] = useState(false);

  // Animação de logotipo
  const logoScale = useRef(new Animated.Value(1)).current;

  // --------------- Efeito de animação ---------------
  useEffect(() => {
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

  // --------------- Observa estado do Auth ---------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        // Está logado => buscar doc "login/{uid}"
        setLoading(true);
        const docRef = doc(db, "login", user.uid);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          Alert.alert(
            "Aviso",
            "Seu login não possui dados de playerId/pin. Conta incompleta."
          );
          await signOut(auth);
          setLoading(false);
          return;
        }
        const data = snap.data();
        if (!data.playerId || !data.pin) {
          Alert.alert(
            "Aviso",
            "Documento sem playerId/pin. Contate o suporte."
          );
          await signOut(auth);
          setLoading(false);
          return;
        }

        // Se tiver "name", ótimo. Senão, fallback.
        const docName = data.name || "Jogador";

        // Salva no AsyncStorage para que as outras telas funcionem igual antes
        await AsyncStorage.setItem("@userId", data.playerId);
        await AsyncStorage.setItem("@userPin", data.pin);
        await AsyncStorage.setItem("@userName", docName);

        // Exemplo de feedback
        Alert.alert("Bem-vindo", `Olá, ${docName}!`);

        // Ir para a Home (tabs)
        router.push("/(tabs)/home");
        setLoading(false);
      } else {
        console.log("Sem user logado");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // --------------- Observa password p/ medir força (em signup) ---------------
  useEffect(() => {
    if (mode === "signup") {
      const s = checkPasswordStrength(password);
      setPasswordStrength(s);
    }
  }, [mode, password]);

  // --------------- Ações ---------------
  async function handleSignUp() {
    if (!email || !password || !playerId || !pin || !playerName) {
      Alert.alert(
        "Erro",
        "Preencha todos os campos (Nome, E-mail, Senha, ID e PIN)."
      );
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert("Erro", "E-mail inválido.");
      return;
    }
    if (!validatePassword(password)) {
      Alert.alert(
        "Senha Fraca",
        "Sua senha deve ter ao menos 1 maiúscula, 1 minúscula, 1 número, 1 especial e 8 caracteres."
      );
      return;
    }
    try {
      setLoading(true);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      console.log("Conta criada, UID=", cred.user.uid);

      // Salva doc "login/{uid}"
      const docRef = doc(db, "login", cred.user.uid);
      await setDoc(docRef, {
        email,
        playerId,
        pin,
        name: playerName, // Fundamental para as outras telas
        createdAt: new Date().toISOString(),
      });

      Alert.alert("Sucesso", `Conta criada. ID=${playerId}, PIN=${pin}`);
      // onAuthStateChanged redireciona
    } catch (err: any) {
      console.log("Erro no SignUp:", err);
      Alert.alert("Erro", err.message || "Não foi possível criar conta.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn() {
    if (!email || !password) {
      Alert.alert("Erro", "Informe e-mail e senha.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // A onAuthStateChanged fará o resto
    } catch (err: any) {
      console.log("Erro no SignIn:", err);
      let msg = "Não foi possível entrar.";
      if (err.code === "auth/wrong-password") {
        msg = "Senha incorreta. Tente novamente.";
      } else if (err.code === "auth/user-not-found") {
        msg = "Usuário não encontrado. Verifique o e-mail.";
      }
      Alert.alert("Erro", msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!email) {
      Alert.alert("Atenção", "Informe seu e-mail para redefinir a senha.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert(
        "Verifique seu e-mail",
        "Um link de redefinição foi enviado para seu e-mail."
      );
    } catch (err: any) {
      console.log("Erro ao resetar senha:", err);
      Alert.alert("Erro", err.message || "Não foi possível enviar e-mail.");
    }
  }

  // --------------- Render ---------------
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={{ color: SECONDARY, marginTop: 8 }}>Carregando...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Logo animada */}
          <Animated.Image
            source={require("../../assets/images/pokemon_ms_logo.jpg")}
            style={[styles.logo, { transform: [{ scale: logoScale }] }]}
            resizeMode="contain"
          />

          <Text style={styles.title}>
            {mode === "signup" ? "Criar Conta" : "Entrar"}
          </Text>

          {/* E-mail */}
          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="seuemail@exemplo.com"
            placeholderTextColor={INPUT_BORDER}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Senha */}
          <Text style={styles.label}>Senha</Text>
          <View style={styles.inputWithIcon}>
            <TextInput
              style={[styles.input, { flex: 1, marginRight: 8 }]}
              placeholder="Digite sua senha"
              placeholderTextColor={INPUT_BORDER}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showPassword ? "eye-off" : "eye"}
                size={24}
                color={SECONDARY}
              />
            </TouchableOpacity>
          </View>

          {/* Esqueci Senha (apenas login) */}
          {mode === "login" && (
            <TouchableOpacity
              style={{ marginTop: 10, alignSelf: "flex-end" }}
              onPress={handleResetPassword}
            >
              <Text style={styles.forgotText}>Esqueceu a Senha?</Text>
            </TouchableOpacity>
          )}

          {/* Se for signup, mostra força da senha */}
          {mode === "signup" && (
            <Text
              style={[
                styles.passwordHint,
                { color: getPasswordStrengthColor(passwordStrength) },
              ]}
            >
              Força da senha: {passwordStrength}
            </Text>
          )}

          {/* ID e PIN, e NOME caso signup */}
          {mode === "signup" && (
            <>
              <Text style={styles.label}>Nome do Jogador</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Ash Ketchum"
                placeholderTextColor={INPUT_BORDER}
                value={playerName}
                onChangeText={setPlayerName}
              />

              <Text style={styles.label}>ID do Jogador</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 5062577"
                placeholderTextColor={INPUT_BORDER}
                value={playerId}
                onChangeText={setPlayerId}
                keyboardType="numeric"
              />

              <Text style={styles.label}>PIN</Text>
              <View style={styles.inputWithIcon}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 8 }]}
                  placeholder="****"
                  placeholderTextColor={INPUT_BORDER}
                  secureTextEntry={!showPin}
                  value={pin}
                  onChangeText={setPin}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  onPress={() => setShowPin(!showPin)}
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={showPin ? "eye-off" : "eye"}
                    size={24}
                    color={SECONDARY}
                  />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Switch: Continuar Conectado */}
          {
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>
                Continuar Conectado (em breve){" "}
              </Text>
              <Switch
                value={stayLogged}
                onValueChange={setStayLogged}
                trackColor={{ false: SWITCH_TRACK, true: PRIMARY }}
                thumbColor={stayLogged ? SWITCH_THUMB : "#ccc"}
              />
            </View>
          }

          {/* Botão principal */}
          {mode === "signup" ? (
            <TouchableOpacity
              style={styles.signupButton}
              onPress={handleSignUp}
            >
              <Text style={styles.buttonText}>Cadastrar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.button} onPress={handleSignIn}>
              <Text style={styles.buttonText}>Entrar</Text>
            </TouchableOpacity>
          )}

          {/* Link p/ trocar de modo */}
          {mode === "signup" ? (
            <TouchableOpacity
              style={{ marginTop: 20 }}
              onPress={() => setMode("login")}
            >
              <Text style={{ color: SECONDARY }}>
                Já tem conta? <Text style={styles.underline}>Entre Aqui</Text>
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={{ marginTop: 20 }}
              onPress={() => setMode("signup")}
            >
              <Text style={{ color: SECONDARY }}>
                Não tem conta? <Text style={styles.underline}>Criar Conta</Text>
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --------------- ESTILOS ---------------
const { width, height } = Dimensions.get("window");
const BACKGROUND = "#1E1E1E";
const PRIMARY = "#E3350D";
const SECONDARY = "#FFFFFF";
const INPUT_BG = "#292929";
const INPUT_BORDER = "#4D4D4D";
const SWITCH_TRACK = "#555555";
const SWITCH_THUMB = PRIMARY;
const ACCENT = "#FF6F61";

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: BACKGROUND,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 20,
    alignItems: "center",
    flexGrow: 1,
  },
  logo: {
    width: width * 0.4,
    height: height * 0.2,
    marginTop: 40,
    marginBottom: 30,
  },
  title: {
    color: PRIMARY,
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 24,
    textTransform: "uppercase",
  },
  label: {
    alignSelf: "flex-start",
    marginLeft: 5,
    color: SECONDARY,
    fontSize: 16,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    padding: 10,
    marginTop: 4,
    borderRadius: 8,
    color: SECONDARY,
    fontSize: 16,
    backgroundColor: INPUT_BG,
    width: "100%",
  },
  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  eyeIcon: {
    padding: 6,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    alignSelf: "flex-start",
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
    borderRadius: 8,
    marginTop: 5,
    shadowColor: SECONDARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  signupButton: {
    backgroundColor: ACCENT,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
    marginTop: 5,
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
  underline: {
    color: ACCENT,
    textDecorationLine: "underline",
  },
  forgotText: {
    color: ACCENT,
    fontSize: 14,
    textDecorationLine: "underline",
    alignSelf: "center",
    marginTop: 10,
  },
  passwordHint: {
    fontSize: 14,
    marginTop: 8,
    alignSelf: "center",
  },
});
