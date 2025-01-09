import React, { useEffect, useState } from "react";
import { Picker } from "@react-native-picker/picker";
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
  where,
  serverTimestamp,
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
  eventType: string; // Cup, Challenger, Pre-release, Liguinha, Evento Especial
  judgeAccepted?: boolean; // se o juiz confirmou a função
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

export default function CalendarScreen() {
  const [playerId, setPlayerId] = useState("");
  const [isHost, setIsHost] = useState(false);

  const [torneios, setTorneios] = useState<Torneio[]>([]);
  const [currentMonth, setCurrentMonth] = useState(moment());

  // Lookup de nomes
  const [judgeMap, setJudgeMap] = useState<Record<string, string>>({});
  const [headJudgeMap, setHeadJudgeMap] = useState<Record<string, string>>({});

  // Modal CRIAR/EDITAR
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editJudge, setEditJudge] = useState("");
  const [editHeadJudge, setEditHeadJudge] = useState("");
  const [editEventType, setEditEventType] = useState("Cup");

  // Modal DETALHES
  const [detalhesModalVisible, setDetalhesModalVisible] = useState(false);
  const [detalhesTorneio, setDetalhesTorneio] = useState<Torneio | null>(null);

  // Sub-modal INSCRIÇÕES (para exibir lista de inscrições e decks) - **Novo** approach
  const [inscricoesModalVisible, setInscricoesModalVisible] = useState(false);
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [deckNameMap, setDeckNameMap] = useState<Record<string, string>>({});
  const [playerNameMap, setPlayerNameMap] = useState<Record<string, string>>({});

  // Sub-modal de PDF do Deck
  const [deckPdfModalVisible, setDeckPdfModalVisible] = useState(false);
  const [selectedDeckIdForPdf, setSelectedDeckIdForPdf] = useState("");

  // Modal INSCRIÇÃO (usuário)
  const [inscricaoModalVisible, setInscricaoModalVisible] = useState(false);
  const [inscricaoTorneioId, setInscricaoTorneioId] = useState<string | null>(
    null
  );
  const [userDecks, setUserDecks] = useState<DeckData[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState("");

  // Para armazenar cartas do deck atual
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

  // ------------------------------------------------------------------
  // Efeito Inicial: Carrega playerId, roles, e SetIdMap
  // ------------------------------------------------------------------
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
      const jMapObj: Record<string, string> = {};
      jArray.forEach((j) => {
        jMapObj[j.userId] = j.fullname;
      });
      setJudgeOptions(jArray);
      setJudgeMap(jMapObj);

      // Carrega HeadJudge
      const hjArray = await fetchHostsInfo(HEAD_JUDGE_PLAYER_IDS);
      const hjMapObj: Record<string, string> = {};
      hjArray.forEach((hj) => {
        hjMapObj[hj.userId] = hj.fullname;
      });
      setHeadJudgeOptions(hjArray);
      setHeadJudgeMap(hjMapObj);

      // Carrega mapping de ptcgoCode => set.id
      loadSetIdMap();
    })();
  }, []);

  // ------------------------------------------------------------------
  // Efeito: Carregar torneios do Firestore p/ mês atual
  // ------------------------------------------------------------------
  useEffect(() => {
    const colRef = collection(db, "calendar", "torneios", "list");
    const unsub = onSnapshot(colRef, (snap) => {
      const arr: Torneio[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        arr.push({
          id: docSnap.id,
          name: d.name,
          date: d.date,
          time: d.time,
          createdBy: d.createdBy,
          judge: d.judge || "",
          headJudge: d.headJudge || "",
          eventType: d.eventType || "Cup",
          judgeAccepted: d.judgeAccepted || false,
        });
      });
      // filtra por mes
      const start = currentMonth.clone().startOf("month");
      const end = currentMonth.clone().endOf("month");
      const filtered = arr.filter((t) => {
        const dt = moment(t.date, "DD/MM/YYYY");
        return dt.isBetween(start, end, undefined, "[]");
      });
      setTorneios(filtered);
    });
    return () => unsub();
  }, [currentMonth]);

  // ------------------------------------------------------------------
  // Função: loadSetIdMap() - carrega sets p/ fetch de imagens
  // ------------------------------------------------------------------
  async function loadSetIdMap() {
    try {
      const response = await fetch("https://api.pokemontcg.io/v2/sets");
      const data = await response.json();
      if (data && data.data) {
        const map: Record<string, string> = {};
        // Agrupa sets
        const groupedSets: Record<string, any[]> = {};
        data.data.forEach((s: any) => {
          const code = s.ptcgoCode?.toUpperCase();
          if (!code) return;
          if (!groupedSets[code]) groupedSets[code] = [];
          groupedSets[code].push(s);
        });
        // Seleciona best set
        Object.keys(groupedSets).forEach((code) => {
          const sets = groupedSets[code];
          const bestSet = sets.reduce((prev, curr) =>
            curr.total > prev.total ? curr : prev
          );
          map[code] = bestSet.id;
        });
        setSetIdMap(map);
      }
    } catch (err) {
      console.log("Erro loadSetIdMap:", err);
    }
  }

  // ====================== CREATE / EDIT TOURNAMENT ===========================
  const [judgeOptions, setJudgeOptions] = useState<
    { userId: string; fullname: string }[]
  >([]);
  const [headJudgeOptions, setHeadJudgeOptions] = useState<
    { userId: string; fullname: string }[]
  >([]);

  function handlePrevMonth() {
    setCurrentMonth((prev) => prev.clone().subtract(1, "month"));
  }
  function handleNextMonth() {
    setCurrentMonth((prev) => prev.clone().add(1, "month"));
  }

  function openCreateModal() {
    setEditId(null);
    setEditName("");
    setEditDate(moment().format("DD/MM/YYYY"));
    setEditTime("10:00");
    setEditJudge("");
    setEditHeadJudge("");
    setEditEventType("Cup");
    setModalVisible(true);
  }

  function openEditModal(t: Torneio) {
    setEditId(t.id);
    setEditName(t.name);
    setEditDate(t.date);
    setEditTime(t.time);
    setEditJudge(t.judge);
    setEditHeadJudge(t.headJudge);
    setEditEventType(t.eventType);
    setModalVisible(true);
  }

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
        // Edit
        const docRef = doc(colRef, editId);
        await updateDoc(docRef, {
          name: editName.trim(),
          date: editDate,
          time: editTime,
          judge: editJudge,
          judgeAccepted: false, // zera caso troque de juiz
          headJudge: editHeadJudge,
          eventType: editEventType,
        });
      } else {
        // Create
        const docRef = await addDoc(colRef, {
          name: editName.trim(),
          date: editDate,
          time: editTime,
          createdBy: playerId,
          judge: editJudge,
          headJudge: editHeadJudge,
          eventType: editEventType,
          judgeAccepted: false,
        });
        // Notifica juiz, se existir
        if (editJudge) {
          sendNotificationToJudge(editJudge, docRef.id, editName.trim());
        }
      }
      setModalVisible(false);
    } catch (err) {
      console.log("Erro handleSaveTorneio:", err);
      Alert.alert("Erro", "Falha ao salvar torneio.");
    }
  }

  async function sendNotificationToJudge(
    judgeId: string,
    torneioId: string,
    torneioName: string
  ) {
    try {
      const notifRef = doc(collection(db, "players", judgeId, "notifications"));
      await setDoc(notifRef, {
        type: "judge_invite",
        torneioId,
        torneioName,
        message: `Você foi escolhido como juiz do torneio "${torneioName}"`,
        timestamp: serverTimestamp(),
      });
      console.log("Notificação enviada ao juiz:", judgeId);
    } catch (err) {
      console.log("Erro ao notificar juiz:", err);
    }
  }

  // ==================== DELETE TORN. ====================
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
          } catch (err) {
            console.log("Erro handleDeleteTorneio:", err);
            Alert.alert("Erro", "Falha ao excluir torneio.");
          }
        },
      },
    ]);
  }

  // ==================== INSCRIÇÃO ====================
  async function handleInscrever(t: Torneio) {
    setInscricaoTorneioId(t.id);
    setSelectedDeckId("");

    // Carrega decks do user
    const decksRef = collection(db, "decks");
    onSnapshot(query(decksRef, where("playerId", "==", playerId)), (snap) => {
      const arr: DeckData[] = [];
      snap.forEach((docSnap) => {
        arr.push({
          id: docSnap.id,
          name: docSnap.data().name || `Deck ${docSnap.id}`,
          playerId: docSnap.data().playerId,
        });
      });
      setUserDecks(arr);
    });
    setInscricaoModalVisible(true);
  }

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
    } catch (err) {
      console.log("Erro handleSalvarInscricao:", err);
      Alert.alert("Erro", "Falha ao se inscrever.");
    }
  }

  // ==================== DETALHES (HOST/JUIZ) ====================
  async function handleOpenDetalhes(t: Torneio) {
    setDetalhesTorneio(t);
    setDetalhesModalVisible(true);
  }
  function closeDetalhes() {
    setDetalhesModalVisible(false);
    setDetalhesTorneio(null);
  }

  // ============ Sub-Modal: Inscrições + Decks (mais responsivo) ============
  async function openInscricoesModal(t: Torneio) {
    // Carrega a subcoleção “inscricoes”
    const colRef = collection(db, "calendar", "torneios", "list", t.id, "inscricoes");
    onSnapshot(colRef, (snap) => {
      const arr: Inscricao[] = [];
      snap.forEach((ds) => {
        arr.push({
          userId: ds.id,
          deckId: ds.data().deckId,
          createdAt: ds.data().createdAt || "",
        });
      });
      // Ordena
      arr.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
      setInscricoes(arr);

      // Montar userIDs e deckIDs
      const deckIdsSet = new Set<string>();
      const userIdsSet = new Set<string>();
      arr.forEach((i) => {
        if (i.deckId) deckIdsSet.add(i.deckId);
        userIdsSet.add(i.userId);
      });

      deckIdsSet.forEach(async (dkId) => {
        const dRef = doc(db, "decks", dkId);
        const dSnap = await getDoc(dRef);
        if (dSnap.exists()) {
          const nm = dSnap.data().name || `Deck ${dkId}`;
          setDeckNameMap((prev) => ({ ...prev, [dkId]: nm }));
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

    setInscricoesModalVisible(true);
  }
  function closeInscricoesModal() {
    setInscricoesModalVisible(false);
    setInscricoes([]);
  }

  // ==================== Juiz Pendente: confirm / recusar ====================
  async function confirmJudge(t: Torneio) {
    try {
      const colRef = collection(db, "calendar", "torneios", "list");
      const docRef = doc(colRef, t.id);
      await updateDoc(docRef, { judgeAccepted: true });
      Alert.alert("Sucesso", `Você confirmou como Juiz de ${t.name}.`);
      sendNotifToHost(t.createdBy, t.id, t.name, "O Juiz confirmou a função!");
    } catch (err) {
      console.log("Erro confirmJudge:", err);
      Alert.alert("Erro", "Não foi possível confirmar.");
    }
  }
  async function declineJudge(t: Torneio) {
    try {
      const colRef = collection(db, "calendar", "torneios", "list");
      const docRef = doc(colRef, t.id);
      await updateDoc(docRef, { judge: "", judgeAccepted: false });
      Alert.alert("Aviso", `Você recusou ser Juiz de ${t.name}.`);
      sendNotifToHost(t.createdBy, t.id, t.name, "O Juiz recusou a função.");
    } catch (err) {
      console.log("Erro declineJudge:", err);
      Alert.alert("Erro", "Não foi possível recusar.");
    }
  }

  /** Notifica o host */
  async function sendNotifToHost(
    hostId: string,
    torneioId: string,
    torneioName: string,
    message: string
  ) {
    if (!hostId) return;
    try {
      const notifRef = doc(collection(db, "players", hostId, "notifications"));
      await setDoc(notifRef, {
        type: "judge_response",
        torneioId,
        torneioName,
        message,
        timestamp: serverTimestamp(),
      });
      console.log("Notificou host:", hostId);
    } catch (err) {
      console.log("Erro ao notificar host:", err);
    }
  }

  // ============ Carregar Deck p/ sub-modal PDF ============
  async function loadDeckCards(deckId: string) {
    try {
      const deckRef = doc(db, "decks", deckId);
      const deckSnap = await getDoc(deckRef);
      if (!deckSnap.exists()) {
        console.log("Deck inexistente:", deckId);
        setDeckCards([]);
        return;
      }
      const deckData = deckSnap.data();
      const cards: {
        category: string;
        quantity: number;
        name: string;
        expansion?: string;
        cardNumber?: string;
      }[] = [];

      deckData.pokemons?.forEach((c: any) =>
        cards.push({ category: "Pokémon", ...c })
      );
      deckData.trainers?.forEach((c: any) =>
        cards.push({ category: "Treinador", ...c })
      );
      deckData.energies?.forEach((c: any) =>
        cards.push({ category: "Energia", ...c })
      );

      setDeckCards(cards);
      setLoadingImages(true);

      // Exemplo fetch de imagens:
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
    } catch (err) {
      console.log("Erro loadDeckCards:", err);
      setDeckCards([]);
      setLoadingImages(false);
    }
  }
  async function fetchCardImage(
    cardName: string,
    expansion?: string,
    cardNumber?: string
  ): Promise<string | null> {
    try {
      const sanitized = cardName.replace(/\bPH\b/g, "").trim();
      const setId = expansion ? setIdMap[expansion.toUpperCase()] : undefined;
      const queryParts: string[] = [`name:"${encodeURIComponent(sanitized)}"`];
      if (setId) queryParts.push(`set.id:"${setId}"`);
      if (cardNumber) queryParts.push(`number:"${cardNumber}"`);
      const query = queryParts.join("%20");
      const url = `https://api.pokemontcg.io/v2/cards?q=${query}`;
      console.log("Consultando:", url);
      const resp = await fetch(url, {
        headers: {
          "X-Api-Key": "8d293a2a-4949-4d04-a06c-c20672a7a12c",
        },
      });
      const data = await resp.json();
      if (data && data.data && data.data.length > 0) {
        return data.data[0].images.small || null;
      }
      return null;
    } catch (err) {
      console.log("Erro fetchCardImage:", err);
      return null;
    }
  }

  // Sub-modal PDF do deck
  function renderDeckPdfModal() {
    return (
      <Modal
        visible={deckPdfModalVisible}
        animationType="slide"
        onRequestClose={() => setDeckPdfModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Detalhes do Deck</Text>
          <Text style={{ color: "#ccc", textAlign: "center", marginBottom: 20 }}>
            Deck: {deckNameMap[selectedDeckIdForPdf] || `ID ${selectedDeckIdForPdf}`}
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
                          {card.category}: {card.name}
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
            onPress={() => setDeckPdfModalVisible(false)}
          >
            <Text style={styles.buttonText}>Fechar</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  // -------------- Render do card principal --------------
  function renderCard(t: Torneio) {
    const dt = moment(t.date, "DD/MM/YYYY");
    const isFuture = dt.isSameOrAfter(moment(), "day");
    const eventLabel = t.eventType || "Cup";

    const judgeName = judgeMap[t.judge] || "(Sem juiz)";
    const headJudgeName = headJudgeMap[t.headJudge] || "(Sem head judge)";

    const isThisJudgePending = t.judge === playerId && t.judgeAccepted === false;
    const canAccessDetails =
      isHost || (t.judge === playerId && t.judgeAccepted === true);

    return (
      <View style={styles.card} key={`t-${t.id}`}>
        <Text style={styles.cardTitle}>{t.name}</Text>
        <Text style={styles.cardSub}>
          {t.date} às {t.time} | [{eventLabel}]
        </Text>
        <Text style={styles.cardSub}>
          Criador: {t.createdBy}
          {"\n"}
          Juiz: {judgeName}
          {t.judgeAccepted ? " (Confirmado)" : " (Pendente)"}
          {"\n"}
          Head Judge: {headJudgeName}
        </Text>

        {isThisJudgePending && (
          <View style={{ flexDirection: "row", marginTop: 8 }}>
            <TouchableOpacity
              style={[styles.buttonSmall, { marginRight: 8 }]}
              onPress={() => confirmJudge(t)}
            >
              <Text style={styles.buttonSmallText}>Confirmar Juiz</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buttonSmall, { backgroundColor: "#FF3333" }]}
              onPress={() => declineJudge(t)}
            >
              <Text style={styles.buttonSmallText}>Recusar</Text>
            </TouchableOpacity>
          </View>
        )}

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
          <View style={{ flexDirection: "row", marginTop: 8 }}>
            {canAccessDetails && (
              <TouchableOpacity
                style={[styles.inscreverButton, { marginRight: 8 }]}
                onPress={() => handleOpenDetalhes(t)}
              >
                <Text style={styles.inscreverButtonText}>Ver Detalhes</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.inscreverButton}
              onPress={() => handleInscrever(t)}
            >
              <Text style={styles.inscreverButtonText}>Inscrever-se</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.inscreverButton, { backgroundColor: "#777", marginTop: 8 }]}
            onPress={() => (canAccessDetails ? handleOpenDetalhes(t) : null)}
          >
            <Text style={styles.inscreverButtonText}>
              {canAccessDetails ? "Ver Detalhes" : "Já ocorreu"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // -------------- Render da Tela de Detalhes --------------
  function renderDetalhesModal() {
    if (!detalhesTorneio) return null;

    return (
      <Modal
        visible={detalhesModalVisible}
        animationType="slide"
        onRequestClose={closeDetalhes}
      >
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.modalTitle}>Detalhes do Torneio</Text>

            <Text style={styles.modalLabel}>Nome</Text>
            <Text style={styles.modalInput}>{detalhesTorneio.name}</Text>

            <Text style={styles.modalLabel}>Data</Text>
            <Text style={styles.modalInput}>{detalhesTorneio.date}</Text>

            <Text style={styles.modalLabel}>Hora</Text>
            <Text style={styles.modalInput}>{detalhesTorneio.time}</Text>

            <Text style={styles.modalLabel}>Tipo de Evento</Text>
            <Text style={styles.modalInput}>{detalhesTorneio.eventType}</Text>

            <Text style={styles.modalLabel}>Juiz</Text>
            <Text style={styles.modalInput}>
              {judgeMap[detalhesTorneio.judge] || "Sem juiz"}
              {detalhesTorneio.judgeAccepted ? " (Confirmado)" : " (Pendente)"}
            </Text>

            <Text style={styles.modalLabel}>Head Judge</Text>
            <Text style={styles.modalInput}>
              {headJudgeMap[detalhesTorneio.headJudge] || "Sem head judge"}
            </Text>

            {/* Botão para abrir outro modal com Inscrições e Decks */}
            <TouchableOpacity
              style={[styles.button, { marginTop: 20 }]}
              onPress={() => openInscricoesModal(detalhesTorneio)}
            >
              <Text style={styles.buttonText}>Ver Inscrições/Decks</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: "#999", marginTop: 20 }]}
              onPress={closeDetalhes}
            >
              <Text style={styles.buttonText}>Fechar</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  // -------------- Sub-modal para mostrar INSCRIÇÕES E DECKS --------------
  function renderInscricoesModal() {
    return (
      <Modal
        visible={inscricoesModalVisible}
        animationType="slide"
        onRequestClose={closeInscricoesModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView style={{ padding: 16 }}>
            <Text style={styles.modalTitle}>Inscrições / Decks</Text>

            {inscricoes.length === 0 ? (
              <Text style={{ color: "#ccc", marginVertical: 10 }}>
                Nenhuma inscrição encontrada.
              </Text>
            ) : (
              inscricoes.map((ins, idx) => (
                <TouchableOpacity
                  key={`ins-${idx}`}
                  style={styles.inscricaoItem}
                  onPress={() =>
                    ins.deckId
                      ? (setSelectedDeckIdForPdf(ins.deckId),
                        loadDeckCards(ins.deckId),
                        setDeckPdfModalVisible(true))
                      : null
                  }
                >
                  <Text style={styles.inscricaoItemText}>
                    Jogador: {playerNameMap[ins.userId] || ins.userId}
                  </Text>
                  <Text style={styles.inscricaoItemText}>
                    Deck:{" "}
                    {ins.deckId
                      ? deckNameMap[ins.deckId] || `(Deck ${ins.deckId})`
                      : "Sem deck"}
                  </Text>
                  <Text style={styles.inscricaoItemText}>
                    Data/Hora: {formatIsoDate(ins.createdAt)}
                  </Text>
                </TouchableOpacity>
              ))
            )}

            <TouchableOpacity
              style={[styles.button, { marginTop: 20 }]}
              onPress={closeInscricoesModal}
            >
              <Text style={styles.buttonText}>Fechar</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  // --------------------------------- RENDER FINAL ---------------------------------
  return (
    <SafeAreaView style={styles.safe}>
      {/* Cabeçalho: Troca de mês */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handlePrevMonth}>
          <Text style={styles.headerButton}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {currentMonth.format("MMMM [de] YYYY")}
        </Text>
        <TouchableOpacity onPress={handleNextMonth}>
          <Text style={styles.headerButton}>{">"}</Text>
        </TouchableOpacity>
      </View>

      {/* Se for Host, exibe botão de Criar Torneio */}
      {isHost && (
        <TouchableOpacity style={styles.createButton} onPress={openCreateModal}>
          <Text style={styles.createButtonText}>+ Criar Torneio</Text>
        </TouchableOpacity>
      )}

      {/* Lista de torneios */}
      <ScrollView style={{ flex: 1, marginTop: 10 }}>
        {torneios.map((t) => renderCard(t))}
      </ScrollView>

      {/* Modal: CRIAR/EDITAR TORNEIO */}
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

            <Text style={styles.modalLabel}>Tipo de Evento</Text>
            <Picker
              selectedValue={editEventType}
              onValueChange={(v) => setEditEventType(v)}
              style={[styles.modalInput, { color: "#fff" }]}
            >
              <Picker.Item label="Cup" value="Cup" />
              <Picker.Item label="Challenger" value="Challenger" />
              <Picker.Item label="Pre-release" value="Pre-release" />
              <Picker.Item label="Liguinha" value="Liguinha" />
              <Picker.Item label="Evento Especial" value="Evento Especial" />
            </Picker>

            <Text style={styles.modalLabel}>Juiz</Text>
            <Picker
              selectedValue={editJudge}
              onValueChange={(v) => setEditJudge(v)}
              style={[styles.modalInput, { color: "#fff" }]}
            >
              <Picker.Item label="Nenhum (Player comum)" value="" />
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
              <Picker.Item label="Nenhum" value="" />
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
              <TouchableOpacity style={styles.button} onPress={handleSaveTorneio}>
                <Text style={styles.buttonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal DETALHES (host/juiz) */}
      {detalhesModalVisible && renderDetalhesModal()}

      {/* Sub-modal INSCRIÇÕES / DECKS (mais otimizado) */}
      {renderInscricoesModal()}

      {/* Sub-modal do PDF do deck */}
      {renderDeckPdfModal()}

      {/* Modal INSCRIÇÃO (Deck) */}
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
                  {dk.playerId} | {dk.name}
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
              <TouchableOpacity style={styles.button} onPress={handleSalvarInscricao}>
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
