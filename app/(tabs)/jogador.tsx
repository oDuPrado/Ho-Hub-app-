//////////////////////////////////////
// ARQUIVO: PlayerScreen.tsx
//////////////////////////////////////
import React, { useEffect, useState, useRef, useCallback } from "react";
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
import { useRouter, useFocusEffect } from "expo-router";
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where
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

// Importamos do matchService
import {
  fetchAllMatches,
  fetchAllStatsByFilter,
  PlayerStatsData,
  MatchData,
} from "../../lib/matchService";

/** Estrutura p/ dados do jogador no Firestore. */
interface PlayerInfo {
  userid: string;
  fullname: string;
}

/** Estrutura p/ exibir stats de confronto contra outro jogador. */
interface ConfrontoStats {
  matches: number;
  userWins: number;
  userLosses: number;
  userDraws: number;
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

/** Mensagens de recomendação conforme stats */
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

  // Filtro (all, city, league)
  const [currentFilter, setCurrentFilter] = useState<string>("all");

  // MODAL de Confronto com outro jogador
  const [confrontModalVisible, setConfrontModalVisible] = useState(false);
  const [confrontStats, setConfrontStats] = useState<ConfrontoStats | null>(null);
  const [confrontName, setConfrontName] = useState("");
  const [confrontAvatar, setConfrontAvatar] = useState<any>(null);
  const [confrontTemplate, setConfrontTemplate] = useState<TemplateItem | null>(null);

  // Carrega dados ao focar tela
  useFocusEffect(
    useCallback(() => {
      loadPlayerData();
    }, [])
  );

  // =======================
  // Carrega dados do jogador
  // =======================
  const loadPlayerData = async () => {
    try {
      setLoading(true);
      const storedId = await AsyncStorage.getItem("@userId");
      const storedName = await AsyncStorage.getItem("@userName");
      if (!storedId) {
        router.replace("/(auth)/login");
        return;
      }
      setUserId(storedId);
      setUserName(storedName ?? "Jogador");

      // Avatar
      const storedAvatar = await AsyncStorage.getItem("@userAvatar");
      if (storedAvatar) {
        const avId = parseInt(storedAvatar, 10);
        const found = avatarList.find((av) => av.id === avId);
        if (found) setSelectedAvatar(found.uri);
      }

      // Template
      const storedTemplateId = await AsyncStorage.getItem("@userTemplateId");
      if (storedTemplateId) {
        setSelectedTemplateId(parseInt(storedTemplateId, 10));
      }

      // Filtro
      const fType = (await AsyncStorage.getItem("@filterType")) || "all";
      setCurrentFilter(fType);

      // Stats do backend
      const aggregated = await fetchAllStatsByFilter(storedId);
      const adaptedStats: PlayerStats = {
        wins: aggregated.wins,
        losses: aggregated.losses,
        draws: aggregated.draws,
        matchesTotal: aggregated.matchesTotal,
        uniqueOpponents: aggregated.opponentsList.length,
        tournamentPlacements: [],
      };
      setStats(adaptedStats);

      // Se for league, computa títulos
      if (fType === "league") {
        const userTitles = computeLocalTitles(adaptedStats);
        setUnlockedTitles(userTitles);
        if (userTitles.some((t) => t.unlocked)) {
          setNewTitleIndicator(true);
        }
      } else {
        // city ou all => sem títulos
        setUnlockedTitles([]);
        setNewTitleIndicator(false);
      }

      defineRecommendation(adaptedStats);
    } catch (err) {
      console.log("Erro init Player:", err);
      Alert.alert("Erro", "Não foi possível carregar seus dados.");
    } finally {
      setLoading(false);
    }
  };

  // =======================
  // Títulos
  // =======================
  function computeLocalTitles(ps: PlayerStats): TitleItem[] {
    return titles.map((t) => {
      const unlocked = t.condition(ps);
      return { ...t, unlocked };
    });
  }

  // =======================
  // Recomendação
  // =======================
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

