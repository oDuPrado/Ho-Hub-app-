import React, { useEffect, useState, useRef } from "react";
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
  Easing,
  Modal,
  FlatList,
  LayoutAnimation,
  UIManager,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter
} from "firebase/firestore";
import { auth, db } from "../../lib/firebaseConfig";
import titles, { TitleItem, PlayerStats } from "../titlesConfig";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import * as Animatable from "react-native-animatable";

import { fetchAllMatches, MatchData } from "../../lib/matchService"; // Importa a função

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

export default function HomeScreen() {
  const router = useRouter();

  const [matches, setMatches] = useState<MatchData[]>([]);

  // Loading e Cálculos
  const [loading, setLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);

  // Usuário
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("Jogador");
  const [avatarUri, setAvatarUri] = useState<any>(null);

  // Stats do jogador
  const [stats, setStats] = useState<PlayerStats>({
    wins: 0,
    losses: 0,
    draws: 0,
    matchesTotal: 0,
    uniqueOpponents: 0,
    tournamentPlacements: [],
  });

  // Títulos + progresso
  const [closestTitles, setClosestTitles] = useState<TitleWithProgress[]>([]);

  // Rival
  const [rivalInfo, setRivalInfo] = useState<RivalData | null>(null);

  // Modal de Rival (quando muda)
  const [rivalModalVisible, setRivalModalVisible] = useState(false);

  // Modal de Coleções
  const [collectionsModalVisible, setCollectionsModalVisible] = useState(false);
  const [validCollections, setValidCollections] = useState<any[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);

  // Modal de Filtro
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Listas e seleções de Cidade/Liga
  const [cities, setCities] = useState<string[]>([]);
  const [leagues, setLeagues] = useState<any[]>([]);

  // Estados de exibição
  const [showCities, setShowCities] = useState(false);
  const [showLeagues, setShowLeagues] = useState(false);

  // Valores escolhidos
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");

  

  // ------------------------------------------------
  // Efeito Inicial (carregar user e stats + filter)
  // ------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // Verifica user
        const storedId = await AsyncStorage.getItem("@userId");
        const storedName = await AsyncStorage.getItem("@userName");
        if (!storedId) {
          router.replace("/(auth)/login");
          return;
        }
        setUserId(storedId);
        setUserName(storedName || "Jogador");

        // Carrega avatar
        const storedAvatar = await AsyncStorage.getItem("@userAvatar");
        if (storedAvatar) {
          const avId = parseInt(storedAvatar, 10);
          const found = avatarList.find((av) => av.id === avId);
          if (found) setAvatarUri(found.uri);
        }

        // Usa a função centralizada para buscar as partidas, respeitando o filtro definido na Home
        const allMatches = await fetchAllMatches();
        // Filtra somente as partidas do usuário
        const userMatches = allMatches.filter(
          (m) => m.player1_id === storedId || m.player2_id === storedId
        );
        setMatches(userMatches);
        
        // Stats
        const newStats = computeBasicStats(storedId, userMatches);
        setStats(newStats);

        // Calcular Títulos
        computeTitlesProgress(newStats);

        // Calcular Rival
        const newRival = await computeBiggestRival(storedId, userMatches);
        await handleRivalDetection(newRival);
      } catch (err) {
        console.log("Erro:", err);
        Alert.alert("Erro", "Não foi possível carregar dados.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // ---------------------------------------------
  // FUNÇÃO PRINCIPAL DE BUSCA COM FILTRO
  // ---------------------------------------------
  async function fetchAllMatches(): Promise<MatchData[]> {
    try {
      const storedUserId = await AsyncStorage.getItem("@userId");
      const filterType = await AsyncStorage.getItem("@filterType"); // "all"|"city"|"league"
      const cityStored = await AsyncStorage.getItem("@selectedCity");
      const leagueStored = await AsyncStorage.getItem("@leagueId");

      if (!storedUserId) {
        console.warn("⚠️ Nenhum usuário logado.");
        return [];
      }

      // Se for "all", buscamos TODAS as ligas.
      // Se for "city", buscamos TODAS as ligas daquela cidade.
      // Se for "league", buscamos APENAS a liga específica.

      // 1) Coletamos a lista de ligas que atenderá o filtro
      let leaguesToFetch: string[] = [];

      if (filterType === "all" || !filterType) {
        // TUDO: Pega todas as ligas
        const leaguesSnap = await getDocs(collection(db, "leagues"));
        leaguesSnap.forEach((docSnap) => {
          leaguesToFetch.push(docSnap.id);
        });
      } else if (filterType === "city" && cityStored) {
        // CIDADE: filtra todas as ligas que contenham "city = cityStored"
        const qCity = query(collection(db, "leagues"), where("city", "==", cityStored));
        const citySnapshot = await getDocs(qCity);
        citySnapshot.forEach((docSnap) => {
          leaguesToFetch.push(docSnap.id);
        });
      } else if (filterType === "league" && leagueStored) {
        // LIGA: apenas essa
        leaguesToFetch.push(leagueStored);
      } else {
        // Se nenhum caso se encaixa, retorna vazio
        console.warn("⚠️ Filtro inválido ou não definido. Retornando vazio.");
        return [];
      }

      if (leaguesToFetch.length === 0) {
        console.log("Nenhuma liga encontrada para esse filtro.");
        return [];
      }

      let allMatches: MatchData[] = [];

      // 2) Para cada liga, pega torneios -> rounds -> matches do usuário
      for (const leagueId of leaguesToFetch) {
        const tournamentsRef = collection(db, `leagues/${leagueId}/tournaments`);
        const tournamentsSnap = await getDocs(tournamentsRef);

        if (tournamentsSnap.empty) continue;

        for (const tournamentDoc of tournamentsSnap.docs) {
          const tournamentId = tournamentDoc.id;
          const roundsRef = collection(
            db,
            `leagues/${leagueId}/tournaments/${tournamentId}/rounds`
          );
          const roundsSnap = await getDocs(roundsRef);

          if (roundsSnap.empty) continue;

          for (const roundDoc of roundsSnap.docs) {
            const roundId = roundDoc.id;
            const matchesRef = collection(
              db,
              `leagues/${leagueId}/tournaments/${tournamentId}/rounds/${roundId}/matches`
            );
            const matchesSnap = await getDocs(matchesRef);

            if (matchesSnap.empty) continue;

            matchesSnap.forEach((docSnap) => {
              const matchData = docSnap.data() as MatchData;
              // Vamos trazer todas as partidas, mas o computeBasicStats vai filtrar as do usuário
              allMatches.push({ ...matchData, id: docSnap.id });
            });
          }
        }
      }

      console.log(`Total de partidas obtidas (filtro: ${filterType}):`, allMatches.length);
      return allMatches;
    } catch (error) {
      console.error("🔥 Erro ao buscar partidas:", error);
      return [];
    }
  }

  // ----------------- STATS --------------------
  function computeBasicStats(uId: string, userMatches: MatchData[]): PlayerStats {
    let wins = 0,
      losses = 0,
      draws = 0;
    const oppSet = new Set<string>();

    for (let mm of userMatches) {
      if (!mm.outcomeNumber) continue;
      const isP1 = mm.player1_id === uId;
      const rivalId = isP1 ? mm.player2_id : mm.player1_id;
      if (rivalId && rivalId !== "N/A") oppSet.add(rivalId);

      switch (mm.outcomeNumber) {
        case 1:
          isP1 ? wins++ : losses++;
          break;
        case 2:
          isP1 ? losses++ : wins++;
          break;
        case 3:
          draws++;
          break;
        case 10:
          // WO é derrota de quem faltou, então se for user, conta como derrota
          isP1 ? losses++ : wins++;
          break;
      }
    }

    return {
      wins,
      losses,
      draws,
      matchesTotal: userMatches.length,
      uniqueOpponents: oppSet.size,
      tournamentPlacements: [],
    };
  }

  async function computeTitlesProgress(st: PlayerStats) {
    setIsCalculating(true);

    const all = titles.map((t) => {
      const locked = !t.condition(st);
      const progress = calcProgress(t, st);
      return { ...t, locked, progress };
    });

    // Filtra apenas os bloqueados, ordena por quem está mais próximo
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

  // ----------------- RIVAL --------------------
  async function computeBiggestRival(
    uId: string,
    userMatches: MatchData[]
  ): Promise<RivalData | null> {
    const rivalsMap: Record<
      string,
      {
        matches: number;
        userWins: number;
        rivalWins: number;
        lastWinner: "user" | "rival" | "empate";
      }
    > = {};
  
    let leagueId = await AsyncStorage.getItem("@leagueId"); // Liga atual selecionada
  
    userMatches.forEach((mm) => {
      const isP1 = mm.player1_id === uId;
      const rId = isP1 ? mm.player2_id : mm.player1_id;
      if (!rId || rId === "N/A") return;
  
      if (!rivalsMap[rId]) {
        rivalsMap[rId] = {
          matches: 0,
          userWins: 0,
          rivalWins: 0,
          lastWinner: "empate",
        };
      }
      rivalsMap[rId].matches += 1;
  
      const outcome = mm.outcomeNumber || 0;
      if (outcome === 1) {
        if (isP1) {
          rivalsMap[rId].userWins += 1;
          rivalsMap[rId].lastWinner = "user";
        } else {
          rivalsMap[rId].rivalWins += 1;
          rivalsMap[rId].lastWinner = "rival";
        }
      } else if (outcome === 2) {
        if (isP1) {
          rivalsMap[rId].rivalWins += 1;
          rivalsMap[rId].lastWinner = "rival";
        } else {
          rivalsMap[rId].userWins += 1;
          rivalsMap[rId].lastWinner = "user";
        }
      } else if (outcome === 3) {
        rivalsMap[rId].lastWinner = "empate";
      } else if (outcome === 10) {
        if (isP1) {
          rivalsMap[rId].rivalWins += 1;
          rivalsMap[rId].lastWinner = "rival";
        } else {
          rivalsMap[rId].userWins += 1;
          rivalsMap[rId].lastWinner = "user";
        }
      }
    });
  
    let topRivalId = "";
    let topMatches = 0;
  
    for (const rid of Object.keys(rivalsMap)) {
      if (rivalsMap[rid].matches > topMatches) {
        topMatches = rivalsMap[rid].matches;
        topRivalId = rid;
      }
    }
    if (!topRivalId) return null;
  
    const data = rivalsMap[topRivalId];
    const userWins = data.userWins;
    const totalMatches = data.matches;
    const wr = totalMatches > 0 ? (userWins / totalMatches) * 100 : 0;
  
    // ⚠️ Agora buscamos o nome do rival corretamente dentro da liga correta!
    const rivalName = await getPlayerName(leagueId || "", topRivalId);
  
    return {
      rivalId: topRivalId,
      rivalName: rivalName,
      matches: totalMatches,
      userWins,
      rivalWins: data.rivalWins,
      lastWinner: data.lastWinner,
      wrPercentage: wr,
    };
  }


  async function getPlayerName(leagueId: string, playerId: string): Promise<string> {
  if (!playerId) return `User ${playerId}`;

  try {
    if (leagueId && leagueId !== "all") {
      // 🔹 Caso normal: buscar nome dentro da liga especificada
      const playerRef = doc(db, `leagues/${leagueId}/players/${playerId}`);
      const playerSnap = await getDoc(playerRef);
      if (playerSnap.exists()) {
        const data = playerSnap.data();
        return data?.fullname || `User ${playerId}`;
      }
    } else {
      // 🔹 Caso especial: Filtro "all" → buscar jogador em TODAS as ligas
      const leaguesSnap = await getDocs(collection(db, "leagues"));
      for (const leagueDoc of leaguesSnap.docs) {
        const leagueId = leagueDoc.id;
        const playerRef = doc(db, `leagues/${leagueId}/players/${playerId}`);
        const playerSnap = await getDoc(playerRef);
        if (playerSnap.exists()) {
          const data = playerSnap.data();
          return data?.fullname || `User ${playerId}`;
        }
      }
    }
  } catch (error) {
    console.error(`Erro ao buscar nome do jogador ${playerId}:`, error);
  }

  return `User ${playerId}`;
}

  

  async function handleRivalDetection(newRival: RivalData | null) {
    if (!newRival) {
      setRivalInfo(null);
      return;
    }
    const oldRivalId = await AsyncStorage.getItem("@lastRivalId");
    setRivalInfo(newRival);

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
    const chosenPhrases = phrases[result] || [];
    return chosenPhrases[Math.floor(Math.random() * chosenPhrases.length)];
  }

  // ----------------- BOTÕES --------------------
  async function handleLogout() {
    try {
      await auth.signOut();
      await AsyncStorage.removeItem("@userId");
      await AsyncStorage.removeItem("@userName");
      router.replace("/(auth)/login");
    } catch (err) {
      Alert.alert("Erro", "Falha ao sair da conta");
      console.log(err);
    }
  }

  function handleDonate() {
    const link = "https://picpay.me/marco.macedo10/0.5";
    Alert.alert("Doar", "Abrindo link de doação...", [
      { text: "OK", onPress: () => Linking.openURL(link) },
    ]);
  }

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
      console.error("Erro ao carregar coleções:", error);
    } finally {
      setLoadingCollections(false);
    }
  }

  function closeCollectionsModal() {
    setCollectionsModalVisible(false);
  }

  // -------------- MODAL DE FILTRO --------------
  const openFilterModal = () => {
    setFilterModalVisible(true);
    fetchCities();
  };

  const closeFilterModal = () => {
    setFilterModalVisible(false);
    setShowCities(false);
    setShowLeagues(false);
  };

  async function fetchCities() {
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
      console.error("Erro ao buscar cidades:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLeaguesByCity(cityName: string) {
    try {
      setLoading(true);
      setSelectedCity(cityName);
      setShowLeagues(false);

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
  }

  async function handleSelectLeague(leagueId: string) {
    setSelectedLeagueId(leagueId);
  }

  // -------------- SALVAR FILTRO ---------------
  async function handleSaveFilter() {
    try {
      // 3 modos: "all", "city", "league"
      if (!selectedCity && !selectedLeagueId) {
        // Se não escolheu nada, assumimos "All"
        await AsyncStorage.setItem("@filterType", "all");
        await AsyncStorage.removeItem("@selectedCity");
        await AsyncStorage.removeItem("@leagueId");
      } else if (selectedCity && !selectedLeagueId) {
        // Filtro por CIDADE
        await AsyncStorage.setItem("@filterType", "city");
        await AsyncStorage.setItem("@selectedCity", selectedCity);
        await AsyncStorage.removeItem("@leagueId");
      } else if (selectedLeagueId) {
        // Filtro por LIGA
        await AsyncStorage.setItem("@filterType", "league");
        await AsyncStorage.setItem("@leagueId", selectedLeagueId);
        // city pode ou não estar definido, mas nesse caso,
        // iremos ignorar city. Então limpamos pra evitar confusão:
        await AsyncStorage.removeItem("@selectedCity");
      }

      // Fecha modal
      setFilterModalVisible(false);

      // Recarrega partidas:
      setLoading(true);
      const newMatches = await fetchAllMatches();

      // Filtra partidas do usuário
      const userMatches = newMatches.filter(
        (m) => m.player1_id === userId || m.player2_id === userId
      );
      const newStats = computeBasicStats(userId, userMatches);
      setStats(newStats);
      computeTitlesProgress(newStats);

      const newRival = await computeBiggestRival(userId, userMatches);
      await handleRivalDetection(newRival);

      setMatches(newMatches);
    } catch (error) {
      console.error("Erro ao salvar filtro:", error);
      Alert.alert("Erro", "Falha ao salvar filtro.");
    } finally {
      setLoading(false);
    }
  }

  // -------------- BOTÃO "TUDO" --------------
  async function handleSelectAllFilter() {
    // Limpa tudo e seta filterType = "all"
    setSelectedCity("");
    setSelectedLeagueId("");
    setShowCities(false);
    setShowLeagues(false);
    await AsyncStorage.setItem("@filterType", "all");
    await AsyncStorage.removeItem("@selectedCity");
    await AsyncStorage.removeItem("@leagueId");

    setFilterModalVisible(false);

    // Recarrega
    setLoading(true);
    const newMatches = await fetchAllMatches();

    const userMatches = newMatches.filter(
      (m) => m.player1_id === userId || m.player2_id === userId
    );
    const newStats = computeBasicStats(userId, userMatches);
    setStats(newStats);
    computeTitlesProgress(newStats);

    const newRival = await computeBiggestRival(userId, userMatches);
    await handleRivalDetection(newRival);

    setMatches(newMatches);
    setLoading(false);
  }

  // ============= RENDER PRINCIPAL =============
  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <Animatable.Text
          style={{ color: "#E3350D", fontSize: 24, fontWeight: "bold" }}
          animation="pulse"
          easing="ease-out"
          iterationCount="infinite"
        >
          Carregando...
        </Animatable.Text>
      </View>
    );
  }

  const total = stats.matchesTotal;
  const wr = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : "0";
  const defaultAvatar = require("../../assets/images/avatar/image.jpg");
  const avatarSource = avatarUri || defaultAvatar;

  return (
    <View style={{ flex: 1, backgroundColor: "#1E1E1E" }}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image source={avatarSource} style={styles.avatar} />
          <Text style={styles.userName}>{userName}</Text>
        </View>

        {/* Ícone de Filtro no canto direito */}
        <TouchableOpacity style={styles.gearButton} onPress={openFilterModal}>
          <Ionicons name="settings" size={28} color="#E3350D" />
        </TouchableOpacity>
      </View>

      <ImageBackground
        source={require("../../assets/images/background_login.jpg")}
        style={styles.backgroundImage}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* STATS */}
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

          {/* RIVAL CARD */}
          {rivalInfo && (
            <Animatable.View
              style={styles.rivalCard}
              animation="fadeInDown"
              delay={350}
            >
              <MaterialCommunityIcons
                name="sword-cross"
                size={30}
                color="#E3350D"
              />
              <Animatable.Text
                animation="pulse"
                iterationCount="infinite"
                style={styles.rivalTitle}
              >
                Rival Atual
              </Animatable.Text>

              <View style={styles.rivalBody}>
                <Text style={styles.rivalName}>{rivalInfo.rivalName}</Text>
                <Text style={styles.rivalStats}>
                  Partidas: {rivalInfo.matches} | WR:{" "}
                  {rivalInfo.wrPercentage.toFixed(1)}%
                </Text>
                <Text style={[styles.rivalStats, { textAlign: "center" }]}>
                  Última Partida:{" "}
                  {getRandomRivalPhrase(rivalInfo.lastWinner || "empate")}
                </Text>
              </View>
            </Animatable.View>
          )}

          {/* TÍTULOS + PROGRESS */}
          <Animatable.View
            animation="fadeInUp"
            style={styles.titlesContainer}
            delay={400}
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

        {/* BOTÕES NO FUNDO */}
        <View style={styles.bottomButtons}>
          <TouchableOpacity
            style={styles.validCollectionsButton}
            onPress={handleOpenCollections}
          >
            <MaterialCommunityIcons name={"book"} size={20} color="#FFF" />
            <Text style={[styles.bottomButtonText, { color: "#FFF", marginLeft: 6 }]}>
              Coleções Válidas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.donateButton} onPress={handleDonate}>
            <MaterialCommunityIcons name={"hand-coin"} size={20} color="#E3350D" />
            <Text style={[styles.bottomButtonText, { color: "#E3350D" }]}>Doar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <MaterialCommunityIcons name={"logout"} size={20} color="#FFF" />
            <Text style={[styles.bottomButtonText, { color: "#FFF" }]}>Sair</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>

      {/* MODAL DE COLEÇÕES VÁLIDAS */}
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
                <MaterialCommunityIcons name={"arrow-left"} size={24} color="#FFF" />
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
                        name={"star-four-points-outline"}
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

      {/* MODAL DE RIVAL (quando muda) */}
      <Modal
        visible={rivalModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setRivalModalVisible(false)}
      >
        <View style={styles.rivalModalOverlay}>
          <Animatable.View
            style={styles.rivalModalContainer}
            animation="shake"
            duration={1200}
          >
            <Text style={styles.rivalModalTitle}>Novo Rival Detectado!</Text>
            {rivalInfo && (
              <>
                <MaterialCommunityIcons
                  name="alert-decagram"
                  size={46}
                  color="#E3350D"
                />
                <Text style={styles.rivalModalText}>
                  {rivalInfo.rivalName} chegou para desafiar você!
                </Text>
              </>
            )}
            <TouchableOpacity
              style={styles.closeRivalModalBtn}
              onPress={() => setRivalModalVisible(false)}
            >
              <Text style={{ color: "#FFF", fontWeight: "bold" }}>
                Conferir seu Rival
              </Text>
            </TouchableOpacity>
          </Animatable.View>
        </View>
      </Modal>

      {/* MODAL DE FILTRO (Cidade/Liga/Tudo) */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeFilterModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalFilterContainer}>
            <Text style={styles.filterModalTitle}>Selecionar Filtro</Text>

            {/* Botão TUDO */}
            <TouchableOpacity
              style={styles.allButton}
              onPress={handleSelectAllFilter}
            >
              <MaterialCommunityIcons
                name="earth"
                size={20}
                color="#FFF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.allButtonText}>Mostrar Tudo</Text>
            </TouchableOpacity>

            {/* Botão expandir cidades */}
            <TouchableOpacity
              style={styles.expandButton}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
                setShowCities(!showCities);
              }}
            >
              <Text style={styles.expandButtonText}>Selecionar Cidade</Text>
              <Ionicons
                name={showCities ? "chevron-up" : "chevron-down"}
                size={24}
                color="#FF6F61"
              />
            </TouchableOpacity>

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
                      color="#FF6F61"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.cityItemText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            )}

            {/* Botão expandir ligas (se cidade selecionada) */}
            {selectedCity !== "" && (
              <TouchableOpacity
                style={styles.expandButton}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
                  setShowLeagues(!showLeagues);
                }}
              >
                <Text style={styles.expandButtonText}>
                  {selectedCity
                    ? `Selecionar Liga (${selectedCity})`
                    : "Selecionar Liga"}
                </Text>
                <Ionicons
                  name={showLeagues ? "chevron-up" : "chevron-down"}
                  size={24}
                  color="#FF6F61"
                />
              </TouchableOpacity>
            )}

            {showLeagues && (
              <FlatList
                style={styles.flatList}
                data={leagues}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const isSelected = selectedLeagueId === item.id;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.leagueItem,
                        {
                          backgroundColor: isSelected
                            ? "#FF6F61"
                            : darkerColor("#292929"),
                        },
                      ]}
                      onPress={() => handleSelectLeague(item.id)}
                    >
                      <Ionicons
                        name="ribbon"
                        size={20}
                        color="#FFF"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.cityItemText}>
                        {item.leagueName || "Sem Nome"}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            {/* Botão SALVAR */}
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveFilter}>
              <Text style={styles.saveButtonText}>Salvar</Text>
            </TouchableOpacity>

            {/* Botão FECHAR */}
            <TouchableOpacity style={styles.closeModalButton} onPress={closeFilterModal}>
              <Text style={styles.closeModalButtonText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );

  // ----------------- RENDERIZAÇÃO DE UM STAT CARD -----------------
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

