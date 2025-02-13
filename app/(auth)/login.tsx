//////////////////////////////////////
// ARQUIVO: LoginScreen.tsx (reformulado)
//////////////////////////////////////
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
  Pressable,
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
import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";

import { auth, db } from "../../lib/firebaseConfig";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n";
import { BAN_PLAYER_IDS } from "../hosts";
import { AppState } from "react-native";

// >>> ADICIONEI: react-native-animatable <<<
import * as Animatable from "react-native-animatable";

//////////////////////////////////////
// CONSTANTES DE CORES
//////////////////////////////////////
const { width, height } = Dimensions.get("window");

const COLORS = {
  BACKGROUND: "#1E1E1E",
  PRIMARY: "#E3350D",
  SECONDARY: "#FFFFFF",
  ACCENT: "#FF6F61",
  INPUT_BG: "#292929",
  INPUT_BORDER: "#4D4D4D",
};

// >>> Lógica de verificação de senha e etc. (inalterada) <<<

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
  if (strength === "Fraca") return COLORS.PRIMARY;
  if (strength === "Média") return "#FFC107";
  if (strength === "Forte") return "#4CAF50";
  if (strength === "Muito Forte") return "#009688";
  return COLORS.SECONDARY;
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

async function saveLoginData(email: string, password: string) {
  await SecureStore.setItemAsync("savedEmail", email);
  await SecureStore.setItemAsync("savedPassword", password);
}

