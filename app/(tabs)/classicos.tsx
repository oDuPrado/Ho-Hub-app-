// app/(tabs)/classicos.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Animatable from "react-native-animatable";

import { collectionGroup, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";

// Exemplo de “Clássico”
interface Classico {
  id: number;
  name: string;
  description: string;
  icon: string;
  iconColor: string;
  checkCondition: (matches: RivalMatchInfo) => boolean;
}

// Info de Rival X user
interface RivalMatchInfo {
  rivalId: string;
  matchesCount: number;
  userWins: number;
  rivalWins: number;
  isRivalCurrent: boolean; // se for o rival atual
}

// Filtraremos e atribuiremos “clássicos”
const classicosList: Classico[] = [
    {
      id: 1,
      name: "Ash vs Gary: Rivalidade Eterna",
      description: "Mais de 10 batalhas épicas com vitórias equilibradas. Quem será o verdadeiro Mestre Pokémon?",
      icon: "pokeball",
      iconColor: "#E3350D",
      checkCondition: (info) => info.matchesCount > 10 && Math.abs(info.userWins - info.rivalWins) <= 2,
    },
    {
      id: 2,
      name: "Confronto de Titãs: Dialga vs Palkia",
      description: "Ambos com 5+ vitórias. Uma batalha que transcende o tempo e o espaço!",
      icon: "sword-cross",
      iconColor: "#FFC312",
      checkCondition: (info) => info.userWins >= 5 && info.rivalWins >= 5,
    },
    {
      id: 3,
      name: "Desafio do Arquipélago de Alola",
      description: "15+ batalhas intensas. Provem seu valor em todas as ilhas!",
      icon: "island",
      iconColor: "#1DD1A1",
      checkCondition: (info) => info.matchesCount >= 15,
    },
    {
      id: 4,
      name: "Kyogre vs Groudon: Tempestade Primordial",
      description: "20+ vitórias combinadas. Uma batalha que pode remodelar o mundo!",
      icon: "weather-windy-variant",
      iconColor: "#A3CB38",
      checkCondition: (info) => (info.userWins + info.rivalWins) >= 20,
    },
    {
      id: 5,
      name: "Campeão Invicto de Galar",
      description: "70%+ de vitórias. Digno de enfrentar o lendário Leon!",
      icon: "crown",
      iconColor: "#F79F1F",
      checkCondition: (info) => {
        const userWR = (info.matchesCount > 0) ? (info.userWins / info.matchesCount)*100 : 0;
        const rivalWR = (info.matchesCount > 0) ? (info.rivalWins / info.matchesCount)*100 : 0;
        return (userWR >= 70) || (rivalWR >= 70);
      },
    },
    {
      id: 6,
      name: "O Legado de Red",
      description: "5+ vitórias sem derrotas. Uma performance digna do lendário Red!",
      icon: "alpha-z-box",
      iconColor: "#EE5A24",
      checkCondition: (info) => info.matchesCount >= 5 && info.userWins === info.matchesCount,
    },
    {
      id: 7,
      name: "Batalha dos Cem: Maratona Pokémon",
      description: "100+ partidas disputadas. Uma rivalidade que resistiu ao teste do tempo!",
      icon: "numeric-100-box",
      iconColor: "#FF6F00",
      checkCondition: (info) => info.matchesCount >= 100,
    },
    {
      id: 8,
      name: "Equilíbrio Perfeito: Yin e Yang",
      description: "50+ partidas com diferença de vitórias de no máximo 3. Um duelo equilibrado!",
      icon: "yin-yang",
      iconColor: "#FFFFFF",
      checkCondition: (info) => info.matchesCount >= 50 && Math.abs(info.userWins - info.rivalWins) <= 3,
    },
    {
      id: 9,
      name: "Mestre e Aprendiz: A Jornada do Conhecimento",
      description: "Um jogador com 2x mais vitórias que o outro após 30+ partidas. Quem é o mestre?",
      icon: "school",
      iconColor: "#4CAF50",
      checkCondition: (info) => info.matchesCount >= 30 && (info.userWins >= 2 * info.rivalWins || info.rivalWins >= 2 * info.userWins),
    },
    {
      id: 10,
      name: "Duelo dos Campeões: Elite Four Challenge",
      description: "Ambos os jogadores com 40+ vitórias. Uma batalha digna da Elite Four!",
      icon: "shield-star",
      iconColor: "#FFC107",
      checkCondition: (info) => info.userWins >= 40 && info.rivalWins >= 40,
    },
    {
      id: 11,
      name: "Rivalidade Acirrada: Cada Vitória Conta",
      description: "75+ partidas com diferença de no máximo 5 vitórias. Quem será o vencedor final?",
      icon: "fire",
      iconColor: "#FF5722",
      checkCondition: (info) => info.matchesCount >= 75 && Math.abs(info.userWins - info.rivalWins) <= 5,
    },
    {
      id: 12,
      name: "Domínio Absoluto: O Reinado do Campeão",
      description: "Um jogador com 80%+ de vitórias após 50+ partidas. Uma demonstração de maestria!",
      icon: "crown",
      iconColor: "#9C27B0",
      checkCondition: (info) => {
        const winRate = info.matchesCount > 0 ? Math.max(info.userWins, info.rivalWins) / info.matchesCount : 0;
        return info.matchesCount >= 50 && winRate >= 0.8;
      },
    },
    
  ];
  

interface RivalStats {
  rivalId: string;
  rivalName: string;
  matchesCount: number;
  userWins: number;
  rivalWins: number;
  classicosIds: number[];  // Quais clássicos se encaixam
  isRivalCurrent: boolean; // Destacar
}

// Filtros
type FilterType = "todoDia" | "fregues" | "deixaQuieto";

export default function ClassicosScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [rivalsData, setRivalsData] = useState<RivalStats[]>([]);
  const [filterType, setFilterType] = useState<FilterType>("todoDia"); 
  const [currentRivalId, setCurrentRivalId] = useState<string>(""); // Rival atual

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const storedId = await AsyncStorage.getItem("@userId");
        if (!storedId) {
          router.replace("/(auth)/login");
          return;
        }
        setUserId(storedId);

        // Rival atual
        const oldRivalId = await AsyncStorage.getItem("@lastRivalId");
        setCurrentRivalId(oldRivalId || "");

        // Pegar partidas
        const allMatches = await fetchAllMatches();
        const userMatches = allMatches.filter(
          (m) => m.player1_id === storedId || m.player2_id === storedId
        );

        // Montar RivalStats
        const statsMap: Record<string, RivalStats> = {};

        for (let mm of userMatches) {
          const isP1 = mm.player1_id === storedId;
          const rId = isP1 ? mm.player2_id : mm.player1_id;
          if (!rId || rId === "N/A") continue;

          if (!statsMap[rId]) {
            statsMap[rId] = {
              rivalId: rId,
              rivalName: `User ${rId}`, // buscaremos no getName
              matchesCount: 0,
              userWins: 0,
              rivalWins: 0,
              classicosIds: [],
              isRivalCurrent: false,
            };
          }

          statsMap[rId].matchesCount += 1;

          const outcome = mm.outcomeNumber || 0;
          if (outcome === 1) {
            if (isP1) statsMap[rId].userWins++;
            else statsMap[rId].rivalWins++;
          } else if (outcome === 2) {
            if (isP1) statsMap[rId].rivalWins++;
            else statsMap[rId].userWins++;
          } else if (outcome === 10) {
            if (isP1) statsMap[rId].rivalWins++;
            else statsMap[rId].userWins++;
          }
        }

        // Buscamos nomes no Firestore
        const finalData: RivalStats[] = [];
        for (let rid of Object.keys(statsMap)) {
          const docRef = doc(db, "players", rid);
          const snap = await getDoc(docRef);
          let fname = `User ${rid}`;
          if (snap.exists()) {
            const data = snap.data();
            fname = data?.fullname || fname;
          }

          // Determina se é rival atual
          const isCurrent = rid === oldRivalId;

          finalData.push({
            ...statsMap[rid],
            rivalName: fname,
            isRivalCurrent: isCurrent,
          });
        }

        // Atribuir clássicos => "apenas 1 rival pode ter"
        // 1) Checamos se se encaixa em classicoList
        // 2) Escolhemos "vencedor" = quem tiver mais matches
        let partialMap: Record<number, RivalStats[]> = {};
        for (let c of classicosList) {
          partialMap[c.id] = [];
        }

        // Identifica pra cada Rival quais clássicos se encaixam
        for (let rs of finalData) {
          const info: RivalMatchInfo = {
            rivalId: rs.rivalId,
            matchesCount: rs.matchesCount,
            userWins: rs.userWins,
            rivalWins: rs.rivalWins,
            isRivalCurrent: rs.isRivalCurrent,
          };
          for (let c of classicosList) {
            if (c.checkCondition(info)) {
              // Se encaixa
              partialMap[c.id].push(rs);
            }
          }
        }

        // 3) Em cada clássico, escolhe 1 Rival => o que tiver maior matchesCount
        for (let cid of Object.keys(partialMap)) {
          const cIdNum = parseInt(cid, 10);
          let arr = partialMap[cIdNum];
          if (!arr || arr.length === 0) continue;
          // Ordena decrescente de matches
          arr.sort((a, b) => b.matchesCount - a.matchesCount);

          // O "vencedor" do clássico é arr[0]
          let winnerId = arr[0].rivalId;

          // Adicionamos no finalData
          const idx = finalData.findIndex((x) => x.rivalId === winnerId);
          finalData[idx].classicosIds.push(cIdNum);
        }

        setRivalsData(finalData);
      } catch (error) {
        console.log("Erro classicos:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function fetchAllMatches() {
    const snap = await getDocs(collectionGroup(db, "matches"));
    const arr: any[] = [];
    snap.forEach((docSnap) => {
      arr.push({ id: docSnap.id, ...docSnap.data() });
    });
    return arr;
  }

  // =============== FILTROS ===============
  const filteredRivals = getFilteredRivals();

  function getFilteredRivals(): RivalStats[] {
    // Rival atual sempre no topo
    let data = [...rivalsData];

    // remover do array e re-add no topo
    const currIdx = data.findIndex((x) => x.isRivalCurrent);
    if (currIdx >= 0) {
      const [curr] = data.splice(currIdx, 1);
      data.unshift(curr);
    }

    // filtra/ordena
    switch (filterType) {
      case "todoDia":
        // Mais partidas -> menor
        data.sort((a, b) => b.matchesCount - a.matchesCount);
        break;
      case "fregues":
        // quem mais perde p/ user => userWins - rivalWins? Maior => top
        data.sort((a, b) => (b.userWins - b.rivalWins) - (a.userWins - a.rivalWins));
        break;
      case "deixaQuieto":
        // quem mais te vence => rivalWins - userWins => maior => top
        data.sort((a, b) => (b.rivalWins - b.userWins) - (a.rivalWins - a.userWins));
        break;
    }

    // Rival atual no topo, mesmo se o filtro mudasse a posição
    // (já movemos no começo)
    return data;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Clássicos</Text>
      </View>

      {/* Filtros */}
      <View style={styles.filtersRow}>
        <TouchableOpacity
          style={[
            styles.filterBtn,
            filterType === "todoDia" && { backgroundColor: "#E3350D" },
          ]}
          onPress={() => setFilterType("todoDia")}
        >
          <Text style={styles.filterText}>Encontro Todo Dia</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterBtn,
            filterType === "fregues" && { backgroundColor: "#E3350D" },
          ]}
          onPress={() => setFilterType("fregues")}
        >
          <Text style={styles.filterText}>Freguês</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterBtn,
            filterType === "deixaQuieto" && { backgroundColor: "#E3350D" },
          ]}
          onPress={() => setFilterType("deixaQuieto")}
        >
          <Text style={styles.filterText}>Deixa Quieto</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E3350D" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollInner}>
          <Text style={styles.infoText}>
            Bem vindo a sua pagina de Clássicos, aqui você vai encontrar seus maiores
          </Text>

          {filteredRivals.map((rd) => (
            <Animatable.View
              key={rd.rivalId}
              style={[
                styles.rivalBox,
                rd.isRivalCurrent && { borderColor: "#FFC312", backgroundColor: "#333" },
              ]}
              animation="fadeInUp"
            >
              <Text style={[styles.rivalTitle, rd.isRivalCurrent && { color: "#FFC312" }]}>
                {rd.rivalName} {rd.isRivalCurrent && " (Rival Atual)"}
              </Text>
              <Text style={styles.rivalText}>
                Partidas: {rd.matchesCount} | Você: {rd.userWins} vs Rival: {rd.rivalWins}
              </Text>

              {/* Lista de Clássicos */}
              {rd.classicosIds.length > 0 ? (
                rd.classicosIds.map((cid) => {
                  const cls = classicosList.find((c) => c.id === cid);
                  if (!cls) return null;
                  return (
                    <Animatable.View
                      key={cls.id}
                      animation="fadeInRight"
                      style={styles.classicoCard}
                    >
                      <MaterialCommunityIcons
                        name={cls.icon as any}
                        size={24}
                        color={cls.iconColor}
                        style={{ marginRight: 10 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.classicoName}>{cls.name}</Text>
                        <Text style={styles.classicoDesc}>{cls.description}</Text>
                      </View>
                    </Animatable.View>
                  );
                })
              ) : (
                <Text style={styles.noClassicosText}>Sem clássicos</Text>
              )}
            </Animatable.View>
          ))}
        </ScrollView>
      )}
    </View>
  );

  // ============ FUNÇÕES EXTRAS =============
  async function getDocData(rid: string) {
    const docRef = doc(db, "players", rid);
    const snap = await getDoc(docRef);
    if (snap.exists()) return snap.data();
    return null;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
  },
  header: {
    backgroundColor: "#000",
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  headerTitle: {
    color: "#E3350D",
    fontSize: 20,
    fontWeight: "bold",
  },
  filtersRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 6,
    backgroundColor: "#111",
  },
  filterBtn: {
    borderColor: "#E3350D",
    borderWidth: 1.5,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginHorizontal: 4,
  },
  filterText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollInner: {
    padding: 16,
  },
  infoText: {
    color: "#FFF",
    fontSize: 14,
    marginBottom: 16,
  },
  rivalBox: {
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "#444",
  },
  rivalTitle: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 4,
  },
  rivalText: {
    color: "#FFF",
    fontSize: 13,
    marginBottom: 8,
  },
  classicoCard: {
    flexDirection: "row",
    backgroundColor: "#3A3A3A",
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#555",
  },
  classicoName: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  classicoDesc: {
    color: "#CCC",
    fontSize: 12,
  },
  noClassicosText: {
    color: "#999",
    fontStyle: "italic",
  },
});

