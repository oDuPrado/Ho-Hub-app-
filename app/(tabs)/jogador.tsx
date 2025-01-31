//////////////////////////////////////
// ARQUIVO: PlayerScreen.tsx
//////////////////////////////////////
import React, { useEffect, useState, useRef } from "react";
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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collectionGroup,
  collection,
} from "firebase/firestore";

import { db } from "../../lib/firebaseConfig";
import titles, { TitleItem, PlayerStats } from "../titlesConfig";
import templates, { TemplateItem } from "../templatesConfig";

import TitlesModal from "../../components/TitlesModal";
import HistoryModal from "../../components/HistoryModal";
import TemplateModal from "../../components/TemplateModal";

import * as Animatable from "react-native-animatable";
import { Ionicons } from "@expo/vector-icons";
import { FontAwesome5 } from "@expo/vector-icons";

/** Estrutura p/ dados de partidas. */
interface MatchData {
  id: string;
  outcomeNumber?: number;
  player1_id?: string;
  player2_id?: string;
}

/** Estrutura p/ dados do jogador no Firestore. */
interface PlayerInfo {
  userid: string;
  fullname: string;
}

/** Estrutura p/ rivalidade. */
interface RivalryData {
  matchesCount: number;
  wins: number;
  losses: number;
  draws: number;
  rivalryFactor: number;
  rivalName: string;
  rivalId: string;       // vamos guardar o ID
  rivalAvatarId: number; // avatar do rival
  rivalTemplateId: number; // template do rival
}

/** Lista de avatares exemplo */
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

/** Mensagens de recomendação (balão) conforme stats */
const recommendationMessages = {
  wins: [
    "Você está batendo mais que Machamp na academia!",
    "Vitórias em alta, continue assim! Quem vai te parar?",
    "Ninguém segura esse campeão... ou será que segura?"
  ],
  losses: [
    "Tá apanhando mais que um Magikarp fora d'água!",
    "Derrotas demais? Hora de rever o deck e suas estratégias!",
    "Faz parte perder... mas perder muito já é teimosia, hein?"
  ],
  draws: [
    "Empate? É... faltou um golpe final aí...",
    "Dois titãs colidiram, mas nenhum triunfou... Tente desempatar!",
    "Se tá empatando tanto, falta agressividade no deck ou sobrou azar?"
  ],
};

/** Streak icons */
const streakIcons = {
  empty: "help-circle",  // Ionicons
  win: "flame",
  loss: "rainy",
};

