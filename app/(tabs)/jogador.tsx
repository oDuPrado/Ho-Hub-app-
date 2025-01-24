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
  getDocs,
  collectionGroup,
  collection,
} from "firebase/firestore";

import { db } from "../../lib/firebaseConfig";
import titles, { TitleItem, PlayerStats } from "../titlesConfig";
import templates from "../templatesConfig";
import TitlesModal from "../../components/TitlesModal";
import HistoryModal from "../../components/HistoryModal";
import TemplateModal from "../../components/TemplateModal";

import { Ionicons } from "@expo/vector-icons";
import { FontAwesome5 } from "@expo/vector-icons";

/** Estrutura p/ dados de partidas. */
interface MatchData {
  id: string;
  outcomeNumber?: number;
  player1_id?: string;
  player2_id?: string;
}

/** Estrutura p/ histórico de torneios (subcoleção places). */
export interface TournamentHistoryItem {
  tournamentId: string;
  tournamentName: string;
  place: number;
  totalPlayers: number;
  roundCount: number;
}

/** Estrutura p/ dados de jogador ao buscar no Firestore. */
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
}

// Lista de avatares exemplo
const avatarList = [
  { id: 1, uri: require("../../assets/images/avatar/avatar1.jpg") },
  { id: 2, uri: require("../../assets/images/avatar/avatar2.jpg") },
  { id: 3, uri: require("../../assets/images/avatar/avatar3.jpg") },
  { id: 4, uri: require("../../assets/images/avatar/avatar4.jpg") },
];

