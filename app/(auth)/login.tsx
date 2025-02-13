import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Modal,
  ImageBackground,
  Image,
  FlatList,
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
import { doc, setDoc, getDoc, collection, getDocs } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";

import { auth, db } from "../../lib/firebaseConfig";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n";
import { BAN_PLAYER_IDS } from "../hosts";
import { AppState } from "react-native";

const { width, height } = Dimensions.get("window");
const BACKGROUND = "#1E1E1E";
const PRIMARY = "#E3350D";
const SECONDARY = "#FFFFFF";
const INPUT_BG = "#292929";
const INPUT_BORDER = "#4D4D4D";
const ACCENT = "#FF6F61";

/** Função que checa a “força” da senha */
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

/** Escolhe cor conforme a força */
function getPasswordStrengthColor(strength: string) {
  if (strength === "Fraca") return "#E3350D";
  if (strength === "Média") return "#FFC107";
  if (strength === "Forte") return "#4CAF50";
  if (strength === "Muito Forte") return "#009688";
  return SECONDARY;
}

/** Valida email */
function validateEmail(mail: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(mail);
}

/** Valida senha */
function validatePassword(pw: string): boolean {
  const upper = /[A-Z]/.test(pw);
  const lower = /[a-z]/.test(pw);
  const digit = /\d/.test(pw);
  const special = /[^A-Za-z0-9]/.test(pw);
  return upper && lower && digit && special && pw.length >= 8;
}

/** Salva login e senha no SecureStore, para login rápido */
async function saveLoginData(email: string, password: string) {
  await SecureStore.setItemAsync("savedEmail", email);
  await SecureStore.setItemAsync("savedPassword", password);
}

/** Verifica se tem login salvo no SecureStore */
async function getSavedLogin() {
  const savedEmail = await SecureStore.getItemAsync("savedEmail");
  const savedPassword = await SecureStore.getItemAsync("savedPassword");
  return { savedEmail, savedPassword };
}

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  // Modo do formulário: login ou signup
  const [mode, setMode] = useState<"login" | "signup">("login");

  // Campos
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [playerName, setPlayerName] = useState("");

  // Switch e toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState("Fraca");

  // Modal de ban, loading e etc
  const [banModalVisible, setBanModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // Modal de idioma
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const languages = [
    { code: "pt", label: "Português" },
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
  ];

  // Animação do logo
  const logoScale = useRef(new Animated.Value(1)).current;

  // Campos do SecureStore (para “login salvo”)
  const [savedEmail, setSavedEmail] = useState("");
  const [savedPassword, setSavedPassword] = useState("");
  const [hasSavedLogin, setHasSavedLogin] = useState(false);

  /** Verifica se o usuário está banido em alguma liga */
async function isUserBanned(userId: string): Promise<boolean> {
  try {
    const leaguesSnap = await getDocs(collection(db, "leagues"));

    for (const leagueDoc of leaguesSnap.docs) {
      const banSnap = await getDocs(collection(db, `leagues/${leagueDoc.id}/roles/ban/members`));
      if (banSnap.docs.some((doc) => doc.id === userId)) {
        console.log(`🚫 Usuário ${userId} está banido na liga ${leagueDoc.id}`);
        return true; // Encontrou o banido, retorna true
      }
    }
  } catch (error) {
    console.error("Erro ao verificar bans:", error);
  }
  return false; // Se passou por todas as ligas e não encontrou, retorna false
}

  // No seu código original, tinha “stayLogged” (mas agora iremos usar login salvo)
  // Ainda assim, mantemos para condiz com a UI (mas sem background fetch).
  const [stayLogged, setStayLogged] = useState(false);

  /** Anima o logo (pulsando) */
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

  /** Carrega login salvo do SecureStore (se houver) */
  useEffect(() => {
    (async () => {
      try {
        const { savedEmail, savedPassword } = await getSavedLogin();
        if (savedEmail && savedPassword) {
          setSavedEmail(savedEmail);
          setSavedPassword(savedPassword);
          setHasSavedLogin(true);
        }
      } catch (err) {
        console.log("Erro ao buscar login salvo:", err);
      }
    })();
  }, []);

  /** Carrega a config stayLogged do AsyncStorage (opcional) */
  useEffect(() => {
    (async () => {
      try {
        const stay = await AsyncStorage.getItem("@stayLogged");
        if (stay === "true") {
          setStayLogged(true);
        }
      } catch (error) {
        console.log("Erro ao carregar @stayLogged:", error);
      }
    })();
  }, []);

  /** Observa se usuário está logado (onAuthStateChanged) e faz verificação no Firestore */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        setLoading(true);
        try {
          const firebaseToken = await user.getIdToken(true);
          const docRef = doc(db, "login", user.uid);
          const snap = await getDoc(docRef);
  
          if (!snap.exists()) {
            Alert.alert("Conta incompleta", "Seu cadastro não está completo.");
            await signOut(auth);
            setLoading(false);
            return;
          }
  
          const data = snap.data();
          if (!data.playerId || !data.pin) {
            Alert.alert("Dados ausentes", "Seu cadastro está incompleto.");
            await signOut(auth);
            setLoading(false);
            return;
          }
  
          // Verificar bans
          const isBanned = await isUserBanned(data.playerId);
          if (isBanned) {
            setBanModalVisible(true);
            await signOut(auth);
            setLoading(false);
            return;
          }
  
          // Salva os dados localmente
          await AsyncStorage.setItem("@userId", data.playerId);
          await AsyncStorage.setItem("@userPin", data.pin);
          await AsyncStorage.setItem("@userName", data.name || "Jogador");
          await AsyncStorage.setItem("@firebaseUID", user.uid);
          await AsyncStorage.setItem("@firebaseToken", firebaseToken);
  
          // Se usuário marcou para permanecer logado
          if (stayLogged) {
            await AsyncStorage.setItem("@stayLogged", "true");
          } else {
            await AsyncStorage.removeItem("@stayLogged");
          }
  
          Alert.alert("Bem-vindo!", `Olá, ${data.name || "Jogador"}!`);
          router.push("/(tabs)/home");
        } catch (e) {
          console.log("Erro no onAuthStateChanged:", e);
          Alert.alert("Erro", "Falha ao carregar dados.");
        } finally {
          setLoading(false);
        }
      }
    });
  
    return () => unsubscribe();
  }, [stayLogged]);  

  /** A cada 55 minutos, renova token do Firebase em foreground. */
  useEffect(() => {
    const interval = setInterval(async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const newToken = await currentUser.getIdToken(true);
          await AsyncStorage.setItem("@firebaseToken", newToken);
          console.log("Token renovado (foreground).");
        } catch (err) {
          console.log("Erro ao renovar token em foreground:", err);
        }
      }
    }, 55 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

