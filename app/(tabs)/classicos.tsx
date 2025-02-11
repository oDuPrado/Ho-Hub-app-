////////////////////////////////////////
// ARQUIVO: (tabs)/classicos.tsx
////////////////////////////////////////
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  BackHandler,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import moment from "moment";
import "moment/locale/pt-br";
import * as Animatable from "react-native-animatable";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  query, 
  where 
} from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";
import { fetchRivalByFilter } from "../../lib/matchService";

// Clássicos e tiers
import classicosList from "../classicosConfig"; // Usamos getActiveClassicosForDuo() adaptado
// (iremos criar uma função local adaptada "computeDuoClassicos" para usar "classics" data)

interface PlayerInfo {
  id: string;
  fullname: string;
}

// Estrutura do doc "classics" que lemos do Firestore
interface ClassicsDoc {
  opponents: {
    [oppId: string]: {
      matches: number;
      wins: number;
      losses: number;
      draws: number;
    }
  };
  updatedAt?: any;
}

type DisplayFilter = "normal" | "vejo" | "fregues" | "deixa";

export default function ClassicosScreen() {
  // Principais estados
  const [userId, setUserId] = useState("");
  const [rivalName, setRivalName] = useState("Sem Rival");
  const [classicsData, setClassicsData] = useState<ClassicsDoc | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);

  // Lista p/ modal "Clássicos da Liga"
  const [duoStatsList, setDuoStatsList] = useState<any[]>([]);

  // Filtro local
  const [displayFilter, setDisplayFilter] = useState<DisplayFilter>("normal");

  // Modais
  const [classicosModalVisible, setClassicosModalVisible] = useState(false);
  const [classicosInfoModalVisible, setClassicosInfoModalVisible] = useState(false);

  // ================= useFocusEffect p/ recarregar =================
  useFocusEffect(
    useCallback(() => {
      loadClassicosPage();
    }, [])
  );

  async function loadClassicosPage() {
    try {
      const storedUserId = await AsyncStorage.getItem("@userId");
      if (!storedUserId) return;

      setUserId(storedUserId);

      const filterType = await AsyncStorage.getItem("@filterType");
      const cityStored = await AsyncStorage.getItem("@selectedCity");
      const leagueStored = await AsyncStorage.getItem("@leagueId");

      // Rival: se for league, buscamos normalmente;
      // se for city/all, exibimos msg "Rival só no modo Liga"
      if (filterType === "league" && leagueStored) {
        const rivalDoc = await fetchRivalByFilter(userId); // userId já definido antes
        if (rivalDoc) {
          setRivalName(rivalDoc.rivalName);
        } else {
          setRivalName("Sem Rival");
        }
      } else {
        setRivalName("Rival indisponível (Somente no modo Liga)");
      }      
      // 1) Carrega "classics" do próprio user c/ cache
      const userClassics = await getClassicsDocWithCache(leagueStored, storedUserId, filterType || "all");
      setClassicsData(userClassics);

      // 2) Carrega a lista de players (conforme city/all/league)
      const loadedPlayers = await loadPlayersByFilter(filterType, cityStored, leagueStored);
      setPlayers(loadedPlayers);

      // 3) "Clássicos da Liga" => ler classics de TODOS os players do filtro, e compor duoStatsList
      const allClassicsData = await getAllClassicsDocsWithCache(loadedPlayers, leagueStored, filterType || "all");
      const combos = buildAllDuoStats(allClassicsData);
      setDuoStatsList(combos);

    } catch (err) {
      console.log("Erro ao carregar tela Clássicos:", err);
    }
  }

  // ============= 1) Ler doc /stats/classics do user, com cache de 30 min =============
  async function getClassicsDocWithCache(leagueId: string | null, userId: string, filterType: string): Promise<ClassicsDoc | null> {
    if (!leagueId) return null;

    const cacheKey = `@classics_user_${userId}_${filterType}`;
    const cachedStr = await AsyncStorage.getItem(cacheKey);
    if (cachedStr) {
      const parsed = JSON.parse(cachedStr);
      const now = Date.now();
      // Checa se não passou 30 min
      if (now - parsed.timestamp < 30 * 60 * 1000) {
        console.log("⏳ Usando cache local de /stats/classics do user");
        return parsed.data;
      }
    }

    // Se não tem cache ou expirou, buscamos no Firestore
    console.log("🔎 Buscando doc classics do user no Firestore...");
    const docRef = doc(db, `leagues/${leagueId}/players/${userId}/stats`, "classics");
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    const data = snap.data() as ClassicsDoc;
    // Salva em cache
    await AsyncStorage.setItem(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }));

    return data;
  }

  // ============= 2) Carregar players (respeitando city/all/league) =============
  async function loadPlayersByFilter(filterType: string | null, cityStored: string | null, leagueStored: string | null): Promise<PlayerInfo[]> {
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

    let allPlayers: PlayerInfo[] = [];
    for (const lid of leaguesToFetch) {
      const pSnap = await getDocs(collection(db, `leagues/${lid}/players`));
      pSnap.forEach((ds) => {
        const d = ds.data();
        allPlayers.push({
          id: ds.id,
          fullname: d.fullname || `User ${ds.id}`
        });
      });
    }
    // remove duplicados
    const seen = new Set<string>();
    const unique = allPlayers.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    return unique;
  }

  // ============= 3) Ler doc /stats/classics de todos os jogadores (para "Clássicos da Liga") + cache =============
  async function getAllClassicsDocsWithCache(playersArr: PlayerInfo[], leagueId: string | null, filterType: string): Promise<Record<string, ClassicsDoc>> {
    if (!leagueId) return {};
    // Cache
    const cacheKey = `@classics_all_${filterType}`;
    const cachedStr = await AsyncStorage.getItem(cacheKey);
    if (cachedStr) {
      const parsed = JSON.parse(cachedStr);
      if (Date.now() - parsed.timestamp < 30 * 60 * 1000) {
        console.log("⏳ Usando cache local de /stats/classics de todos os players");
        return parsed.data;
      }
    }
    // Se não tem cache ou expirou
    console.log("🔎 Buscando /stats/classics de todos os players no Firestore...");
    const result: Record<string, ClassicsDoc> = {};

    for (const p of playersArr) {
      const docRef = doc(db, `leagues/${leagueId}/players/${p.id}/stats`, "classics");
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        result[p.id] = { opponents: {} };
      } else {
        result[p.id] = snap.data() as ClassicsDoc;
      }
    }
    // Salva cache
    await AsyncStorage.setItem(cacheKey, JSON.stringify({
      data: result,
      timestamp: Date.now()
    }));
    return result;
  }

  // ============= 4) Montar duoStatsList a partir de /stats/classics de todos os players =============
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

    // p/ vitórias B:
    const dataB = allClassics[B]?.opponents || {};
    const statsBA = dataB[A];
    const winsB = statsBA ? statsBA.wins : 0;

    // Monta objeto completo incluindo playerA e playerB
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

