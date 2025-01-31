// app/(tabs)/home.tsx

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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import {
  collectionGroup,
  getDocs,
  doc,
  getDoc,
  collection,
} from "firebase/firestore";

import { auth, db } from "../../lib/firebaseConfig";
import titles, { TitleItem, PlayerStats } from "../titlesConfig";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Animatable from "react-native-animatable";

// ---------- Interfaces ----------
interface MatchData {
  id: string;
  outcomeNumber?: number; // 1 (P1 vence), 2 (P2 vence), 3 (empate), 10 (WO)
  player1_id?: string;
  player2_id?: string;
}

interface RivalData {
  rivalId: string;
  rivalName: string;
  matches: number;
  userWins: number;
  rivalWins: number;
  lastWinner: "user" | "rival" | "empate" | null;
  wrPercentage: number;
}

// Avatares
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

// Títulos + Progress
interface TitleWithProgress extends TitleItem {
  progress: number;
  locked: boolean;
}

export default function HomeScreen() {
  const router = useRouter();

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

  // ----------------------------------------
  // Efeito Inicial
  // ----------------------------------------
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

        // Buscar partidas
        const allMatches = await fetchAllMatches();
        const userMatches = allMatches.filter(
          (m) => m.player1_id === storedId || m.player2_id === storedId
        );

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

  // ----------------------------------------
  // FUNÇÕES PRINCIPAIS
  // ----------------------------------------

  // Buscar TODAS as partidas
  async function fetchAllMatches(): Promise<MatchData[]> {
    const snap = await getDocs(collectionGroup(db, "matches"));
    const arr: MatchData[] = [];
    snap.forEach((docSnap) => {
      arr.push({ id: docSnap.id, ...docSnap.data() } as MatchData);
    });
    return arr;
  }

  // Computar stats simples (wins, losses, draws)
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
          losses++;
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

  // Calcular Títulos
  async function computeTitlesProgress(st: PlayerStats) {
    setIsCalculating(true);

    const all = titles.map((t) => {
      const locked = !t.condition(st);
      const progress = calcProgress(t, st);
      return { ...t, locked, progress };
    });

    // Filtra locked e ordena
    const lockedOnly = all.filter((tw) => tw.locked);
    lockedOnly.sort((a, b) => b.progress - a.progress);

    // Pega top 3
    const top3 = lockedOnly.slice(0, 3);
    setClosestTitles(top3);

    setIsCalculating(false);
  }

  // Cálculo de progresso (manual)
  function calcProgress(title: TitleItem, stats: PlayerStats): number {
    if (title.condition(stats)) return 1; // Já desbloqueado
    let progress = 0;

    // Comparações manuais
    switch (title.id) {
      case 101: // Mestre Kanto
        progress = stats.wins / 20;
        break;
      case 999: // A Jornada Começa
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
        progress = (stats.tournamentPlacements?.filter((p) => p <= 3).length ?? 0) / 3;
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
        progress = (stats.tournamentPlacements?.filter((p) => p <= 3).length ?? 0) / 4;
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
        progress = (stats.tournamentPlacements?.filter((p) => p === 1).length ?? 0) / 2;
        break;
      default:
        progress = 0;
    }

    return Math.min(progress, 1);
  }

  // ----------------------------------------
  // RIVAL
  // ----------------------------------------

  // Buscar "fullname" do rival no Firestore
  async function getPlayerName(rid: string): Promise<string> {
    try {
      const docRef = doc(db, "players", rid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return data?.fullname || `User ${rid}`;
      }
    } catch {
      return `User ${rid}`;
    }
    return `User ${rid}`;
  }

  async function computeBiggestRival(uId: string, userMatches: MatchData[]): Promise<RivalData | null> {
    // Monta um map { rivalId: { matches, userWins, rivalWins, lastWinner } }
    const rivalsMap: Record<string, { matches: number; userWins: number; rivalWins: number; lastWinner: "user"|"rival"|"empate" }> = {};

    userMatches.forEach((mm) => {
      const isP1 = mm.player1_id === uId;
      const rId = isP1 ? mm.player2_id : mm.player1_id;
      if (!rId || rId === "N/A") return;

      if (!rivalsMap[rId]) {
        rivalsMap[rId] = { matches: 0, userWins: 0, rivalWins: 0, lastWinner: "empate" };
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

    // Achar rival com maior 'matches'
    let topRivalId = "";
    let topMatches = 0;

    for (const rid of Object.keys(rivalsMap)) {
      if (rivalsMap[rid].matches > topMatches) {
        topMatches = rivalsMap[rid].matches;
        topRivalId = rid;
      }
    }
    if (!topRivalId) return null; // sem rival

    const data = rivalsMap[topRivalId];
    const userWins = data.userWins;
    const totalMatches = data.matches;
    const wr = totalMatches > 0 ? (userWins / totalMatches) * 100 : 0;

    const name = await getPlayerName(topRivalId);

    return {
      rivalId: topRivalId,
      rivalName: name,
      matches: totalMatches,
      userWins,
      rivalWins: data.rivalWins,
      lastWinner: data.lastWinner,
      wrPercentage: wr,
    };
  }

  async function handleRivalDetection(newRival: RivalData | null) {
    if (!newRival) {
      setRivalInfo(null);
      return;
    }
    // Carrega do AsyncStorage
    const oldRivalId = await AsyncStorage.getItem("@lastRivalId");

    setRivalInfo(newRival);

    // Se rival mudou
    if (oldRivalId !== newRival.rivalId) {
      setRivalModalVisible(true);
      await AsyncStorage.setItem("@lastRivalId", newRival.rivalId);
    }
  }

  // Função para pegar frases aleatórias conforme o resultado
const getRandomRivalPhrase = (result: "user" | "rival" | "empate") => {
  const phrases = {
    user: [
      "Tá voando, hein?! Venceu com estilo! 🚀🔥",
      "Foi um massacre! O rival nem viu de onde veio. 🎯😎",
      "Deu aula! O rival ainda tá tentando entender o que aconteceu. 📚😂",
      "Vitória confirmada! Dá até pra soltar aquele 'EZ'. 😏",
      "Boa! O rival já tá procurando tutorial no YouTube. 🎥😂"
    ],
    rival: [
      "Eita... levou aquela coça! Tenta de novo! 😂",
      "O rival mandou um 'GG EZ'... não vai deixar barato, né? 😡🔥",
      "Bom... pelo menos agora você sabe como perder com estilo. 😆",
      "Essa foi feia, hein... Mas é errando que se aprende! Ou não. 🤷‍♂️",
      "A derrota veio, mas o drama é opcional. Levanta e luta de novo! 🥋🔥"
    ],
    empate: [
      "Dois titãs colidiram... e ninguém venceu! ⚡🤜🤛",
      "Empate... Que tal um desempate pra ver quem é o verdadeiro campeão? 🏆",
      "Nada definido ainda! Próxima batalha decide tudo. 🔥",
      "Empate?! Dá pra aceitar isso? Bora revanche AGORA! 🤨",
      "Equilíbrio total! Um verdadeiro duelo de gigantes. 💥"
    ]
  };

  // Escolhe aleatoriamente uma frase da categoria correspondente
  const chosenPhrases = phrases[result] || [];
  return chosenPhrases[Math.floor(Math.random() * chosenPhrases.length)];
};

  // ============= BOTÕES =============
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

  // ============= RENDER =============
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

  // Stats
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
            {renderStatCard("Oponentes", stats.uniqueOpponents, "account-group", "#9980FA", 350)}
          </View>

          {/* Rival Card */}
          {rivalInfo && (
            <Animatable.View
              style={styles.rivalCard}
              animation="fadeInDown"
              delay={350}
            >
              {/* Ícone Rival */}
              <MaterialCommunityIcons name="sword-cross" size={30} color="#E3350D" />
              <Animatable.Text
                animation="pulse"
                iterationCount="infinite"
                style={styles.rivalTitle}
              >
                Rival Atual
              </Animatable.Text>

              {/* Corpo do Rival */}
              <View style={styles.rivalBody}>
                <Text style={styles.rivalName}>{rivalInfo.rivalName}</Text>
                <Text style={styles.rivalStats}>
                  Partidas: {rivalInfo.matches} | WR: {rivalInfo.wrPercentage.toFixed(1)}%
                </Text>
                <Text style={[styles.rivalStats, { textAlign: "center" }]}>
                  Última Partida: {getRandomRivalPhrase(rivalInfo.lastWinner || "empate")}
                </Text>
              </View>
            </Animatable.View>
          )}

          {/* Títulos + progress */}
          <Animatable.View
            animation="fadeInUp"
            style={styles.titlesContainer}
            delay={400}
          >
            <Text style={styles.titlesHeader}>Títulos Próximos</Text>
            {isCalculating ? (
              <ActivityIndicator size="large" color="#E3350D" style={{ marginTop: 20 }} />
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

        {/* BOTÕES NO FUNDO (3) */}
        <View style={styles.bottomButtons}>
          {/* Coleções Válidas */}
          <TouchableOpacity style={styles.validCollectionsButton} onPress={handleOpenCollections}>
            <MaterialCommunityIcons name={"book" as any} size={20} color="#FFF" />
            <Text style={[styles.bottomButtonText, { color: "#FFF", marginLeft: 6 }]}>
              Coleções Válidas
            </Text>
          </TouchableOpacity>

          {/* Doar */}
          <TouchableOpacity style={styles.donateButton} onPress={handleDonate}>
            <MaterialCommunityIcons name={"hand-coin" as any} size={20} color="#E3350D" />
            <Text style={[styles.bottomButtonText, { color: "#E3350D" }]}>Doar</Text>
          </TouchableOpacity>

          {/* Sair */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <MaterialCommunityIcons name={"logout" as any} size={20} color="#FFF" />
            <Text style={[styles.bottomButtonText, { color: "#FFF" }]}>Sair</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>

      {/* MODAL: Coleções Válidas */}
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
                <MaterialCommunityIcons name={"arrow-left" as any} size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Coleções Válidas</Text>
            </View>
            <View style={{ flex: 1, padding: 16, backgroundColor: "#1E1E1E" }}>
              {loadingCollections ? (
                <ActivityIndicator size="large" color="#E3350D" style={{ marginTop: 20 }} />
              ) : (
                <ScrollView>
                  {validCollections.map((set: any) => (
                    <View key={set.id} style={styles.collectionCard}>
                      <MaterialCommunityIcons
                        name={"star-four-points-outline" as any}
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

      {/* MODAL de Rival (quando muda) */}
      <Modal
        visible={rivalModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setRivalModalVisible(false)}
      >
        <View style={styles.rivalModalOverlay}>
          <Animatable.View style={styles.rivalModalContainer} animation="shake" duration={1200}>
            <Text style={styles.rivalModalTitle}>Novo Rival Detectado!</Text>
            {rivalInfo && (
              <>
                <MaterialCommunityIcons name="alert-decagram" size={46} color="#E3350D" />
                <Text style={styles.rivalModalText}>
                  {rivalInfo.rivalName} chegou para desafiar você!
                </Text>
              </>
            )}

            <TouchableOpacity
              style={styles.closeRivalModalBtn}
              onPress={() => setRivalModalVisible(false)}
            >
              <Text style={{ color: "#FFF", fontWeight: "bold" }}>Conferir seu Rival</Text>
            </TouchableOpacity>
          </Animatable.View>
        </View>
      </Modal>
    </View>
  );

  // RENDER FUNÇÕES
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

// ----------------------------------------------
// Componente Título com Progresso
// ----------------------------------------------
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
        name={"star-four-points" as any}
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

// ============ ESTILOS ============
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

  // STATS
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
});