async function getSavedLogin() {
  const savedEmail = await SecureStore.getItemAsync("savedEmail");
  const savedPassword = await SecureStore.getItemAsync("savedPassword");
  return { savedEmail, savedPassword };
}

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  // >>> ESTADOS E LÓGICA (INALTERADOS) <<<
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [playerName, setPlayerName] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState("Fraca");

  const [banModalVisible, setBanModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const languages = [
    { code: "pt", label: "Português" },
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
  ];

  const logoScale = useRef(new Animated.Value(1)).current;

  const [savedEmail, setSavedEmail] = useState("");
  const [savedPassword, setSavedPassword] = useState("");
  const [hasSavedLogin, setHasSavedLogin] = useState(false);

  // >>> MANTENDO A LÓGICA DA FUNÇÃO isUserBanned <<<
  async function isUserBanned(userId: string): Promise<boolean> {
    try {
      const leaguesSnap = await getDocs(collection(db, "leagues"));
      for (const leagueDoc of leaguesSnap.docs) {
        const banSnap = await getDocs(
          collection(db, `leagues/${leagueDoc.id}/roles/ban/members`)
        );
        if (banSnap.docs.some((doc) => doc.id === userId)) {
          console.log(`🚫 Usuário ${userId} está banido na liga ${leagueDoc.id}`);
          return true;
        }
      }
    } catch (error) {
      console.error("Erro ao verificar bans:", error);
    }
    return false;
  }

  const [stayLogged, setStayLogged] = useState(false);

  // >>> ANIMAÇÃO DO LOGO <<<
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.08,
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

          const isBanned = await isUserBanned(data.playerId);
          if (isBanned) {
            setBanModalVisible(true);
            await signOut(auth);
            setLoading(false);
            return;
          }

          await AsyncStorage.setItem("@userId", data.playerId);
          await AsyncStorage.setItem("@userPin", data.pin);
          await AsyncStorage.setItem("@userName", data.name || "Jogador");
          await AsyncStorage.setItem("@firebaseUID", user.uid);
          await AsyncStorage.setItem("@firebaseToken", firebaseToken);

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

    const appStateListener = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        renewToken();
      }
    });

    return () => appStateListener.remove();
  }, []);

  useEffect(() => {
    if (mode === "signup") {
      const s = checkPasswordStrength(password);
      setPasswordStrength(s);
    }
  }, [mode, password]);

  function changeLanguage(lang: string) {
    i18n.changeLanguage(lang);
    setLanguageModalVisible(false);
  }

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

      const docRef = doc(db, "login", cred.user.uid);
      await setDoc(docRef, {
        email,
        playerId: userId,
        pin,
        name: playerName,
        createdAt: new Date().toISOString(),
      });

      await saveLoginData(email, password);

      Alert.alert(t("login.alerts.signup_success", { playerId: userId, pin }));
    } catch (err: any) {
      Alert.alert(t("login.alerts.signup_error", { error: err.message || "" }));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn() {
    if (!email || !password) {
      Alert.alert(t("login.alerts.empty_fields"));
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await saveLoginData(email, password);
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

  async function clearSavedLogin() {
    await SecureStore.deleteItemAsync("savedEmail");
    await SecureStore.deleteItemAsync("savedPassword");
    setSavedEmail("");
    setSavedPassword("");
    setHasSavedLogin(false);
    Alert.alert("Login removido", "Seu login salvo foi apagado.");
  }

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={{ color: COLORS.SECONDARY, marginTop: 8 }}>
          {t("login.loading")}
        </Text>
      </View>
    );
  }

  return (
    <ImageBackground
      source={require("../../assets/images/background_login.jpg")}
      style={s.background}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.scrollContent}>
          {/* ANIMAÇÃO DO LOGO */}
          <Animatable.View
            animation="fadeInDown"
            duration={800}
            style={s.logoContainer}
          >
            <Animated.Image
              source={require("../../assets/images/logo.jpg")}
              style={[s.logo, { transform: [{ scale: logoScale }] }]}
              resizeMode="contain"
            />
          </Animatable.View>

          <Animatable.Text animation="fadeInUp" duration={800} style={s.title}>
            {mode === "signup"
              ? t("login.title_signup")
              : t("login.title_login")}
          </Animatable.Text>

          {/* MODAL DE IDIOMA */}
          <Modal
            animationType="slide"
            transparent
            visible={languageModalVisible}
            onRequestClose={() => setLanguageModalVisible(false)}
          >
            <View style={s.modalOverlay}>
              <View style={s.modalContainer}>
                <Text style={s.modalTitle}>{t("login.select_language")}</Text>
                <FlatList
                  data={languages}
                  keyExtractor={(item) => item.code}
                  renderItem={({ item }) => (
                    <Pressable
                      style={s.listItem}
                      android_ripple={{ color: "#777" }}
                      onPress={() => changeLanguage(item.code)}
                    >
                      <Text style={s.listText}>{item.label}</Text>
                    </Pressable>
                  )}
                />
                <TouchableOpacity
                  style={s.closeButton}
                  onPress={() => setLanguageModalVisible(false)}
                >
                  <Text style={s.closeText}>{t("login.cancel")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* MODAL BANIDO */}
          <Modal
            animationType="fade"
            transparent
            visible={banModalVisible}
            onRequestClose={() => setBanModalVisible(false)}
          >
            <View style={s.banOverlay}>
              <Animatable.View
                animation="zoomIn"
                duration={400}
                style={s.banContainer}
              >
                <Image
                  source={require("../../assets/images/pikachu_happy.png")}
                  style={s.banImage}
                />
                <Text style={s.banTitle}>Banido!</Text>
                <Text style={s.banText}>{t("login.alerts.ban_message")}</Text>
                <TouchableOpacity
                  onPress={() => setBanModalVisible(false)}
                  style={s.banButton}
                >
                  <Text style={s.banButtonText}>Ok</Text>
                </TouchableOpacity>
              </Animatable.View>
            </View>
          </Modal>

          {/* FORMULÁRIO DE EMAIL */}
          <Animatable.View animation="fadeInUp" style={{ width: "100%" }}>
            <Text style={s.label}>{t("login.email_label")}</Text>
            <View style={s.inputContainer}>
              <Ionicons name="mail" size={20} color="#999" style={{ marginLeft: 10, marginRight: 6 }}/>
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder={t("login.email_placeholder") || ""}
                placeholderTextColor={COLORS.INPUT_BORDER}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* FORMULÁRIO DE SENHA */}
            <Text style={s.label}>{t("login.password_label")}</Text>
            <View style={s.inputContainer}>
              <Ionicons name="lock-closed" size={20} color="#999" style={{ marginLeft: 10, marginRight: 6 }}/>
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder={t("login.password_placeholder") || ""}
                placeholderTextColor={COLORS.INPUT_BORDER}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={{ marginRight: 10 }}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={COLORS.SECONDARY}
                />
              </TouchableOpacity>
            </View>

            {/* Botão "Esqueci a senha" apenas no modo Login */}
            {mode === "login" && (
              <TouchableOpacity
                style={s.forgotButton}
                onPress={handleResetPassword}
              >
                <Text style={s.forgotText}>{t("login.forgot_password")}</Text>
              </TouchableOpacity>
          )}

            {/* Força da senha se for SIGNUP */}
            {mode === "signup" && (
              <Text
                style={[
                  s.passwordHint,
                  { color: getPasswordStrengthColor(passwordStrength) },
                ]}
              >
                {t("login.password_strength", { strength: passwordStrength })}
              </Text>
            )}

            {/* CAMPOS EXTRAS SE FOR SIGNUP */}
            {mode === "signup" && (
              <>
                <Text style={s.label}>{t("login.player_name_label")}</Text>
                <View style={s.inputContainer}>
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color="#999"
                    style={{ marginLeft: 10, marginRight: 6 }}
                  />
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    placeholder={t("login.player_name_placeholder") || ""}
                    placeholderTextColor={COLORS.INPUT_BORDER}
                    value={playerName}
                    onChangeText={setPlayerName}
                  />
                </View>

                <Text style={s.label}>{t("login.player_id_label")}</Text>
                <View style={s.inputContainer}>
                  <Ionicons
                    name="finger-print"
                    size={20}
                    color="#999"
                    style={{ marginLeft: 10, marginRight: 6 }}
                  />
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    placeholder={t("login.player_id_placeholder") || ""}
                    placeholderTextColor={COLORS.INPUT_BORDER}
                    value={userId}
                    onChangeText={setUserId}
                    keyboardType="numeric"
                  />
                </View>

                <Text style={s.label}>{t("login.pin_label")}</Text>
                <View style={s.inputContainer}>
                  <Ionicons
                    name="key-outline"
                    size={20}
                    color="#999"
                    style={{ marginLeft: 10, marginRight: 6 }}
                  />
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    placeholder={t("login.pin_placeholder") || ""}
                    placeholderTextColor={COLORS.INPUT_BORDER}
                    secureTextEntry={!showPin}
                    value={pin}
                    onChangeText={setPin}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    style={{ marginRight: 10 }}
                    onPress={() => setShowPin(!showPin)}
                  >
                    <Ionicons
                      name={showPin ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={COLORS.SECONDARY}
                    />
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* BOTÃO PRINCIPAL: SIGNUP ou LOGIN */}
            <Animatable.View
              animation="bounceIn"
              delay={300}
              style={{
                marginTop: 20,
                alignItems: "center",
              }}
            >
              {mode === "signup" ? (
                <TouchableOpacity style={s.signupButton} onPress={handleSignUp}>
                  <Ionicons name="person-add-outline" size={18} color="#FFF" style={{ marginRight: 6 }}/>
                  <Text style={s.buttonText}>{t("login.signup_button")}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.loginButton} onPress={handleSignIn}>
                  <Ionicons name="log-in-outline" size={18} color="#FFF" style={{ marginRight: 6 }}/>
                  <Text style={s.buttonText}>{t("login.login_button")}</Text>
                </TouchableOpacity>
              )}
            </Animatable.View>

            {/* LINK PARA TROCAR DE MODO */}
            <TouchableOpacity
              style={{ marginTop: 20, alignSelf: "center" }}
              onPress={() => setMode(mode === "signup" ? "login" : "signup")}
            >
              <Text style={{ color: COLORS.SECONDARY }}>
                {mode === "signup"
                  ? t("login.link_to_login")
                  : t("login.link_to_signup")}
              </Text>
            </TouchableOpacity>

            {/* LOGIN SALVO -> BOTÃO AUTOLOGIN */}
            {hasSavedLogin && (
              <View style={{ marginTop: 24 }}>
                <Text style={{ color: COLORS.SECONDARY, marginBottom: 8 }}>
                  Você tem um login salvo:
                </Text>
                <TouchableOpacity
                  style={s.autoLoginButton}
                  onPress={handleAutoLogin}
                >
                  <Ionicons
                    name="play-circle-outline"
                    size={16}
                    color="#FFF"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={s.autoLoginText}>
                    Entrar como {savedEmail}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.forgetSavedButton}
                  onPress={clearSavedLogin}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color="#FFF"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={{ color: "#FFF", fontWeight: "bold" }}>
                    Esquecer esse login
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* BOTÃO MUDAR IDIOMA */}
            <View style={{ marginTop: 20, alignItems: "flex-end" }}>
              <TouchableOpacity
                style={s.languageButton}
                onPress={() => setLanguageModalVisible(true)}
              >
                <Ionicons name="language-outline" size={16} color="#FFF" style={{ marginRight: 8 }}/>
                <Text style={s.languageButtonText}>Mudar idioma</Text>
              </TouchableOpacity>
            </View>
          </Animatable.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

//////////////////////////////////////
// ESTILOS
//////////////////////////////////////
const s = StyleSheet.create({
  background: {
    flex: 1,
    width,
    height,
    resizeMode: "cover",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 20,
    alignItems: "center",
    flexGrow: 1,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 10,
  },
  logo: {
    width: width * 0.45,
    height: height * 0.2,
    marginTop: 30,
    marginBottom: 10,
  },
  title: {
    color: COLORS.PRIMARY,
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
    textTransform: "uppercase",
  },
  label: {
    color: COLORS.SECONDARY,
    fontSize: 15,
    marginTop: 14,
    marginLeft: 6,
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.INPUT_BG,
    borderColor: COLORS.INPUT_BORDER,
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 6,
  },
  input: {
    color: COLORS.SECONDARY,
    fontSize: 15,
    paddingVertical: 10,
  },
  forgotButton: {
    marginTop: 8,
    alignSelf: "flex-end",
  },
  forgotText: {
    color: COLORS.ACCENT,
    fontSize: 13,
    textDecorationLine: "underline",
  },
  passwordHint: {
    fontSize: 13,
    marginTop: 8,
    alignSelf: "center",
    fontWeight: "bold",
  },
  signupButton: {
    backgroundColor: COLORS.ACCENT,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 30,
  },
  loginButton: {
    backgroundColor: COLORS.PRIMARY,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 30,
  },
  buttonText: {
    color: COLORS.SECONDARY,
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
    backgroundColor: "#444",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
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
    backgroundColor: COLORS.INPUT_BG,
    borderRadius: 8,
    padding: 20,
  },
  modalTitle: {
    color: COLORS.SECONDARY,
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
    color: COLORS.SECONDARY,
    fontSize: 16,
    textAlign: "center",
  },
  closeButton: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: COLORS.PRIMARY,
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
    backgroundColor: COLORS.PRIMARY,
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
