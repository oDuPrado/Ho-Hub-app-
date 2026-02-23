// ===========================================
// PÁGINA: RankingScreen.tsx
// ===========================================
// Ranking com 3 abas/guias:
//   1) Ranking Normal (pontuação = 3*wins + draws, critério secundário: winRate)
//   2) Ranking de "Mais Vices" (quem mais vezes ficou em 2º lugar)
//   3) Ranking de "Mais Participou" (quantidade de torneios distintos)
// Usa matchService.ts (fetchAllStatsByFilter) para cada jogador.
//
// PASSOS DE USO:
//  1) Adicione este RankingScreen ao seu Drawer/Stack, ex.:
//      <Drawer.Screen
//        name="Ranking"
//        component={RankingScreen}
//        options={{ title: "Ranking" }}
//      />
//  2) Ajuste imports conforme seu projeto.
//
// Observação: Ele respeita o filterType salvo no AsyncStorage
// ("all" | "city" | "league"), lendo os jogadores corretos.

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";
import { fetchAllStatsByFilter } from "../../lib/matchService";
import * as Animatable from "react-native-animatable";
import { Ionicons } from "@expo/vector-icons";


// ==== Tipos para o Ranking
interface RankingItem {
  playerId: string;
  name: string;
  wins: number;
  draws: number;
  losses: number;
  matches: number;
  points: number;           // 3*wins + draws
  winRate: number;          // (wins/matches)*100
  secondPlaces: number;     // quantas vezes ficou em 2º lugar
  distinctTournaments: number; // quantos torneios diferentes participou
}

type TabType = "points" | "vices" | "participacoes";

export default function RankingScreen() {
  const [loading, setLoading] = useState(true);
  const [rankingData, setRankingData] = useState<RankingItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("points");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        // Lê o tipo de filtro salvo
        const filterType = (await AsyncStorage.getItem("@filterType")) || "all";
        if (filterType !== "all") {
          const leagueStored = await AsyncStorage.getItem("@leagueId");
          if (!leagueStored && filterType !== "city") {
            Alert.alert(
              "Atenção",
              "Nenhuma liga definida. Ajuste o filtro para ver o ranking."
            );
            setLoading(false);
            return;
          }
        }

        // Busca a lista de players conforme o filtro
        const playersList = await fetchPlayersByFilter(filterType);

        // Monta array final
        const finalArr: RankingItem[] = await Promise.all(
          playersList.map(async (p) => {
            const aggregated = await fetchAllStatsByFilter(p.id);
            const w = aggregated.wins;
            const d = aggregated.draws;
            const l = aggregated.losses;
            const total = aggregated.matchesTotal;
            const points = w * 3 + d;
            const wr = total > 0 ? (w / total) * 100 : 0;

            let secondCount = 0;
            const uniqueTIDs = new Set<string>();

            if (aggregated.tournamentPlacements?.length) {
              aggregated.tournamentPlacements.forEach((tp) => {
                if (tp.place === 2) {
                  secondCount++;
                }
                uniqueTIDs.add(tp.tournamentId);
              });
            }

            return {
              playerId: p.id,
              name: p.name,
              wins: w,
              draws: d,
              losses: l,
              matches: total,
              points,
              winRate: wr,
              secondPlaces: secondCount,
              distinctTournaments: uniqueTIDs.size,
            };
          })
        );

        setRankingData(finalArr);
      } catch (err) {
        console.log(err);
        Alert.alert("Erro", "Falha ao carregar ranking.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ==============================
  // FUNÇÃO DE OBTENÇÃO DE PLAYERS
  // ==============================
  async function fetchPlayersByFilter(
    filterType: string
  ): Promise<{ id: string; name: string }[]> {
    const arr: { id: string; name: string }[] = [];
    const cityStored = await AsyncStorage.getItem("@selectedCity");
    const leagueStored = await AsyncStorage.getItem("@leagueId");

    // "all" => pega players na raiz
    if (!filterType || filterType === "all") {
      const snap = await getDocs(collection(db, "players"));
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        arr.push({
          id: docSnap.id,
          name: d.fullname || docSnap.id,
        });
      });
    } else if (filterType === "city" && cityStored) {
      // Pega ligas da cidade
      const qCity = query(collection(db, "leagues"), where("city", "==", cityStored));
      const snapCity = await getDocs(qCity);
      const leagueIds = snapCity.docs.map((d) => d.id);
      const playersByLeague = await Promise.all(
        leagueIds.map(async (lid) => {
          const plRef = collection(db, `leagues/${lid}/players`);
          const plSnap = await getDocs(plRef);
          return plSnap.docs.map((pDoc) => {
            const pData = pDoc.data();
            return {
              id: pDoc.id,
              name: pData.fullname || pDoc.id,
            };
          });
        })
      );
      playersByLeague.flat().forEach((p) => arr.push(p));
    } else if (filterType === "league" && leagueStored) {
      const plRef = collection(db, `leagues/${leagueStored}/players`);
      const plSnap = await getDocs(plRef);
      plSnap.forEach((pDoc) => {
        const pData = pDoc.data();
        arr.push({
          id: pDoc.id,
          name: pData.fullname || pDoc.id,
        });
      });
    }
    return arr;
  }

  // ==============================
  // FUNÇÃO: Ordenar de acordo com tab
  // ==============================
  function getSortedRanking(): RankingItem[] {
    const copy = [...rankingData];
    if (activeTab === "points") {
      // Ranking normal: ordena decrescente por points, tie => maior WR
      copy.sort((a, b) => {
        if (b.points === a.points) {
          return b.winRate - a.winRate;
        }
        return b.points - a.points;
      });
    } else if (activeTab === "vices") {
      // Ranking de Mais Vices
      // tie => points
      copy.sort((a, b) => {
        if (b.secondPlaces === a.secondPlaces) {
          return b.points - a.points;
        }
        return b.secondPlaces - a.secondPlaces;
      });
    } else if (activeTab === "participacoes") {
      // Ranking de Mais Participou (torneios distintos)
      // tie => points
      copy.sort((a, b) => {
        if (b.distinctTournaments === a.distinctTournaments) {
          return b.points - a.points;
        }
        return b.distinctTournaments - a.distinctTournaments;
      });
    }
    return copy;
  }

  // ==============================
  // RENDER
  // ==============================
  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#E3350D" />
        <Text style={{ color: "#FFF", marginTop: 12 }}>Carregando Ranking...</Text>
      </View>
    );
  }

  if (rankingData.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.pageTitle}>Ranking</Text>
        <Text style={{ color: "#FFF", textAlign: "center", marginTop: 20 }}>
          Nenhum jogador encontrado.
        </Text>
      </View>
    );
  }

  const sorted = getSortedRanking();

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Ranking</Text>

      {/* Abas */}
      <View style={styles.tabsRow}>
        <TabButton
          label="Pontuação"
          active={activeTab === "points"}
          onPress={() => setActiveTab("points")}
        />
        <TabButton
          label="Mais Vices"
          active={activeTab === "vices"}
          onPress={() => setActiveTab("vices")}
        />
        <TabButton
          label="Participação"
          active={activeTab === "participacoes"}
          onPress={() => setActiveTab("participacoes")}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {sorted.map((item, index) => {
          return (
            <RankCard key={item.playerId} rank={index + 1} data={item} tab={activeTab} />
          );
        })}
      </ScrollView>
    </View>
  );
}

