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
  Modal,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Firebase
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signOut,
  User,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebaseConfig";

// i18n
import { useTranslation } from "react-i18next";
import LSselector from "../../LSselector";

// Ban List
import { BAN_PLAYER_IDS } from "../hosts";

// Biometria e SecureStore
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

// Ícones
import { Ionicons } from "@expo/vector-icons";

// --------------- Funções Auxiliares ---------------
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

// Funções de SecureStore
async function saveBiometricToken() {
  await SecureStore.setItemAsync("userBiometricToken", "enabled");
}
async function deleteBiometricToken() {
  await SecureStore.deleteItemAsync("userBiometricToken");
}
async function getBiometricToken() {
  return SecureStore.getItemAsync("userBiometricToken");
}

// --------------- Componente Principal ---------------
export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [mode, setMode] = useState<"login" | "signup">("login");

  // Campos do formulário
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [pin, setPin] = useState("");
  const [playerName, setPlayerName] = useState("");

  const [stayLogged, setStayLogged] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Auxiliares
  const [passwordStrength, setPasswordStrength] = useState("Fraca");
  const [loading, setLoading] = useState(false);

  // Ban
  const [banModalVisible, setBanModalVisible] = useState(false);

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

  // --------------- Tenta login com biometria se usuário já tiver optado ---------------
  useEffect(() => {
    (async () => {
      const stored = await getBiometricToken(); // "enabled" ou null
      if (stored === "enabled") {
        const canAuth = await LocalAuthentication.hasHardwareAsync();
        if (!canAuth) return;
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!enrolled) return;

        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Autenticar com biometria",
          fallbackLabel: "Usar senha",
          cancelLabel: "Cancelar",
        });

        if (result.success) {
          // Se biometria for ok, pula login e vai home
          console.log("Biometria ok!");
          router.push("/(tabs)/home");
        }
      }
    })();
  }, [router]);

  // --------------- Observa password p/ medir força (em signup) ---------------
  useEffect(() => {
    if (mode === "signup") {
      const s = checkPasswordStrength(password);
      setPasswordStrength(s);
    }
  }, [mode, password]);

  // --------------- Observa estado do Auth (FireAuth) ---------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        setLoading(true);

        // Buscar doc "login/{uid}"
        const docRef = doc(db, "login", user.uid);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          Alert.alert("Erro", "Conta incompleta no Firestore.");
          await signOut(auth);
          setLoading(false);
          return;
        }

        const data = snap.data();
        if (!data.playerId || !data.pin) {
          Alert.alert("Erro", "Conta sem playerId/pin.");
          await signOut(auth);
          setLoading(false);
          return;
        }

        // Verifica ban
        if (BAN_PLAYER_IDS.includes(data.playerId)) {
          // Exibe modal de ban
          setBanModalVisible(true);
          // Força signOut
          await signOut(auth);
          setLoading(false);
          return;
        }

        // Se não banido
        const docName = data.name || "Jogador";

        // Salva no AsyncStorage
        await AsyncStorage.setItem("@userId", data.playerId);
        await AsyncStorage.setItem("@userPin", data.pin);
        await AsyncStorage.setItem("@userName", docName);

        // Se "stayLogged" = true, pergunta se quer habilitar biometria
        if (stayLogged) {
          askEnableBiometry();
        }

        Alert.alert("Bem-vindo", `Olá, ${docName}!`);
        router.push("/(tabs)/home");
        setLoading(false);
      } else {
        console.log("Sem user logado");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // --------------- Pergunta se usuário quer habilitar biometria ---------------
  async function askEnableBiometry() {
    const canAuth = await LocalAuthentication.hasHardwareAsync();
    if (!canAuth) return; // se não suportar, não faz nada
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) return; // se não tiver biometria cadastrada, não faz nada

    Alert.alert(
      "Login por Biometria",
      "Deseja habilitar login por biometria para entrar sem digitar senha?",
      [
        { text: "Não", style: "cancel" },
        {
          text: "Sim",
          onPress: async () => {
            await saveBiometricToken(); // "enabled"
            Alert.alert("Sucesso", "Login biométrico habilitado!");
          },
        },
      ]
    );
  }

  // --------------- Ações de Signup/Login ---------------
  async function handleSignUp() {
    if (!email || !password || !playerId || !pin || !playerName) {
      Alert.alert("Erro", "Preencha todos os campos!");
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert("Erro", "Email inválido.");
      return;
    }
    if (!validatePassword(password)) {
      Alert.alert("Erro", "Senha fraca! Use 8+ chars c/ maiúscula, minúscula, dígito, especial.");
      return;
    }
    try {
      setLoading(true);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      console.log("Conta criada, UID=", cred.user.uid);

      // Salva doc "login/{uid}" no Firestore
      const docRef = doc(db, "login", cred.user.uid);
      await setDoc(docRef, {
        email,
        playerId,
        pin,
        name: playerName,
        createdAt: new Date().toISOString(),
      });

      Alert.alert("Sucesso", `Conta criada. ID=${playerId}, PIN=${pin}.`);
      // onAuthStateChanged redireciona
    } catch (err: any) {
      console.log("Erro no SignUp:", err);
      Alert.alert("Erro no signup", err.message || "");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn() {
    if (!email || !password) {
      Alert.alert("Erro", "Digite email e senha");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged fará o resto
    } catch (err: any) {
      console.log("Erro no SignIn:", err);
      let msg = "Falha ao logar.";
      if (err.code === "auth/wrong-password") {
        msg = "Senha incorreta.";
      } else if (err.code === "auth/user-not-found") {
        msg = "Usuário não encontrado.";
      }
      Alert.alert("Erro de Login", msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!email) {
      Alert.alert("Erro", "Digite um email");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert("Verifique seu email", "Link de redefinição enviado.");
    } catch (err: any) {
      console.log("Erro ao resetar senha:", err);
      Alert.alert("Erro ao resetar", err.message || "");
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

          {/* Ban Modal */}
          <Modal
            animationType="fade"
            transparent={true}
            visible={banModalVisible}
            onRequestClose={() => setBanModalVisible(false)}
          >
            <View style={styles.banOverlay}>
              <View style={styles.banContainer}>
                <Image
                  source={require("../../assets/images/pikachu_happy.png")}
                  style={styles.banImage}
                />
                <Text style={styles.banTitle}>Banido!</Text>
                <Text style={styles.banText}>
                  Infelizmente você foi banido por violar nossos Termos de Uso.
                </Text>
                <TouchableOpacity
                  onPress={() => setBanModalVisible(false)}
                  style={styles.banButton}
                >
                  <Text style={styles.banButtonText}>Ok</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Seletor de idioma */}
          <LSselector />

          {/* Logo animada */}
          <Animated.Image
            source={require("../../assets/images/pokemon_ms_logo.jpg")}
            style={[styles.logo, { transform: [{ scale: logoScale }] }]}
            resizeMode="contain"
          />

          <Text style={styles.title}>
            {mode === "signup" ? "Criar Conta" : "Fazer Login"}
          </Text>

          {/* Email */}
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite seu email..."
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
              placeholder="********"
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

          {/* Esqueci a senha (somente no login) */}
          {mode === "login" && (
            <TouchableOpacity
              style={{ marginTop: 10, alignSelf: "flex-end" }}
              onPress={handleResetPassword}
            >
              <Text style={styles.forgotText}>Esqueci a senha</Text>
            </TouchableOpacity>
          )}

          {/* Força da senha (somente signup) */}
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

          {/* ID, PIN e Nome caso signup */}
          {mode === "signup" && (
            <>
              <Text style={styles.label}>Nome</Text>
              <TextInput
                style={styles.input}
                placeholder="Seu nome..."
                placeholderTextColor={INPUT_BORDER}
                value={playerName}
                onChangeText={setPlayerName}
              />

              <Text style={styles.label}>Player ID</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 123456"
                placeholderTextColor={INPUT_BORDER}
                value={playerId}
                onChangeText={setPlayerId}
                keyboardType="numeric"
              />

              <Text style={styles.label}>PIN</Text>
              <View style={styles.inputWithIcon}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 8 }]}
                  placeholder="Ex: 9999"
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

          {/* Switch: Continuar conectado */}
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Manter Conectado</Text>
            <Switch
              value={stayLogged}
              onValueChange={setStayLogged}
              trackColor={{ false: SWITCH_TRACK, true: PRIMARY }}
              thumbColor={stayLogged ? SWITCH_THUMB : "#ccc"}
            />
          </View>

          {/* Botão principal */}
          {mode === "signup" ? (
            <TouchableOpacity style={styles.signupButton} onPress={handleSignUp}>
              <Text style={styles.buttonText}>Criar Conta</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.button} onPress={handleSignIn}>
              <Text style={styles.buttonText}>Login</Text>
            </TouchableOpacity>
          )}

          {/* Link p/ trocar de modo */}
          {mode === "signup" ? (
            <TouchableOpacity
              style={{ marginTop: 20 }}
              onPress={() => setMode("login")}
            >
              <Text style={{ color: SECONDARY }}>
                Já tem conta? Fazer Login
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={{ marginTop: 20 }}
              onPress={() => setMode("signup")}
            >
              <Text style={{ color: SECONDARY }}>
                Não tem conta? Criar Conta
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

  // Ban Modal
  banOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  banContainer: {
    width: "80%",
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    alignItems: "center",
    padding: 20,
  },
  banImage: {
    width: 80,
    height: 80,
    marginBottom: 15,
  },
  banTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 10,
  },
  banText: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    marginBottom: 20,
  },
  banButton: {
    backgroundColor: "#E3350D",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  banButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
});
