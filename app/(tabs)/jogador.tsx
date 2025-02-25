import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  Animated,
  Easing,
  ScrollView,
  Image,
  TouchableWithoutFeedback,
  Dimensions,
  Vibration,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";
import * as Animatable from "react-native-animatable";
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";

import { db } from "../../lib/firebaseConfig";

// Import lógica + configs existentes
import titles, { TitleItem, PlayerStats } from "../titlesConfig";
import templates, { TemplateItem } from "../templatesConfig";
import TitlesModal from "../../components/TitlesModal";
import HistoryModal from "../../components/HistoryModal";
import TemplateModal from "../../components/TemplateModal";

// 🔥 Importamos a função que calcula stats + XP
import {
  fetchAllStatsByFilter,
  PlayerStatsData,
  fetchAllMatches,
  MatchData,
} from "../../lib/matchService";

/** ================================ */
/** IMPORTES DOS NOVOS COMPONENTES:  */
/** 1) AvatarModal                  */
/** 2) SeasonModal                  */
/** ================================ */
import AvatarModal from "../../components/AvatarModal";
import SeasonModal from "../../components/SeasonModal";

/** PlayerInfo e ConfrontoStats */
interface PlayerInfo {
  userid: string;
  fullname: string;
}
interface ConfrontoStats {
  matches: number;
  userWins: number;
  userLosses: number;
  userDraws: number;
}

/** Lista de Avatares */
const avatarList = [
  { id: 1, uri: require("../../assets/images/avatar/avatar1.jpg") },
  { id: 2, uri: require("../../assets/images/avatar/avatar2.jpg") },
  { id: 3, uri: require("../../assets/images/avatar/avatar3.jpg") },
  { id: 4, uri: require("../../assets/images/avatar/avatar4.jpg") },
  { id: 5, uri: require("../../assets/images/avatar/avatar5.jpg") },
  { id: 6, uri: require("../../assets/images/avatar/avatar6.jpg") },
  { id: 7, uri: require("../../assets/images/avatar/avatar7.jpg") },
  { id: 8, uri: require("../../assets/images/avatar/avatar8.jpg") },
];

/** Mensagens de recomendação */
const recommendationMessages = {
  wins: [
    "Você está batendo mais que Machamp na academia!",
    "Vitórias em alta, continue assim! Quem vai te parar?",
    "Ninguém segura esse campeão... ou será que segura?",
  ],
  losses: [
    "Tá apanhando mais que um Magikarp fora d'água!",
    "Derrotas demais? Hora de rever o deck e suas estratégias!",
    "Faz parte perder... mas perder muito já é teimosia, hein?",
  ],
  draws: [
    "Empate? É... faltou um golpe final aí...",
    "Dois titãs colidiram, mas nenhum triunfou... Tente desempatar!",
    "Se tá empatando tanto, falta agressividade no deck ou sobrou azar?",
  ],
};

