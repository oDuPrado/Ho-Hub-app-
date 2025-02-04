// (auth)/login.tsx
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
  Image,
  ImageBackground,
  FlatList,
  LayoutAnimation,
  UIManager,
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
  query,
  where,
} from "firebase/firestore";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { auth, db } from "../../lib/firebaseConfig";
import { useTranslation } from "react-i18next"; // i18n
import LSselector from "../../LSselector";

// Importamos a lista de banimento
import { BAN_PLAYER_IDS } from "../hosts";

// --------------- Cores & Constantes ---------------
const { width, height } = Dimensions.get("window");
const BACKGROUND = "#1E1E1";
const PRIMARY = "#E3350D";
const SECONDARY = "#FFFFFF";
const INPUT_BG = "#292929";
const INPUT_BORDER = "#4D4D4D";
const SWITCH_TRACK = "#555555";
const SWITCH_THUMB = PRIMARY;
const ACCENT = "#FF6F61";

// Para animar layout no Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

  // Modal de Configurações (Engrenagem)
  const [adminModalVisible, setAdminModalVisible] = useState(false);

  // Listas e seleções de cidades/ligas
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [leagues, setLeagues] = useState<any[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");

  // Flags para expandir/ocultar listas
  const [showCities, setShowCities] = useState(false);
  const [showLeagues, setShowLeagues] = useState(false);

  // --------------- Efeito de animação no logotipo ---------------
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

  // --------------- Checa AsyncStorage p/ ver se user quer permanecer logado ---------------
  useEffect(() => {
    (async () => {
      try {
        const stay = await AsyncStorage.getItem("@stayLogged");
        if (stay === "true") {
          setStayLogged(true); // Atualiza o estado
        }
      } catch (error) {
        console.error("Erro ao carregar @stayLogged:", error);
      }
    })();
  }, []);

  // --------------- Observa estado do Auth ---------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        setLoading(true);
        try {
          // Buscar doc "login/{uid}"
          const docRef = doc(db, "login", user.uid);
          const snap = await getDoc(docRef);

          if (!snap.exists()) {
            Alert.alert(
              t("login.alerts.incomplete_account"),
              t("login.alerts.incomplete_account")
            );
            await signOut(auth);
            setLoading(false);
            return;
          }

          const data = snap.data();
          if (!data.playerId || !data.pin) {
            Alert.alert(
              t("login.alerts.missing_data"),
              t("login.alerts.missing_data")
            );
            await signOut(auth);
            setLoading(false);
            return;
          }

          // === Verifica banimento ===
          if (BAN_PLAYER_IDS.includes(data.playerId)) {
            // Exibe modal de ban
            setBanModalVisible(true);

            // Força signOut pra não entrar
            await signOut(auth);
            setLoading(false);
            return;
          }

          // Se não banido, prossegue
          const docName = data.name || "Jogador";

          // Salva no AsyncStorage
          await AsyncStorage.setItem("@userId", data.playerId);
          await AsyncStorage.setItem("@userPin", data.pin);
          await AsyncStorage.setItem("@userName", docName);

          // Armazena preferencia de stayLogged
          if (stayLogged) {
            await AsyncStorage.setItem("@stayLogged", "true");
          } else {
            await AsyncStorage.removeItem("@stayLogged");
          }

          // Alerta de boas vindas
          Alert.alert(
            t("login.alerts.welcome"),
            t("login.alerts.welcome") + `, ${docName}!`
          );
          router.push("/(tabs)/home");
        } catch (error) {
          console.error("Erro ao verificar autenticação:", error);
          Alert.alert(t("login.alerts.error"), t("login.alerts.error"));
        } finally {
          setLoading(false);
        }
      } else {
        console.log("Sem user logado no momento...");
      }
    });

    return () => unsubscribe();
  }, [router, t, stayLogged]);

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
        name: playerName,
        createdAt: new Date().toISOString(),
      });

      Alert.alert(
        t("login.alerts.signup_success", {
          playerId: playerId,
          pin: pin,
        })
      );
      // onAuthStateChanged vai redirecionar ao home
    } catch (err: any) {
      console.log("Erro no SignUp:", err);
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
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged fará o resto
    } catch (err: any) {
      console.log("Erro no SignIn:", err);
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
      console.log("Erro ao resetar senha:", err);
      Alert.alert(
        t("login.alerts.password_reset_error", { error: err.message || "" })
      );
    }
  }

  // --------------- Funções do Modal de Liga ---------------
  const openAdminModal = async () => {
    setAdminModalVisible(true);
    await fetchCities(); // Carrega cidades quando abrir modal
  };

  const closeAdminModal = () => {
    setAdminModalVisible(false);
    setShowCities(false);
    setShowLeagues(false);
  };

  // Busca todas as cidades disponíveis na coleção "leagues"
  const fetchCities = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, "leagues"));
      const citySet = new Set<string>();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.city) {
          citySet.add(data.city);
        }
      });
      setCities(Array.from(citySet));
    } catch (error) {
      console.log("Erro ao buscar cidades:", error);
    } finally {
      setLoading(false);
    }
  };

  // Busca as ligas na cidade
  const fetchLeaguesByCity = async (cityName: string) => {
    try {
      setLoading(true);
      setSelectedCity(cityName);
      setShowLeagues(false);

      // Animação de layout (Android)
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      const qCity = query(collection(db, "leagues"), where("city", "==", cityName));
      const citySnapshot = await getDocs(qCity);

      const leaguesList: any[] = [];
      citySnapshot.forEach((doc) => {
        leaguesList.push({
          id: doc.id,
          ...doc.data(),
        });
      });
      setLeagues(leaguesList);
    } catch (error) {
      console.error("Erro ao buscar ligas por cidade:", error);
    } finally {
      setLoading(false);
    }
  };

  // Define a liga selecionada
  const handleSelectLeague = async (leagueId: string) => {
    setSelectedLeagueId(leagueId);
    await AsyncStorage.setItem("@leagueId", leagueId);
    Alert.alert("Liga Selecionada", `League ID: ${leagueId}`);
  };

  // --------------- Render ---------------
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
          {/* Modal de Ban (caso banModalVisible = true) */}
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

          {/* Modal de Seleção de Liga e Idioma */}
          <Modal
            visible={adminModalVisible}
            transparent
            animationType="slide"
            onRequestClose={closeAdminModal}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>{t("common.config")}</Text>

                {/* Seletor de Idioma */}
                <LSselector />

                {/* Botão para expandir/ocultar cidades */}
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
                    setShowCities(!showCities);
                  }}
                >
                  <Text style={styles.expandButtonText}>
                    {t("common.select_city")}
                  </Text>
                  <Ionicons
                    name={showCities ? "chevron-up" : "chevron-down"}
                    size={24}
                    color={ACCENT}
                  />
                </TouchableOpacity>

                {/* Lista de Cidades (com ícones) */}
                {showCities && (
                  <FlatList
                    style={styles.flatList}
                    data={cities}
                    keyExtractor={(item) => item}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.cityItem}
                        onPress={() => {
                          fetchLeaguesByCity(item);
                          setShowLeagues(true);
                        }}
                      >
                        <MaterialCommunityIcons
                          name="map-marker"
                          size={20}
                          color={ACCENT}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.cityItemText}>{item}</Text>
                      </TouchableOpacity>
                    )}
                  />
                )}

                {/* Botão para expandir ligas */}
                {selectedCity !== "" && (
                  <TouchableOpacity
                    style={styles.expandButton}
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
                      // Se não tiver ligas ainda, já buscou no click da cidade.
                      setShowLeagues(!showLeagues);
                    }}
                  >
                    <Text style={styles.expandButtonText}>
                      {selectedCity
                        ? `${t("common.select_league")} (${selectedCity})`
                        : t("common.select_league")}
                    </Text>
                    <Ionicons
                      name={showLeagues ? "chevron-up" : "chevron-down"}
                      size={24}
                      color={ACCENT}
                    />
                  </TouchableOpacity>
                )}

                {/* Lista de Ligas */}
                {showLeagues && (
                  <FlatList
                    style={styles.flatList}
                    data={leagues}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[
                          styles.leagueItem,
                          {
                            backgroundColor:
                              selectedLeagueId === item.id ? ACCENT : DARKER(INPUT_BG),
                          },
                        ]}
                        onPress={() => handleSelectLeague(item.id)}
                      >
                        <Ionicons
                          name="ribbon"
                          size={20}
                          color={SECONDARY}
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.cityItemText}>
                          {item.leagueName || "Sem Nome"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                )}

                {/* Botão fechar */}
                <TouchableOpacity
                  style={styles.closeModalButton}
                  onPress={closeAdminModal}
                >
                  <Text style={styles.closeModalButtonText}>
                    {t("common.close")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Ícone de Engrenagem no topo direito */}
          <TouchableOpacity style={styles.gearButton} onPress={openAdminModal}>
            <Ionicons name="settings" size={32} color={SECONDARY} />
          </TouchableOpacity>

          {/* Logo animada */}
          <Animated.Image
            source={require("../../assets/images/logo.jpg")}
            style={[styles.logo, { transform: [{ scale: logoScale }] }]}
            resizeMode="contain"
          />

          <Text style={styles.title}>
            {mode === "signup"
              ? t("login.title_signup")
              : t("login.title_login")}
          </Text>

          {/* E-mail */}
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

          {/* Senha */}
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

          {/* Esqueci Senha (apenas login) */}
          {mode === "login" && (
            <TouchableOpacity
              style={{ marginTop: 10, alignSelf: "flex-end" }}
              onPress={handleResetPassword}
            >
              <Text style={styles.forgotText}>{t("login.forgot_password")}</Text>
            </TouchableOpacity>
          )}

          {/* Força da senha (signup) */}
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

          {/* ID, PIN e Nome (apenas no signup) */}
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
                value={playerId}
                onChangeText={setPlayerId}
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

          {/* Switch: Continuar Conectado */}
          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{t("login.stay_logged")} </Text>
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
              <Text style={styles.buttonText}>{t("login.signup_button")}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.button} onPress={handleSignIn}>
              <Text style={styles.buttonText}>{t("login.login_button")}</Text>
            </TouchableOpacity>
          )}

          {/* Link p/ trocar de modo */}
          {mode === "signup" ? (
            <TouchableOpacity
              style={{ marginTop: 20 }}
              onPress={() => setMode("login")}
            >
              <Text style={{ color: SECONDARY }}>
                {t("login.link_to_login")}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={{ marginTop: 20 }}
              onPress={() => setMode("signup")}
            >
              <Text style={{ color: SECONDARY }}>
                {t("login.link_to_signup")}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

// --------------- ESTILOS ---------------
const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: width,
    height: height,
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
    height: height * 0.21,
    marginTop: 30,
    marginBottom: 35,
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
  },
  signupButton: {
    backgroundColor: ACCENT,
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

  // Modal Admin
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "85%",
    backgroundColor: INPUT_BG,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  modalTitle: {
    color: SECONDARY,
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
  },

  // Botão de expansão (cidades/ligas)
  expandButton: {
    flexDirection: "row",
    backgroundColor: "#444444",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginTop: 10,
    width: "100%",
  },
  expandButtonText: {
    color: ACCENT,
    fontWeight: "600",
    fontSize: 16,
  },
  flatList: {
    width: "100%",
    maxHeight: 150,
    marginTop: 8,
    marginBottom: 8,
  },

  cityItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: DARKER(INPUT_BG),
    padding: 10,
    marginVertical: 4,
    borderRadius: 6,
  },
  cityItemText: {
    color: SECONDARY,
    fontSize: 15,
  },
  leagueItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    marginVertical: 4,
    borderRadius: 6,
  },

  closeModalButton: {
    backgroundColor: PRIMARY,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  closeModalButtonText: {
    color: SECONDARY,
    fontWeight: "bold",
    fontSize: 16,
  },
  gearButton: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 10,
  },
});

// Helper para escurecer cor
function DARKER(hexColor: string) {
  const amt = -20;
  let num = parseInt(hexColor.replace("#", ""), 16);
  let r = (num >> 16) + amt;
  let b = ((num >> 8) & 0x00ff) + amt;
  let g = (num & 0x0000ff) + amt;

  const newColor =
    "#" +
    (
      0x1000000 +
      (r < 255 ? (r < 0 ? 0 : r) : 255) * 0x10000 +
      (b < 255 ? (b < 0 ? 0 : b) : 255) * 0x100 +
      (g < 255 ? (g < 0 ? 0 : g) : 255)
    )
      .toString(16)
      .slice(1);
  return newColor;
}
