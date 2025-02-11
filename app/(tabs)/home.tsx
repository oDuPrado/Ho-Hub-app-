import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  ScrollView,
  Alert,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Animated,
  Linking,
  Modal,
  FlatList,
  LayoutAnimation,
  UIManager,
  Platform,
  Easing,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { auth, db } from "../../lib/firebaseConfig";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import * as Animatable from "react-native-animatable";
import { Audio } from "expo-av";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  // As outras imports se mantêm se quiser
} from "firebase/firestore";

// ===== Importamos Titles e Stats originais =====
import titles, { TitleItem, PlayerStats } from "../titlesConfig";

// ===== Importamos as funções novas de estatísticas/rival =====
import {
  fetchAllStatsByFilter, // ✅ Busca stats agregadas por filtro (liga/cidade/todas)
  fetchRivalByFilter,    // ✅ Busca rival do backend baseado no filtro
  RivalData as RivalBackendData,
  PlayerStatsData as PlayerStatsBackend,
} from "../../lib/matchService";

// Avatares e config UI
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

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ======= INTERFACES =======
// Aqui mantemos a interface RivalData usada no layout (só para o state)
interface RivalData {
  rivalId: string;
  rivalName: string;
  matches: number;
  userWins: number;
  rivalWins: number;
  lastWinner: "user" | "rival" | "empate" | null;
  wrPercentage: number;
}
interface TitleWithProgress extends TitleItem {
  progress: number;
  locked: boolean;
}