/** Renova token ao voltar do background */
useEffect(() => {
    const renewToken = async () => {
        const currentUser = auth.currentUser;
        if (currentUser) {
            try {
                const newToken = await currentUser.getIdToken(true);
                await AsyncStorage.setItem("@firebaseToken", newToken);
                console.log("Token renovado ao voltar do background.");
            } catch (err) {
                console.log("Erro ao renovar token ao voltar do background:", err);
            }
        }
    };

    // Configura o evento ao voltar do background
    const appStateListener = AppState.addEventListener("change", (nextAppState) => {
        if (nextAppState === "active") {
            renewToken();
        }
    });

    return () => appStateListener.remove();
}, []);


  /** Se estiver no modo signup, recalcula força da senha */
  useEffect(() => {
    if (mode === "signup") {
      const s = checkPasswordStrength(password);
      setPasswordStrength(s);
    }
  }, [mode, password]);

  /** Muda idioma */
  function changeLanguage(lang: string) {
    i18n.changeLanguage(lang);
    setLanguageModalVisible(false);
  }

  /** Cadastrar (SIGNUP) */
  async function handleSignUp() {
    if (!email || !password || !userId || !pin || !playerName) {
      Alert.alert(t("login.alerts.empty_fields"));
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert(t("login.alerts.invalid_email"));
      return;
    }
    if (!validatePassword(password)) {
      Alert.alert(t("login.alerts.weak_password"));
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // salva no Firestore
      const docRef = doc(db, "login", cred.user.uid);
      await setDoc(docRef, {
        email,
        playerId: userId,
        pin,
        name: playerName,
        createdAt: new Date().toISOString(),
      });

      // salva no SecureStore
      await saveLoginData(email, password);

      Alert.alert(t("login.alerts.signup_success", { playerId: userId, pin }));
    } catch (err: any) {
      Alert.alert(t("login.alerts.signup_error", { error: err.message || "" }));
    } finally {
      setLoading(false);
    }
  }

  /** Login normal */
  async function handleSignIn() {
    if (!email || !password) {
      Alert.alert(t("login.alerts.empty_fields"));
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await saveLoginData(email, password); // salva p/ login rápido
      console.log("SignIn ok:", cred.user.uid);
    } catch (err: any) {
      let msg = t("login.alerts.login_error", { error: "" });
      if (err.code === "auth/wrong-password") {
        msg = t("login.alerts.wrong_password");
      } else if (err.code === "auth/user-not-found") {
        msg = t("login.alerts.user_not_found");
      }
      Alert.alert(t("login.alerts.login_error", { error: "" }), msg);
    } finally {
      setLoading(false);
    }
  }

  /** Reset de senha */
  async function handleResetPassword() {
    if (!email) {
      Alert.alert(
        t("login.alerts.password_reset_error", { error: "" }),
        t("login.alerts.invalid_email")
      );
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert(t("login.alerts.password_reset_sent"));
    } catch (err: any) {
      Alert.alert(
        t("login.alerts.password_reset_error", { error: err.message || "" })
      );
    }
  }

  /** Tentar login automático */
  async function handleAutoLogin() {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, savedEmail, savedPassword);
      console.log("Login automático com:", savedEmail);
    } catch (err) {
      Alert.alert("Erro", "Falha ao entrar automaticamente.");
    }
    setLoading(false);
  }

  /** Limpar login salvo */
  async function clearSavedLogin() {
    await SecureStore.deleteItemAsync("savedEmail");
    await SecureStore.deleteItemAsync("savedPassword");
    setSavedEmail("");
    setSavedPassword("");
    setHasSavedLogin(false);
    Alert.alert("Login removido", "Seu login salvo foi apagado.");
  }

  // Se estiver carregando
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={{ color: SECONDARY, marginTop: 8 }}>{t("login.loading")}</Text>
      </View>
    );
  }

  return (
    <ImageBackground
      source={require("../../assets/images/background_login.jpg")}
      style={styles.background}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Animated.Image
            source={require("../../assets/images/logo.jpg")}
            style={[styles.logo, { transform: [{ scale: logoScale }] }]}
            resizeMode="contain"
          />

          <Text style={styles.title}>
            {mode === "signup" ? t("login.title_signup") : t("login.title_login")}
          </Text>

          {/* Modal de idioma */}
          <Modal
            animationType="slide"
            transparent
            visible={languageModalVisible}
            onRequestClose={() => setLanguageModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>{t("login.select_language")}</Text>
                <FlatList
                  data={languages}
                  keyExtractor={(item) => item.code}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.listItem}
                      onPress={() => changeLanguage(item.code)}
                    >
                      <Text style={styles.listText}>{item.label}</Text>
                    </TouchableOpacity>
                  )}
                />
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setLanguageModalVisible(false)}
                >
                  <Text style={styles.closeText}>{t("login.cancel")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Modal Banido */}
          <Modal
            animationType="fade"
            transparent
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
                <Text style={styles.banText}>{t("login.alerts.ban_message")}</Text>
                <TouchableOpacity
                  onPress={() => setBanModalVisible(false)}
                  style={styles.banButton}
                >
                  <Text style={styles.banButtonText}>Ok</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Campo Email */}
          <Text style={styles.label}>{t("login.email_label")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("login.email_placeholder") || ""}
            placeholderTextColor={INPUT_BORDER}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Campo Senha */}
          <Text style={styles.label}>{t("login.password_label")}</Text>
          <View style={styles.inputWithIcon}>
            <TextInput
              style={[styles.input, { flex: 1, marginRight: 8 }]}
              placeholder={t("login.password_placeholder") || ""}
              placeholderTextColor={INPUT_BORDER}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? "eye-off" : "eye"}
                size={24}
                color={SECONDARY}
              />
            </TouchableOpacity>
          </View>

          {/* Esqueci a senha (apenas no modo login) */}
          {mode === "login" && (
            <TouchableOpacity
              style={{ marginTop: 10, alignSelf: "flex-end" }}
              onPress={handleResetPassword}
            >
              <Text style={styles.forgotText}>{t("login.forgot_password")}</Text>
            </TouchableOpacity>
          )}

          {/* Se for cadastro, mostra força da senha */}
          {mode === "signup" && (
            <Text
              style={[
                styles.passwordHint,
                { color: getPasswordStrengthColor(passwordStrength) },
              ]}
            >
              {t("login.password_strength", { strength: passwordStrength })}
            </Text>
          )}

          {/* Campos extras do signup */}
          {mode === "signup" && (
            <>
              <Text style={styles.label}>{t("login.player_name_label")}</Text>
              <TextInput
                style={styles.input}
                placeholder={t("login.player_name_placeholder") || ""}
                placeholderTextColor={INPUT_BORDER}
                value={playerName}
                onChangeText={setPlayerName}
              />

              <Text style={styles.label}>{t("login.player_id_label")}</Text>
              <TextInput
                style={styles.input}
                placeholder={t("login.player_id_placeholder") || ""}
                placeholderTextColor={INPUT_BORDER}
                value={userId}
                onChangeText={setUserId}
                keyboardType="numeric"
              />

              <Text style={styles.label}>{t("login.pin_label")}</Text>
              <View style={styles.inputWithIcon}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 8 }]}
                  placeholder={t("login.pin_placeholder") || ""}
                  placeholderTextColor={INPUT_BORDER}
                  secureTextEntry={!showPin}
                  value={pin}
                  onChangeText={setPin}
                  keyboardType="numeric"
                />
                <TouchableOpacity onPress={() => setShowPin(!showPin)}>
                  <Ionicons
                    name={showPin ? "eye-off" : "eye"}
                    size={24}
                    color={SECONDARY}
                  />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Botão principal: SIGNUP ou LOGIN */}
          {mode === "signup" ? (
            <TouchableOpacity style={styles.signupButton} onPress={handleSignUp}>
              <Text style={styles.buttonText}>{t("login.signup_button")}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.loginButton} onPress={handleSignIn}>
              <Text style={styles.buttonText}>{t("login.login_button")}</Text>
            </TouchableOpacity>
          )}

          {/* Trocar modo */}
          {mode === "signup" ? (
            <TouchableOpacity
              style={{ marginTop: 20 }}
              onPress={() => setMode("login")}
            >
              <Text style={{ color: SECONDARY }}>{t("login.link_to_login")}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={{ marginTop: 20 }}
              onPress={() => setMode("signup")}
            >
              <Text style={{ color: SECONDARY }}>{t("login.link_to_signup")}</Text>
            </TouchableOpacity>
          )}

          {/* Se tivermos login salvo, botão de autoLogin */}
          {hasSavedLogin && (
            <View style={{ marginTop: 24 }}>
              <Text style={{ color: SECONDARY, marginBottom: 8 }}>
                Você tem um login salvo:
              </Text>
              <TouchableOpacity style={styles.autoLoginButton} onPress={handleAutoLogin}>
                <Ionicons name="log-in" size={16} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.autoLoginText}>Entrar como {savedEmail}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.forgetSavedButton}
                onPress={clearSavedLogin}
              >
                <Ionicons name="trash-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={{ color: "#FFF", fontWeight: "bold" }}>Esquecer esse login</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Botão mudar idioma */}
          <TouchableOpacity
            style={styles.languageButton}
            onPress={() => setLanguageModalVisible(true)}
          >
            <Text style={styles.languageButtonText}>Mudar idioma</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

// ==================== ESTILOS ====================
const styles = StyleSheet.create({
  background: {
    flex: 1,
    width,
    height,
    resizeMode: "cover",
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
    width: width * 0.45,
    height: height * 0.2,
    marginTop: 30,
    marginBottom: 24,
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
  signupButton: {
    backgroundColor: ACCENT,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
    marginTop: 18,
  },
  loginButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
    marginTop: 18,
  },
  buttonText: {
    color: SECONDARY,
    fontSize: 16,
    fontWeight: "bold",
  },
  autoLoginButton: {
    flexDirection: "row",
    backgroundColor: "#4A4A4A",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  autoLoginText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  forgetSavedButton: {
    flexDirection: "row",
    backgroundColor: "#999",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  languageButton: {
    alignSelf: "flex-end",
    marginTop: 14,
    backgroundColor: "#000",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  languageButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "80%",
    backgroundColor: "#292929",
    borderRadius: 8,
    padding: 20,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
  },
  listItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#1E1E1E",
    borderRadius: 8,
    marginBottom: 10,
  },
  listText: {
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "center",
  },
  closeButton: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#E3350D",
  },
  closeText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
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
