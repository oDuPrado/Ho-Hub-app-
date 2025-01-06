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
import { doc, setDoc, getDoc, collection, Firestore } from "firebase/firestore";

import { Ionicons } from "@expo/vector-icons"; // expo install react-native-vector-icons

import { auth, db } from "../../lib/firebaseConfig";

/** Avalia força da senha e retorna: Fraca, Média, Forte, Muito Forte */
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
  if (strength === "Muito Forte") return "#4CAF50"; // Verde Escuro (ou outra cor, se preferir)
  return SECONDARY; // Cor padrão
}

/** Valida form de e-mail minimamente */
function validateEmail(mail: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(mail);
}
/** Verificação mínima se a senha tem 8 chars etc. */
function validatePassword(pw: string): boolean {
  const upper = /[A-Z]/.test(pw);
  const lower = /[a-z]/.test(pw);
  const digit = /\d/.test(pw);
  const special = /[^A-Za-z0-9]/.test(pw);
  return pw.length >= 8 && upper && lower && digit && special;
}

const { width, height } = Dimensions.get("window");

const BACKGROUND = "#1E1E1E";
const PRIMARY = "#E3350D"; // Vermelho “Pokébola”
const SECONDARY = "#FFFFFF";
const INPUT_BG = "#292929";
const INPUT_BORDER = "#4D4D4D";
const SWITCH_TRACK = "#555555";
const SWITCH_THUMB = PRIMARY;
const ACCENT = "#FF6F61";

