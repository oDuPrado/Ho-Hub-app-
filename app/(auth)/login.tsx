import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Switch,
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
import { doc, setDoc, getDoc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import BackgroundFetch from "react-native-background-fetch";

import { auth, db } from "../../lib/firebaseConfig";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n";
import { BAN_PLAYER_IDS } from "../hosts";

const { width, height } = Dimensions.get("window");
const BACKGROUND = "#1E1E1E";
const PRIMARY = "#E3350D";
const SECONDARY = "#FFFFFF";
const INPUT_BG = "#292929";
const INPUT_BORDER = "#4D4D4D";
const ACCENT = "#FF6F61";

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

function getPasswordStrengthColor(strength: string) {
  if (strength === "Fraca") return "#E3350D";
  if (strength === "Média") return "#FFC107";
  if (strength === "Forte") return "#4CAF50";
  if (strength === "Muito Forte") return "#009688";
  return SECONDARY;
}

function validateEmail(mail: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(mail);
}

function validatePassword(pw: string): boolean {
  const upper = /[A-Z]/.test(pw);
  const lower = /[a-z]/.test(pw);
  const digit = /\d/.test(pw);
  const special = /[^A-Za-z0-9]/.test(pw);
  return upper && lower && digit && special && pw.length >= 8;
}

// Renova token em background no Android
async function backgroundRefreshToken() {
  console.log("====> [BackgroundFetch] Iniciando backgroundRefreshToken...");
  const savedEmail = await SecureStore.getItemAsync("email");
  const savedPassword = await SecureStore.getItemAsync("password");
  if (savedEmail && savedPassword) {
    try {
      console.log("====> [BackgroundFetch] Fazendo signIn silencioso...");
      await signInWithEmailAndPassword(auth, savedEmail, savedPassword);
      console.log("====> [BackgroundFetch] Token renovado com sucesso!");
    } catch (err) {
      console.log("====> [BackgroundFetch] Erro ao renovar token:", err);
    }
  } else {
    console.log("====> [BackgroundFetch] Nenhum email/senha salvos. Pulando.");
  }
}

function configureBackgroundFetch() {
  console.log("====> [LoginScreen] Configurando BackgroundFetch...");
  BackgroundFetch.configure(
    {
      minimumFetchInterval: 15,
      stopOnTerminate: false,
      enableHeadless: true,
      startOnBoot: true,
    },
    async () => {
      console.log("====> [BackgroundFetch] Evento de background disparado!");
      await backgroundRefreshToken();
      BackgroundFetch.finish();
    },
    (error) => {
      console.log("====> [BackgroundFetch] Erro ao configurar:", error);
    }
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [stayLogged, setStayLogged] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState("Fraca");
  const [loading, setLoading] = useState(false);
  const [banModalVisible, setBanModalVisible] = useState(false);

  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const languages = [
    { code: "pt", label: "Português" },
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
  ];

  const logoScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    console.log("====> [LoginScreen] Montando componente...");
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

  useEffect(() => {
    console.log("====> [LoginScreen] Chamando configureBackgroundFetch()");
    configureBackgroundFetch();
  }, []);

  useEffect(() => {
    (async () => {
      console.log("====> [LoginScreen] Carregando @stayLogged do AsyncStorage...");
      try {
        const stay = await AsyncStorage.getItem("@stayLogged");
        if (stay === "true") {
          setStayLogged(true);
        }
      } catch (error) {
        console.log("====> [LoginScreen] Erro ao carregar @stayLogged:", error);
      }
    })();
  }, []);

  useEffect(() => {
    console.log("====> [LoginScreen] Iniciando onAuthStateChanged watcher...");
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        console.log("====> [LoginScreen] onAuthStateChanged detectou user:", user.uid);
        setLoading(true);
        try {
          const firebaseToken = await user.getIdToken(true);
          const docRef = doc(db, "login", user.uid);
          const snap = await getDoc(docRef);

          if (!snap.exists()) {
            console.log("====> [LoginScreen] Documento de login não existe no Firestore.");
            Alert.alert(
              t("login.alerts.incomplete_account"),
              t("login.alerts.incomplete_account")
            );
            await signOut(auth);
            setLoading(false);
            return;
          }

          const data = snap.data();
          console.log("====> [LoginScreen] Dados do Firestore:", data);

          if (!data.playerId || !data.pin) {
            console.log("====> [LoginScreen] playerId/pin faltando no documento");
            Alert.alert(
              t("login.alerts.missing_data"),
              t("login.alerts.missing_data")
            );
            await signOut(auth);
            setLoading(false);
            return;
          }

          if (BAN_PLAYER_IDS.includes(data.playerId)) {
            console.log("====> [LoginScreen] ID banido:", data.playerId);
            setBanModalVisible(true);
            await signOut(auth);
            setLoading(false);
            return;
          }

          const docName = data.name || "Jogador";
          await AsyncStorage.setItem("@userId", data.playerId);
          await AsyncStorage.setItem("@userPin", data.pin);
          await AsyncStorage.setItem("@userName", docName);
          await AsyncStorage.setItem("@firebaseUID", user.uid);
          await AsyncStorage.setItem("@firebaseToken", firebaseToken);

          if (stayLogged) {
            console.log("====> [LoginScreen] Salvando @stayLogged = true");
            await AsyncStorage.setItem("@stayLogged", "true");
          } else {
            console.log("====> [LoginScreen] Removendo @stayLogged");
            await AsyncStorage.removeItem("@stayLogged");
          }

          Alert.alert(
            t("login.alerts.welcome"),
            t("login.alerts.welcome") + ", " + docName
          );

          console.log("====> [LoginScreen] Navegando para /home");
          router.push("/(tabs)/home");
        } catch (e) {
          console.log("====> [LoginScreen] Erro no onAuthStateChanged:", e);
          Alert.alert(t("login.alerts.error"), t("login.alerts.error"));
        } finally {
          setLoading(false);
        }
      } else {
        console.log("====> [LoginScreen] onAuthStateChanged: sem usuário logado.");
      }
    });
    return () => unsubscribe();
  }, [router, t, stayLogged]);

  useEffect(() => {
    console.log("====> [LoginScreen] Iniciando interval p/ renovar token a cada 55min");
    const interval = setInterval(async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          console.log("====> [LoginScreen] Renovando token em foreground...");
          const newToken = await currentUser.getIdToken(true);
          await AsyncStorage.setItem("@firebaseToken", newToken);
          console.log("====> [LoginScreen] Token renovado com sucesso (foreground).");
        } catch (err) {
          console.log("====> [LoginScreen] Erro ao renovar token em foreground:", err);
        }
      }
    }, 55 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (mode === "signup") {
      const s = checkPasswordStrength(password);
      setPasswordStrength(s);
    }
  }, [mode, password]);

  function changeLanguage(lang: string) {
    console.log("====> [LoginScreen] Mudando idioma para:", lang);
    i18n.changeLanguage(lang);
    setLanguageModalVisible(false);
  }

  async function handleSignUp() {
    console.log("====> [LoginScreen] handleSignUp disparado...");
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
      console.log("====> [LoginScreen] Criando usuário Firebase...");
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      console.log("====> [LoginScreen] Salvando doc login no Firestore...");
      const docRef = doc(db, "login", cred.user.uid);
      await setDoc(docRef, {
        email,
        playerId: userId,
        pin,
        name: playerName,
        createdAt: new Date().toISOString(),
      });

      console.log("====> [LoginScreen] Salvando email/senha no SecureStore...");
      await SecureStore.setItemAsync("email", email);
      await SecureStore.setItemAsync("password", password);

      Alert.alert(t("login.alerts.signup_success", { playerId: userId, pin }));
      console.log("====> [LoginScreen] handleSignUp concluído com sucesso!");
    } catch (err: any) {
      console.log("====> [LoginScreen] Erro no SignUp:", err);
      Alert.alert(t("login.alerts.signup_error", { error: err.message || "" }));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn() {
    console.log("====> [LoginScreen] handleSignIn disparado...");
    if (!email || !password) {
      Alert.alert(t("login.alerts.empty_fields"));
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      console.log("====> [LoginScreen] SignIn realizado com sucesso:", cred.user.uid);

      console.log("====> [LoginScreen] Salvando email/senha no SecureStore...");
      await SecureStore.setItemAsync("email", email);
      await SecureStore.setItemAsync("password", password);

      console.log("====> [LoginScreen] handleSignIn concluído com sucesso!");
    } catch (err: any) {
      console.log("====> [LoginScreen] Erro no SignIn:", err);
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

  async function handleResetPassword() {
    console.log("====> [LoginScreen] handleResetPassword disparado...");
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
      console.log("====> [LoginScreen] Envio de reset de senha concluído!");
    } catch (err: any) {
      console.log("====> [LoginScreen] Erro ao resetar senha:", err);
      Alert.alert(
        t("login.alerts.password_reset_error", { error: err.message || "" })
      );
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={{ color: SECONDARY, marginTop: 8 }}>
          {t("login.loading")}
        </Text>
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

          <Modal
            animationType="slide"
            transparent={true}
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

          {mode === "login" && (
            <TouchableOpacity
              style={{ marginTop: 10, alignSelf: "flex-end" }}
              onPress={handleResetPassword}
            >
              <Text style={styles.forgotText}>{t("login.forgot_password")}</Text>
            </TouchableOpacity>
          )}

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

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{t("login.stay_logged")} </Text>
            <Switch
              value={stayLogged}
              onValueChange={setStayLogged}
              trackColor={{ false: "#555", true: PRIMARY }}
              thumbColor={stayLogged ? "#FFF" : "#ccc"}
            />
          </View>

          {mode === "signup" ? (
            <TouchableOpacity style={styles.signupButton} onPress={handleSignUp}>
              <Text style={styles.buttonText}>{t("login.signup_button")}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.loginButton} onPress={handleSignIn}>
              <Text style={styles.buttonText}>{t("login.login_button")}</Text>
            </TouchableOpacity>
          )}

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

          <TouchableOpacity
            style={styles.languageButton}
            onPress={() => {
              console.log("====> [LoginScreen] Abrindo modal de idioma...");
              setLanguageModalVisible(true);
            }}
          >
            <Text style={styles.languageButtonText}>Mudar idioma</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

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
  eyeIcon: {
    padding: 6,
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
  signupButton: {
    backgroundColor: ACCENT,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
    marginTop: 5,
  },
  loginButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
    marginTop: 5,
  },
  buttonText: {
    color: SECONDARY,
    fontSize: 16,
    fontWeight: "bold",
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