export default function HomeScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("Jogador");
  const [avatarUri, setAvatarUri] = useState<any>(null);

  // Stats do FRONT (mesmo shape que Titles e Stats pedem)
  const [stats, setStats] = useState<PlayerStats>({
    wins: 0,
    losses: 0,
    draws: 0,
    matchesTotal: 0,
    uniqueOpponents: 0,
    tournamentPlacements: [],
  });

  // Títulos
  const [closestTitles, setClosestTitles] = useState<TitleWithProgress[]>([]);

  // Rival (layout)
  const [rivalInfo, setRivalInfo] = useState<RivalData | null>(null);
  const [rivalModalVisible, setRivalModalVisible] = useState(false);

  const battleMusicRef = useRef<Audio.Sound | null>(null);

  // Modal Coleções
  const [collectionsModalVisible, setCollectionsModalVisible] = useState(false);
  const [validCollections, setValidCollections] = useState<any[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);

  // Modal de Filtro
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [showMosaicCities, setShowMosaicCities] = useState(false);
  const [showMosaicLeagues, setShowMosaicLeagues] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [fetchingLeagues, setFetchingLeagues] = useState(false);
  const [showAllLeagues, setShowAllLeagues] = useState(false);

  // Modal de Boas-Vindas
  const [welcomeModalVisible, setWelcomeModalVisible] = useState(false);

  // =============================
  // useEffect Inicial
  // =============================
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // 1) Pega userId e nome
        const storedId = await AsyncStorage.getItem("@userId");
        const storedName = await AsyncStorage.getItem("@userName");
        if (!storedId) {
          router.replace("/(auth)/login");
          return;
        }
        setUserId(storedId);
        setUserName(storedName || "Jogador");

        // Avatar
        const storedAvatar = await AsyncStorage.getItem("@userAvatar");
        if (storedAvatar) {
          const avId = parseInt(storedAvatar, 10);
          const found = avatarList.find((av) => av.id === avId);
          if (found) setAvatarUri(found.uri);
        }

        // Boas-vindas
        const showWelcome = await AsyncStorage.getItem("@showWelcomeModal");
        if (showWelcome === "true") {
          setWelcomeModalVisible(true);
          await AsyncStorage.removeItem("@showWelcomeModal");
        }

        // 3) Lê STATs AGREGADAS do backend (já somadas conforme o filtro)
        const aggregated = await fetchAllStatsByFilter(storedId);

        // Precisamos adaptar para o shape PlayerStats (usado no titles)
        const adaptedStats: PlayerStats = {
          wins: aggregated.wins,
          losses: aggregated.losses,
          draws: aggregated.draws,
          matchesTotal: aggregated.matchesTotal,
          uniqueOpponents: aggregated.opponentsList.length,
          tournamentPlacements: [],
        };
        setStats(adaptedStats);

        // Calcula títulos
        computeTitlesProgress(adaptedStats);

        // 4) Lê Rival do backend
        const backendRival = await fetchRivalByFilter(storedId);
        if (backendRival) {
          // converte RivalBackendData em RivalData local
          const newRival: RivalData = {
            rivalId: backendRival.rivalId,
            rivalName: backendRival.rivalName,
            matches: backendRival.matches,
            userWins: backendRival.userWins,
            rivalWins: backendRival.rivalWins,
            lastWinner: backendRival.lastWinner,
            wrPercentage: backendRival.wrPercentage,
          };
          await handleRivalDetection(newRival);
        } else {
          setRivalInfo(null);
        }
      } catch (err) {
        Alert.alert("Erro", "Não foi possível carregar dados.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // Música do Rival
  useEffect(() => {
    if (rivalModalVisible) {
      loadBattleMusic();
    } else {
      stopBattleMusic();
    }
  }, [rivalModalVisible]);

  // =============================
  // Funções para Títulos
  // =============================
  async function computeTitlesProgress(st: PlayerStats) {
    setIsCalculating(true);
    const all = titles.map((t) => {
      const locked = !t.condition(st);
      const progress = calcProgress(t, st);
      return { ...t, locked, progress };
    });
    const lockedOnly = all.filter((tw) => tw.locked);
    lockedOnly.sort((a, b) => b.progress - a.progress);
    const top3 = lockedOnly.slice(0, 3);
    setClosestTitles(top3);
    setIsCalculating(false);
  }

  function calcProgress(title: TitleItem, stats: PlayerStats): number {
    if (title.condition(stats)) return 1;
    let progress = 0;
    switch (title.id) {
      case 101:
        progress = stats.wins / 20;
        break;
      case 999:
        progress = stats.wins / 1;
        break;
      case 102:
        progress = stats.wins / 30;
        break;
      case 401:
        progress = stats.wins / 50;
        break;
      case 405:
        progress = stats.matchesTotal / 100;
        break;
      case 406:
        progress = stats.wins / 75;
        break;
      case 407:
        progress =
          (stats.tournamentPlacements?.filter((p) => p <= 3).length ?? 0) / 3;
        break;
      case 408:
        progress = stats.matchesTotal / 50;
        break;
      case 409:
        progress = stats.uniqueOpponents / 20;
        break;
      case 410:
        progress = stats.wins / 90;
        break;
      case 411:
        progress =
          (stats.tournamentPlacements?.filter((p) => p <= 3).length ?? 0) / 4;
        break;
      case 412:
        progress = stats.matchesTotal / 150;
        break;
      case 413:
        progress = stats.wins / 120;
        break;
      case 414:
        progress = Math.min(stats.losses / 10, stats.wins / 10);
        break;
      case 415:
        progress =
          (stats.tournamentPlacements?.filter((p) => p === 1).length ?? 0) / 2;
        break;
      default:
        progress = 0;
    }
    return Math.min(progress, 1);
  }

  // =============================
  // Funções para Rival (agora lendo do backend)
  // =============================
  async function handleRivalDetection(newRival: RivalData) {
    setRivalInfo(newRival);
    const oldRivalId = await AsyncStorage.getItem("@lastRivalId");
    if (oldRivalId !== newRival.rivalId) {
      setRivalModalVisible(true);
      await AsyncStorage.setItem("@lastRivalId", newRival.rivalId);
    }
  }

  function getRandomRivalPhrase(result: "user" | "rival" | "empate") {
    const phrases = {
      user: [
        "Tá voando, hein?! Venceu com estilo! 🚀🔥",
        "Foi um massacre! O rival nem viu de onde veio. 🎯😎",
        "Deu aula! O rival ainda tá tentando entender o que aconteceu. 📚😂",
        "Vitória confirmada! Dá até pra soltar aquele 'EZ'. 😏",
        "Boa! O rival já tá procurando tutorial no YouTube. 🎥😂",
      ],
      rival: [
        "Eita... levou aquela coça! Tenta de novo! 😂",
        "O rival mandou um 'GG EZ'... não vai deixar barato, né? 😡🔥",
        "Bom... pelo menos agora você sabe como perder com estilo. 😆",
        "Essa foi feia, hein... Mas é errando que se aprende! Ou não. 🤷‍♂️",
        "A derrota veio, mas o drama é opcional. Levanta e luta de novo! 🥋🔥",
      ],
      empate: [
        "Dois titãs colidiram... e ninguém venceu! ⚡🤜🤛",
        "Empate... Que tal um desempate pra ver quem é o verdadeiro campeão? 🏆",
        "Nada definido ainda! Próxima batalha decide tudo. 🔥",
        "Empate?! Dá pra aceitar isso? Bora revanche AGORA! 🤨",
        "Equilíbrio total! Um verdadeiro duelo de gigantes. 💥",
      ],
    };
    const chosen = phrases[result] || [];
    if (!chosen.length) return "Empate dramático!";
    return chosen[Math.floor(Math.random() * chosen.length)];
  }

  async function loadBattleMusic() {
    if (battleMusicRef.current) {
      return;
    }
    const { sound } = await Audio.Sound.createAsync(
      require("../../assets/images/sounds/battle_music.mp3"),
      { isLooping: true, volume: 1.0 }
    );
    battleMusicRef.current = sound;
    await battleMusicRef.current.playAsync();
  }

  async function stopBattleMusic() {
    if (battleMusicRef.current) {
      await battleMusicRef.current.stopAsync();
      await battleMusicRef.current.unloadAsync();
      battleMusicRef.current = null;
    }
  }

  // =============================
  // Botões no rodapé
  // =============================
  function handleLogout() {
    auth.signOut().then(() => {
      AsyncStorage.removeItem("@userId");
      AsyncStorage.removeItem("@userName");
      router.replace("/(auth)/login");
    });
  }

  function handleDonate() {
    const link = "https://picpay.me/marco.macedo10/0.5";
    Linking.openURL(link).catch(() => {});
  }

  // =============================
  // Modal de Coleções
  // =============================
  function handleOpenCollections() {
    setCollectionsModalVisible(true);
    fetchValidCollections();
  }

  async function fetchValidCollections() {
    setLoadingCollections(true);
    try {
      const response = await fetch("https://api.pokemontcg.io/v2/sets");
      const data = await response.json();
      if (data && data.data) {
        const validSets = data.data.filter(
          (set: any) => set.legalities?.standard === "Legal"
        );
        setValidCollections(validSets);
      }
    } catch (error) {
      console.log("Erro ao buscar coleções:", error);
    }
    setLoadingCollections(false);
  }

  function closeCollectionsModal() {
    setCollectionsModalVisible(false);
  }

  // =============================
  // Modal de Filtro
  // =============================
  function openFilterModal() {
    setFilterModalVisible(true);
    fetchCities();
  }

  function closeFilterModal() {
    setFilterModalVisible(false);
    setShowMosaicCities(false);
    setShowMosaicLeagues(false);
  }

  async function fetchCities() {
    try {
      setFetchingLeagues(true);
      const snapshot = await getDocs(collection(db, "leagues"));
      const citySet = new Set<string>();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.city) citySet.add(data.city);
      });
      setCities(Array.from(citySet));
    } catch (err) {
      console.log("Erro ao buscar cidades:", err);
    }
    setFetchingLeagues(false);
  }

  async function fetchLeaguesByCity(cityName: string) {
    try {
      setSelectedCity(cityName);
      setFetchingLeagues(true);
      const qCity = query(collection(db, "leagues"), where("city", "==", cityName));
      const citySnapshot = await getDocs(qCity);
      const leaguesList: any[] = [];
      citySnapshot.forEach((docSnap) => {
        leaguesList.push({ id: docSnap.id, ...docSnap.data() });
      });
      setLeagues(leaguesList);
    } catch (err) {
      console.log("Erro ao buscar ligas da cidade:", err);
    }
    setFetchingLeagues(false);
  }

  function handleSelectLeague(leagueId: string) {
    setSelectedLeagueId((prev) => (prev === leagueId ? "" : leagueId));
  }

  // Quando o usuário clica em SALVAR, refazemos a leitura das stats do backend,
  // e recalculamos Títulos, Rival etc.
  async function handleSaveFilter() {
    try {
      if (showAllLeagues) {
        await AsyncStorage.setItem("@filterType", "all");
        await AsyncStorage.removeItem("@selectedCity");
        await AsyncStorage.removeItem("@leagueId");
      } else if (selectedCity && !selectedLeagueId) {
        await AsyncStorage.setItem("@filterType", "city");
        await AsyncStorage.setItem("@selectedCity", selectedCity);
        await AsyncStorage.removeItem("@leagueId");
      } else if (selectedLeagueId) {
        await AsyncStorage.setItem("@filterType", "league");
        await AsyncStorage.setItem("@leagueId", selectedLeagueId);
        await AsyncStorage.removeItem("@selectedCity");
      } else {
        await AsyncStorage.setItem("@filterType", "all");
        await AsyncStorage.removeItem("@selectedCity");
        await AsyncStorage.removeItem("@leagueId");
      }

      setFilterModalVisible(false);
      setLoading(true);

      // =========== Lê stats agregadas de novo ===========
      const aggregated = await fetchAllStatsByFilter(userId);
      const adaptedStats: PlayerStats = {
        wins: aggregated.wins,
        losses: aggregated.losses,
        draws: aggregated.draws,
        matchesTotal: aggregated.matchesTotal,
        uniqueOpponents: aggregated.opponentsList.length,
        tournamentPlacements: [],
      };
      setStats(adaptedStats);
      computeTitlesProgress(adaptedStats);

      // =========== Rival de novo ===========
      const newRival = await fetchRivalByFilter(userId);
      if (newRival) {
        const r: RivalData = {
          rivalId: newRival.rivalId,
          rivalName: newRival.rivalName,
          matches: newRival.matches,
          userWins: newRival.userWins,
          rivalWins: newRival.rivalWins,
          lastWinner: newRival.lastWinner,
          wrPercentage: newRival.wrPercentage,
        };
        setRivalInfo(r);
        const oldRivalId = await AsyncStorage.getItem("@lastRivalId");
        if (oldRivalId !== r.rivalId) {
          setRivalModalVisible(true);
          await AsyncStorage.setItem("@lastRivalId", r.rivalId);
        }
      } else {
        setRivalInfo(null);
      }

    } catch {
      Alert.alert("Erro", "Não foi possível salvar o filtro.");
    }
    setLoading(false);
  }

  // =============================
  // Render
  // =============================
  const total = stats.matchesTotal;
  const wr = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : "0";
  const defaultAvatar = require("../../assets/images/avatar/image.jpg");
  const avatarSource = avatarUri || defaultAvatar;

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <Animatable.Text
          style={styles.loadingText}
          animation="pulse"
          easing="ease-out"
          iterationCount="infinite"
        >
          Carregando...
        </Animatable.Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#1E1E1E" }}>
      {/* Modal de Boas-Vindas */}
      <Modal
        visible={welcomeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWelcomeModalVisible(false)}
      >
        <View style={styles.welcomeOverlay}>
          <Animatable.View
            style={styles.welcomeContainer}
            animation="fadeInUp"
            duration={700}
          >
            <Image
              source={require("../../assets/images/fundos/welcome_bg.jpg")}
              style={styles.welcomeImage}
              resizeMode="contain"
            />
            <Text style={styles.welcomeText}>
              Bem-vindo, {userName}!
            </Text>
            <TouchableOpacity
              style={styles.closeWelcomeButton}
              onPress={() => setWelcomeModalVisible(false)}
            >
              <Text style={{ color: "#FFF", fontWeight: "bold" }}>
                Fechar
              </Text>
            </TouchableOpacity>
          </Animatable.View>
        </View>
      </Modal>

      {/* Cabeçalho */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image source={avatarSource} style={styles.avatar} />
          <Text style={styles.userName}>{userName}</Text>
        </View>

        {/* Botão LIGAS */}
        <TouchableOpacity style={styles.ligasButton} onPress={openFilterModal}>
          <MaterialCommunityIcons name="earth" size={20} color="#FFF" />
          <Text style={styles.ligasButtonText}>Ligas</Text>
        </TouchableOpacity>
      </View>

      <ImageBackground
        source={require("../../assets/images/background_login.jpg")}
        style={styles.backgroundImage}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Stats */}
          <View style={styles.statsContainer}>
            {renderStatCard("Vitórias", stats.wins, "trophy", "#E3350D", 100)}
            {renderStatCard("Derrotas", stats.losses, "skull", "#fff", 150)}
            {renderStatCard("Empates", stats.draws, "handshake", "#f5a623", 200)}
            {renderStatCard("Partidas", stats.matchesTotal, "sword-cross", "#1DD1A1", 250)}
            {renderStatCard("WinRate", wr + "%", "chart-line", "#FFC312", 300)}
            {renderStatCard(
              "Oponentes",
              stats.uniqueOpponents,
              "account-group",
              "#9980FA",
              350
            )}
          </View>

          {/* Rival Card */}
          {rivalInfo && (
            <Animatable.View
              style={styles.rivalCard}
              animation="fadeInDown"
              delay={400}
            >
              <View style={styles.rivalCardHeader}>
                <MaterialCommunityIcons name="sword-cross" size={26} color="#E3350D" />
                <Text style={styles.rivalTitle}>Rival Atual</Text>
              </View>
              <View style={styles.vsRow}>
                <Animatable.Image
                  source={require("../../assets/images/lotties/versus.jpg")}
                  style={styles.vsIcon}
                  animation="pulse"
                  easing="ease-in-out"
                  iterationCount="infinite"
                />
              </View>
              <View style={styles.rivalBody}>
                <Text style={styles.rivalName}>{rivalInfo.rivalName}</Text>
                <Text style={styles.rivalStats}>
                  Partidas: {rivalInfo.matches} | WR:{" "}
                  {rivalInfo.wrPercentage.toFixed(1)}%
                </Text>
                <Text style={[styles.rivalStats, { textAlign: "center" }]}>
                  Última Batalha:{" "}
                  {getRandomRivalPhrase(rivalInfo.lastWinner || "empate")}
                </Text>
              </View>
            </Animatable.View>
          )}

          {/* Títulos */}
          <Animatable.View
            animation="fadeInUp"
            style={styles.titlesContainer}
            delay={450}
          >
            <Text style={styles.titlesHeader}>Títulos Próximos</Text>
            {isCalculating ? (
              <ActivityIndicator
                size="large"
                color="#E3350D"
                style={{ marginTop: 20 }}
              />
            ) : closestTitles.length === 0 ? (
              <Text style={styles.noTitlesText}>
                Você não possui títulos bloqueados!
              </Text>
            ) : (
              closestTitles.map((title, index) => (
                <TitleProgressCard key={title.id} item={title} delay={index * 100} />
              ))
            )}
          </Animatable.View>
        </ScrollView>

        {/* Botões no rodapé */}
        <View style={styles.bottomButtons}>
          <TouchableOpacity
            style={styles.validCollectionsButton}
            onPress={handleOpenCollections}
          >
            <MaterialCommunityIcons name="book" size={20} color="#FFF" />
            <Text style={[styles.bottomButtonText, { color: "#FFF", marginLeft: 6 }]}>
              Coleções Válidas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.donateButton} onPress={handleDonate}>
            <MaterialCommunityIcons name="hand-coin" size={20} color="#E3350D" />
            <Text style={[styles.bottomButtonText, { color: "#E3350D" }]}>
              Doar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={20} color="#FFF" />
            <Text style={[styles.bottomButtonText, { color: "#FFF", marginLeft: 6 }]}>
              Sair
            </Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>

      {/* Modal de Rival Aprimorado */}
      <Modal
        visible={rivalModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setRivalModalVisible(false)}
      >
        <View style={styles.rivalModalOverlay}>
          <Animatable.View
            style={styles.rivalModalContainer}
            animation="zoomIn"
            duration={700}
          >
            <View style={styles.rivalModalHeader}>
              <MaterialCommunityIcons name="sword-cross" size={32} color="#E3350D" />
              <Text style={styles.rivalModalTitle}>NOVO RIVAL!</Text>
              <MaterialCommunityIcons name="sword-cross" size={32} color="#E3350D" />
            </View>
            <Image
              source={require("../../assets/images/avatar/avatar.jpg")}
              style={styles.modalVSimage}
              resizeMode="contain"
            />
            {rivalInfo && (
              <Text style={styles.rivalModalText}>
                {rivalInfo.rivalName} chegou para desafiar você!
              </Text>
            )}
            <TouchableOpacity
              style={styles.closeRivalModalBtn}
              onPress={() => setRivalModalVisible(false)}
            >
              <Text style={{ color: "#FFF", fontWeight: "bold" }}>
                Fechar Confronto
              </Text>
            </TouchableOpacity>
          </Animatable.View>
        </View>
      </Modal>

      {/* Modal de Coleções Válidas */}
      <Modal
        visible={collectionsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeCollectionsModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeCollectionsModal} style={{ marginRight: 10 }}>
                <MaterialCommunityIcons name="arrow-left" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Coleções Válidas</Text>
            </View>
            <View style={{ flex: 1, padding: 16, backgroundColor: "#1E1E1E" }}>
              {loadingCollections ? (
                <ActivityIndicator
                  size="large"
                  color="#E3350D"
                  style={{ marginTop: 20 }}
                />
              ) : (
                <ScrollView>
                  {validCollections.map((set: any) => (
                    <View key={set.id} style={styles.collectionCard}>
                      <MaterialCommunityIcons
                        name="star-four-points-outline"
                        size={30}
                        color="#E3350D"
                        style={{ marginRight: 10 }}
                      />
                      <View>
                        <Text style={styles.collectionName}>{set.name}</Text>
                        <Text style={styles.collectionSeries}>{set.series}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Filtro (mosaico) */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeFilterModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModalContainer}>
            <Text style={styles.filterModalTitle}>Selecionar Filtro</Text>

            <TouchableOpacity
              style={styles.showAllRow}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
                setShowAllLeagues(!showAllLeagues);
              }}
            >
              <MaterialCommunityIcons
                name={
                  showAllLeagues
                    ? "checkbox-marked-outline"
                    : "checkbox-blank-outline"
                }
                size={24}
                color="#E3350D"
                style={{ marginRight: 10 }}
              />
              <Text style={styles.showAllText}>Mostrar todas as Ligas</Text>
            </TouchableOpacity>

            {!showAllLeagues && (
              <>
                <TouchableOpacity
                  style={styles.cityButton}
                  onPress={() => {
                    setShowMosaicCities(!showMosaicCities);
                    setShowMosaicLeagues(false);
                  }}
                >
                  <Ionicons
                    name="map-outline"
                    size={22}
                    color="#FFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.cityButtonText}>Cidades</Text>
                </TouchableOpacity>

                {showMosaicCities && (
                  <FlatList
                    data={cities}
                    keyExtractor={(item) => item}
                    numColumns={2}
                    style={styles.mosaicList}
                    columnWrapperStyle={styles.mosaicRow}
                    renderItem={({ item }) => {
                      const selected = item === selectedCity;
                      return (
                        <TouchableOpacity
                          style={[
                            styles.mosaicItem,
                            selected && { borderColor: "#E3350D" },
                          ]}
                          onPress={() => {
                            setSelectedCity(item);
                            setShowMosaicLeagues(true);
                            fetchLeaguesByCity(item);
                          }}
                        >
                          <MaterialCommunityIcons
                            name="map-marker"
                            size={24}
                            color={selected ? "#E3350D" : "#FFF"}
                          />
                          <Text style={styles.mosaicItemText}>{item}</Text>
                        </TouchableOpacity>
                      );
                    }}
                  />
                )}

                {showMosaicLeagues && (
                  <FlatList
                    data={leagues}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    style={styles.mosaicList}
                    columnWrapperStyle={styles.mosaicRow}
                    renderItem={({ item }) => {
                      const isSelected = item.id === selectedLeagueId;
                      return (
                        <TouchableOpacity
                          style={[
                            styles.mosaicItem,
                            isSelected && { borderColor: "#E3350D" },
                          ]}
                          onPress={() => handleSelectLeague(item.id)}
                        >
                          <Ionicons
                            name="trophy-outline"
                            size={24}
                            color={isSelected ? "#E3350D" : "#FFF"}
                          />
                          <Text style={styles.mosaicItemText}>
                            {item.leagueName || "Liga Sem Nome"}
                          </Text>
                        </TouchableOpacity>
                      );
                    }}
                  />
                )}
              </>
            )}

            <TouchableOpacity
              style={styles.saveFilterButton}
              onPress={handleSaveFilter}
            >
              <Text style={styles.saveFilterText}>Salvar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeFilterButton}
              onPress={closeFilterModal}
            >
              <Text style={styles.closeFilterText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );

  // ==================================
  // Função de render de cada "Card de Stat"
  // ==================================
  function renderStatCard(
    label: string,
    value: string | number,
    iconName: string,
    iconColor: string,
    delayAnim: number
  ) {
    return (
      <Animatable.View
        animation="fadeInUp"
        style={styles.statCard}
        delay={delayAnim}
        key={label}
      >
        <MaterialCommunityIcons name={iconName as any} size={26} color={iconColor} />
        <Text style={styles.statCardValue}>{value}</Text>
        <Text style={styles.statCardLabel}>{label}</Text>
      </Animatable.View>
    );
  }
}