export default function PlayerScreen() {
  const router = useRouter();
  
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("Jogador");
  const [loading, setLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState<PlayerStats>({
    wins: 0,
    losses: 0,
    draws: 0,
    matchesTotal: 0,
    uniqueOpponents: 0,
    tournamentPlacements: [],
  });

  // Streak
  const [currentStreak, setCurrentStreak] = useState<string>("Sem Streak");
  const [streakType, setStreakType] = useState<"win"|"loss"|"empty">("empty");

  // TÍTULOS
  const [unlockedTitles, setUnlockedTitles] = useState<TitleItem[]>([]);
  const [titlesModalVisible, setTitlesModalVisible] = useState(false);
  const [newTitleIndicator, setNewTitleIndicator] = useState(false);

  // HISTÓRICO
  const [historyModalVisible, setHistoryModalVisible] = useState(false);

  // AVATAR
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<any>(null);

  // PESQUISA
  const [searchText, setSearchText] = useState("");
  const [playersResult, setPlayersResult] = useState<PlayerInfo[]>([]);
  const [playerSearchLoading, setPlayerSearchLoading] = useState(false);
  const [searchBarWidth] = useState(new Animated.Value(0));
  const [searchIconVisible, setSearchIconVisible] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  // TEMPLATE
  const [selectedTemplateId, setSelectedTemplateId] = useState<number>(1);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const epicIconSpin = useRef(new Animated.Value(0)).current;

  // Balão de recomendação
  const [showRecommendation, setShowRecommendation] = useState(true);
  const [recommendationText, setRecommendationText] = useState("");

  // RIVAL MODAL (mostrando perfil do rival)
  const [rivalModalVisible, setRivalModalVisible] = useState(false);
  const [rivalData, setRivalData] = useState<RivalryData | null>(null);

  // =============== EFEITOS ===============
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

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // Carrega user do AsyncStorage
        const storedId = await AsyncStorage.getItem("@userId");
        const storedName = await AsyncStorage.getItem("@userName");
        if (!storedId) {
          router.replace("/(auth)/login");
          return;
        }
        setUserId(storedId);
        setUserName(storedName ?? "Jogador");

        // Carrega avatar
        const storedAvatar = await AsyncStorage.getItem("@userAvatar");
        if (storedAvatar) {
          const avId = parseInt(storedAvatar, 10);
          const found = avatarList.find((av) => av.id === avId);
          if (found) setSelectedAvatar(found.uri);
        }

        // Carrega template
        const storedTemplateId = await AsyncStorage.getItem("@userTemplateId");
        if (storedTemplateId) {
          setSelectedTemplateId(parseInt(storedTemplateId, 10));
        }

        // Carrega partidas
        const allMatches = await fetchAllMatches();
        const userMatches = allMatches.filter(
          (m) => m.player1_id === storedId || m.player2_id === storedId
        );

        // Stats básicas
        const computedStats = computeBasicStats(storedId, userMatches);
        setStats(computedStats);

        // Streak
        const { streakString, streakT } = computeCurrentStreak(storedId, userMatches);
        setCurrentStreak(streakString);
        setStreakType(streakT);

        // Títulos
        const unlocked = computeTitles(computedStats);
        const enriched = titles.map((t) => ({
          ...t,
          unlocked: unlocked.some((tt) => tt.id === t.id),
        }));
        setUnlockedTitles(enriched);
        if (unlocked.length > 0) {
          setNewTitleIndicator(true);
        }

        // Recomendação
        defineRecommendation(computedStats);

      } catch (err) {
        console.log("Erro init Player:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // Atualiza o avatar do jogador no Firestore
async function updatePlayerAvatar(userId: string, avatarId: number) {
  try {
    console.log(`📤 Salvando avatarId (${avatarId}) para o usuário ${userId}...`);

    await setDoc(doc(db, "players", userId), { avatarId }, { merge: true });

    console.log(`✅ Avatar salvo com sucesso para ${userId}`);

    // Verifica se foi salvo corretamente
    const docSnap = await getDoc(doc(db, "players", userId));
    if (docSnap.exists()) {
      console.log(`🗂 Dados do Firestore após salvar avatar:`, docSnap.data());
    } else {
      console.warn(`⚠️ Documento do usuário ${userId} não encontrado após salvar avatar.`);
    }

  } catch (error) {
    console.error("❌ Erro ao salvar avatar:", error);
  }
}

// Atualiza o template do jogador no Firestore
async function updatePlayerTemplate(userId: string, templateId: number) {
  try {
    console.log(`📤 Salvando templateId (${templateId}) para o usuário ${userId}...`);

    await setDoc(doc(db, "players", userId), { templateId }, { merge: true });

    console.log(`✅ Template salvo com sucesso para ${userId}`);

    // Verifica se foi salvo corretamente
    const docSnap = await getDoc(doc(db, "players", userId));
    if (docSnap.exists()) {
      console.log(`🗂 Dados do Firestore após salvar template:`, docSnap.data());
    } else {
      console.warn(`⚠️ Documento do usuário ${userId} não encontrado após salvar template.`);
    }

  } catch (error) {
    console.error("❌ Erro ao salvar template:", error);
  }
}

  // ============ FUNÇÕES DE STATS ============
  async function fetchAllMatches(): Promise<MatchData[]> {
    const snap = await getDocs(collectionGroup(db, "matches"));
    const arr: MatchData[] = [];
    snap.forEach((docSnap) => {
      arr.push({ id: docSnap.id, ...docSnap.data() } as MatchData);
    });
    return arr;
  }

  function computeBasicStats(uId: string, userMatches: MatchData[]): PlayerStats {
    let w = 0, l = 0, d = 0;
    const oppSet = new Set<string>();

    userMatches.forEach((mm) => {
      if (!mm.outcomeNumber) return;
      const isP1 = mm.player1_id === uId;
      const rivalId = isP1 ? mm.player2_id : mm.player1_id;
      if (rivalId && rivalId !== "N/A") oppSet.add(rivalId);

      switch (mm.outcomeNumber) {
        case 1:
          isP1 ? w++ : l++;
          break;
        case 2:
          isP1 ? l++ : w++;
          break;
        case 3:
          d++;
          break;
        case 10:
          l++;
          break;
      }
    });

    return {
      wins: w,
      losses: l,
      draws: d,
      matchesTotal: userMatches.length,
      uniqueOpponents: oppSet.size,
      tournamentPlacements: [],
    };
  }

  function computeCurrentStreak(uId: string, userMatches: MatchData[]) {
    if (userMatches.length === 0) {
      return { streakString: "Sem Streak", streakT: "empty" as const };
    }
    userMatches.sort((a, b) => (a.id < b.id ? -1 : 1));

    let streakCount = 0;
    let sType: "win" | "loss" | null = null;

    for (let i = userMatches.length - 1; i >= 0; i--) {
      const mm = userMatches[i];
      if (!mm.outcomeNumber) break;
      const isP1 = mm.player1_id === uId;
      let matchResult: "win"|"loss"|"draw" = "draw";

      if (mm.outcomeNumber === 1) {
        matchResult = isP1 ? "win" : "loss";
      } else if (mm.outcomeNumber === 2) {
        matchResult = isP1 ? "loss" : "win";
      } else if (mm.outcomeNumber === 10) {
        matchResult = "loss";
      }

      if (i === userMatches.length - 1) {
        if (matchResult === "win") {
          sType = "win";
          streakCount = 1;
        } else if (matchResult === "loss") {
          sType = "loss";
          streakCount = 1;
        } else {
          return { streakString: "Sem Streak", streakT: "empty" as const };
        }
      } else {
        if (matchResult === sType) {
          streakCount++;
        } else {
          break;
        }
      }
    }

    if (!sType) {
      return { streakString: "Sem Streak", streakT: "empty" as const };
    }
    if (sType === "win" && streakCount >= 2) {
      return { streakString: `${streakCount} Vitórias`, streakT: "win" as const };
    } else if (sType === "loss" && streakCount >= 2) {
      return { streakString: `${streakCount} Derrotas`, streakT: "loss" as const };
    } else {
      return { streakString: "Sem Streak", streakT: "empty" as const };
    }
  }

  function computeTitles(ps: PlayerStats): TitleItem[] {
    const result: TitleItem[] = [];
    for (const t of titles) {
      if (t.condition(ps)) result.push(t);
    }
    return result;
  }

  function defineRecommendation(ps: PlayerStats) {
    let best = "wins";
    let maxValue = ps.wins;
    if (ps.losses > maxValue) {
      best = "losses";
      maxValue = ps.losses;
    }
    if (ps.draws > maxValue) {
      best = "draws";
      maxValue = ps.draws;
    }
    const arr = recommendationMessages[best as keyof typeof recommendationMessages];
    if (arr) {
      const text = arr[Math.floor(Math.random() * arr.length)];
      setRecommendationText(text);
    } else {
      setRecommendationText("Continue treinando e conquistando vitórias!");
    }
  }
  

  // ============ PESQUISA RIVAL + PERFIL ===============
  const handleSearchPlayers = async () => {
    if (!searchText.trim()) {
      Alert.alert("Busca", "Digite algo para buscar.");
      return;
    }
    try {
      setPlayerSearchLoading(true);
      const all = await getDocs(collection(db, "players"));
      const arr: PlayerInfo[] = [];
      all.forEach((ds) => {
        const d = ds.data();
        const full = d.fullname || ds.id;
        if (full.toLowerCase().includes(searchText.toLowerCase())) {
          arr.push({ userid: ds.id, fullname: full });
        }
      });
      setPlayersResult(arr);
      if (arr.length === 0) {
        Alert.alert("Busca", "Nenhum jogador encontrado.");
      }
    } catch (err) {
      console.log("Erro handleSearchPlayers:", err);
      Alert.alert("Erro", "Falha na busca de jogadores.");
    } finally {
      setPlayerSearchLoading(false);
    }
  };

  const handleToggleSearch = () => {
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
  };

  const closeSearchOverlay = () => {
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
  };

  /**
   * handleCheckRival: abre modal do rival, mas agora mostra o card de "perfil do rival"
   * com estatísticas de Rivalidade.
   */
  const handleCheckRival = async (userid: string, fullname: string) => {
    try {
      setRivalModalVisible(true);
      setRivalData(null);

      // Buscar avatarId, templateId do rival
      const docRef = doc(db, "players", userid);
      const docSnap = await getDoc(docRef);
      let rivalAvatarId = 1;
      let rivalTemplateId = 1;
      if (docSnap.exists()) {
        const dd = docSnap.data();
        if (dd.avatarId) rivalAvatarId = dd.avatarId;
        if (dd.templateId) rivalTemplateId = dd.templateId;
      }

      // Buscar matches p/ calcular Rivalidade
      const allMatches = await fetchAllMatches();
      const userMatches = allMatches.filter(
        (m) => m.player1_id === userId || m.player2_id === userId
      );
      const direct = userMatches.filter(
        (m) =>
          (m.player1_id === userId && m.player2_id === userid) ||
          (m.player2_id === userId && m.player1_id === userid)
      );

      let w = 0, l = 0, d = 0;
      direct.forEach((mm) => {
        if (!mm.outcomeNumber) return;
        const isP1 = mm.player1_id === userId;
        switch (mm.outcomeNumber) {
          case 1:
            isP1 ? w++ : l++;
            break;
          case 2:
            isP1 ? l++ : w++;
            break;
          case 3:
            d++;
            break;
          case 10:
            l++;
            break;
        }
      });

      const matchesEntreEles = direct.length;
      const totalMatchesUser = userMatches.length;
      const rivalryFactor = 100 * (matchesEntreEles / (totalMatchesUser + 1));

      setRivalData({
        matchesCount: matchesEntreEles,
        wins: w,
        losses: l,
        draws: d,
        rivalryFactor,
        rivalName: fullname,
        rivalId: userid,
        rivalAvatarId,
        rivalTemplateId,
      });
      closeSearchOverlay();
    } catch (err) {
      console.log("Erro handleCheckRival:", err);
      Alert.alert("Erro", "Falha ao calcular rivalidade.");
    }
  };

  // ============ AVATAR + TEMPLATE ============
  const defaultAvatar = require("../../assets/images/avatar/image.jpg");
  const currentAvatar = selectedAvatar || defaultAvatar;

  const handleSelectAvatar = async (avatarUri: any, avId: number) => {
    setSelectedAvatar(avatarUri);
    setAvatarModalVisible(false);
    await AsyncStorage.setItem("@userAvatar", avId.toString());
  
    // Salva no Firestore
    await updatePlayerAvatar(userId, avId);
  };
  

  const handleSelectTemplate = async (templateId: number) => {
    setSelectedTemplateId(templateId);
    await AsyncStorage.setItem("@userTemplateId", templateId.toString());
  
    // Salva no Firestore
    await updatePlayerTemplate(userId, templateId);
  };
  
  const activeTemplate = templates.find((t) => t.id === selectedTemplateId);
  const fallbackTemplate = templates[0];
  const usedTemplate = activeTemplate || fallbackTemplate;
  const templateStyle = usedTemplate.containerStyle || {};
  const textStyle = usedTemplate.textStyle || { color: "#FFFFFF" };

  const spin = epicIconSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // ============ MODAIS ============
  const handleOpenTitles = () => {
    setTitlesModalVisible(true);
    setNewTitleIndicator(false);
  };

  const handleOpenHistory = () => {
    setHistoryModalVisible(true);
  };

  // ============ RENDER ============
  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={RED} />
      </View>
    );
  }

  const totalMatches = stats.matchesTotal;
  const wrValue = totalMatches > 0 ? ((stats.wins / totalMatches) * 100).toFixed(1) : "0";

  // Icône do streak
  const streakIconName = streakIcons[streakType];

  return (
    <View style={styles.mainContainer}>
      {/* MODAL TÍTULOS */}
      <TitlesModal
        visible={titlesModalVisible}
        onClose={() => setTitlesModalVisible(false)}
        titles={unlockedTitles}
      />

      {/* MODAL HISTÓRICO */}
      <HistoryModal
        visible={historyModalVisible}
        onClose={() => setHistoryModalVisible(false)}
        userId={userId}
      />

      {/* MODAL RIVAL (exibe perfil do Rival com template e avatar) */}
      <Modal
        visible={rivalModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRivalModalVisible(false)}
      >
        <View style={styles.rivalModalOverlay}>
          {rivalData ? (
            <RivalProfileCard
              rivalData={rivalData}
              onClose={() => setRivalModalVisible(false)}
            />
          ) : (
            <ActivityIndicator size="large" color={RED} />
          )}
        </View>
      </Modal>

      {/* MODAL AVATAR */}
      <Modal
        visible={avatarModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: "90%" }]}>
            <Text style={[styles.modalTitle, { color: textStyle.color }]}>
              Selecione um Avatar
            </Text>
            <ScrollView contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap" }}>
              {avatarList.map((av) => (
                <TouchableOpacity
                  key={av.id}
                  style={styles.avatarChoice}
                  onPress={() => handleSelectAvatar(av.uri, av.id)}
                >
                  <Image source={av.uri} style={styles.avatarImage} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Pressable
              style={styles.closeModalBtn}
              onPress={() => setAvatarModalVisible(false)}
            >
              <Text style={styles.closeModalText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* TEMPLATE MODAL */}
      <TemplateModal
        visible={templateModalVisible}
        onClose={() => setTemplateModalVisible(false)}
        unlockedTitles={unlockedTitles}
        onSelectTemplate={handleSelectTemplate}
        currentTemplateId={selectedTemplateId}
      />

      {/* HEADER PESQUISA */}
      <View style={styles.header}>
        {searchIconVisible && (
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

      {/* LISTA RESULTADOS SOBREPOSTA */}
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
                    onPress={() => handleCheckRival(pl.userid, pl.fullname)}
                  >
                    <Text style={{ color: WHITE }}>{pl.fullname}</Text>
                  </TouchableOpacity>
                ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      )}

      {/* CONTEÚDO PRINCIPAL */}
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* CARD DO JOGADOR com template */}
        <View style={[styles.playerCard, templateStyle]}>
          {/* ÍCONE do template (épico gira) */}
          <View style={styles.templateIconContainer}>
            {usedTemplate.hasEpicAnimation ? (
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <FontAwesome5
                  name={usedTemplate.iconName}
                  size={32}
                  color={usedTemplate.iconColor}
                />
              </Animated.View>
            ) : (
              <FontAwesome5
                name={usedTemplate.iconName}
                size={32}
                color={usedTemplate.iconColor}
              />
            )}
          </View>

          {/* ÍCONE DE ENGENHARIA (GEAR) */}
          <TouchableOpacity
            style={styles.gearIconContainer}
            onPress={() => setTemplateModalVisible(true)}
          >
            <Ionicons name="settings-sharp" size={24} color="#000000" />
          </TouchableOpacity>

          <Text style={[styles.playerName, textStyle]}>{userName}</Text>

          {/* Emblema se houver */}
          {usedTemplate.emblemImage && (
            <Text style={{ color: textStyle.color, marginBottom: 4 }}>
              [Emblema: {usedTemplate.emblemImage}]
            </Text>
          )}

          {/* Avatar */}
          <TouchableOpacity onPress={() => setAvatarModalVisible(true)}>
            <Image source={currentAvatar} style={[styles.avatar, { borderColor: RED }]} />
          </TouchableOpacity>

          {/* STREAK ANIMAÇÃO */}
          <Animatable.View
            style={styles.streakContainer}
            animation="pulse"
            iterationCount="infinite"
            duration={2000}
          >
            <Ionicons
              name={streakIconName as keyof typeof Ionicons.glyphMap}
              size={30}
              color={streakType === "win" ? "#00D840" : streakType === "loss" ? "#F44336" : "#999"}
            />
            <Text style={[styles.streakText, textStyle]}>{currentStreak}</Text>
          </Animatable.View>

          {/* STATS ROW */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, textStyle]}>Vitórias</Text>
              <Text style={[styles.statValue, textStyle]}>{stats.wins}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, textStyle]}>Derrotas</Text>
              <Text style={[styles.statValue, textStyle]}>{stats.losses}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, textStyle]}>Empates</Text>
              <Text style={[styles.statValue, textStyle]}>{stats.draws}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, textStyle]}>Partidas</Text>
              <Text style={[styles.statValue, textStyle]}>{stats.matchesTotal}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, textStyle]}>WinRate</Text>
              <Text style={[styles.statValue, textStyle]}>{wrValue}%</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, textStyle]}>Oponentes</Text>
              <Text style={[styles.statValue, textStyle]}>{stats.uniqueOpponents}</Text>
            </View>
          </View>

          {/* BALÃO DE RECOMENDAÇÃO */}
          {showRecommendation && (
            <Animatable.View animation="fadeInUp" style={styles.recommendationCard}>
              <Text style={styles.recommendationText}>{recommendationText}</Text>
              <TouchableOpacity
                style={styles.closeRecommendation}
                onPress={() => setShowRecommendation(false)}
              >
                <Ionicons name="close-circle" size={24} color="#FFF" />
              </TouchableOpacity>
            </Animatable.View>
          )}
        </View>

        {/* BOTÕES */}
        <TouchableOpacity
          style={[styles.titlesButton, { backgroundColor: "#000000" }]}
          onPress={handleOpenTitles}
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
          style={[styles.historyButton, { backgroundColor: "#000000" }]}
          onPress={handleOpenHistory}
        >
          <Text style={styles.historyButtonText}>Ver Histórico de Torneios</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ============ SUBCOMPONENTE: RivalProfileCard =============