// ----------------- COMPONENTE DE TÍTULO + PROGRESSO -----------------
function TitleProgressCard({ item, delay }: { item: any; delay: number }) {
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

// ----------------- ESTILOS -----------------
const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
    alignItems: "center",
  },
  backgroundImage: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
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
  gearButton: {
    padding: 6,
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

  // Stats
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

  // Rival Card
  rivalCard: {
    backgroundColor: "#2A2A2A",
    borderRadius: 10,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#444",
    alignItems: "center",
  },
  rivalTitle: {
    color: "#E3350D",
    fontWeight: "bold",
    fontSize: 16,
    marginVertical: 8,
  },
  rivalBody: {
    marginTop: 5,
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

  // Títulos
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

  // Bottom Buttons
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
    marginLeft: 6,
    fontSize: 16,
  },

  // Modal Coleções
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
    width: "80%",
  },
  rivalModalTitle: {
    color: "#E3350D",
    fontWeight: "bold",
    fontSize: 20,
    marginBottom: 12,
    textAlign: "center",
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
  modalFilterContainer: {
    width: "90%",
    backgroundColor: "#292929",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
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
    color: "#FF6F61",
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
    backgroundColor: darkerColor("#292929"),
    padding: 10,
    marginVertical: 4,
    borderRadius: 6,
  },
  cityItemText: {
    color: "#FFFFFF",
    fontSize: 15,
  },
  leagueItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    marginVertical: 4,
    borderRadius: 6,
  },
  allButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3350D",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  allButtonText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: "#E3350D",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  closeModalButton: {
    backgroundColor: "#999",
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  closeModalButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
});

// Helper para escurecer cor
function darkerColor(hexColor: string) {
  const amt = -20;
  let num = parseInt(hexColor.replace("#", ""), 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0x00ff) + amt;
  let b = (num & 0x0000ff) + amt;

  return (
    "#" +
    (
      0x1000000 +
      (r < 255 ? (r < 0 ? 0 : r) : 255) * 0x10000 +
      (g < 255 ? (g < 0 ? 0 : g) : 255) * 0x100 +
      (b < 255 ? (b < 0 ? 0 : b) : 255)
    )
      .toString(16)
      .slice(1)
  );
}
