import React, { useEffect, useState } from "react";
import { Picker } from "@react-native-picker/picker";
import { PokemonTCG } from "pokemon-tcg-sdk-typescript";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ScrollView,
  Modal,
  TextInput,
  Platform,
  Image,
  ActivityIndicator,
} from "react-native";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  setDoc,
  getDoc,
  orderBy,
  where,
} from "firebase/firestore";
import moment from "moment";
import "moment/locale/pt-br";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "../../lib/firebaseConfig";

import {
  HOST_PLAYER_IDS,
  JUDGE_PLAYER_IDS,
  HEAD_JUDGE_PLAYER_IDS,
  fetchHostsInfo,
} from "../hosts";

/** Estrutura do Torneio */
interface Torneio {
  id: string;
  name: string;
  date: string; // dd/mm/aaaa
  time: string; // hh:mm
  createdBy: string;
  judge: string;
  headJudge: string;
}

/** Estrutura de Inscrição */
interface Inscricao {
  userId: string;
  deckId?: string;
  createdAt: string;
}

/** Estrutura de Deck (para nome etc.) */
interface DeckData {
  id: string;
  name: string;
  playerId: string;
}

/** Estrutura p/ sub-tela do modal Detalhes (Host) */
type DetalhesTab = "inscricoes" | "decks";