// ============= getActiveClassicos local (adaptado para receber playerA e playerB) =============
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
      // Agora passamos também playerA e playerB no objeto
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
  // ------------- Filtros Locais -------------
  function handleSetFilter(f: DisplayFilter) {
    setDisplayFilter(f);
  }

  // Exibe os confrontos do user (classicsData?.opponents) => filtra e ordena
  function getFilteredOpponents(): string[] {
    if (!classicsData) return [];
    const oppIds = Object.keys(classicsData.opponents);
    // Transformar em array para ordenar
    const arr = oppIds.map((id) => {
      const st = classicsData.opponents[id];
      return { id, ...st };
    });

    // Ordena conforme displayFilter
    arr.sort((a, b) => {
      if (displayFilter === "vejo") {
        return b.matches - a.matches;
      } else if (displayFilter === "fregues") {
        return b.wins - a.wins; // vitórias do user
      } else if (displayFilter === "deixa") {
        return b.losses - a.losses; // user "sofrendo" => ord desc por losses
      }
      return 0;
    });
    return arr.map((x) => x.id);
  }

  // ------------- BOTÕES DE MODAL -------------
  function openClassicosModal() {
    setClassicosModalVisible(true);
  }
  function closeClassicosModal() {
    setClassicosModalVisible(false);
  }

  function openClassicosInfoModal() {
    setClassicosInfoModalVisible(true);
  }
  function closeClassicosInfoModal() {
    setClassicosInfoModalVisible(false);
  }

  // ------------- BACKHANDLER -------------
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

  // ------------- RENDER -------------
  const filteredOppIds = getFilteredOpponents();

  return (
    <View style={styles.container}>
      <Animatable.Text 
        style={styles.title}
        animation="fadeInDown" 
        delay={100}
      >
        CLÁSSICOS
      </Animatable.Text>

      <ScrollView style={{ flex: 1, marginHorizontal: 10 }}>
        {/* Rival do usuário */}
        <Animatable.View 
          style={styles.rivalCard}
          animation="bounceIn"
          delay={200}
        >
          <Ionicons name="flash" size={28} color="#E3350D" style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rivalTitle}>Rival Atual</Text>
            <Text style={styles.rivalName}>{rivalName}</Text>
          </View>
        </Animatable.View>

        {/* FILTROS LOCAIS */}
        <View style={styles.filterRow}>
          <TouchableOpacity 
            style={[
              styles.filterBtn, 
              displayFilter === "normal" && styles.filterBtnActive
            ]}
            onPress={() => handleSetFilter("normal")}
          >
            <Ionicons name="options" size={18} color="#fff" style={{ marginRight: 4 }}/>
            <Text style={styles.filterBtnText}>Normal</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.filterBtn, 
              displayFilter === "vejo" && styles.filterBtnActive
            ]}
            onPress={() => handleSetFilter("vejo")}
          >
            <Ionicons name="eye" size={18} color="#fff" style={{ marginRight: 4 }}/>
            <Text style={styles.filterBtnText}>Vejo Todo Dia</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.filterBtn, 
              displayFilter === "fregues" && styles.filterBtnActive
            ]}
            onPress={() => handleSetFilter("fregues")}
          >
            <Ionicons name="checkmark-done" size={18} color="#fff" style={{ marginRight: 4 }}/>
            <Text style={styles.filterBtnText}>Freguês</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.filterBtn, 
              displayFilter === "deixa" && styles.filterBtnActive
            ]}
            onPress={() => handleSetFilter("deixa")}
          >
            <Ionicons name="skull" size={18} color="#fff" style={{ marginRight: 4 }}/>
            <Text style={styles.filterBtnText}>Deixa Quieto</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subParagraph}>
          Selecione um filtro e veja como se comportam seus confrontos.
        </Text>

        {/* Lista de confrontos do usuario (com animações) */}
        {filteredOppIds.map((oppId, index) => {
          const st = classicsData?.opponents[oppId];
          if (!st || st.matches === 0) return null;

          // Nome do adversário
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

      {/* BOTOES NO RODAPE */}
      <View style={styles.footerButtons}>
        <TouchableOpacity style={styles.footerBtn} onPress={openClassicosModal}>
          <Ionicons name="people" size={20} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.footerBtnText}>Clássicos da Liga</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.footerBtn, { backgroundColor: "#666" }]} onPress={openClassicosInfoModal}>
          <Ionicons name="information-circle" size={20} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.footerBtnText}>Clássicos - Info</Text>
        </TouchableOpacity>
      </View>

      {/* MODAL: CLÁSSICOS DA LIGA (mostra duplas e clássicos) */}
      <Modal
        visible={classicosModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeClassicosModal}
      >
        <View style={styles.overlay}>
          <Animatable.View style={styles.modalContainer} animation="zoomIn">
            <Text style={styles.modalTitle}>CLÁSSICOS DA LIGA</Text>
            <ScrollView style={{ flex: 1 }}>
              {duoStatsList.length === 0 ? (
                <View style={{ alignItems: "center", marginTop: 20 }}>
                  <Ionicons name="trophy-outline" size={40} color="#FFD700" />
                  <Text style={{ 
                    color: "#FFD700", 
                    fontSize: 18, 
                    fontWeight: "bold", 
                    textAlign: "center", 
                    marginTop: 10 
                  }}>
                    Nenhum Clássico Ativo na Liga!
                  </Text>
                  <Text style={{ 
                    color: "#ccc", 
                    fontSize: 14, 
                    textAlign: "center", 
                    marginTop: 5, 
                    paddingHorizontal: 20 
                  }}>
                    As maiores rivalidades começam com grandes batalhas! 
                    Participem de mais torneios e façam história nessa liga! 🔥⚔️
                  </Text>
                </View>
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

            <TouchableOpacity style={styles.closeButton} onPress={closeClassicosModal}>
              <Ionicons name="arrow-back" size={20} color="#fff" style={{ marginRight: 6 }}/>
              <Text style={styles.closeButtonText}>Voltar</Text>
            </TouchableOpacity>
          </Animatable.View>
        </View>
      </Modal>

      {/* MODAL: CLÁSSICOS - INFO (lista e descrições) */}
      <Modal
        visible={classicosInfoModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeClassicosInfoModal}
      >
        <View style={styles.overlay}>
          <Animatable.View style={styles.modalContainer} animation="zoomIn">
            <ScrollView contentContainerStyle={styles.infoScrollContainer}>
              {classicosList.map((cItem) => (
                <Animatable.View 
                  key={cItem.id} 
                  animation="fadeInUp" 
                  duration={600}
                  style={styles.classicoCardInfo}
                >
                  <View style={styles.classicoTitleCard}>
                    {/* Ícone do tier */}
                    {cItem.tier === "Épico" && (
                      <Ionicons name="flame" size={20} color="#FFD700" style={styles.classicoIcon} />
                    )}
                    {cItem.tier === "Lendário" && (
                      <Ionicons name="star" size={20} color="#FFA500" style={styles.classicoIcon} />
                    )}
                    {cItem.tier === "Arceus" && (
                      <Ionicons name="sparkles" size={20} color="#DA70D6" style={styles.classicoIcon} />
                    )}
                    <Text style={styles.classicoTitle}>
                      {cItem.title} ({cItem.tier})
                    </Text>
                  </View>
                  <View style={styles.classicoDescriptionCard}>
                    <Text style={styles.classicoDesc}>
                      {cItem.description}
                    </Text>
                  </View>
                </Animatable.View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closeButton} onPress={closeClassicosInfoModal}>
              <Ionicons name="arrow-back" size={20} color="#fff" style={{ marginRight: 6 }}/>
              <Text style={styles.closeButtonText}>Voltar</Text>
            </TouchableOpacity>
          </Animatable.View>
        </View>
      </Modal>
    </View>
  );
}

// ==================== ESTILOS ====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    paddingTop: 40,
  },
  title: {
    color: "#E3350D",
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
  },
  rivalCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#292929",
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
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
    marginBottom: 6,
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
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 8,
  },
  duoTitle: {
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 2,
  },
  duoStatsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingHorizontal: 10,
  },
  statBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginRight: 8,
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
    backgroundColor: "#000000aa",
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
  },
  modalTitle: {
    color: "#E3350D",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
  },
  modalDuoCard: {
    backgroundColor: "#292929",
    borderRadius: 8,
    marginBottom: 16,
    padding: 10,
  },
  modalDuoTitle: {
    color: "#FFF",
    fontWeight: "bold",
    marginBottom: 4,
  },
  modalClassicoItem: {
    color: "#FFD700",
    marginLeft: 10,
  },
  closeButton: {
    backgroundColor: "#555",
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
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
    borderColor: "#FFD",
  },
  classicoTitleCard: {
    backgroundColor: "#444", 
    padding: 8, 
    borderTopLeftRadius: 8, 
    borderTopRightRadius: 8,
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