/** Componente principal de Login/Cadastro */
export default function LoginScreen() {
  const router = useRouter();

  // Modo => login ou signup
  const [mode, setMode] = useState<"login" | "signup">("login");

  // Campos do formulário
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [playerId, setPlayerId] = useState(""); // somente para signup
  const [pin, setPin] = useState(""); // somente para signup
  const [stayLogged, setStayLogged] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Auxiliares
  const [passwordStrength, setPasswordStrength] = useState("Fraca");
  const [loading, setLoading] = useState(false);

  // Animação do logo
  const logoScale = useRef(new Animated.Value(1)).current;

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

  // Observa user logado
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        console.log("onAuthStateChanged -> user logado:", user.uid);
        setLoading(true);
        const docRef = doc(db, "login", user.uid);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          // Se doc login/{uid} não existe => recusa
          Alert.alert(
            "Aviso",
            "Nenhum registro de playerId/pin encontrado. Conta incompleta."
          );
          // Desloga e sai
          await signOut(auth);
          setLoading(false);
          return;
        }
        const data = snap.data();
        // Se faltar playerId ou pin => recusa
        if (!data.playerId || !data.pin) {
          Alert.alert(
            "Aviso",
            "Documento de login sem playerId/pin. Contate o suporte."
          );
          await signOut(auth);
          setLoading(false);
          return;
        }

        // Passou => salva local e vai p/ home
        await AsyncStorage.setItem("@userId", data.playerId);
        await AsyncStorage.setItem("@userPin", data.pin);

        Alert.alert(
          "Bem-vindo",
          `Bem-vindo, ${data.name || "Mestre Pokémon"}!`
        );

        router.push("/(tabs)/home");
        setLoading(false);
      } else {
        console.log("onAuthStateChanged -> sem user logado");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Observa password p/ medir força
  useEffect(() => {
    if (mode === "signup") {
      const str = checkPasswordStrength(password);
      setPasswordStrength(str);
    }
  }, [mode, password]);

  /** Cria conta => createUserWithEmailAndPassword => doc login/{uid} */
  async function handleSignUp() {
    if (!email || !password || !playerId || !pin) {
      Alert.alert("Erro", "Preencha todos os campos (email, senha, ID, PIN).");
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert("Erro", "E-mail inválido.");
      return;
    }
    if (!validatePassword(password)) {
      Alert.alert(
        "Senha Fraca",
        "A senha deve ter 1 maiúscula, 1 minúscula, 1 número, 1 especial e >=8 caracteres."
      );
      return;
    }
    try {
      setLoading(true);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      console.log("Conta criada, UID=", cred.user.uid);

      // Cria doc "login/{uid}" com playerId/pin
      const docRef = doc(db, "login", cred.user.uid);
      await setDoc(docRef, {
        email,
        playerId,
        pin,
        createdAt: new Date().toISOString(),
      });

      Alert.alert("Sucesso", `Conta criada. ID=${playerId}, PIN=${pin}`);
      // onAuthStateChanged() redireciona
    } catch (err: any) {
      console.log("Erro createUserWithEmailAndPassword:", err);
      Alert.alert("Erro", err.message || "Não foi possível criar conta.");
    } finally {
      setLoading(false);
    }
  }

  /** Entra => signInWithEmailAndPassword => checa doc login/{uid} */
  /** Entra => signInWithEmailAndPassword => checa doc login/{uid} */
  async function handleSignIn() {
    if (!email || !password) {
      Alert.alert("Erro", "Informe e-mail e senha.");
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      console.log("Login efetuado. user=", cred.user.uid);

      // A verificação do doc login/{uid} é feita no onAuthStateChanged
    } catch (err: any) {
      console.log("Erro no signInWithEmailAndPassword:", err);

      // Trata erros específicos do Firebase
      let errorMessage = "Erro ao tentar entrar. Usuario ou senha incorretos.";
      if (err.code === "auth/user-not-found") {
        errorMessage = "Usuário não encontrado. Verifique o e-mail.";
      } else if (err.code === "auth/wrong-password") {
        errorMessage = "Senha incorreta. Tente novamente.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "E-mail inválido. Verifique e tente novamente.";
      }

      Alert.alert("Erro", errorMessage);
    } finally {
      setLoading(false);
    }
  }

  /** Redefinir senha => via e-mail (Firebase Auth) */
  async function handleResetPassword() {
    if (!email) {
      Alert.alert("Atenção", "Informe seu e-mail primeiro.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert(
        "E-mail enviado",
        "Verifique sua caixa de entrada para redefinir a senha."
      );
    } catch (err: any) {
      console.log("Erro ao resetar senha:", err);
      Alert.alert("Erro", err.message || "Não foi possível enviar e-mail.");
    }
  }

  // Se está carregando
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

          {/* Link de Esqueceu a Senha */}
          {mode === "login" && (
            <TouchableOpacity
              style={{ marginTop: 10, alignSelf: "flex-end" }}
              onPress={handleResetPassword}
            >
              <Text style={styles.forgotText}>Esqueceu a Senha?</Text>
            </TouchableOpacity>
          )}

          {/* Indicador de força (apenas em signup) */}
          {mode === "signup" && (
            <Text
              style={[
                styles.passwordHint,
                { color: getPasswordStrengthColor(passwordStrength) }, // Define a cor dinamicamente
              ]}
            >
              Força da senha: {passwordStrength}
            </Text>
          )}

          {/* ID & PIN só no modo signup */}
          {mode === "signup" && (
            <>
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

          {/* Switch: ficar conectado */}
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Continuar Conectado</Text>
            <Switch
              value={stayLogged}
              onValueChange={setStayLogged}
              trackColor={{ false: SWITCH_TRACK, true: PRIMARY }}
              thumbColor={stayLogged ? SWITCH_THUMB : "#ccc"}
            />
          </View>

          {/* Botão principal: Entrar ou Cadastrar */}
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

          {/* Link para trocar modo (Entrar <-> Criar Conta) */}
          {mode === "signup" ? (
            <TouchableOpacity
              style={{ marginTop: 20 }}
              onPress={() => setMode("login")}
            >
              <Text style={{ color: SECONDARY }}>
                Já tem conta? <Text style={styles.underline}>Entrar</Text>
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

/** ------------------- STYLES ------------------- */
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
  buttonText: {
    color: SECONDARY,
    fontSize: 16,
    fontWeight: "bold",
  },
  underline: {
    color: ACCENT,
    textDecorationLine: "underline",
  },
  // Novas propriedades adicionadas:
  passwordHint: {
    fontSize: 14,
    marginTop: 8,
    alignSelf: "center", // Centralizado
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
  forgotText: {
    color: ACCENT,
    fontSize: 14,
    textDecorationLine: "underline",
    alignSelf: "center", // Centraliza o texto horizontalmente
    marginTop: 10, // Adiciona espaço acima (opcional)
  },
});