export default function CalendarScreen() {
  const [playerId, setPlayerId] = useState("");
  const [isHost, setIsHost] = useState(false);

  const [torneios, setTorneios] = useState<Torneio[]>([]);
  const [currentMonth, setCurrentMonth] = useState(moment());

  // ------------- Dicionários para lookup de nomes -------------
  const [judgeMap, setJudgeMap] = useState<Record<string, string>>({});
  const [headJudgeMap, setHeadJudgeMap] = useState<Record<string, string>>({});

  // ------------- Modal CRIAR/EDITAR -------------
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editJudge, setEditJudge] = useState("");
  const [editHeadJudge, setEditHeadJudge] = useState("");

  // ------------- Para exibir Juiz/HeadJudge (picker) -------------
  const [judgeOptions, setJudgeOptions] = useState<
    { userId: string; fullname: string }[]
  >([]);
  const [headJudgeOptions, setHeadJudgeOptions] = useState<
    { userId: string; fullname: string }[]
  >([]);

  // ------------- Modal DETALHES (Host) -------------
  const [detalhesModalVisible, setDetalhesModalVisible] = useState(false);
  const [detalhesTorneio, setDetalhesTorneio] = useState<Torneio | null>(null);
  const [detalhesTab, setDetalhesTab] = useState<DetalhesTab>("inscricoes");
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [deckNameMap, setDeckNameMap] = useState<Record<string, string>>({}); // deckId -> deckName
  const [playerNameMap, setPlayerNameMap] = useState<Record<string, string>>(
    {}
  ); // userId -> fullname

  // Sub-Modal p/ exibir deck "em PDF"
  const [deckPdfModalVisible, setDeckPdfModalVisible] = useState(false);
  const [selectedDeckIdForPdf, setSelectedDeckIdForPdf] = useState("");

  // ------------- Modal INSCRIÇÃO (usuário) -------------
  const [inscricaoModalVisible, setInscricaoModalVisible] = useState(false);
  const [inscricaoTorneioId, setInscricaoTorneioId] = useState<string | null>(
    null
  );
  const [userDecks, setUserDecks] = useState<DeckData[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState("");

  // ============ Efeito: carrega playerId e carrega judge/headJudge info ============
  useEffect(() => {
    moment.locale("pt-br");

    (async () => {
      try {
        const pid = await AsyncStorage.getItem("@userId");
        if (pid) {
          setPlayerId(pid);
          setIsHost(HOST_PLAYER_IDS.includes(pid));
        }
      } catch (error) {
        console.log("Erro ao obter playerId:", error);
      }

      // Carrega Juiz
      const jArray = await fetchHostsInfo(JUDGE_PLAYER_IDS);
      setJudgeOptions(jArray);
      const jMap: Record<string, string> = {};
      jArray.forEach((j) => {
        jMap[j.userId] = j.fullname;
      });
      setJudgeMap(jMap);

      // Carrega HeadJudge
      const hjArray = await fetchHostsInfo(HEAD_JUDGE_PLAYER_IDS);
      setHeadJudgeOptions(hjArray);
      const hjMap: Record<string, string> = {};
      hjArray.forEach((hj) => {
        hjMap[hj.userId] = hj.fullname;
      });
      setHeadJudgeMap(hjMap);
    })();
  }, []);

  // ============ Efeito: Carregar torneios do Firestore para o mês atual ============
  useEffect(() => {
    const colRef = collection(db, "calendar", "torneios", "list");
    const unsub = onSnapshot(colRef, (snap) => {
      const items: Torneio[] = [];
      snap.forEach((ds) => {
        const data = ds.data();
        items.push({
          id: ds.id,
          name: data.name,
          date: data.date, // dd/mm/aaaa
          time: data.time, // hh:mm
          createdBy: data.createdBy,
          judge: data.judge || "",
          headJudge: data.headJudge || "",
        });
      });
      // filtra por mes
      const start = currentMonth.clone().startOf("month");
      const end = currentMonth.clone().endOf("month");
      const filtered = items.filter((t) => {
        const dt = moment(t.date, "DD/MM/YYYY");
        return dt.isBetween(start, end, undefined, "[]");
      });
      setTorneios(filtered);
    });
    return () => unsub();
  }, [currentMonth]);

  // ============ Mudar mês ============
  function handlePrevMonth() {
    setCurrentMonth((prev) => prev.clone().subtract(1, "month"));
  }
  function handleNextMonth() {
    setCurrentMonth((prev) => prev.clone().add(1, "month"));
  }

  // ============ Abrir modal CRIAR torneio ============
  function openCreateModal() {
    setEditId(null);
    setEditName("");
    setEditDate(moment().format("DD/MM/YYYY"));
    setEditTime("10:00");
    setEditJudge("");
    setEditHeadJudge("");
    setModalVisible(true);
  }

  // ============ Abrir modal EDITAR torneio ============
  function openEditModal(t: Torneio) {
    setEditId(t.id);
    setEditName(t.name);
    setEditDate(t.date);
    setEditTime(t.time);
    setEditJudge(t.judge);
    setEditHeadJudge(t.headJudge);
    setModalVisible(true);
  }

  // ============ Salvar torneio (criar ou editar) ============
  async function handleSaveTorneio() {
    if (!editName.trim()) {
      Alert.alert("Erro", "Nome do torneio não pode estar vazio.");
      return;
    }
    if (!moment(editDate, "DD/MM/YYYY", true).isValid()) {
      Alert.alert("Erro", "Data inválida (use DD/MM/AAAA).");
      return;
    }
    try {
      const colRef = collection(db, "calendar", "torneios", "list");
      if (editId) {
        const docRef = doc(colRef, editId);
        await updateDoc(docRef, {
          name: editName.trim(),
          date: editDate,
          time: editTime,
          judge: editJudge,
          headJudge: editHeadJudge,
        });
      } else {
        await addDoc(colRef, {
          name: editName.trim(),
          date: editDate,
          time: editTime,
          createdBy: playerId,
          judge: editJudge,
          headJudge: editHeadJudge,
        });
      }
      setModalVisible(false);
    } catch (error) {
      console.log("Erro ao salvar torneio:", error);
      Alert.alert("Erro", "Falha ao salvar torneio.");
    }
  }

  // ============ Excluir torneio ============
  async function handleDeleteTorneio(t: Torneio) {
    Alert.alert("Confirmar", `Excluir torneio ${t.name}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            const colRef = collection(db, "calendar", "torneios", "list");
            const docRef = doc(colRef, t.id);
            await deleteDoc(docRef);
          } catch (error) {
            console.log("Erro ao excluir torneio:", error);
            Alert.alert("Erro", "Falha ao excluir torneio.");
          }
        },
      },
    ]);
  }

  // ============ Inscrever-se (usuário) ============
  async function handleInscrever(t: Torneio) {
    setInscricaoTorneioId(t.id);
    setSelectedDeckId("");

    // Carregar decks do user
    const colRef = collection(db, "decks");
    const unsub = onSnapshot(
      query(colRef, where("playerId", "==", playerId)),
      (snap) => {
        const arr: DeckData[] = [];
        snap.forEach((ds) => {
          arr.push({
            id: ds.id,
            name: ds.data().name || `Deck ${ds.id}`,
            playerId: ds.data().playerId,
          });
        });
        setUserDecks(arr);
      }
    );

    setInscricaoModalVisible(true);
  }

  // ============ Salvar inscrição com deckId ============
  async function handleSalvarInscricao() {
    if (!inscricaoTorneioId) return;
    if (!selectedDeckId) {
      Alert.alert("Erro", "Selecione um deck antes de enviar.");
      return;
    }
    try {
      const colRef = collection(
        db,
        "calendar",
        "torneios",
        "list",
        inscricaoTorneioId,
        "inscricoes"
      );
      const docRef = doc(colRef, playerId);
      await setDoc(docRef, {
        userId: playerId,
        deckId: selectedDeckId,
        createdAt: new Date().toISOString(),
      });
      Alert.alert("Sucesso", "Inscrição realizada!");
      setInscricaoModalVisible(false);
    } catch (error) {
      console.log("Erro ao inscrever:", error);
      Alert.alert("Erro", "Falha ao se inscrever.");
    }
  }

  // ============ Abrir modal DETALHES p/ Host (inscrições + decks) ============
  async function handleOpenDetalhes(t: Torneio) {
    setDetalhesTorneio(t);
    setDetalhesTab("inscricoes");

    // Buscar subcoleção "inscricoes"
    const colRef = collection(
      db,
      "calendar",
      "torneios",
      "list",
      t.id,
      "inscricoes"
    );
    const unsub = onSnapshot(colRef, (snap) => {
      const arr: Inscricao[] = [];
      snap.forEach((ds) => {
        arr.push({
          userId: ds.id,
          deckId: ds.data().deckId,
          createdAt: ds.data().createdAt || "",
        });
      });
      // Ordena por createdAt
      arr.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
      setInscricoes(arr);

      // Montar um set de deckIds e userIds
      const deckIdsSet = new Set<string>();
      const userIdsSet = new Set<string>();
      arr.forEach((i) => {
        if (i.deckId) deckIdsSet.add(i.deckId);
        userIdsSet.add(i.userId);
      });

      // Buscar no Firestore para deckName e userName
      deckIdsSet.forEach(async (dkId) => {
        const dRef = doc(db, "decks", dkId);
        const dSnap = await getDoc(dRef);
        if (dSnap.exists()) {
          const name = dSnap.data().name || `Deck ${dkId}`;
          setDeckNameMap((prev) => ({ ...prev, [dkId]: name }));
        }
      });
      userIdsSet.forEach(async (uId) => {
        const pRef = doc(db, "players", uId);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) {
          const nm = pSnap.data().fullname || `Jogador ${uId}`;
          setPlayerNameMap((prev) => ({ ...prev, [uId]: nm }));
        }
      });
    });

    setDetalhesModalVisible(true);
  }

  // ============ Fechar modal DETALHES  ============
  function closeDetalhes() {
    setDetalhesModalVisible(false);
    setDetalhesTorneio(null);
    setInscricoes([]);
  }

  // ============ Ao clicar em um deck (na aba "decks"), exibe sub-modal (PDF) ============
  function handleOpenDeckPdf(deckId: string) {
    setSelectedDeckIdForPdf(deckId);
    loadDeckCards(deckId); // Carrega as cartas do deck antes de abrir o modal
    setDeckPdfModalVisible(true);
  }

  function closeDeckPdfModal() {
    setDeckPdfModalVisible(false);
    setSelectedDeckIdForPdf("");
  }

  // ============ Render de um "card" de torneio (listagem principal) ============
  function renderCard(t: Torneio) {
    // Converte data p/ moment e descobre se é futuro ou passado
    const dt = moment(t.date, "DD/MM/YYYY");
    const isFuture = dt.isSameOrAfter(moment(), "day");

    // Substituir IDs por nomes
    const judgeName = judgeMap[t.judge] || "(Sem juiz)";
    const headJudgeName = headJudgeMap[t.headJudge] || "(Sem head judge)";

    return (
      <View style={styles.card} key={`t-${t.id}`}>
        <Text style={styles.cardTitle}>{t.name}</Text>
        <Text style={styles.cardSub}>
          {/* Data e Hora (dd/mm/aaaa hh:mm) */}
          {t.date} às {t.time}
        </Text>
        <Text style={styles.cardSub}>
          Juiz: {judgeName}, Head Judge: {headJudgeName}
        </Text>

        {isHost && (
          <View style={{ flexDirection: "row", marginTop: 6 }}>
            <TouchableOpacity
              style={[styles.buttonSmall, { marginRight: 8 }]}
              onPress={() => openEditModal(t)}
            >
              <Text style={styles.buttonSmallText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buttonSmall, { backgroundColor: "#FF3333" }]}
              onPress={() => handleDeleteTorneio(t)}
            >
              <Text style={styles.buttonSmallText}>Excluir</Text>
            </TouchableOpacity>
          </View>
        )}

        {isFuture ? (
          <TouchableOpacity
            style={[styles.inscreverButton, { marginTop: 8 }]}
            onPress={() =>
              isHost ? handleOpenDetalhes(t) : handleInscrever(t)
            }
          >
            <Text style={styles.inscreverButtonText}>
              {isHost ? "Ver Detalhes" : "Inscrever-se"}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.inscreverButton,
              { backgroundColor: "#777", marginTop: 8 },
            ]}
            onPress={() => isHost && handleOpenDetalhes(t)}
          >
            <Text style={styles.inscreverButtonText}>
              {isHost ? "Ver Detalhes" : "Já ocorreu"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ============ Render do modal DETALHES p/ Host ============
  function renderDetalhesModal() {
    if (!detalhesTorneio) return null;

    // formata data e hora
    const dtObj = moment(detalhesTorneio.date, "DD/MM/YYYY");
    const dataFormatada = dtObj.format("DD/MM/YYYY");
    return (
      <Modal
        visible={detalhesModalVisible}
        animationType="slide"
        onRequestClose={closeDetalhes}
      >
        <SafeAreaView style={styles.modalContainer}>
          <Text style={styles.modalTitle}>{detalhesTorneio.name}</Text>
          <Text style={{ color: "#ccc", textAlign: "center" }}>
            Data/Hora: {dataFormatada} às {detalhesTorneio.time}
          </Text>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              marginTop: 10,
            }}
          >
            <TouchableOpacity
              style={[
                styles.tabButton,
                detalhesTab === "inscricoes" && { backgroundColor: "#666" },
              ]}
              onPress={() => setDetalhesTab("inscricoes")}
            >
              <Text style={styles.tabButtonText}>Inscrições</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tabButton,
                detalhesTab === "decks" && { backgroundColor: "#666" },
              ]}
              onPress={() => setDetalhesTab("decks")}
            >
              <Text style={styles.tabButtonText}>Decks</Text>
            </TouchableOpacity>
          </View>

          {detalhesTab === "inscricoes" && (
            <ScrollView style={{ margin: 16 }}>
              {inscricoes.map((i) => (
                <View style={styles.inscricaoItem} key={`ins-${i.userId}`}>
                  <Text style={styles.inscricaoItemText}>
                    Jogador: {playerNameMap[i.userId] || i.userId}
                  </Text>
                  <Text style={styles.inscricaoItemText}>
                    Data/Hora: {formatIsoDate(i.createdAt)}
                  </Text>
                  <Text style={styles.inscricaoItemText}>
                    Deck:{" "}
                    {i.deckId
                      ? deckNameMap[i.deckId] || `(Deck ${i.deckId})`
                      : "(Sem deck)"}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          {detalhesTab === "decks" && (
            <ScrollView style={{ margin: 16 }}>
              {inscricoes.map((i) => (
                <TouchableOpacity
                  style={styles.inscricaoItem}
                  key={`deckRef-${i.userId}`}
                  onPress={() => {
                    if (i.deckId) {
                      handleOpenDeckPdf(i.deckId);
                    }
                  }}
                >
                  <Text style={styles.inscricaoItemText}>
                    Jogador: {playerNameMap[i.userId] || i.userId}
                  </Text>
                  <Text style={styles.inscricaoItemText}>
                    Deck:{" "}
                    {i.deckId
                      ? deckNameMap[i.deckId] || `(Deck ${i.deckId})`
                      : "(Sem deck)"}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[styles.button, { margin: 16 }]}
            onPress={closeDetalhes}
          >
            <Text style={styles.buttonText}>Fechar</Text>
          </TouchableOpacity>
        </SafeAreaView>

        {/* Sub-modal do PDF (ou visualização) */}
      </Modal>
    );
  }

  // ============ Sub-modal PDF do deck =============
  const [deckCards, setDeckCards] = useState<
    {
      category: string;
      quantity: number;
      name: string;
      expansion?: string;
      cardNumber?: string;
    }[]
  >([]);

  const [cardImages, setCardImages] = useState<Record<string, string>>({});
  const [setIdMap, setSetIdMap] = useState<Record<string, string>>({});
  const [loadingImages, setLoadingImages] = useState<boolean>(false);

  // Função para carregar o mapeamento de ptcgoCode para id
  async function loadSetIdMap() {
    try {
      const response = await fetch("https://api.pokemontcg.io/v2/sets");
      const data = await response.json();
      if (data && data.data) {
        const map: Record<string, string> = {};

        // Agrupa sets por ptcgoCode e seleciona o que possui maior "total"
        const groupedSets: Record<string, any[]> = {};
        data.data.forEach((set: any) => {
          const code = set.ptcgoCode?.toUpperCase();
          if (!code) return;
          if (!groupedSets[code]) groupedSets[code] = [];
          groupedSets[code].push(set);
        });

        // Seleciona o set com maior "total" para cada ptcgoCode
        Object.keys(groupedSets).forEach((code) => {
          const sets = groupedSets[code];
          const bestSet = sets.reduce((prev, curr) =>
            curr.total > prev.total ? curr : prev
          );
          map[code] = bestSet.id; // Mapeia o ID do melhor conjunto
        });

        setSetIdMap(map);
      }
    } catch (error) {
      console.error("Erro ao carregar mapeamento de sets:", error);
    }
  }

  // Carrega o mapeamento de sets ao inicializar
  useEffect(() => {
    loadSetIdMap();
  }, []);

  // Função para buscar a imagem de uma carta
  async function fetchCardImage(
    cardName: string,
    expansion?: string,
    cardNumber?: string
  ): Promise<string | null> {
    try {
      // Remove "PH" do nome da carta, se existir
      const sanitizedCardName = cardName.replace(/\bPH\b/g, "").trim();

      // Transforma o ptcgoCode em id se disponível
      const setId = expansion ? setIdMap[expansion.toUpperCase()] : undefined;

      // Monta a query
      const queryParts: string[] = [];
      queryParts.push(`name:"${encodeURIComponent(sanitizedCardName)}"`);
      if (setId) queryParts.push(`set.id:"${setId}"`);
      if (cardNumber) queryParts.push(`number:"${cardNumber}"`);

      const query = queryParts.join("%20");
      const url = `https://api.pokemontcg.io/v2/cards?q=${query}`;
      console.log("URL usada para consulta:", url);

      const response = await fetch(url, {
        headers: {
          "X-Api-Key": "8d293a2a-4949-4d04-a06c-c20672a7a12c",
        },
      });

      const data = await response.json();
      if (data && data.data && data.data.length > 0) {
        return data.data[0].images.small || null;
      }
      return null;
    } catch (error) {
      console.error(`Erro ao buscar imagem para ${cardName}:`, error);
      return null;
    }
  }

  // Função para processar o nome da carta
  function processCardName(cardName: string): string {
    const energyMap: Record<string, string> = {
      G: "Grass",
      F: "Fire",
      W: "Water",
      L: "Lightning",
      P: "Psychic",
      D: "Darkness",
      M: "Metal",
      C: "Colorless",
      R: "Fighting", // Rock
    };

    let sanitizedCardName = cardName.replace(/\bPH\b/g, "").trim();
    sanitizedCardName = sanitizedCardName.replace(
      /\{([A-Za-z]+)\}/g,
      (_, match) => {
        const energyName = energyMap[match.toUpperCase()] || `{${match}}`;
        return energyName;
      }
    );

    sanitizedCardName = sanitizedCardName.replace(
      /\b(Energy)\b.*?\b(Energy)\b/i,
      "$1"
    );

    return sanitizedCardName;
  }

  // Função para carregar cartas do deck
  async function loadDeckCards(deckId: string) {
    try {
      const deckRef = doc(db, "decks", deckId);
      const deckSnap = await getDoc(deckRef);

      if (deckSnap.exists()) {
        const deckData = deckSnap.data();
        const cards: {
          category: string;
          quantity: number;
          name: string;
          expansion?: string;
          cardNumber?: string;
        }[] = [];

        deckData.pokemons?.forEach((card: any) =>
          cards.push({ category: "Pokémon", ...card })
        );

        deckData.trainers?.forEach((card: any) =>
          cards.push({ category: "Treinador", ...card })
        );

        deckData.energies?.forEach((card: any) =>
          cards.push({ category: "Energia", ...card })
        );

        setDeckCards(cards);

        setLoadingImages(true);
        const imagePromises = cards.map(async (card) => {
          const imageUrl = await fetchCardImage(
            card.name,
            card.expansion,
            card.cardNumber
          );
          return {
            key: `${card.name}__${card.expansion}__${card.cardNumber}`,
            url: imageUrl,
          };
        });

        const imageResults = await Promise.all(imagePromises);
        const newCardImages: Record<string, string> = {};
        imageResults.forEach((result) => {
          if (result.url) newCardImages[result.key] = result.url;
        });

        setCardImages(newCardImages);
        setLoadingImages(false);
      } else {
        console.log("Deck não encontrado.");
        setDeckCards([]);
      }
    } catch (error) {
      console.log("Erro ao carregar deck:", error);
      setDeckCards([]);
      setLoadingImages(false);
    }
  }

  // Render do sub-modal do PDF do deck
  function renderDeckPdfModal() {
    return (
      <Modal
        visible={deckPdfModalVisible}
        animationType="slide"
        onRequestClose={closeDeckPdfModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Detalhes do Deck</Text>
          <Text
            style={{ color: "#ccc", textAlign: "center", marginBottom: 20 }}
          >
            Deck:{" "}
            {deckNameMap[selectedDeckIdForPdf] || `ID ${selectedDeckIdForPdf}`}
          </Text>
          <ScrollView style={{ marginHorizontal: 16 }}>
            {deckCards.length > 0 ? (
              deckCards.map((card, index) => {
                const keyStr = `${card.name}__${card.expansion}__${card.cardNumber}`;
                const imageUrl = cardImages[keyStr];
                return (
                  <View key={`card-${index}`} style={styles.card}>
                    <View style={styles.cardContent}>
                      <View style={styles.cardText}>
                        <Text style={styles.cardTitle}>
                          {card.category}: {processCardName(card.name)}
                        </Text>
                        <Text style={styles.cardSub}>Qtd: {card.quantity}</Text>
                        {card.expansion && (
                          <Text style={styles.cardSub}>
                            Expansão: {card.expansion}
                          </Text>
                        )}
                        {card.cardNumber && (
                          <Text style={styles.cardSub}>
                            Nº: {card.cardNumber}
                          </Text>
                        )}
                      </View>
                      <View style={styles.cardImageContainer}>
                        {loadingImages ? (
                          <ActivityIndicator size="small" color="#ccc" />
                        ) : imageUrl ? (
                          <Image
                            source={{ uri: imageUrl }}
                            style={styles.cardImage}
                            resizeMode="contain"
                          />
                        ) : (
                          <Text style={styles.noImageText}>Sem Imagem</Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={{ color: "#fff", marginBottom: 20 }}>
                Nenhuma carta encontrada neste deck.
              </Text>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.button, { margin: 16 }]}
            onPress={closeDeckPdfModal}
          >
            <Text style={styles.buttonText}>Fechar</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  // -------------- Render principal --------------
  const monthDisplay = currentMonth.format("MMMM [de] YYYY");

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handlePrevMonth}>
          <Text style={styles.headerButton}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{monthDisplay}</Text>
        <TouchableOpacity onPress={handleNextMonth}>
          <Text style={styles.headerButton}>{">"}</Text>
        </TouchableOpacity>
      </View>

      {isHost && (
        <TouchableOpacity style={styles.createButton} onPress={openCreateModal}>
          <Text style={styles.createButtonText}>+ Criar Torneio</Text>
        </TouchableOpacity>
      )}

      <ScrollView style={{ flex: 1, marginTop: 10 }}>
        {torneios.map((t) => renderCard(t))}
      </ScrollView>

      {/* Modal CRIAR/EDITAR TORN. */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView style={{ padding: 16 }}>
            <Text style={styles.modalTitle}>
              {editId ? "Editar Torneio" : "Criar Torneio"}
            </Text>

            <Text style={styles.modalLabel}>Nome</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
            />

            <Text style={styles.modalLabel}>Data (DD/MM/AAAA)</Text>
            <TextInput
              style={styles.modalInput}
              value={editDate}
              onChangeText={setEditDate}
            />

            <Text style={styles.modalLabel}>Hora (HH:mm)</Text>
            <TextInput
              style={styles.modalInput}
              value={editTime}
              onChangeText={setEditTime}
            />

            <Text style={styles.modalLabel}>Juiz</Text>
            <Picker
              selectedValue={editJudge}
              onValueChange={(v) => setEditJudge(v)}
              style={[styles.modalInput, { color: "#fff" }]}
            >
              <Picker.Item label="Selecione..." value="" />
              {judgeOptions.map((j) => (
                <Picker.Item
                  key={`judge-${j.userId}`}
                  label={j.fullname}
                  value={j.userId}
                />
              ))}
            </Picker>

            <Text style={styles.modalLabel}>Head Judge</Text>
            <Picker
              selectedValue={editHeadJudge}
              onValueChange={(v) => setEditHeadJudge(v)}
              style={[styles.modalInput, { color: "#fff" }]}
            >
              <Picker.Item label="Selecione..." value="" />
              {headJudgeOptions.map((hj) => (
                <Picker.Item
                  key={`headjudge-${hj.userId}`}
                  label={hj.fullname}
                  value={hj.userId}
                />
              ))}
            </Picker>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: "#999" }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.button}
                onPress={handleSaveTorneio}
              >
                <Text style={styles.buttonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal DETALHES (Host) */}
      {renderDetalhesModal()}

      {/* Sub-modal do PDF do deck */}
      {renderDeckPdfModal()}

      {/* Modal Inscrição c/ deck */}
      <Modal
        visible={inscricaoModalVisible}
        animationType="slide"
        onRequestClose={() => setInscricaoModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView style={{ padding: 16 }}>
            <Text style={styles.modalTitle}>Escolha seu Deck</Text>
            {userDecks.length === 0 && (
              <Text style={{ color: "#fff", marginBottom: 10 }}>
                (Nenhum deck cadastrado)
              </Text>
            )}
            {userDecks.map((dk) => (
              <TouchableOpacity
                key={`dk-${dk.id}`}
                style={[
                  styles.deckOption,
                  selectedDeckId === dk.id && { backgroundColor: "#666" },
                ]}
                onPress={() => setSelectedDeckId(dk.id)}
              >
                <Text style={styles.deckOptionText}>
                  Jogador: {dk.playerId} | Deck: {dk.name}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: "#999" }]}
                onPress={() => setInscricaoModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.button}
                onPress={handleSalvarInscricao}
              >
                <Text style={styles.buttonText}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ----------- Funções auxiliares -----------
function formatIsoDate(isoStr: string) {
  if (!isoStr) return "";
  const m = moment(isoStr);
  if (!m.isValid()) return isoStr;
  return m.format("DD/MM/YYYY HH:mm");
}

// ----------- Estilos -----------
const DARK = "#1E1E1E";
const PRIMARY = "#E3350D";
const SECONDARY = "#FFFFFF";
const GRAY = "#333333";

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: DARK,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  headerButton: {
    color: SECONDARY,
    fontSize: 24,
    fontWeight: "bold",
  },
  headerTitle: {
    color: SECONDARY,
    fontSize: 18,
    fontWeight: "bold",
  },
  createButton: {
    backgroundColor: PRIMARY,
    margin: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  createButtonText: {
    color: SECONDARY,
    fontWeight: "bold",
  },
  card: {
    backgroundColor: GRAY,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 12,
    borderRadius: 8,
  },
  cardTitle: {
    color: SECONDARY,
    fontSize: 16,
    fontWeight: "bold",
  },
  cardSub: {
    color: "#ccc",
    fontSize: 14,
  },
  buttonSmall: {
    backgroundColor: "#555",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  buttonSmallText: {
    color: SECONDARY,
    fontWeight: "bold",
  },
  inscreverButton: {
    backgroundColor: "#4CAF50",
    padding: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  inscreverButtonText: {
    color: SECONDARY,
    fontWeight: "bold",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: DARK,
  },
  modalTitle: {
    color: SECONDARY,
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 16,
  },
  modalLabel: {
    color: SECONDARY,
    fontSize: 14,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: "#4A4A4A",
    color: SECONDARY,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    marginVertical: 6,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
  },
  button: {
    backgroundColor: PRIMARY,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  buttonText: {
    color: SECONDARY,
    fontWeight: "bold",
  },
  tabButton: {
    backgroundColor: "#444",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  tabButtonText: {
    color: SECONDARY,
    fontWeight: "bold",
  },
  inscricaoItem: {
    backgroundColor: "#444",
    borderRadius: 6,
    padding: 10,
    marginVertical: 6,
  },
  inscricaoItemText: {
    color: "#fff",
    fontSize: 14,
  },
  deckOption: {
    backgroundColor: "#444",
    borderRadius: 6,
    padding: 10,
    marginVertical: 6,
  },
  deckOptionText: {
    color: SECONDARY,
    fontWeight: "bold",
  },
  cardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardText: {
    flex: 1,
    paddingRight: 10,
  },
  cardImageContainer: {
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  cardImage: {
    width: "100%",
    height: "100%",
    borderRadius: 4,
  },
  noImageText: {
    color: "#ccc",
    fontSize: 12,
    textAlign: "center",
  },
});