// ==================================
// Card de progresso de Título
// ==================================
function TitleProgressCard({
  item,
  delay,
}: {
  item: any;
  delay: number;
}) {
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: item.progress,
      duration: 1200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [item.progress]);

  const widthInterpolate = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });
  const progressPercent = Math.round(item.progress * 100);

  return (
    <Animatable.View
      animation="fadeInUp"
      delay={600 + delay}
      style={styles.titleCard}
    >
      <MaterialCommunityIcons
        name={"star-four-points"}
        size={32}
        color={item.locked ? "#999" : "#00D840"}
        style={{ marginRight: 10 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.titleName}>{item.title}</Text>
        <Text style={styles.titleDesc}>{item.description}</Text>
        <View style={styles.progressBarContainer}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: widthInterpolate,
                backgroundColor: item.locked ? "#E3350D" : "#00D840",
              },
            ]}
          />
        </View>
        <Text style={styles.progressLabel}>{progressPercent}%</Text>
      </View>
    </Animatable.View>
  );
}

// ==================================
// Estilos (idênticos ao original)
// ==================================
const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#E3350D",
    fontSize: 24,
    fontWeight: "bold",
  },
  header: {
    backgroundColor: "#000",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 10,
    borderWidth: 2,
    borderColor: "#E3350D",
  },
  userName: {
    color: "#E3350D",
    fontWeight: "bold",
    fontSize: 20,
  },
  ligasButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3350D",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  ligasButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 6,
  },

  backgroundImage: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  statsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 16,
    marginHorizontal: 10,
  },
  statCard: {
    backgroundColor: "#2A2A2A",
    width: 100,
    height: 100,
    borderRadius: 10,
    margin: 6,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#444",
  },
  statCardValue: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 4,
    textAlign: "center",
  },
  statCardLabel: {
    color: "#ccc",
    fontSize: 12,
    textAlign: "center",
  },

  rivalCard: {
    backgroundColor: "#2A2A2A",
    borderRadius: 10,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#444",
  },
  rivalCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  rivalTitle: {
    color: "#E3350D",
    fontWeight: "bold",
    fontSize: 16,
    marginHorizontal: 8,
  },
  vsRow: {
    alignItems: "center",
    marginVertical: 6,
  },
  vsIcon: {
    width: 30,
    height: 35,
  },
  rivalBody: {
    marginTop: 8,
    alignItems: "center",
  },
  rivalName: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  rivalStats: {
    color: "#ccc",
    fontSize: 13,
    marginTop: 2,
  },

  titlesContainer: {
    backgroundColor: "#2A2A2A",
    marginHorizontal: 12,
    marginTop: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#444",
    padding: 12,
  },
  titlesHeader: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  noTitlesText: {
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
  },
  titleCard: {
    flexDirection: "row",
    backgroundColor: "#3A3A3A",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#555",
  },
  titleName: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  titleDesc: {
    color: "#CCC",
    fontSize: 13,
    marginBottom: 6,
  },
  progressBarContainer: {
    backgroundColor: "#555",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 2,
  },
  progressBarFill: {
    height: 6,
  },
  progressLabel: {
    color: "#FFF",
    fontSize: 12,
    textAlign: "right",
  },

  bottomButtons: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#000000bb",
    flexDirection: "row",
    padding: 8,
    justifyContent: "space-around",
    alignItems: "center",
  },
  validCollectionsButton: {
    borderWidth: 1,
    borderColor: "#FFF",
    backgroundColor: "transparent",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  donateButton: {
    borderWidth: 1,
    borderColor: "#E3350D",
    backgroundColor: "#FFF",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: "#fff",
    backgroundColor: "#E3350D",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  bottomButtonText: {
    fontWeight: "bold",
    fontSize: 16,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#1E1E1E",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#000",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalTitle: {
    color: "#E3350D",
    fontWeight: "bold",
    fontSize: 20,
  },
  collectionCard: {
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  collectionName: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  collectionSeries: {
    color: "#ccc",
    fontSize: 14,
  },

  // Rival Modal
  rivalModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  rivalModalContainer: {
    backgroundColor: "#2A2A2A",
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: "#555",
    alignItems: "center",
    width: "85%",
  },
  rivalModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 10,
  },
  rivalModalTitle: {
    color: "#E3350D",
    fontWeight: "bold",
    fontSize: 20,
    textAlign: "center",
    marginHorizontal: 10,
  },
  modalVSimage: {
    width: 100,
    height: 60,
    marginVertical: 8,
  },
  rivalModalText: {
    color: "#FFF",
    fontSize: 16,
    marginVertical: 8,
    textAlign: "center",
  },
  closeRivalModalBtn: {
    backgroundColor: "#E3350D",
    borderRadius: 6,
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },

  // Modal de Filtro
  filterModalContainer: {
    width: "90%",
    backgroundColor: "#292929",
    padding: 16,
    borderRadius: 12,
    alignSelf: "center",
    marginTop: 60,
  },
  filterModalTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  showAllRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  showAllText: {
    color: "#FFF",
    fontSize: 16,
  },
  cityButton: {
    flexDirection: "row",
    backgroundColor: "#E3350D",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
    marginTop: 4,
  },
  cityButtonText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 16,
  },
  mosaicList: {
    width: "100%",
    marginTop: 12,
    marginBottom: 8,
  },
  mosaicRow: {
    justifyContent: "space-around",
  },
  mosaicItem: {
    width: "45%",
    backgroundColor: "#333",
    borderRadius: 8,
    marginBottom: 10,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#333",
  },
  mosaicItemText: {
    color: "#FFF",
    marginTop: 4,
    fontSize: 14,
    textAlign: "center",
  },
  saveFilterButton: {
    backgroundColor: "#E3350D",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
    alignItems: "center",
  },
  saveFilterText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  closeFilterButton: {
    backgroundColor: "#999",
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  closeFilterText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },

  // Welcome Modal
  welcomeOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  welcomeContainer: {
    backgroundColor: "#2A2A2A",
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: "#444",
    width: "85%",
    alignItems: "center",
  },
  welcomeImage: {
    width: "90%",
    height: 120,
    marginBottom: 20,
  },
  welcomeText: {
    color: "#FFF",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 20,
    fontWeight: "bold",
  },
  closeWelcomeButton: {
    backgroundColor: "#E3350D",
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
});