function RivalProfileCard({
  rivalData,
  onClose,
}: {
  rivalData: RivalryData;
  onClose: () => void;
}) {
  // Pega avatar e template do rival
  const rivalAvatar = avatarList.find((a) => a.id === rivalData.rivalAvatarId)?.uri;
  const rivalTemplate: TemplateItem =
    templates.find((t) => t.id === rivalData.rivalTemplateId) || templates[0];

  // Container e text style do rival
  const containerStyle = rivalTemplate.containerStyle;
  const textStyle = rivalTemplate.textStyle || { color: "#FFFFFF" };

  return (
    <View style={[stylesRival.profileContainer]}>
      <View style={[stylesRival.rivalCard, containerStyle]}>
        <Text style={[stylesRival.rivalName, textStyle]}>
          {rivalData.rivalName}
        </Text>

        {/* Avatar do Rival */}
        <Image
          source={rivalAvatar || require("../../assets/images/avatar/image.jpg")}
          style={[stylesRival.rivalAvatar, { borderColor: "#E3350D" }]}
        />

        {/* Estatísticas de Rivalidade em cards com icones */}
        <View style={stylesRival.statsRow}>
          <View style={stylesRival.statCard}>
            <Ionicons name="trophy" size={20} color="#00D840" />
            <Text style={[stylesRival.statLabel, textStyle]}>Vitórias</Text>
            <Text style={[stylesRival.statValue, textStyle]}>{rivalData.wins}</Text>
          </View>
          <View style={stylesRival.statCard}>
            <Ionicons name="skull" size={20} color="#F44336" />
            <Text style={[stylesRival.statLabel, textStyle]}>Derrotas</Text>
            <Text style={[stylesRival.statValue, textStyle]}>{rivalData.losses}</Text>
          </View>
          <View style={stylesRival.statCard}>
          <Ionicons name="thumbs-up" size={20} color="#f5a623" />
            <Text style={[stylesRival.statLabel, textStyle]}>Empates</Text>
            <Text style={[stylesRival.statValue, textStyle]}>{rivalData.draws}</Text>
          </View>
        </View>

        <View style={stylesRival.statsRow}>
          <View style={stylesRival.statCard}>
            <Ionicons name="flash" size={20} color="#E3350D" />
            <Text style={[stylesRival.statLabel, textStyle]}>Partidas</Text>
            <Text style={[stylesRival.statValue, textStyle]}>{rivalData.matchesCount}</Text>
          </View>
          <View style={stylesRival.statCard}>
            <Ionicons name="stats-chart" size={20} color="#FFC312" />
            <Text style={[stylesRival.statLabel, textStyle]}>WinRate</Text>
            <Text style={[stylesRival.statValue, textStyle]}>
              {((rivalData.wins / rivalData.matchesCount) * 100).toFixed(1)}%
            </Text>
          </View>
          <View style={stylesRival.statCard}>
            <Ionicons name="alert-circle" size={20} color="#7f12ee" />
            <Text style={[stylesRival.statLabel, textStyle]}>Fator Rival</Text>
            <Text style={[stylesRival.statValue, textStyle]}>
              {rivalData.rivalryFactor.toFixed(1)}%
            </Text>
          </View>
        </View>

        <TouchableOpacity style={stylesRival.closeBtn} onPress={onClose}>
          <Text style={stylesRival.closeBtnText}>Fechar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Estilos do Rival Profile
const stylesRival = StyleSheet.create({
  profileContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  rivalCard: {
    width: "90%",
    borderWidth: 2,
    borderColor: "#333",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  rivalName: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  rivalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginVertical: 6,
  },
  statCard: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
    width: 80,
  },
  statLabel: {
    marginTop: 2,
    fontSize: 12,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 2,
  },
  closeBtn: {
    marginTop: 20,
    backgroundColor: "#E3350D",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeBtnText: {
    color: "#FFF",
    fontWeight: "bold",
  },
});

// ============ ESTILOS GERAIS PLAYER SCREEN ============
const DARK_BG = "#1E1E1E";
const CARD_BG = "#292929";
const BORDER_COLOR = "#4D4D4D";
const RED = "#E3350D";
const WHITE = "#FFFFFF";

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: DARK_BG,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    marginTop: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchContainer: {
    backgroundColor: CARD_BG,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
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
    top: 80,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  searchResultBox: {
    marginHorizontal: 16,
    backgroundColor: CARD_BG,
    borderRadius: 8,
    padding: 8,
  },
  searchItem: {
    backgroundColor: "#444",
    borderRadius: 6,
    padding: 8,
    marginVertical: 4,
  },
  playerCard: {
    backgroundColor: CARD_BG,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    padding: 16,
    alignItems: "center",
    position: "relative",
    marginTop: 10,
  },
  templateIconContainer: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  gearIconContainer: {
    position: "absolute",
    top: 10,
    left: 10,
  },
  playerName: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 6,
    textAlign: "center",
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginVertical: 12,
    borderWidth: 2,
  },
  streakContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  streakText: {
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 5,
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
    marginBottom: 4,
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

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    maxHeight: "85%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
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

  rivalModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarChoice: {
    margin: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: BORDER_COLOR,
  },
  avatarImage: {
    width: 80,
    height: 80,
  },
});
