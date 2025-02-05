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

import * as Animatable from "react-native-animatable"; // <-- animações

import { fetchAllMatches, MatchData } from "../../lib/matchService";
import classicosList, {
  computePlayerVsPlayerStats,
  getActiveClassicosForDuo,
} from "../classicosConfig";

import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface PlayerInfo {
  id: string;
  fullname: string;
}

type DisplayFilter = "normal" | "vejo" | "fregues" | "deixa";

export default function ClassicosScreen() {
  const [allMatches, setAllMatches] = useState<MatchData[]>([]);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);

  const [userId, setUserId] = useState("");
  const [rivalId, setRivalId] = useState("");
  const [rivalName, setRivalName] = useState("Sem Rival");

  // Modal states
  const [classicosModalVisible, setClassicosModalVisible] = useState(false);
  const [classicosInfoModalVisible, setClassicosInfoModalVisible] = useState(false);

  // Lista de {pA, pB, stats, classicos[]} p/ exibir no modal “Clássicos da Liga”
  const [duoStatsList, setDuoStatsList] = useState<any[]>([]);

  // Filtro local: "normal", "vejo", "fregues", "deixa"
  const [displayFilter, setDisplayFilter] = useState<DisplayFilter>("normal");

  // ============ useFocusEffect p/ recarregar toda vez que focar na tela ============
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          // 1) Carrega user
          const uid = await AsyncStorage.getItem("@userId");
          if (!uid) return;
          setUserId(uid);

          // 2) Carrega partidas com filtro
          console.log("🔄 [Classicos] Carregando partidas via filter...");
          const matches = await fetchAllMatches();
          setAllMatches(matches);

          // 3) Carrega lista de jogadores (liga/cidade)
          await loadPlayers();

          // 4) Detecta Rival
          const newRival = await detectUserRival(uid, matches);
          if (newRival) {
            setRivalId(newRival.rivalId);
            setRivalName(newRival.rivalName);
          } else {
            setRivalId("");
            setRivalName("Sem Rival");
          }

          // 5) Monta stats para TODAS as duplas
          const listStats = buildAllDuoStats(matches);
          setDuoStatsList(listStats);

        } catch (err) {
          console.log("❌ Erro no useFocusEffect de Classicos:", err);
        }
      })();
    }, [])
  );

  // =========== Detectar Rival do usuário (mais partidas) ===========
  async function detectUserRival(uid: string, matches: MatchData[]) {
    const rivalMap: Record<string, number> = {};
    
    matches.forEach((m) => {
      if (!m.player1_id || !m.player2_id) return;
      if (m.player1_id === uid) {
        rivalMap[m.player2_id] = (rivalMap[m.player2_id] || 0) + 1;
      } else if (m.player2_id === uid) {
        rivalMap[m.player1_id] = (rivalMap[m.player1_id] || 0) + 1;
      }
    });
  
    let topCount = 0;
    let topRival = "";
  
    for (const rid of Object.keys(rivalMap)) {
      if (rivalMap[rid] > topCount) {
        topCount = rivalMap[rid];
        topRival = rid;
      }
    }
  
    if (!topRival) return null;

    // Busca no array players
    const found = players.find((pl) => pl.id === topRival);
    if (found) {
      return { rivalId: topRival, rivalName: found.fullname };
    }

    // Se não achou, tenta no Firebase
    try {
      const leagueStored = await AsyncStorage.getItem("@leagueId");
      if (!leagueStored) return null;

      const pRef = doc(db, `leagues/${leagueStored}/players/${topRival}`);
      const pSnap = await getDoc(pRef);
      if (pSnap.exists()) {
        const fullname = pSnap.data().fullname || `Desconhecido`;
        return { rivalId: topRival, rivalName: fullname };
      }
    } catch (error) {
      console.error("Erro ao buscar nome do rival:", error);
    }
    return { rivalId: topRival, rivalName: `User ${topRival}` };
  }

  // =========== Carrega lista de jogadores respeitando filter ===========
  async function loadPlayers() {
    try {
      const filterType = await AsyncStorage.getItem("@filterType");
      const cityStored = await AsyncStorage.getItem("@selectedCity");
      const leagueStored = await AsyncStorage.getItem("@leagueId");

      console.log("📌 [Classicos] Carregando players => filter:", filterType, cityStored, leagueStored);

      let leagueIds: string[] = [];
      if (!filterType || filterType === "all") {
        // Carrega todos
        const leaguesSnap = await getDocs(collection(db, "leagues"));
        leaguesSnap.forEach((docSnap) => leagueIds.push(docSnap.id));
      } else if (filterType === "city" && cityStored) {
        const allLeaguesSnap = await getDocs(collection(db, "leagues"));
        allLeaguesSnap.forEach((ds) => {
          const data = ds.data();
          if (data.city === cityStored) {
            leagueIds.push(ds.id);
          }
        });
      } else if (filterType === "league" && leagueStored) {
        leagueIds.push(leagueStored);
      }

      let allPlayers: PlayerInfo[] = [];
      for (const lId of leagueIds) {
        const pRef = collection(db, `leagues/${lId}/players`);
        const pSnap = await getDocs(pRef);
        pSnap.forEach((ds) => {
          const d = ds.data();
          allPlayers.push({
            id: ds.id,
            fullname: d.fullname || `User ${ds.id}`,
          });
        });
      }

      // Remove duplicados
      const seen = new Set<string>();
      const uniquePlayers = allPlayers.filter((pl) => {
        if (seen.has(pl.id)) return false;
        seen.add(pl.id);
        return true;
      });

      console.log("✅ [Classicos] totalPlayers =>", uniquePlayers.length);
      setPlayers(uniquePlayers);
    } catch (err) {
      console.log("❌ Erro ao carregar players em Classicos:", err);
    }
  }

  // =========== Monta stats para TODAS as duplas (Clássicos da Liga) ==========
  function buildAllDuoStats(matches: MatchData[]) {
    const pairsSet = new Set<string>();

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const pA = players[i].id;
        const pB = players[j].id;
        if (pA !== pB) {
          const key = pA < pB ? `${pA}_${pB}` : `${pB}_${pA}`;
          pairsSet.add(key);
        }
      }
    }

    const results: any[] = [];
    pairsSet.forEach((key) => {
      const [pA, pB] = key.split("_");
      const statsDuo = computePlayerVsPlayerStats(matches, pA, pB);
      if (statsDuo.matches > 0) {
        const activeClassicos = getActiveClassicosForDuo(statsDuo);
        if (activeClassicos.length > 0) {
          results.push({
            playerA: pA,
            playerB: pB,
            stats: statsDuo,
            classicos: activeClassicos,
          });
        }
      }
    });
    return results;
  }

  // ------------- FILTROS LOCAIS -------------
  function handleSetFilter(f: DisplayFilter) {
    setDisplayFilter(f);
  }

  // Retorna a lista de oponentes com stats, aplicando a lógica do filter
  function getFilteredOpponents(): PlayerInfo[] {
    // Primeiro pega todos que não são o user
    let opps = players.filter((p) => p.id !== userId);

    if (displayFilter === "normal") {
      return opps;
    }

    // Para cada opponent, calculamos statsDuo
    const sorted = [...opps].sort((a, b) => {
      const stA = computePlayerVsPlayerStats(allMatches, userId, a.id);
      const stB = computePlayerVsPlayerStats(allMatches, userId, b.id);

      if (displayFilter === "vejo") {
        // “Vejo Todo Dia”: ord. desc por matches
        return stB.matches - stA.matches;
      } else if (displayFilter === "fregues") {
        // “Freguês”: ord. desc por winsA
        return stB.winsA - stA.winsA;
      } else if (displayFilter === "deixa") {
        // “Deixa Quieto”: ord. desc por winsB
        return stB.winsB - stA.winsB;
      }
      return 0;
    });

    return sorted;
  }

  // ------------- BOTÕES MODAIS -------------
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

  // =========== RENDER MAIN ============
  const filteredOpponents = getFilteredOpponents();

  return (
    <View style={styles.container}>
      {/* TITULO */}
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
        {filteredOpponents.map((opponent, index) => {
          const statsDuo = computePlayerVsPlayerStats(allMatches, userId, opponent.id);
          if (statsDuo.matches === 0) return null;
          const classicosActive = getActiveClassicosForDuo(statsDuo);

          return (
            <Animatable.View 
              style={styles.duoCard} 
              key={opponent.id}
              animation="fadeInUp"
              delay={100 * (index + 1)}
            >
              <Text style={styles.duoTitle}>
                vs {opponent.fullname} ({statsDuo.matches} partidas)
              </Text>
              <View style={styles.duoStatsContainer}>
                <View style={styles.statBox}>
                  <Ionicons name="trophy" size={16} color="#FFD700" />
                  <Text style={styles.statText}>Vitórias: {statsDuo.winsA}</Text>
                </View>
                <View style={styles.statBox}>
                  <Ionicons name="skull" size={16} color="#E3350D" />
                  <Text style={styles.statText}>Derrotas: {statsDuo.winsB}</Text>
                </View>
                <View style={styles.statBox}>
                  <Ionicons name="hand-left" size={16} color="#3498db" />
                  <Text style={styles.statText}>Empates: {statsDuo.draws}</Text>
                </View>
              </View>


              {classicosActive.length > 0 && (
          <View style={styles.classicoActiveContainer}>
            <Text style={styles.classicoActiveHeader}>🔥 Clássicos Ativos 🔥</Text>
            {classicosActive.map((cA) => {
              // Função auxiliar para obter a cor com base no tier
              const getTierColor = (tier: string): string => {
                if (tier === "Épico") return "#FFD700";
                if (tier === "Lendário") return "#FFA500";
                if (tier === "Arceus") return "#DA70D6";
                return "#FFF";
              };

              const tierColor = getTierColor(cA.tier);

              return (
                <Animatable.View 
                  key={cA.id} 
                  animation="fadeInUp" 
                  duration={600} 
                  style={[
                    styles.classicoCard,
                    { borderColor: tierColor, backgroundColor: "#333" } // sobrepõe a cor da borda
                  ]}
                >
                  {cA.tier === "Épico" && (
                    <Ionicons name="flame" size={20} color={tierColor} style={styles.classicoIcon} />
                  )}
                  {cA.tier === "Lendário" && (
                    <Ionicons name="star" size={20} color={tierColor} style={styles.classicoIcon} />
                  )}
                  {cA.tier === "Arceus" && (
                    <Ionicons name="sparkles" size={20} color={tierColor} style={styles.classicoIcon} />
                  )}
                  <View>
                    <Text style={[styles.classicoTitle, { color: tierColor }]}>{cA.title}</Text>
                    <Text style={[styles.classicoTier, { color: tierColor }]}>{cA.tier}</Text>
                  </View>
                </Animatable.View>
              );
            })}
          </View>
        )}


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
                  const pANm = players.find((pl) => pl.id === duo.playerA)?.fullname || duo.playerA;
                  const pBNm = players.find((pl) => pl.id === duo.playerB)?.fullname || duo.playerB;
                  return (
                    <Animatable.View 
                      key={idx} 
                      style={styles.modalDuoCard}
                      animation="fadeInUp"
                      delay={100 * (idx + 1)}
                    >
                      <Text style={styles.modalDuoTitle}>
                        {pANm} vs {pBNm} ({duo.stats.matches} Partidas)
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
              {/** Define o ícone de acordo com o tier */}
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
  duoSub: {
    color: "#bbb",
    fontSize: 13,
  },
  classicoActiveText: {
    color: "#FFD700",
    fontWeight: "bold",
    marginTop: 4,
  },
  classicoActiveItem: {
    color: "#FFD700",
    fontSize: 13,
    marginLeft: 10,
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
  // Overlays e Modals
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
  // Clássicos Info
  classicoDesc: {
    color: "#ccc",
    fontSize: 14,
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
  classicoActiveContainer: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#2A2A2A",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#808080",
  },
  classicoActiveHeader: {
    color: "#FFFFF0",
    fontWeight: "bold",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 6,
  },
  classicoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  classicoIcon: {
    marginRight: 10,
  },
  classicoTitle: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  classicoTier: {
    color: "#FFD700",
    fontSize: 12,
    fontStyle: "italic",
  },
  infoScrollContainer: {
    padding: 16,
    flexGrow: 1,
    alignItems: "center",
  },
  classicoTitleCard: {
    backgroundColor: "#444", 
    padding: 8, 
    borderTopLeftRadius: 8, 
    borderTopRightRadius: 8,
  },
  classicoDescriptionCard: {
    backgroundColor: "#333", 
    padding: 10, 
    borderBottomLeftRadius: 8, 
    borderBottomRightRadius: 8,
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
});