// ===================================
// COMPONENTE DE BOTÃO DE ABA
// ===================================
function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tabButton, active && styles.tabButtonActive]}
      onPress={onPress}
    >
      <Text style={[styles.tabButtonText, active && { color: "#FFF" }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ===================================
// COMPONENTE RankCard
// ===================================
function RankCard({
  rank,
  data,
  tab,
}: {
  rank: number;
  data: RankingItem;
  tab: TabType;
}) {
  // Lógica de ícone/animação se for top 3
  let iconName: any = null;
  let color = "#FFF";
  let anim = null;
  if (rank === 1) {
    iconName = "medal-outline";
    color = "#FFD700";
    anim = "tada";
  } else if (rank === 2) {
    iconName = "ribbon-outline";
    color = "#C0C0C0";
    anim = "pulse";
  } else if (rank === 3) {
    iconName = "shield-half-outline";
    color = "#CD7F32";
    anim = "bounceIn";
  }

  // Campo principal, dependendo da aba
  let mainLabel = "";
  let mainValue: number | string = 0;

  if (tab === "points") {
    mainLabel = "Pts";
    mainValue = data.points;
  } else if (tab === "vices") {
    mainLabel = "Vices";
    mainValue = data.secondPlaces;
  } else {
    mainLabel = "Torn.";
    mainValue = data.distinctTournaments;
  }

  return (
    <Animatable.View
      style={styles.rankCard}
      animation={anim || "fadeInUp"}
      delay={rank * 80}
    >
      <View style={styles.rankLeft}>
        <Text style={[styles.rankNumber, rank <= 3 && { color }]}>{rank}</Text>
        {iconName && (
          <Ionicons name={iconName} size={24} color={color} style={{ marginLeft: 4 }} />
        )}
      </View>

      <View style={styles.rankCenter}>
        <Text style={styles.playerName}>{data.name}</Text>
        {tab === "points" && (
          <Text style={styles.subInfo}>
            {data.wins}V / {data.draws}E / {data.losses}D - {data.winRate.toFixed(1)}% WR
          </Text>
        )}
        {tab === "vices" && (
          <Text style={styles.subInfo}>
            {data.secondPlaces}x Vice - {data.points} pts
          </Text>
        )}
        {tab === "participacoes" && (
          <Text style={styles.subInfo}>
            {data.distinctTournaments} torneios - {data.points} pts
          </Text>
        )}
      </View>

      <View style={styles.rankRight}>
        <Text style={styles.mainValue}>{mainValue}</Text>
        <Text style={styles.mainLabel}>{mainLabel}</Text>
      </View>
    </Animatable.View>
  );
}

// ===================================
// ESTILOS
// ===================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
    alignItems: "center",
  },
  pageTitle: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
  },
  tabsRow: {
    flexDirection: "row",
    marginBottom: 16,
    justifyContent: "center",
  },
  tabButton: {
    borderWidth: 1,
    borderColor: "#FFF",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 4,
  },
  tabButtonActive: {
    backgroundColor: "#E3350D",
    borderColor: "#E3350D",
  },
  tabButtonText: {
    color: "#DDD",
    fontWeight: "bold",
  },
  rankCard: {
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#444",
  },
  rankLeft: {
    width: 50,
    flexDirection: "row",
    alignItems: "center",
  },
  rankNumber: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFF",
  },
  rankCenter: {
    flex: 1,
    justifyContent: "center",
    paddingLeft: 4,
  },
  playerName: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  subInfo: {
    color: "#aaa",
    fontSize: 12,
    marginTop: 2,
  },
  rankRight: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  mainValue: {
    color: "#E3350D",
    fontWeight: "bold",
    fontSize: 18,
  },
  mainLabel: {
    color: "#999",
    fontSize: 12,
  },
});
