import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  BackHandler,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Animatable from "react-native-animatable";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";
import { fetchRivalByFilter } from "../../lib/matchService";

// Clássicos e tiers
import classicosList from "../classicosConfig"; // Usamos getActiveClassicosForDuo() adaptado

// Tipos e interfaces
interface PlayerInfo {
  id: string;
  fullname: string;
}

interface ClassicsDoc {
  opponents: {
    [oppId: string]: {
      matches: number;
      wins: number;
      losses: number;
      draws: number;
    };
  };
  updatedAt?: any;
}

type DisplayFilter = "normal" | "vejo" | "fregues" | "deixa";

export default function ClassicosScreen() {
  // =============== ESTADOS ===============
  const [rivalName, setRivalName] = useState("Sem Rival");
  const [classicsData, setClassicsData] = useState<ClassicsDoc | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [duoStatsList, setDuoStatsList] = useState<any[]>([]);
  const [displayFilter, setDisplayFilter] = useState<DisplayFilter>("normal");

  const [classicosModalVisible, setClassicosModalVisible] = useState(false);
  const [classicosInfoModalVisible, setClassicosInfoModalVisible] = useState(false);

  // ============ FOCUS E BACKHANDLER ============
  const loadClassicosPage = useCallback(async () => {
    try {
      const storedUserId = await AsyncStorage.getItem("@userId");
      if (!storedUserId) {
        console.log("ID do usu?rio n?o encontrado.");
        return;
      }

      const filterType = await AsyncStorage.getItem("@filterType");
      const cityStored = await AsyncStorage.getItem("@selectedCity");
      const leagueStored = await AsyncStorage.getItem("@leagueId");

      if (filterType === "league" && leagueStored) {
        const rivalDoc = await fetchRivalByFilter(storedUserId);
        if (rivalDoc) {
          setRivalName(rivalDoc.rivalName);
        } else {
          setRivalName("Sem Rival");
        }
      } else {
        setRivalName("Rival indispon?vel (Somente no modo Liga)");
      }

      const userClassics = await getClassicsDocWithCache(
        leagueStored,
        storedUserId,
        filterType || "all"
      );
      setClassicsData(userClassics);

      const loadedPlayers = await loadPlayersByFilter(filterType, cityStored, leagueStored);
      setPlayers(loadedPlayers);

      const allClassicsData = await getAllClassicsDocsWithCache(
        loadedPlayers,
        leagueStored,
        filterType || "all"
      );
      const combos = buildAllDuoStats(allClassicsData);
      setDuoStatsList(combos);
    } catch (err) {
      console.log("Erro ao carregar tela Cl?ssicos:", err);
    }
  }, [getAllClassicsDocsWithCache, getClassicsDocWithCache, loadPlayersByFilter]);

  useFocusEffect(
    useCallback(() => {
      loadClassicosPage();
    }, [loadClassicosPage])
  );

  useEffect(() => {
    const backAction = () => {
      if (classicosModalVisible) {
        setClassicosModalVisible(false);
        return true;
      }
      if (classicosInfoModalVisible) {
        setClassicosInfoModalVisible(false);
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => subscription.remove();
  }, [classicosModalVisible, classicosInfoModalVisible]);

// ============ FUNÇÕES DE LEITURA ============
  async function getClassicsDocWithCache(
    leagueId: string | null,
    userId: string,
    filterType: string
  ): Promise<ClassicsDoc | null> {
    if (!leagueId) return null;
    const cacheKey = `@classics_user_${userId}_${filterType}_${leagueId}`;
    const cachedStr = await AsyncStorage.getItem(cacheKey);
    if (cachedStr) {
      const parsed = JSON.parse(cachedStr);
      const now = Date.now();
      if (now - parsed.timestamp < 30 * 60 * 1000) {
        console.log("⏳ Usando cache local de /stats/classics do usuário");
        return parsed.data;
      }
    }
    console.log("🔎 Buscando documento /stats/classics do usuário no Firestore...");
    const docRef = doc(db, `leagues/${leagueId}/players/${userId}/stats`, "classics");
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const data = snap.data() as ClassicsDoc;
    await AsyncStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
    return data;
  }

  async function loadPlayersByFilter(
    filterType: string | null,
    cityStored: string | null,
    leagueStored: string | null
  ): Promise<PlayerInfo[]> {
    let leaguesToFetch: string[] = [];

    if (!filterType || filterType === "all") {
      const leaguesSnap = await getDocs(collection(db, "leagues"));
      leaguesSnap.forEach((docSnap) => leaguesToFetch.push(docSnap.id));
    } else if (filterType === "city" && cityStored) {
      const qCity = query(collection(db, "leagues"), where("city", "==", cityStored));
      const citySnapshot = await getDocs(qCity);
      citySnapshot.forEach((docSnap) => leaguesToFetch.push(docSnap.id));
    } else if (filterType === "league" && leagueStored) {
      leaguesToFetch.push(leagueStored);
    }

    if (leaguesToFetch.length === 0) return [];

    const playersByLeague = await Promise.all(
      leaguesToFetch.map(async (lid) => {
        const pSnap = await getDocs(collection(db, `leagues/${lid}/players`));
        return pSnap.docs.map((ds) => {
          const d = ds.data();
          return { id: ds.id, fullname: d.fullname || `User ${ds.id}` };
        });
      })
    );

    const seen = new Map<string, PlayerInfo>();
    playersByLeague.flat().forEach((p) => {
      if (!seen.has(p.id)) {
        seen.set(p.id, p);
      }
    });
    return Array.from(seen.values());
  }

  async function getAllClassicsDocsWithCache(
    playersArr: PlayerInfo[],
    leagueId: string | null,
    filterType: string
  ): Promise<Record<string, ClassicsDoc>> {
    if (!leagueId) return {};
    const cacheKey = `@classics_all_${filterType}_${leagueId}`;
    const cachedStr = await AsyncStorage.getItem(cacheKey);
    if (cachedStr) {
      const parsed = JSON.parse(cachedStr);
      if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
        console.log("⏳ Usando cache local de /stats/classics de todos os jogadores");
        return parsed.data;
      }
    }
    console.log("🔎 Buscando documentos /stats/classics de todos os jogadores no Firestore...");
    const result: Record<string, ClassicsDoc> = {};
    await Promise.all(
      playersArr.map(async (p) => {
        const docRef = doc(db, `leagues/${leagueId}/players/${p.id}/stats`, "classics");
        const snap = await getDoc(docRef);
        result[p.id] = snap.exists() ? (snap.data() as ClassicsDoc) : { opponents: {} };
      })
    );
    await AsyncStorage.setItem(cacheKey, JSON.stringify({ data: result, timestamp: Date.now() }));
    return result;
  }

  // ============ MONTAR LISTA DE DUPLAS ============
  function buildAllDuoStats(allClassics: Record<string, ClassicsDoc>): any[] {
    const userIds = Object.keys(allClassics).sort();
    const combosSet = new Set<string>();

    for (let i = 0; i < userIds.length; i++) {
      for (let j = i + 1; j < userIds.length; j++) {
        const A = userIds[i];
        const B = userIds[j];
        const comboKey = A < B ? `${A}_${B}` : `${B}_${A}`;
        combosSet.add(comboKey);
      }
    }

    const results: any[] = [];
    combosSet.forEach((key) => {
      const [A, B] = key.split("_");
      const dataA = allClassics[A]?.opponents || {};
      const statsAB = dataA[B];
      if (!statsAB || statsAB.matches === 0) return;

      const dataB = allClassics[B]?.opponents || {};
      const statsBA = dataB[A];
      const winsB = statsBA ? statsBA.wins : 0;

      const statsDuoFull = {
        playerA: A,
        playerB: B,
        matches: statsAB.matches,
        winsA: statsAB.wins,
        winsB: winsB,
        draws: statsAB.draws,
      };

      const classicosActive = getActiveClassicos(statsDuoFull);
      if (classicosActive.length > 0) {
        results.push({
          playerA: A,
          playerB: B,
          stats: statsDuoFull,
          classicos: classicosActive,
        });
      }
    });

    return results;
  }

  function getActiveClassicos(statsDuo: {
    playerA: string;
    playerB: string;
    matches: number;
    winsA: number;
    winsB: number;
    draws: number;
  }) {
    const found: any[] = [];
    for (const cItem of classicosList) {
      if (cItem.condition) {
        const ok = cItem.condition({
          playerA: statsDuo.playerA,
          playerB: statsDuo.playerB,
          matches: statsDuo.matches,
          winsA: statsDuo.winsA,
          winsB: statsDuo.winsB,
          draws: statsDuo.draws,
        });
        if (ok) {
          found.push(cItem);
        }
      }
    }
    return found;
  }

  // ============ FILTRO LOCAL ============
  function handleSetFilter(f: DisplayFilter) {
    setDisplayFilter(f);
  }

  function getFilteredOpponents(): string[] {
    if (!classicsData) return [];
    const oppIds = Object.keys(classicsData.opponents);
    const arr = oppIds.map((id) => {
      const st = classicsData.opponents[id];
      return { id, ...st };
    });

    arr.sort((a, b) => {
      if (displayFilter === "vejo") {
        return b.matches - a.matches;
      } else if (displayFilter === "fregues") {
        return b.wins - a.wins;
      } else if (displayFilter === "deixa") {
        return b.losses - a.losses;
      }
      return 0; // normal
    });
    return arr.map((x) => x.id);
  }

  // ============ MODAIS ============

  // ============ RENDER ============
  const filteredOppIds = getFilteredOpponents();

  return (
    <View style={styles.container}>
      <Animatable.Text style={styles.title} animation="slideInDown" duration={600}>
        CLÁSSICOS
      </Animatable.Text>

      <ScrollView style={{ flex: 1, marginHorizontal: 10 }}>
        <Animatable.View style={styles.rivalCard} animation="bounceIn" delay={200}>
          <Ionicons name="flash" size={28} color="#E3350D" style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rivalTitle}>Rival Atual</Text>
            <Text style={styles.rivalName}>{rivalName}</Text>
          </View>
        </Animatable.View>

        {/* FILTRO LOCAL */}
        <Animatable.View style={styles.filterRow} animation="fadeIn" delay={300}>
          <TouchableOpacity
            style={[styles.filterBtn, displayFilter === "normal" && styles.filterBtnActive]}
            onPress={() => handleSetFilter("normal")}
          >
            <Ionicons name="options" size={18} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.filterBtnText}>Normal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterBtn, displayFilter === "vejo" && styles.filterBtnActive]}
            onPress={() => handleSetFilter("vejo")}
          >
            <Ionicons name="eye" size={18} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.filterBtnText}>Vejo Todo Dia</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterBtn, displayFilter === "fregues" && styles.filterBtnActive]}
            onPress={() => handleSetFilter("fregues")}
          >
            <Ionicons name="checkmark-done" size={18} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.filterBtnText}>Freguês</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterBtn, displayFilter === "deixa" && styles.filterBtnActive]}
            onPress={() => handleSetFilter("deixa")}
          >
            <Ionicons name="skull" size={18} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.filterBtnText}>Deixa Quieto</Text>
          </TouchableOpacity>
        </Animatable.View>

        <Animatable.Text
          style={styles.subParagraph}
          animation="fadeInUp"
          delay={400}
        >
          Selecione um filtro e veja como se comportam seus confrontos.
        </Animatable.Text>

        {/* LISTA DE OPONENTES DO USUÁRIO */}
        {filteredOppIds.map((oppId, index) => {
          const st = classicsData?.opponents[oppId];
          if (!st || st.matches === 0) return null;
          const pObj = players.find((pp) => pp.id === oppId);
          const oppName = pObj ? pObj.fullname : `User ${oppId}`;

          return (
            <Animatable.View
              style={styles.duoCard}
              key={oppId}
              animation="fadeInUp"
              delay={100 * (index + 1)}
            >
              <Text style={styles.duoTitle}>
                vs {oppName} ({st.matches} partidas)
              </Text>
              <View style={styles.duoStatsContainer}>
                <View style={styles.statBox}>
                  <Ionicons name="trophy" size={16} color="#FFD700" />
                  <Text style={styles.statText}>Vitórias: {st.wins}</Text>
                </View>
                <View style={styles.statBox}>
                  <Ionicons name="skull" size={16} color="#E3350D" />
                  <Text style={styles.statText}>Derrotas: {st.losses}</Text>
                </View>
                <View style={styles.statBox}>
                  <Ionicons name="hand-left" size={16} color="#3498db" />
                  <Text style={styles.statText}>Empates: {st.draws}</Text>
                </View>
              </View>
            </Animatable.View>
          );
        })}
      </ScrollView>

      {/* BOTÕES FOOTER */}
      <Animatable.View style={styles.footerButtons} animation="fadeInUp" delay={400}>
        <TouchableOpacity style={styles.footerBtn} onPress={() => setClassicosModalVisible(true)}>
          <Ionicons name="people" size={20} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.footerBtnText}>Clássicos da Liga</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.footerBtn, { backgroundColor: "#666" }]}
          onPress={() => setClassicosInfoModalVisible(true)}
        >
          <Ionicons name="information-circle" size={20} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.footerBtnText}>Clássicos - Info</Text>
        </TouchableOpacity>
      </Animatable.View>

      {/* MODAL: CLÁSSICOS DA LIGA */}
      <Modal
        visible={classicosModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setClassicosModalVisible(false)}
      >
        <View style={styles.overlay}>
          <Animatable.View style={styles.modalContainer} animation="zoomIn" duration={400}>
            <Text style={styles.modalTitle}>CLÁSSICOS DA LIGA</Text>
            <ScrollView style={{ flex: 1 }}>
              {duoStatsList.length === 0 ? (
                <Animatable.View
                  style={styles.emptyClassicosContainer}
                  animation="fadeIn"
                >
                  <Ionicons name="trophy-outline" size={40} color="#FFD700" />
                  <Text style={styles.emptyClassicosTitle}>
                    Nenhum Clássico Ativo na Liga!
                  </Text>
                  <Text style={styles.emptyClassicosSubtitle}>
                    As maiores rivalidades começam com grandes batalhas!
                    Participe de mais torneios e faça história nesta liga!
                  </Text>
                </Animatable.View>
              ) : (
                duoStatsList.map((duo, idx) => {
                  const pAName = players.find((p) => p.id === duo.playerA)?.fullname || duo.playerA;
                  const pBName = players.find((p) => p.id === duo.playerB)?.fullname || duo.playerB;
                  return (
                    <Animatable.View
                      key={idx}
                      style={styles.modalDuoCard}
                      animation="fadeInUp"
                      delay={100 * (idx + 1)}
                    >
                      <Text style={styles.modalDuoTitle}>
                        {pAName} vs {pBName} ({duo.stats.matches} Partidas)
                      </Text>
                      {duo.classicos.map((cc: any) => (
                        <Text key={cc.id} style={styles.modalClassicoItem}>
                          {cc.title} ({cc.tier})
                        </Text>
                      ))}
                    </Animatable.View>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity style={styles.closeButton} onPress={() => setClassicosModalVisible(false)}>
              <Ionicons name="arrow-back" size={20} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.closeButtonText}>Voltar</Text>
            </TouchableOpacity>
          </Animatable.View>
        </View>
      </Modal>

      {/* MODAL: CLÁSSICOS INFO */}
      <Modal
        visible={classicosInfoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setClassicosInfoModalVisible(false)}
      >
        <View style={styles.overlay}>
          <Animatable.View style={styles.modalContainer} animation="zoomIn" duration={400}>
            <ScrollView contentContainerStyle={styles.infoScrollContainer}>
              {classicosList.map((cItem) => (
                <Animatable.View
                  key={cItem.id}
                  animation="fadeInUp"
                  duration={600}
                  style={styles.classicoCardInfo}
                >
                  <View style={styles.classicoTitleCard}>
                    {cItem.tier === "Épico" && (
                      <Ionicons
                        name="flame"
                        size={20}
                        color="#FFD700"
                        style={styles.classicoIcon}
                      />
                    )}
                    {cItem.tier === "Lendário" && (
                      <Ionicons
                        name="star"
                        size={20}
                        color="#FFA500"
                        style={styles.classicoIcon}
                      />
                    )}
                    {cItem.tier === "Arceus" && (
                      <Ionicons
                        name="sparkles"
                        size={20}
                        color="#DA70D6"
                        style={styles.classicoIcon}
                      />
                    )}
                    <Text style={styles.classicoTitle}>
                      {cItem.title} ({cItem.tier})
                    </Text>
                  </View>
                  <View style={styles.classicoDescriptionCard}>
                    <Text style={styles.classicoDesc}>{cItem.description}</Text>
                  </View>
                </Animatable.View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closeButton} onPress={() => setClassicosInfoModalVisible(false)}>
              <Ionicons name="arrow-back" size={20} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.closeButtonText}>Voltar</Text>
            </TouchableOpacity>
          </Animatable.View>
        </View>
      </Modal>
    </View>
  );
}

// ============ ESTILOS ============
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    paddingTop: 5,
  },
  title: {
    color: "#E3350D",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: 1.2,
  },
  rivalCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#292929",
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#444",
  },
  rivalTitle: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  rivalName: {
    color: "#E3350D",
    fontSize: 18,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: 16,
    marginBottom: 8,
    alignItems: "center",
  },
  filterBtn: {
    backgroundColor: "#444",
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 6,
  },
  filterBtnActive: {
    backgroundColor: "#E3350D",
  },
  filterBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
  subParagraph: {
    color: "#ccc",
    fontSize: 13,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  duoCard: {
    backgroundColor: "#333",
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#444",
  },
  duoTitle: {
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 2,
    fontSize: 15,
  },
  duoStatsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 8,
  },
  statBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  statText: {
    color: "#FFF",
    fontSize: 13,
    marginLeft: 4,
    fontWeight: "bold",
  },
  footerButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#000000bb",
    padding: 8,
  },
  footerBtn: {
    backgroundColor: "#E3350D",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  footerBtnText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
  },
  modalContainer: {
    backgroundColor: "#000",
    margin: 20,
    borderRadius: 10,
    padding: 16,
    flex: 1,
    borderWidth: 1,
    borderColor: "#444",
  },
  modalTitle: {
    color: "#E3350D",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
    letterSpacing: 1,
  },
  emptyClassicosContainer: {
    alignItems: "center",
    marginTop: 20,
    paddingHorizontal: 20,
  },
  emptyClassicosTitle: {
    color: "#FFD700",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 10,
  },
  emptyClassicosSubtitle: {
    color: "#ccc",
    fontSize: 14,
    textAlign: "center",
    marginTop: 5,
  },
  modalDuoCard: {
    backgroundColor: "#292929",
    borderRadius: 8,
    marginBottom: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "#444",
  },
  modalDuoTitle: {
    color: "#FFF",
    fontWeight: "bold",
    marginBottom: 4,
    fontSize: 15,
  },
  modalClassicoItem: {
    color: "#FFD700",
    marginLeft: 10,
    fontSize: 13,
    marginBottom: 2,
  },
  closeButton: {
    backgroundColor: "#555",
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 10,
    alignSelf: "flex-start",
  },
  closeButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  infoScrollContainer: {
    padding: 16,
    flexGrow: 1,
    alignItems: "center",
  },
  classicoCardInfo: {
    width: "90%",
    backgroundColor: "#292929",
    borderRadius: 8,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#FFA50055",
  },
  classicoTitleCard: {
    backgroundColor: "#444",
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  classicoIcon: {
    marginRight: 6,
  },
  classicoTitle: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  classicoDescriptionCard: {
    backgroundColor: "#333",
    padding: 10,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  classicoDesc: {
    color: "#ccc",
    fontSize: 14,
  },
});