  // =======================
  // Animação pro Template Épico
  // =======================
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

  // =======================
  // Salvar avatar/template
  // =======================
  async function updatePlayerAvatar(uId: string, avatarId: number) {
    try {
      await setDoc(doc(db, "players", uId), { avatarId }, { merge: true });
    } catch (error) {
      console.error("Erro ao salvar avatar:", error);
    }
  }

  async function updatePlayerTemplate(uId: string, templateId: number) {
    try {
      await setDoc(doc(db, "players", uId), { templateId }, { merge: true });
    } catch (error) {
      console.error("Erro ao salvar template:", error);
    }
  }

  // =======================
  // Barra de Pesquisa
  // =======================
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

  const handleSearchPlayers = async () => {
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
    } catch (err) {
      console.log("Erro handleSearchPlayers:", err);
      Alert.alert("Erro", "Falha na busca de jogadores.");
    } finally {
      setPlayerSearchLoading(false);
    }
  };

  async function fetchPlayersByFilter(searchTerm: string): Promise<PlayerInfo[]> {
    try {
      const filterType = await AsyncStorage.getItem("@filterType");
      const cityStored = await AsyncStorage.getItem("@selectedCity");
      const leagueStored = await AsyncStorage.getItem("@leagueId");
      const arr: PlayerInfo[] = [];

      if (!filterType || filterType === "all") {
        // Buscar em /players
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
    } catch (error) {
      console.error("Erro ao buscar jogadores pelo filtro:", error);
      return [];
    }
  }

  // =======================
  // Confronto: Exibir stats vs outro jogador
  // =======================
  async function handleCheckConfronto(opponentId: string, opponentName: string) {
    try {
      setConfrontModalVisible(true);
      setConfrontName(opponentName);
      setConfrontStats(null);
      setConfrontAvatar(null);
      setConfrontTemplate(null);

      // 1) Pega avatar/template do oponente
      // Observação: se você guarda em doc(db, "players", oppId), consulte lá
      // Se guarda em doc(db, "leagues/{id}/players"), precisa de outra lógica
      // Abaixo, supondo doc(db, "players", oppId):
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

      // 2) Pega todas as partidas do FILTRO
      const allMatches = await fetchAllMatches();
      // 3) Filtra as do user com esse oponente
      const direct = allMatches.filter((mm) => {
        if (!mm.outcomeNumber) return false;
        const isUser1 = mm.player1_id === userId && mm.player2_id === opponentId;
        const isUser2 = mm.player2_id === userId && mm.player1_id === opponentId;
        return isUser1 || isUser2;
      });

      // 4) Calcula vitórias/derrotas/empates
      let userW = 0,
        userL = 0,
        userD = 0;
      direct.forEach((mm) => {
        const isUserP1 = mm.player1_id === userId;
        if (mm.outcomeNumber === 1) {
          // P1 vence
          if (isUserP1) userW++;
          else userL++;
        } else if (mm.outcomeNumber === 2) {
          // P2 vence
          if (isUserP1) userL++;
          else userW++;
        } else if (mm.outcomeNumber === 3) {
          userD++;
        } else if (mm.outcomeNumber === 10) {
          // Derrota dupla
          userL++;
        }
      });
      const conf: ConfrontoStats = {
        matches: direct.length,
        userWins: userW,
        userLosses: userL,
        userDraws: userD,
      };
      setConfrontStats(conf);
    } catch (error) {
      console.error("Erro ao calcular confronto:", error);
      Alert.alert("Erro", "Não foi possível calcular o confronto.");
    }
  }

  // =======================
  // TÍTULOS
  // =======================
  const handleOpenTitles = () => {
    setTitlesModalVisible(true);
    setNewTitleIndicator(false);
  };

  // =======================
  // HISTÓRICO
  // =======================
  const handleOpenHistory = () => {
    setHistoryModalVisible(true);
  };

  // =======================
  // AVATAR / TEMPLATE
  // =======================
  const handleSelectAvatar = async (avatarUri: any, avId: number) => {
    setSelectedAvatar(avatarUri);
    setAvatarModalVisible(false);
    await AsyncStorage.setItem("@userAvatar", avId.toString());
    await updatePlayerAvatar(userId, avId);
  };

  const handleSelectTemplate = async (templateId: number) => {
    setSelectedTemplateId(templateId);
    await AsyncStorage.setItem("@userTemplateId", templateId.toString());
    await updatePlayerTemplate(userId, templateId);
  };

  // =======================
  // Layout final
  // =======================
  const activeTemplate = templates.find((t) => t.id === selectedTemplateId);
  const fallbackTemplate = templates[0];
  const usedTemplate = activeTemplate || fallbackTemplate;
  const templateStyle = usedTemplate.containerStyle || {};
  const textStyle = usedTemplate.textStyle || { color: "#FFFFFF" };

  const defaultAvatar = require("../../assets/images/avatar/image.jpg");
  const currentAvatar = selectedAvatar || defaultAvatar;

  const spin = epicIconSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const totalMatches = stats.matchesTotal;
  const wrValue = totalMatches > 0 ? ((stats.wins / totalMatches) * 100).toFixed(1) : "0";

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={RED} />
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
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
      {/* Modal do Avatar */}
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
            <Pressable style={styles.closeModalBtn} onPress={() => setAvatarModalVisible(false)}>
              <Text style={styles.closeModalText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal Template */}
      <TemplateModal
        visible={templateModalVisible}
        onClose={() => setTemplateModalVisible(false)}
        unlockedTitles={unlockedTitles}
        onSelectTemplate={handleSelectTemplate}
        currentTemplateId={selectedTemplateId}
      />

      {/* Modal de Confronto com outro jogador */}
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
                      size={32}
                      color={confrontTemplate.iconColor}
                    />
                  </View>
                )}
                <Text style={styles.confrontName}>{confrontName}</Text>
                <Image
                  source={confrontAvatar || defaultAvatar}
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

      {/* Header (Barra de Pesquisa) */}
      <View style={styles.header}>
      {searchIconVisible && false && ( // Adicionei "false" para desativar a exibição do ícone
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
                      // Ao clicar, mostra modal de confronto
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

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[styles.playerCard, templateStyle]}>
          <View style={styles.templateIconContainer}>
            {usedTemplate.hasEpicAnimation ? (
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <FontAwesome5 name={usedTemplate.iconName} size={32} color={usedTemplate.iconColor} />
              </Animated.View>
            ) : (
              <FontAwesome5 name={usedTemplate.iconName} size={32} color={usedTemplate.iconColor} />
            )}
          </View>
          <TouchableOpacity
            style={styles.gearIconContainer}
            onPress={() => setTemplateModalVisible(true)}
          >
            <Ionicons name="settings-sharp" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={[styles.playerName, textStyle]}>{userName}</Text>
          {usedTemplate.emblemImage && (
            <Text style={{ color: textStyle.color, marginBottom: 4 }}>
              [Emblema: {usedTemplate.emblemImage}]
            </Text>
          )}
          <TouchableOpacity onPress={() => setAvatarModalVisible(true)}>
            <Image source={currentAvatar} style={[styles.avatar, { borderColor: RED }]} />
          </TouchableOpacity>

          {/* Stats */}
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

// ---------------- ESTILOS RivalProfileCard ----------------
const DARK_BG = "#1E1E1E";
const CARD_BG = "#292929";
const BORDER_COLOR = "#4D4D4D";
const RED = "#E3350D";
const WHITE = "#FFFFFF";

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: DARK_BG },
  loaderContainer: { flex: 1, backgroundColor: DARK_BG, justifyContent: "center", alignItems: "center" },
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
  avatarChoice: {
    margin: 8,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: BORDER_COLOR,
  },
  avatarImage: {
    width: 80,
    height: 80,
  },

  // Modal de Confronto
  confrontModalContainer: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
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
});