export default function PlayerScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("Jogador");
  const [loading, setLoading] = useState(true);

  // STATS
  const [stats, setStats] = useState<PlayerStats>({
    wins: 0,
    losses: 0,
    draws: 0,
    matchesTotal: 0,
    tournamentsPlayed: 0,
    top8Count: 0,
    positiveStreak: 0,
    negativeStreak: 0,
    uniqueOpponents: 0,
    comebackWins: 0,
    flawlessTournamentWins: 0,
    regionalWins: 0,
    bigTournamentWins: 0,
    helpedBeginners: 0,
    luckyWins: 0,
    memeDeckWins: 0,
    matchesAfterMidnight: 0,
    matchesAfterMidnightWins: 0,
    ownedTitlesCount: 0,
    beatAllPlayersInTournament: 0,
    firstTournamentWinner: false,
    firstAchieved: false,
  });
  const [currentStreak, setCurrentStreak] = useState<string>("Sem Streak");

  // TÍTULOS
  const [unlockedTitles, setUnlockedTitles] = useState<TitleItem[]>([]);
  const [titlesModalVisible, setTitlesModalVisible] = useState(false);

  // HISTÓRICO
  const [historyModalVisible, setHistoryModalVisible] = useState(false);

  // RIVALIDADE
  const [rivalModalVisible, setRivalModalVisible] = useState(false);
  const [rivalData, setRivalData] = useState<RivalryData | null>(null);

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

  // Animação do ícone épico (se estiver em template épico)
  const epicIconSpin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Se for épico, faz girar
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

        // Carrega userId e userName do AsyncStorage
        const storedId = await AsyncStorage.getItem("@userId");
        const storedName = await AsyncStorage.getItem("@userName");
        if (!storedId) {
          // Se não houver userId, manda login
          router.replace("/(auth)/login");
          return;
        }
        setUserId(storedId);
        setUserName(storedName ?? "Jogador");

        // Carrega avatar selecionado
        const storedAvatar = await AsyncStorage.getItem("@userAvatar");
        if (storedAvatar) {
          const avId = parseInt(storedAvatar, 10);
          const found = avatarList.find((av) => av.id === avId);
          if (found) setSelectedAvatar(found.uri);
        }

        // Carrega template selecionado
        const storedTemplateId = await AsyncStorage.getItem("@userTemplateId");
        if (storedTemplateId) {
          setSelectedTemplateId(parseInt(storedTemplateId, 10));
        }

        // Carrega partidas do usuário
        const allMatches = await fetchAllMatches();
        const userMatches = allMatches.filter(
          (m) => m.player1_id === storedId || m.player2_id === storedId
        );

        // Calcula stats
        const computedStats = computeBasicStats(storedId, userMatches);
        setStats(computedStats);

        // Calcula streak
        const cStreak = computeCurrentStreak(storedId, userMatches);
        setCurrentStreak(cStreak);

        // Títulos
        const titlesUnlocked = computeTitles(computedStats);
        // Marca unlocked
        const enriched = titles.map((t) => ({
          ...t,
          unlocked: titlesUnlocked.some((tt) => tt.id === t.id),
        }));
        setUnlockedTitles(enriched);
      } catch (err) {
        console.log("Erro init Player:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // =======================================
  // FUNÇÕES DE PARTIDAS
  // =======================================
  async function fetchAllMatches(): Promise<MatchData[]> {
    const snap = await getDocs(collectionGroup(db, "matches"));
    const arr: MatchData[] = [];
    snap.forEach((docSnap) => {
      arr.push({ id: docSnap.id, ...docSnap.data() } as MatchData);
    });
    return arr;
  }

  function computeBasicStats(uId: string, userMatches: MatchData[]): PlayerStats {
    let w = 0,
      l = 0,
      d = 0;
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
      ...stats,
      wins: w,
      losses: l,
      draws: d,
      matchesTotal: userMatches.length,
      uniqueOpponents: oppSet.size,
    };
  }

  function computeCurrentStreak(uId: string, userMatches: MatchData[]): string {
    if (userMatches.length === 0) return "Sem Streak";
    userMatches.sort((a, b) => (a.id < b.id ? -1 : 1));

    let streakCount = 0;
    let streakType: "win" | "loss" | null = null;

    for (let i = userMatches.length - 1; i >= 0; i--) {
      const mm = userMatches[i];
      if (!mm.outcomeNumber) break;
      const isP1 = mm.player1_id === uId;
      let matchResult: "win" | "loss" | "draw" = "draw";

      if (mm.outcomeNumber === 1) {
        matchResult = isP1 ? "win" : "loss";
      } else if (mm.outcomeNumber === 2) {
        matchResult = isP1 ? "loss" : "win";
      } else if (mm.outcomeNumber === 10) {
        matchResult = "loss";
      }

      if (i === userMatches.length - 1) {
        // última partida
        if (matchResult === "win") {
          streakType = "win";
          streakCount = 1;
        } else if (matchResult === "loss") {
          streakType = "loss";
          streakCount = 1;
        } else {
          return "Sem Streak";
        }
      } else {
        if (matchResult === streakType) {
          streakCount++;
        } else {
          break;
        }
      }
    }

    if (!streakType) return "Sem Streak";
    if (streakType === "win") return `${streakCount} Vitórias`;
    if (streakType === "loss") return `${streakCount} Derrotas`;
    return "Sem Streak";
  }

  function computeTitles(ps: PlayerStats): TitleItem[] {
    const result: TitleItem[] = [];
    for (let t of titles) {
      if (t.condition(ps)) {
        result.push(t);
      }
    }
    return result;
  }

  // =======================================
  // HISTÓRICO
  // =======================================
  const handleOpenHistory = () => {
    setHistoryModalVisible(true);
  };

  // =======================================
  // RIVAL
  // =======================================
  const handleCheckRival = async (userid: string, fullname: string) => {
    try {
      setRivalModalVisible(true);
      setRivalData(null);

      const allMatches = await fetchAllMatches();
      const userMatches = allMatches.filter(
        (m) => m.player1_id === userId || m.player2_id === userId
      );
      const direct = userMatches.filter(
        (m) =>
          (m.player1_id === userId && m.player2_id === userid) ||
          (m.player2_id === userId && m.player1_id === userid)
      );

      let w = 0,
        l = 0,
        d = 0;
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
      });
      closeSearchOverlay();
    } catch (err) {
      console.log("Erro handleCheckRival:", err);
      Alert.alert("Erro", "Falha ao calcular rivalidade.");
    }
  };

  // =======================================
  // PESQUISA
  // =======================================
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

  // =======================================
  // AVATAR
  // =======================================
  const defaultAvatar = require("../../assets/images/avatar/image.jpg");
  const currentAvatar = selectedAvatar || defaultAvatar;

  const handleSelectAvatar = async (avatarUri: any, avId: number) => {
    setSelectedAvatar(avatarUri);
    setAvatarModalVisible(false);
    // Salva no AsyncStorage
    await AsyncStorage.setItem("@userAvatar", avId.toString());
  };

  // =======================================
  // TEMPLATE
  // =======================================
  const handleSelectTemplate = async (templateId: number) => {
    setSelectedTemplateId(templateId);
    // Salva no AsyncStorage
    await AsyncStorage.setItem("@userTemplateId", templateId.toString());
  };

  const activeTemplate = templates.find((t) => t.id === selectedTemplateId);
  const fallbackTemplate = templates[0];
  const usedTemplate = activeTemplate || fallbackTemplate;

  // Estilos do template
  const templateStyle = usedTemplate.containerStyle || {};
  const textStyle = usedTemplate.textStyle || { color: "#FFFFFF" };

  // Animação do ícone
  const spin = epicIconSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // =======================================
  // RENDER
  // =======================================
  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={RED} />
      </View>
    );
  }

  const totalMatches = stats.matchesTotal;
  const wr = totalMatches > 0 ? ((stats.wins / totalMatches) * 100).toFixed(1) : "0";

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

      {/* MODAL RIVAL */}
      <Modal
        visible={rivalModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRivalModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: "90%" }]}>
            {rivalData ? (
              <>
                <Text style={[styles.modalTitle, { color: textStyle.color }]}>
                  Confronto vs {rivalData.rivalName}
                </Text>

                <View style={styles.rivalStatsContainer}>
                  <View style={[styles.rivalCard, { borderColor: "green" }]}>
                    <Text style={[styles.rivalCardLabel, { color: textStyle.color }]}>
                      Vitórias
                    </Text>
                    <Text style={[styles.rivalCardValue, { color: textStyle.color }]}>
                      {rivalData.wins}
                    </Text>
                  </View>
                  <View style={[styles.rivalCard, { borderColor: "red" }]}>
                    <Text style={[styles.rivalCardLabel, { color: textStyle.color }]}>
                      Derrotas
                    </Text>
                    <Text style={[styles.rivalCardValue, { color: textStyle.color }]}>
                      {rivalData.losses}
                    </Text>
                  </View>
                  <View style={[styles.rivalCard, { borderColor: "#ccc" }]}>
                    <Text style={[styles.rivalCardLabel, { color: textStyle.color }]}>
                      Empates
                    </Text>
                    <Text style={[styles.rivalCardValue, { color: textStyle.color }]}>
                      {rivalData.draws}
                    </Text>
                  </View>
                </View>

                <View style={styles.rivalStatsContainer}>
                  <View style={[styles.rivalCard, { borderColor: "#7f12ee" }]}>
                    <Text style={[styles.rivalCardLabel, { color: textStyle.color }]}>
                      Fator Rivalidade
                    </Text>
                    <Text style={[styles.rivalCardValue, { color: textStyle.color }]}>
                      {rivalData.rivalryFactor.toFixed(1)}%
                    </Text>
                  </View>
                  <View style={[styles.rivalCard, { borderColor: "#3d85c6" }]}>
                    <Text style={[styles.rivalCardLabel, { color: textStyle.color }]}>
                      Partidas Disputadas
                    </Text>
                    <Text style={[styles.rivalCardValue, { color: textStyle.color }]}>
                      {rivalData.matchesCount}
                    </Text>
                  </View>
                </View>

                <Pressable
                  style={styles.closeModalBtn}
                  onPress={() => setRivalModalVisible(false)}
                >
                  <Text style={styles.closeModalText}>Fechar</Text>
                </Pressable>
              </>
            ) : (
              <ActivityIndicator size="large" color={RED} />
            )}
          </View>
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

      {/* MODAL TEMPLATE */}
      <TemplateModal
        visible={templateModalVisible}
        onClose={() => setTemplateModalVisible(false)}
        unlockedTitles={unlockedTitles}
        onSelectTemplate={handleSelectTemplate}
        currentTemplateId={selectedTemplateId}
      />

      {/* HEADER - PESQUISA */}
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

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* CARD DO JOGADOR */}
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

          {/* ÍCONE DE ENGENHARIA (GEAR) para abrir TemplateModal */}
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
              <Text style={[styles.statValue, textStyle]}>{wr}%</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statLabel, textStyle]}>Streak</Text>
              <Text style={[styles.statValue, textStyle]}>{currentStreak}</Text>
            </View>
          </View>
        </View>

        {/* BOTÕES */}
        <TouchableOpacity
          style={[styles.titlesButton, { backgroundColor: "#000000" }]}
          onPress={() => setTitlesModalVisible(true)}
        >
          <Text style={styles.titlesButtonText}>Ver Títulos</Text>
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

// =======================================
// ESTILOS
// =======================================
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
  // Botões com estilo preto e branco
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
  },
  playerName: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
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
  },
  statLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
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
  rivalStatsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginVertical: 8,
  },
  rivalCard: {
    width: "40%",
    backgroundColor: CARD_BG,
    borderWidth: 2,
    borderRadius: 8,
    padding: 10,
    margin: 6,
    alignItems: "center",
  },
  rivalCardLabel: {
    marginBottom: 4,
  },
  rivalCardValue: {
    fontWeight: "bold",
    fontSize: 16,
  },
  avatarChoice: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: BORDER_COLOR,
    overflow: "hidden",
    margin: 8,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
});