/** Mensagens de NPCs aleatórios */
const npcMessages = [
  "Força sem estratégia é apenas brutalidade!",
  "A paciência é a chave para surpreender o adversário!",
  "Já organizou seu deck hoje?",
  "Rendam-se agora ou preparem-se para lutar!",
  "Dragões exigem respeito... e muitas vitórias!",
  "Para vencer, você precisa dominar suas fraquezas!",
];

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function PlayerScreen() {
  const router = useRouter();

  // ======================
  // ESTADOS GERAIS
  // ======================
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("Jogador");
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<PlayerStats>({
    wins: 0,
    losses: 0,
    draws: 0,
    matchesTotal: 0,
    uniqueOpponents: 0,
    tournamentPlacements: [],
  });

  // XP, level, xpNext
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [xpNextLevel, setXpNextLevel] = useState(50);

  const [unlockedTitles, setUnlockedTitles] = useState<TitleItem[]>([]);
  const [titlesModalVisible, setTitlesModalVisible] = useState(false);
  const [newTitleIndicator, setNewTitleIndicator] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);

  // Avatar + Template
  /** =========== REMOVEMOS O COD. DO MODAL DE AVATAR =========== */
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<any>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number>(1);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);

  // PESQUISA (oculto, mas funcional)
  const [searchText, setSearchText] = useState("");
  const [playersResult, setPlayersResult] = useState<PlayerInfo[]>([]);
  const [playerSearchLoading, setPlayerSearchLoading] = useState(false);
  const [searchBarWidth] = useState(new Animated.Value(0));
  const [searchIconVisible, setSearchIconVisible] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  // Animações
  const epicIconSpin = useRef(new Animated.Value(0)).current;
  const backgroundAnim = useRef(new Animated.Value(0)).current;
  const avatarFlipAnim = useRef(new Animated.Value(0)).current;
  const [showRecommendation, setShowRecommendation] = useState(true);
  const [recommendationText, setRecommendationText] = useState("");

  // NPC Aleatório (com fechar)
  const [npcText, setNpcText] = useState("");
  const [showNpc, setShowNpc] = useState(true);

  // Frase personalizada do jogador
  const [playerMessage, setPlayerMessage] = useState("");

  // Flag feedback tátil
  const [tactileEnabled, setTactileEnabled] = useState(true);

  // Filtro
  const [currentFilter, setCurrentFilter] = useState<string>("all");

  // Confronto Modal
  const [confrontModalVisible, setConfrontModalVisible] = useState(false);
  const [confrontStats, setConfrontStats] = useState<ConfrontoStats | null>(null);
  const [confrontName, setConfrontName] = useState("");
  const [confrontAvatar, setConfrontAvatar] = useState<any>(null);
  const [confrontTemplate, setConfrontTemplate] = useState<TemplateItem | null>(null);

  // SWIPE PAGES
  const [activePage, setActivePage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // ========== NOVO: Modal de Temporada ==========
  /** =========== REMOVEMOS O COD. DO MODAL DE TEMPORADA =========== */
  const [seasonModalVisible, setSeasonModalVisible] = useState(false);

  // ======================
  // USE FOCUS / INIT
  // ======================
  useFocusEffect(
    useCallback(() => {
      loadPlayerData();
      loadNPCMessage();
    }, [])
  );

  useEffect(() => {
    // Anima BG
    Animated.loop(
      Animated.sequence([
        Animated.timing(backgroundAnim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(backgroundAnim, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  // Animação épica no ícone do template
  useEffect(() => {
    const activeTemplate = templates.find((t) => t.id === selectedTemplateId);
    if (activeTemplate?.hasEpicAnimation) {
      Animated.loop(
        Animated.timing(epicIconSpin, {
          toValue: 1,
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      epicIconSpin.stopAnimation();
      epicIconSpin.setValue(0);
    }
  }, [selectedTemplateId]);

  // ======================
  // CARREGAR DADOS
  // ======================
  async function loadPlayerData() {
    try {
      setLoading(true);
      const storedId = await AsyncStorage.getItem("@userId");
      if (!storedId) {
        router.replace("/(auth)/login");
        return;
      }
      setUserId(storedId);

      const storedName = await AsyncStorage.getItem("@userName");
      setUserName(storedName ?? "Jogador");

      const storedAvatar = await AsyncStorage.getItem("@userAvatar");
      if (storedAvatar) {
        const avId = parseInt(storedAvatar, 10);
        const found = avatarList.find((av) => av.id === avId);
        if (found) setSelectedAvatar(found.uri);
      }

      const storedTemplateId = await AsyncStorage.getItem("@userTemplateId");
      if (storedTemplateId) {
        setSelectedTemplateId(parseInt(storedTemplateId, 10));
      }

      const storedMsg = await AsyncStorage.getItem("@userMessage");
      if (storedMsg) {
        setPlayerMessage(storedMsg);
      }

      const storedTactile = await AsyncStorage.getItem("@tactileEnabled");
      if (storedTactile) {
        setTactileEnabled(storedTactile === "true");
      }

      const fType = (await AsyncStorage.getItem("@filterType")) || "all";
      setCurrentFilter(fType);

      // 🔥 Agora chamamos nossa função que já faz o cálculo de XP e nível
      const aggregatedStats = await fetchAllStatsByFilter(storedId);

      const adaptedStats: PlayerStats = {
        wins: aggregatedStats.wins,
        losses: aggregatedStats.losses,
        draws: aggregatedStats.draws,
        matchesTotal: aggregatedStats.matchesTotal,
        uniqueOpponents: aggregatedStats.opponentsList.length,
        tournamentPlacements: aggregatedStats.tournamentPlacements.map((item) => item.place),
      };
      setStats(adaptedStats);

      // XP e nível
      setXp(aggregatedStats.xp);
      setLevel(aggregatedStats.level);
      setXpNextLevel(aggregatedStats.xpForNextLevel);

      if (fType === "league") {
        // Computar títulos locais
        const userTitles = computeLocalTitles(adaptedStats);
        setUnlockedTitles(userTitles);
        if (userTitles.some((t) => t.unlocked)) {
          setNewTitleIndicator(true);
        }
      } else {
        setUnlockedTitles([]);
        setNewTitleIndicator(false);
      }

      defineRecommendation(adaptedStats);
    } catch (error) {
      Alert.alert("Erro", "Não foi possível carregar seus dados.");
    } finally {
      setLoading(false);
    }
  }

  function computeLocalTitles(ps: PlayerStats): TitleItem[] {
    return titles.map((t) => {
      const unlocked = t.condition(ps);
      return { ...t, unlocked };
    });
  }

  function defineRecommendation(ps: PlayerStats) {
    let bestCategory = "wins";
    let maxVal = ps.wins;
    if (ps.losses > maxVal) {
      bestCategory = "losses";
      maxVal = ps.losses;
    }
    if (ps.draws > maxVal) {
      bestCategory = "draws";
      maxVal = ps.draws;
    }
    const arr = recommendationMessages[bestCategory as keyof typeof recommendationMessages];
    if (arr && arr.length > 0) {
      const text = arr[Math.floor(Math.random() * arr.length)];
      setRecommendationText(text);
    } else {
      setRecommendationText("Continue treinando e conquistando vitórias!");
    }
  }

  // NPC ALEATÓRIO
  function loadNPCMessage() {
    const randomIndex = Math.floor(Math.random() * npcMessages.length);
    setNpcText(npcMessages[randomIndex]);
    setShowNpc(true);
  }

  // ======================
  // BACKGROUND ANIM
  // ======================
  const interpolatedBG = backgroundAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [DARK_BG, "#1A1818"],
  });

  // ======================
  // AVATAR EFEITO 3D
  // ======================
  const avatarSpinY = avatarFlipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  function flipAvatar() {
    Animated.sequence([
      Animated.timing(avatarFlipAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(avatarFlipAnim, {
        toValue: 0,
        duration: 350,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (tactileEnabled) {
        Vibration.vibrate(10);
      }
    });
  }

  // ======================
  // SALVAR AVATAR / TEMPLATE
  // ======================
  async function updatePlayerAvatar(uId: string, avatarId: number) {
    try {
      await setDoc(doc(db, "players", uId), { avatarId }, { merge: true });
    } catch (error) {
      // ignore
    }
  }

  async function updatePlayerTemplate(uId: string, templateId: number) {
    try {
      await setDoc(doc(db, "players", uId), { templateId }, { merge: true });
    } catch (error) {
      // ignore
    }
  }

  // Salvar mensagem do jogador
  async function savePlayerMessage(msg: string) {
    setPlayerMessage(msg);
    await AsyncStorage.setItem("@userMessage", msg);
    if (tactileEnabled) {
      Vibration.vibrate(5);
    }
  }

  // Salvar flag de feedback tátil
  async function saveTactileSetting(val: boolean) {
    setTactileEnabled(val);
    await AsyncStorage.setItem("@tactileEnabled", val.toString());
    if (val) {
      Vibration.vibrate(5);
    }
  }

  // ======================
  // PESQUISA (oculta)
  // ======================
  function closeSearchOverlay() {
    Animated.timing(searchBarWidth, {
      toValue: 0,
      duration: 400,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      setSearchOpen(false);
      setSearchIconVisible(true);
      setSearchText("");
      setPlayersResult([]);
    });
  }

  function handleToggleSearch() {
    if (!searchOpen) {
      setSearchOpen(true);
      setSearchIconVisible(false);
      Animated.timing(searchBarWidth, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    } else {
      closeSearchOverlay();
    }
  }

  async function handleSearchPlayers() {
    if (!searchText.trim()) {
      Alert.alert("Busca", "Digite algo para buscar.");
      return;
    }
    setPlayerSearchLoading(true);
    try {
      const filteredPlayers = await fetchPlayersByFilter(searchText);
      setPlayersResult(filteredPlayers);
      if (filteredPlayers.length === 0) {
        Alert.alert("Busca", "Nenhum jogador encontrado.");
      }
    } catch {
      Alert.alert("Erro", "Falha na busca de jogadores.");
    } finally {
      setPlayerSearchLoading(false);
    }
  }

  async function fetchPlayersByFilter(searchTerm: string): Promise<PlayerInfo[]> {
    try {
      const filterType = await AsyncStorage.getItem("@filterType");
      const cityStored = await AsyncStorage.getItem("@selectedCity");
      const leagueStored = await AsyncStorage.getItem("@leagueId");
      const arr: PlayerInfo[] = [];

      if (!filterType || filterType === "all") {
        const allSnap = await getDocs(collection(db, "players"));
        allSnap.forEach((docSnap) => {
          const d = docSnap.data();
          const full = (d.fullname || docSnap.id).toLowerCase();
          if (full.includes(searchTerm.toLowerCase())) {
            arr.push({ userid: docSnap.id, fullname: d.fullname || docSnap.id });
          }
        });
      } else if (filterType === "city" && cityStored) {
        const qCity = query(collection(db, "leagues"), where("city", "==", cityStored));
        const snapCity = await getDocs(qCity);
        for (const leagueDoc of snapCity.docs) {
          const leagueId = leagueDoc.id;
          const playersRef = collection(db, `leagues/${leagueId}/players`);
          const playersSnap = await getDocs(playersRef);
          playersSnap.forEach((ds) => {
            const data = ds.data();
            const full = (data.fullname || ds.id).toLowerCase();
            if (full.includes(searchTerm.toLowerCase())) {
              arr.push({ userid: ds.id, fullname: data.fullname || ds.id });
            }
          });
        }
      } else if (filterType === "league" && leagueStored) {
        const playersRef = collection(db, `leagues/${leagueStored}/players`);
        const playersSnap = await getDocs(playersRef);
        playersSnap.forEach((ds) => {
          const data = ds.data();
          const full = (data.fullname || ds.id).toLowerCase();
          if (full.includes(searchTerm.toLowerCase())) {
            arr.push({ userid: ds.id, fullname: data.fullname || ds.id });
          }
        });
      }
      return arr;
    } catch {
      return [];
    }
  }

  // ======================
  // CONFRONTO
  // ======================
  async function handleCheckConfronto(opponentId: string, opponentName: string) {
    try {
      setConfrontModalVisible(true);
      setConfrontName(opponentName);
      setConfrontStats(null);
      setConfrontAvatar(null);
      setConfrontTemplate(null);

      const docRef = doc(db, "players", opponentId);
      const docSnap = await getDoc(docRef);
      let oppAvId = 1;
      let oppTempId = 1;
      if (docSnap.exists()) {
        const dd = docSnap.data();
        if (dd.avatarId) oppAvId = dd.avatarId;
        if (dd.templateId) oppTempId = dd.templateId;
      }
      const foundAv = avatarList.find((x) => x.id === oppAvId);
      setConfrontAvatar(foundAv ? foundAv.uri : null);

      const foundT = templates.find((x) => x.id === oppTempId);
      setConfrontTemplate(foundT || null);

      const allMatches = await fetchAllMatches();
      const direct = allMatches.filter((mm) => {
        if (!mm.outcomeNumber) return false;
        const isUser1 = mm.player1_id === userId && mm.player2_id === opponentId;
        const isUser2 = mm.player2_id === userId && mm.player1_id === opponentId;
        return isUser1 || isUser2;
      });

      let userW = 0;
      let userL = 0;
      let userD = 0;
      direct.forEach((mm) => {
        const isUserP1 = mm.player1_id === userId;
        if (mm.outcomeNumber === 1) {
          if (isUserP1) userW++;
          else userL++;
        } else if (mm.outcomeNumber === 2) {
          if (isUserP1) userL++;
          else userW++;
        } else if (mm.outcomeNumber === 3) {
          userD++;
        } else if (mm.outcomeNumber === 10) {
          userL++;
        }
      });

      setConfrontStats({
        matches: direct.length,
        userWins: userW,
        userLosses: userL,
        userDraws: userD,
      });
    } catch {
      Alert.alert("Erro", "Não foi possível calcular o confronto.");
    }
  }

  // ======================
  // ABRIR/FECHAR MODAIS
  // ======================
  function handleOpenTitles() {
    setTitlesModalVisible(true);
    setNewTitleIndicator(false);
  }
  function handleOpenHistory() {
    setHistoryModalVisible(true);
  }

  // ======================
  // SWIPE ENTRE SEÇÕES
  // ======================
  function onScrollEnd(e: any) {
    const contentOffsetX = e.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(contentOffsetX / SCREEN_WIDTH);
    setActivePage(pageIndex);
  }

  function goToPage(index: number) {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ x: SCREEN_WIDTH * index, y: 0, animated: true });
    }
  }

  // ======================
  // SEÇÃO DE PERFIL
  // ======================
  function renderProfileSection() {
    const activeTemplate = templates.find((t) => t.id === selectedTemplateId);
    const fallbackTemplate = templates[0];
    const usedTemplate = activeTemplate || fallbackTemplate;
    const templateStyle = usedTemplate.containerStyle || {};
    const textStyle = usedTemplate.textStyle || { color: "#FFFFFF" };

    const spin = epicIconSpin.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });

    const defaultAvatar = require("../../assets/images/avatar/image.jpg");
    const currentAvatar = selectedAvatar || defaultAvatar;

    const totalMatches = stats.matchesTotal;
    const wrValue = totalMatches > 0 ? ((stats.wins / totalMatches) * 100).toFixed(1) : "0";

    // Ícones mudam de cor conforme template
    const iconColor = usedTemplate.iconColor || "#FFF";

    // Identifica se estamos em um "estilo" pra cada 30 níveis
    // Só pra trocar cor ou algo do tipo
    const levelDecorationStyle = getLevelDecorationStyle(level);

    return (
      <View style={{ width: SCREEN_WIDTH }}>
        <View style={[styles.playerCard, templateStyle]}>
          <View style={styles.templateIconContainer}>
            {usedTemplate.hasEpicAnimation ? (
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <FontAwesome5
                  name={usedTemplate.iconName}
                  size={usedTemplate.iconSize || 30}
                  color={usedTemplate.iconColor}
                />
              </Animated.View>
            ) : (
              <FontAwesome5
                name={usedTemplate.iconName}
                size={usedTemplate.iconSize || 30}
                color={usedTemplate.iconColor}
              />
            )}
          </View>

          <Text style={[styles.playerName, textStyle]}>{userName}</Text>

          {/* Nível Decorado */}
          <Animatable.View animation="pulse" iterationCount="infinite" style={[styles.levelBadge, levelDecorationStyle]}>
            <Text style={styles.levelBadgeText}>Nível {level}</Text>
          </Animatable.View>

          {/* Avatar interativo */}
          <TouchableOpacity
            onPress={() => {
              flipAvatar();
              setAvatarModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Animated.Image
              source={currentAvatar}
              style={[
                styles.avatar,
                { transform: [{ rotateY: avatarSpinY }] },
              ]}
            />
          </TouchableOpacity>

          {/* Frase do Jogador */}
          {playerMessage ? (
            <Text style={[styles.playerMessage, { color: textStyle.color }]}>
              "{playerMessage}"
            </Text>
          ) : (
            <Text style={[styles.playerMessage, { color: textStyle.color, fontStyle: "italic" }]}>
              (Sem frase personalizada)
            </Text>
          )}

          {/* Barra de XP */}
          <View style={styles.xpContainer}>
            <Text style={[styles.xpText, { color: textStyle.color }]}>
              XP: {xp}/{xpNextLevel}
            </Text>
            <View style={styles.xpBar}>
              <View style={[styles.xpFill, { width: `${(xp / xpNextLevel) * 100}%` }]} />
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <MaterialCommunityIcons name="trophy" size={20} color={iconColor} />
              <Text style={[styles.statLabel, textStyle]}>Vitórias</Text>
              <Text style={[styles.statValue, textStyle]}>{stats.wins}</Text>
            </View>
            <View style={styles.statBox}>
              <MaterialCommunityIcons name="emoticon-cry-outline" size={20} color={iconColor} />
              <Text style={[styles.statLabel, textStyle]}>Derrotas</Text>
              <Text style={[styles.statValue, textStyle]}>{stats.losses}</Text>
            </View>
            <View style={styles.statBox}>
              <MaterialCommunityIcons name="handshake" size={20} color={iconColor} />
              <Text style={[styles.statLabel, textStyle]}>Empates</Text>
              <Text style={[styles.statValue, textStyle]}>{stats.draws}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <MaterialCommunityIcons name="gamepad" size={20} color={iconColor} />
              <Text style={[styles.statLabel, textStyle]}>Partidas</Text>
              <Text style={[styles.statValue, textStyle]}>{stats.matchesTotal}</Text>
            </View>
            <View style={styles.statBox}>
              <MaterialCommunityIcons name="percent" size={20} color={iconColor} />
              <Text style={[styles.statLabel, textStyle]}>WinRate</Text>
              <Text style={[styles.statValue, textStyle]}>{wrValue}%</Text>
            </View>
            <View style={styles.statBox}>
              <MaterialCommunityIcons name="account-group" size={20} color={iconColor} />
              <Text style={[styles.statLabel, textStyle]}>Oponentes</Text>
              <Text style={[styles.statValue, textStyle]}>{stats.uniqueOpponents}</Text>
            </View>
          </View>

          {/* Balão de recomendação */}
          {showRecommendation && (
            <Animatable.View
              animation="fadeInUp"
              style={styles.recommendationCard}
            >
              <Text style={styles.recommendationText}>{recommendationText}</Text>
              <TouchableOpacity
                style={styles.closeRecommendation}
                onPress={() => setShowRecommendation(false)}
              >
                <Ionicons name="close-circle" size={22} color="#FFF" />
              </TouchableOpacity>
            </Animatable.View>
          )}
        </View>

        {/* Botões de Títulos e Histórico */}
        <TouchableOpacity
          style={[styles.titlesButton, { backgroundColor: "#000" }]}
          onPress={handleOpenTitles}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.titlesButtonText}>Ver Títulos</Text>
            {newTitleIndicator && (
              <View style={styles.newTitleBadge}>
                <Text style={styles.newTitleBadgeText}>Novo</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.historyButton, { backgroundColor: "#000" }]}
          onPress={handleOpenHistory}
          activeOpacity={0.8}
        >
          <Text style={styles.historyButtonText}>Ver Histórico de Torneios</Text>
        </TouchableOpacity>

        {/* Botão Temporada */}
        <TouchableOpacity
          style={[styles.seasonButton, { backgroundColor: "#333" }]}
          onPress={() => setSeasonModalVisible(true)}
        >
          <MaterialCommunityIcons name="map-marker-path" size={22} color="#FFF" />
          <Text style={styles.seasonButtonText}>Temporada</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Função auxiliar: muda cor do "Nível" a cada 30 níveis
  function getLevelDecorationStyle(lv: number) {
    const baseStyle = {
      backgroundColor: "#E3350D", // default
      borderColor: "#fff",
    };
    if (lv >= 30 && lv < 60) {
      return { backgroundColor: "#ff9900", borderColor: "#fff" };
    } else if (lv >= 60 && lv < 90) {
      return { backgroundColor: "#00ccff", borderColor: "#fff" };
    } else if (lv >= 90 && lv < 120) {
      return { backgroundColor: "#cc00ff", borderColor: "#fff" };
    } else if (lv >= 120) {
      return { backgroundColor: "#00ff00", borderColor: "#fff" };
    }
    return baseStyle;
  }

  // ======================
  // SEÇÃO DE CUSTOMIZAÇÃO
  // ======================
  function renderCustomizationSection() {
    return (
      <View style={{ width: SCREEN_WIDTH, padding: 20 }}>
        <Text style={styles.sectionTitle}>Personalização</Text>

        <Text style={styles.customLabel}>Frase do Jogador</Text>
        <View style={styles.customBox}>
          <TextInput
            style={styles.customInput}
            placeholder="Digite sua frase de perfil..."
            placeholderTextColor="#888"
            value={playerMessage}
            onChangeText={savePlayerMessage}
          />
        </View>

        {/* Caixa de feedback tátil */}
        <Text style={styles.customLabel}>Feedback Tátil</Text>
        <View style={[styles.customBox, { flexDirection: "row", alignItems: "center" }]}>
          <Text style={styles.customInput}>
            {tactileEnabled ? "Ativado" : "Desativado"}
          </Text>
          <TouchableOpacity
            style={styles.toggleTactileButton}
            onPress={() => saveTactileSetting(!tactileEnabled)}
          >
            <Text style={{ color: "#FFF", fontWeight: "bold" }}>
              {tactileEnabled ? "Desativar" : "Ativar"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Botão para selecionar template */}
        <Text style={styles.customLabel}>Template (Tema Visual)</Text>
        <Animatable.View animation="pulse" iterationCount="infinite" style={{ marginTop: 8 }}>
          <TouchableOpacity
            style={styles.templateButton}
            onPress={() => setTemplateModalVisible(true)}
          >
            <MaterialCommunityIcons name="brush" size={22} color="#000" />
            <Text style={{ marginLeft: 6, color: "#000", fontWeight: "bold" }}>Escolher Template</Text>
          </TouchableOpacity>
        </Animatable.View>
      </View>
    );
  }

  // ======================
  // LAYOUT PRINCIPAL
  // ======================
  if (loading) {
    return (
      <Animated.View style={[styles.loaderContainer, { backgroundColor: interpolatedBG }]}>
        <ActivityIndicator size="large" color={RED} />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.mainContainer, { backgroundColor: interpolatedBG }]}>
      {/* NPC Aleatório */}
      {showNpc && (
        <View style={styles.npcBanner}>
          <Text style={styles.npcBannerText}>{npcText}</Text>
          <TouchableOpacity
            style={styles.npcClose}
            onPress={() => setShowNpc(false)}
          >
            <Ionicons name="close-circle" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Modais de Temporada e AvatarModal agora importados */}
      <SeasonModal
        visible={seasonModalVisible}
        onClose={() => setSeasonModalVisible(false)}
        currentLevel={level}
        currentXp={xp}
        xpForNextLevel={xpNextLevel}
        seasonName="Temporada dos Dragões"
      />

      <AvatarModal
        visible={avatarModalVisible}
        onClose={() => setAvatarModalVisible(false)}
        currentAvatarId={
          // Tentando descobrir ID no array original:
          (() => {
            const found = avatarList.find((x) => x.uri === selectedAvatar);
            return found?.id || 1;
          })()
        }
        onSelectAvatar={async (avatarId) => {
          const found = avatarList.find((av) => av.id === avatarId);
          if (found) {
            setSelectedAvatar(found.uri);
            await AsyncStorage.setItem("@userAvatar", avatarId.toString());
            if (userId) {
              await updatePlayerAvatar(userId, avatarId);
            }
          }
        }}
        avatarsList={avatarList.map((av) => ({
          ...av,
          requiredXp: av.id > 3 ? av.id * 200 : 0, // Exemplo de XP base
        }))}
        userXp={xp}
      />

      <TitlesModal
        visible={titlesModalVisible}
        onClose={() => setTitlesModalVisible(false)}
        titles={unlockedTitles}
      />
      <HistoryModal
        visible={historyModalVisible}
        onClose={() => setHistoryModalVisible(false)}
        userId={userId}
      />
      <TemplateModal
        visible={templateModalVisible}
        onClose={() => setTemplateModalVisible(false)}
        unlockedTitles={unlockedTitles}
        onSelectTemplate={async (templateId) => {
          setSelectedTemplateId(templateId);
          if (userId) {
            await AsyncStorage.setItem("@userTemplateId", templateId.toString());
            await updatePlayerTemplate(userId, templateId);
          }
        }}
        currentTemplateId={selectedTemplateId}
      />

      <Modal
        visible={confrontModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setConfrontModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confrontModalContainer}>
            {confrontStats ? (
              <>
                {confrontTemplate && (
                  <View style={[styles.confrontTemplate, confrontTemplate.containerStyle || {}]}>
                    <FontAwesome5
                      name={confrontTemplate.iconName}
                      size={confrontTemplate.iconSize || 32}
                      color={confrontTemplate.iconColor}
                    />
                  </View>
                )}
                <Text style={styles.confrontName}>{confrontName}</Text>
                <Image
                  source={confrontAvatar || require("../../assets/images/avatar/image.jpg")}
                  style={[styles.confrontAvatar, { borderColor: RED }]}
                />
                <View style={styles.confrontStatsRow}>
                  <View style={styles.confrontStatBox}>
                    <Ionicons name="trophy" size={20} color="#E3350D" />
                    <Text style={styles.confrontLabel}>Vitórias (Você)</Text>
                    <Text style={styles.confrontValue}>{confrontStats.userWins}</Text>
                  </View>
                  <View style={styles.confrontStatBox}>
                    <Ionicons name="sad" size={20} color="#FFF" />
                    <Text style={styles.confrontLabel}>Derrotas (Você)</Text>
                    <Text style={styles.confrontValue}>{confrontStats.userLosses}</Text>
                  </View>
                  <View style={styles.confrontStatBox}>
                    <Ionicons name="hand-left" size={20} color="#f5a623" />
                    <Text style={styles.confrontLabel}>Empates</Text>
                    <Text style={styles.confrontValue}>{confrontStats.userDraws}</Text>
                  </View>
                </View>
                <Text style={styles.confrontMatches}>
                  Partidas Totais: {confrontStats.matches}
                </Text>
              </>
            ) : (
              <ActivityIndicator size="large" color={RED} />
            )}
            <TouchableOpacity
              style={styles.confrontCloseBtn}
              onPress={() => setConfrontModalVisible(false)}
            >
              <Text style={{ color: "#FFF", fontWeight: "bold" }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Header com search oculta (atualmente desativado, mas mantido) */}
      <View style={styles.header}>
        {searchIconVisible && false && (
          <TouchableOpacity style={{ marginRight: 12 }} onPress={handleToggleSearch}>
            <Ionicons name="search" size={24} color="#fff" />
          </TouchableOpacity>
        )}
        {searchOpen && (
          <Animated.View
            style={[
              styles.searchContainer,
              {
                width: searchBarWidth.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "70%"],
                }),
              },
            ]}
          >
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar jogador..."
              placeholderTextColor="#999"
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={handleSearchPlayers}
            />
          </Animated.View>
        )}
      </View>

      {searchOpen && playersResult.length > 0 && (
        <TouchableWithoutFeedback onPress={() => closeSearchOverlay()}>
          <View style={styles.searchOverlay}>
            <View style={styles.searchResultBox}>
              {playerSearchLoading && <ActivityIndicator size="small" color={RED} />}
              {!playerSearchLoading &&
                playersResult.map((pl) => (
                  <TouchableOpacity
                    key={pl.userid}
                    style={styles.searchItem}
                    onPress={() => {
                      handleCheckConfronto(pl.userid, pl.fullname);
                      closeSearchOverlay();
                    }}
                  >
                    <Text style={{ color: WHITE }}>{pl.fullname}</Text>
                  </TouchableOpacity>
                ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      )}

      {/* SCROLLVIEW HORIZONTAL PARA SWIPE ENTRE SEÇÕES */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
      >
        {renderProfileSection()}
        {renderCustomizationSection()}
      </ScrollView>

      {/* Dots de navegação */}
      <View style={styles.dotsContainer}>
        <TouchableOpacity
          style={[styles.dot, activePage === 0 && styles.dotActive]}
          onPress={() => goToPage(0)}
        />
        <TouchableOpacity
          style={[styles.dot, activePage === 1 && styles.dotActive]}
          onPress={() => goToPage(1)}
        />
      </View>
    </Animated.View>
  );
}

// ======================
// ESTILOS
// ======================
const DARK_BG = "#1E1E1E";
const RED = "#E3350D";
const WHITE = "#FFFFFF";

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  // NPC Banner
  npcBanner: {
    backgroundColor: "#333",
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  npcBannerText: {
    color: "#FFF",
    fontSize: 14,
    fontStyle: "italic",
  },
  npcClose: {
    marginLeft: 8,
  },
  header: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchContainer: {
    backgroundColor: "#292929",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4D4D4D",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    overflow: "hidden",
  },
  searchInput: {
    color: WHITE,
    fontSize: 14,
    width: "100%",
    paddingVertical: 4,
  },
  searchOverlay: {
    position: "absolute",
    top: 68,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  searchResultBox: {
    marginHorizontal: 16,
    backgroundColor: "#292929",
    borderRadius: 8,
    padding: 8,
  },
  searchItem: {
    backgroundColor: "#444",
    borderRadius: 6,
    padding: 8,
    marginVertical: 4,
  },
  // PÁGINA DE PERFIL
  playerCard: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 2,
    padding: 20,
    alignItems: "center",
  },
  templateIconContainer: {
    position: "absolute",
    top: 12,
    right: 12,
  },
  playerName: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 6,
    textAlign: "center",
  },
  levelBadge: {
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  levelBadgeText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginVertical: 14,
    backgroundColor: "#000",
  },
  playerMessage: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 14,
    textAlign: "center",
  },
  xpContainer: {
    marginBottom: 12,
    alignItems: "center",
  },
  xpText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  xpBar: {
    width: 200,
    height: 10,
    backgroundColor: "#444",
    borderRadius: 5,
    marginTop: 4,
    overflow: "hidden",
  },
  xpFill: {
    height: "100%",
    backgroundColor: "#E3350D",
  },
  statsRow: {
    flexDirection: "row",
    marginVertical: 6,
    justifyContent: "space-around",
    width: "100%",
  },
  statBox: {
    alignItems: "center",
    flex: 1,
    marginVertical: 6,
  },
  statLabel: {
    fontSize: 14,
    marginTop: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
  },
  recommendationCard: {
    backgroundColor: "#444",
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
    width: "100%",
    position: "relative",
  },
  recommendationText: {
    color: "#fff",
    fontStyle: "italic",
    textAlign: "center",
  },
  closeRecommendation: {
    position: "absolute",
    top: 6,
    right: 6,
  },
  titlesButton: {
    borderWidth: 1,
    borderColor: "#FFFFFF",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 20,
  },
  titlesButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  newTitleBadge: {
    backgroundColor: RED,
    borderRadius: 10,
    marginLeft: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  newTitleBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  historyButton: {
    borderWidth: 1,
    borderColor: "#FFFFFF",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 10,
  },
  historyButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  seasonButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 10,
    justifyContent: "center",
  },
  seasonButtonText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 6,
  },
  // SEÇÃO DE CUSTOMIZAÇÃO
  sectionTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  customLabel: {
    color: "#CCC",
    fontSize: 14,
    marginTop: 8,
  },
  customBox: {
    backgroundColor: "#333",
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
    marginTop: 4,
  },
  customInput: {
    color: "#FFF",
    fontSize: 14,
  },
  toggleTactileButton: {
    backgroundColor: "#555",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 12,
  },
  templateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  // MODAIS GENÉRICOS
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#292929",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#4D4D4D",
    maxHeight: "85%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    color: "#FFF",
  },
  closeModalBtn: {
    backgroundColor: RED,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignSelf: "center",
    marginTop: 10,
  },
  closeModalText: {
    color: WHITE,
    fontWeight: "bold",
    fontSize: 14,
  },
  avatarChoice: {
    margin: 8,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#4D4D4D",
  },
  avatarImage: {
    width: 80,
    height: 80,
  },
  // Confronto
  confrontModalContainer: {
    backgroundColor: "#292929",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4D4D4D",
    padding: 16,
    width: "90%",
    alignItems: "center",
  },
  confrontTemplate: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#555",
  },
  confrontName: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  confrontAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    marginBottom: 16,
  },
  confrontStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginVertical: 6,
  },
  confrontStatBox: {
    backgroundColor: "#444",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
    width: "30%",
  },
  confrontLabel: {
    color: "#CCC",
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  confrontValue: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 4,
  },
  confrontMatches: {
    color: "#CCC",
    fontSize: 14,
    marginTop: 8,
  },
  confrontCloseBtn: {
    backgroundColor: RED,
    borderRadius: 6,
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  // SWIPE DOTS
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#666",
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: "#FFF",
  },
  // MODAL DE TEMPORADA
  seasonModalContent: {
    backgroundColor: "#292929",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4D4D4D",
    width: "90%",
    maxHeight: "85%",
    padding: 16,
    alignItems: "center",
  },
  seasonModalTitle: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
  },
  seasonModalSubtitle: {
    color: "#CCC",
    fontSize: 14,
    marginBottom: 16,
  },
  towerScroll: {
    width: "100%",
    marginBottom: 16,
  },
  towerLevelContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#444",
    marginVertical: 4,
    padding: 8,
    borderRadius: 8,
  },
  towerLevelText: {
    color: "#FFF",
    marginLeft: 8,
  },
  closeSeasonBtn: {
    backgroundColor: RED,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeSeasonBtnText: {
    color: "#FFF",
    fontWeight: "bold",
  },
});
