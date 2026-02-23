//////////////////////////////////////
// ARQUIVO: LoginScreen.tsx
//////////////////////////////////////
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
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
  FlatList,
  Pressable,
  AppState,
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
import * as Animatable from "react-native-animatable";
import { useTranslation } from "react-i18next";

import { auth, db } from "../../lib/firebaseConfig";
import i18n from "../../i18n";

// >>> IMPORTAÇÃO DO MODAL <<<
import CustomModal from "../../components/CustomModal";

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

//////////////////////////////////////
// FUNÇÕES DE VALIDAÇÃO
//////////////////////////////////////
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

//////////////////////////////////////
// COMPONENTE PRINCIPAL
//////////////////////////////////////
export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  // ESTADOS DE FORMULÁRIO
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [playerName, setPlayerName] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState("Fraca");
  const [loading, setLoading] = useState(false);

  // MODAL DE IDIOMA
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const languages = [
    { code: "pt", label: "Português" },
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
  ];

  // LOGO ANIMADO
  const logoScale = useRef(new Animated.Value(1)).current;

  // LOGIN SALVO
  const [savedEmail, setSavedEmail] = useState("");
  const [savedPassword, setSavedPassword] = useState("");
  const [hasSavedLogin, setHasSavedLogin] = useState(false);
  const [stayLogged, setStayLogged] = useState(false);

  // >>> ESTADO PARA CARREGAMENTO INICIAL <<<
  // Serve para não ficar piscando a tela de login
  const [checkingAuth, setCheckingAuth] = useState(true);

  // >>> MODAL CUSTOMIZADO <<<
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  // >>> ESTADO PARA GUARDAR O TIPO DE USUÁRIO <<<
  const [selectedTypeUser, setSelectedTypeUser] = useState<
    "tournament" | "collection" | "both"
  >("both");

  // >>> Guardamos uma ação extra para executar quando o modal fechar
  const [onModalCloseAction, setOnModalCloseAction] = useState<() => void>(
    () => {}
  );

  // Mostra o modal e define uma ação a ser executada quando clicar em "OK"
  function showModal(title: string, message: string, onCloseCb?: () => void) {
    setModalTitle(title);
    setModalMessage(message || "");
    setModalVisible(true);

    if (onCloseCb) {
      setOnModalCloseAction(() => onCloseCb);
    } else {
      setOnModalCloseAction(() => {});
    }
  }

  // Fechar o modal e executar a ação (caso exista)
  function handleCloseModal() {
    setModalVisible(false);
    onModalCloseAction(); // Executa a callback (ex: navegar para a Home)
  }

  //////////////////////////////////////
  // VERIFICAR SE USUÁRIO ESTÁ BANIDO
  //////////////////////////////////////
  async function isUserBanned(id: string): Promise<boolean> {
    try {
      const leaguesSnap = await getDocs(collection(db, "leagues"));
      for (const leagueDoc of leaguesSnap.docs) {
        const banSnap = await getDocs(
          collection(db, `leagues/${leagueDoc.id}/roles/ban/members`)
        );
        if (banSnap.docs.some((doc) => doc.id === id)) {
          console.log(`🚫 Usuário ${id} está banido na liga ${leagueDoc.id}`);
          return true;
        }
      }
    } catch (error) {
      console.error("Erro ao verificar bans:", error);
    }
    return false;
  }

  //////////////////////////////////////
  // EFFECTS
  //////////////////////////////////////

  // >>> Animação do LOGO
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

  // >>> Buscar login salvo
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

  // >>> Carregar stayLogged
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

  // >>> onAuthStateChanged (verifica se usuário já está logado)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        try {
          setLoading(true);
          const firebaseToken = await user.getIdToken(true);
          const docRef = doc(db, "login", user.uid);
          const snap = await getDoc(docRef);

          if (!snap.exists()) {
            // Conta incompleta
            showModal("Conta incompleta", "Seu cadastro não está completo.");
            await signOut(auth);
            setLoading(false);
            return;
          }

          const data = snap.data();
          if (!data.playerId || !data.pin) {
            // Dados ausentes
            showModal("Dados ausentes", "Seu cadastro está incompleto.");
            await signOut(auth);
            setLoading(false);
            return;
          }

          // Checar se está banido
          const banned = await isUserBanned(data.playerId);
          if (banned) {
            showModal("Banido!", t("login.alerts.ban_message"), () => {
              // Ao fechar, não navega, apenas fica aqui
            });
            await signOut(auth);
            setLoading(false);
            return;
          }

          // Salvar dados no AsyncStorage
          await AsyncStorage.setItem("@userId", data.playerId);
          await AsyncStorage.setItem("@userPin", data.pin);
          await AsyncStorage.setItem("@userName", data.name || "Jogador");
          await AsyncStorage.setItem("@firebaseUID", user.uid);
          await AsyncStorage.setItem("@firebaseToken", firebaseToken);
          await AsyncStorage.setItem("@userType", data.type_user || "both");

          if (stayLogged) {
            await AsyncStorage.setItem("@stayLogged", "true");
          } else {
            await AsyncStorage.removeItem("@stayLogged");
          }

          // Exibir modal de Bem-vindo e, ao fechar, navegar para Home
          showModal("Bem-vindo!", `Olá, ${data.name || "Jogador"}!`, () => {
            router.push("/(tabs)/home");
          });
        } catch (e) {
          console.log("Erro no onAuthStateChanged:", e);
          showModal("Erro", "Falha ao carregar dados.");
        } finally {
          setLoading(false);
        }
      }
      // Se não houver user, apenas marcamos que terminamos de checar
      else {
        setLoading(false);
      }
      setCheckingAuth(false);
    });

    return () => unsubscribe();
  }, [router, stayLogged, t]);

  // >>> Renovar token (foreground)
  useEffect(() => {
    const interval = setInterval(
      async () => {
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
      },
      55 * 60 * 1000
    );
    return () => clearInterval(interval);
  }, []);

  // >>> Renovar token (ao voltar do background)
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

    const appStateListener = AppState.addEventListener(
      "change",
      (nextAppState) => {
        if (nextAppState === "active") {
          renewToken();
        }
      }
    );

    return () => appStateListener.remove();
  }, []);

  // >>> Calcular força da senha se for signup
  useEffect(() => {
    if (mode === "signup") {
      const s = checkPasswordStrength(password);
      setPasswordStrength(s);
    }
  }, [mode, password]);

  //////////////////////////////////////
  // TROCAR IDIOMA
  //////////////////////////////////////
  function changeLanguage(lang: string) {
    i18n.changeLanguage(lang);
    setLanguageModalVisible(false);
  }

  //////////////////////////////////////
  // FUNÇÕES DE SIGNUP, LOGIN, RESET
  //////////////////////////////////////
  async function handleSignUp() {
    if (
      !email ||
      !password ||
      !userId ||
      (!pin && selectedTypeUser !== "collection") ||
      !playerName
    ) {
      showModal("", t("login.alerts.empty_fields"));
      return;
    }
    if (!validateEmail(email)) {
      showModal("", t("login.alerts.invalid_email"));
      return;
    }
    if (!validatePassword(password)) {
      showModal("", t("login.alerts.weak_password"));
      return;
    }
    if (selectedTypeUser !== "collection" && (!/^\d{4}$/.test(pin))) {
      showModal("", "PIN inválido. Deve conter 4 dígitos numéricos.");
      return;
    }    

    setLoading(true);
    try {
      // Se for só coleção, gera um PIN aleatório
      let finalPin = pin;
      if (selectedTypeUser === "collection") {
        finalPin = Math.floor(1000 + Math.random() * 9000).toString();
      }

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const docRef = doc(db, "login", cred.user.uid);

      await setDoc(docRef, {
        email,
        playerId: userId,
        pin: finalPin,
        name: playerName,
        type_user: selectedTypeUser,
        createdAt: new Date().toISOString(),
      });

      await saveLoginData(email, password);

      showModal(
        "",
        t("login.alerts.signup_success", { playerId: userId, pin: finalPin })
      );
    } catch (err: any) {
      showModal(
        "",
        t("login.alerts.signup_error", { error: err.message || "" })
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn() {
    if (!email || !password) {
      showModal("", t("login.alerts.empty_fields"));
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
      showModal(t("login.alerts.login_error", { error: "" }), msg, () => {
        setLoading(false); // <- isso aqui destrava a tela depois do erro
      });      
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!email) {
      showModal(
        t("login.alerts.password_reset_error", { error: "" }),
        t("login.alerts.invalid_email")
      );
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      showModal("", t("login.alerts.password_reset_sent"));
    } catch (err: any) {
      showModal(
        "",
        t("login.alerts.password_reset_error", { error: err.message || "" })
      );
    }
  }

  async function handleAutoLogin() {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, savedEmail, savedPassword);
      console.log("Login automático com:", savedEmail);
    } catch {
      showModal("Erro", "Falha ao entrar automaticamente.");
    }
    setLoading(false);
  }

  async function clearSavedLogin() {
    await SecureStore.deleteItemAsync("savedEmail");
    await SecureStore.deleteItemAsync("savedPassword");
    setSavedEmail("");
    setSavedPassword("");
    setHasSavedLogin(false);
    showModal("Login removido", "Seu login salvo foi apagado.");
  }

  //////////////////////////////////////
  // ESTADO INICIAL DE CHECAGEM DE AUTENTICAÇÃO
  //////////////////////////////////////
  if (checkingAuth || loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        <Text style={{ color: COLORS.SECONDARY, marginTop: 8 }}>
          {t("login.loading")}
        </Text>
      </View>
    );
  }

  //////////////////////////////////////
  // SE NÃO ESTÁ CARREGANDO E NÃO TEM USUÁRIO,
  // MOSTRA A TELA DE LOGIN
  //////////////////////////////////////
  return (
    <ImageBackground
      source={require("../../assets/images/background_login.jpg")}
      style={s.background}
    >
      {/* MODAL CUSTOMIZADO (um só) */}
      <CustomModal
        visible={modalVisible}
        onClose={handleCloseModal}
        title={modalTitle}
        message={modalMessage}
      />

      {/* MODAL DE SELEÇÃO DE IDIOMA */}
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

      {/* CONTEÚDO DA TELA DE LOGIN */}
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

          {/* FORMULÁRIO LOGIN/SIGNUP */}
          <Animatable.View animation="fadeInUp" style={{ width: "100%" }}>
            {/* EMAIL */}
            <Text style={s.label}>{t("login.email_label")}</Text>
            <View style={s.inputContainer}>
              <Ionicons
                name="mail"
                size={20}
                color="#999"
                style={{ marginLeft: 10, marginRight: 6 }}
              />
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

            {/* SENHA */}
            <Text style={s.label}>{t("login.password_label")}</Text>
            <View style={s.inputContainer}>
              <Ionicons
                name="lock-closed"
                size={20}
                color="#999"
                style={{ marginLeft: 10, marginRight: 6 }}
              />
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

            {/* ESQUECI A SENHA */}
            {mode === "login" && (
              <TouchableOpacity
                style={s.forgotButton}
                onPress={handleResetPassword}
              >
                <Text style={s.forgotText}>{t("login.forgot_password")}</Text>
              </TouchableOpacity>
            )}

            {/* FORÇA DE SENHA (somente signup) */}
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

            {/* CAMPOS EXTRAS (signup) */}
            {mode === "signup" && (
              <>
                {/* NOME */}
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

                {/* ID DO JOGADOR */}
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

                <Text style={s.label}>Tipo de Usuário</Text>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {[
                    { label: "Coleção", value: "collection" },
                    { label: "Torneio", value: "tournament" },
                    { label: "Ambos", value: "both" },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setSelectedTypeUser(opt.value as any)}
                      style={{
                        backgroundColor:
                          selectedTypeUser === opt.value ? "#66BB6A" : "#444",
                        borderRadius: 20,
                        paddingVertical: 6,
                        paddingHorizontal: 14,
                      }}
                    >
                      <Text style={{ color: "#FFF", fontWeight: "bold" }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* PIN */}
                {selectedTypeUser !== "collection" && (
                  <>
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
              </>
            )}

            {/* BOTÃO PRINCIPAL */}
            <Animatable.View
              animation="bounceIn"
              delay={300}
              style={{ marginTop: 20, alignItems: "center" }}
            >
              {mode === "signup" ? (
                <TouchableOpacity style={s.signupButton} onPress={handleSignUp}>
                  <Ionicons
                    name="person-add-outline"
                    size={18}
                    color="#FFF"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={s.buttonText}>{t("login.signup_button")}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.loginButton} onPress={handleSignIn}>
                  <Ionicons
                    name="log-in-outline"
                    size={18}
                    color="#FFF"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={s.buttonText}>{t("login.login_button")}</Text>
                </TouchableOpacity>
              )}
            </Animatable.View>

            {/* LINK TROCAR MODO */}
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

            {/* LOGIN SALVO */}
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
                  <Text style={s.autoLoginText}>Entrar como {savedEmail}</Text>
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
                <Ionicons
                  name="language-outline"
                  size={16}
                  color="#FFF"
                  style={{ marginRight: 8 }}
                />
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
});
