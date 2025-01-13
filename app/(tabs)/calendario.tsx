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

import { useTranslation } from "react-i18next"; // <--- i18n

/** Estrutura do Torneio */
interface Torneio {
  id: string;
  name: string;
  date: string; // dd/mm/aaaa
  time: string; // hh:mm
  createdBy: string;
  judge: string;
  headJudge: string;
  eventType: string;
  judgeAccepted?: boolean;
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
  const { t } = useTranslation(); // <--- i18n Hook

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

  // Sub-modal INSCRIÇÕES
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

  // Select de Juiz
  const [judgeOptions, setJudgeOptions] = useState<
    { userId: string; fullname: string }[]
  >([]);
  const [headJudgeOptions, setHeadJudgeOptions] = useState<
    { userId: string; fullname: string }[]
  >([]);

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

      // Carrega Judge
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

      // Carrega mapping p/ imagens
      loadSetIdMap();
    })();
  }, []);

  // Carrega torneios do Firestore p/ mês atual
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

  async function loadSetIdMap() {
    try {
      const response = await fetch("https://api.pokemontcg.io/v2/sets");
      const data = await response.json();
      if (data && data.data) {
        const map: Record<string, string> = {};
        const groupedSets: Record<string, any[]> = {};
        data.data.forEach((s: any) => {
          const code = s.ptcgoCode?.toUpperCase();
          if (!code) return;
          if (!groupedSets[code]) groupedSets[code] = [];
          groupedSets[code].push(s);
        });
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

  // --------------- Navegação de mês ---------------
  function handlePrevMonth() {
    setCurrentMonth((prev) => prev.clone().subtract(1, "month"));
  }
  function handleNextMonth() {
    setCurrentMonth((prev) => prev.clone().add(1, "month"));
  }

  // --------------- Criar/Editar Torneio ---------------
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
      Alert.alert(t("common.error"), t("calendar.alerts.name_required"));
      return;
    }
    if (!moment(editDate, "DD/MM/YYYY", true).isValid()) {
      Alert.alert(t("common.error"), t("calendar.alerts.invalid_date"));
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
          judgeAccepted: false,
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
      Alert.alert(t("common.error"), t("calendar.alerts.save_error"));
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
        message: t("calendar.alerts.judge_invite_message", {
          torneioName: torneioName,
        }) /* <--- Falta criar se quiser */,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.log("Erro ao notificar juiz:", err);
    }
  }

  // --------------- Excluir Torneio ---------------
  async function handleDeleteTorneio(torneio: Torneio) {
    Alert.alert(
      t("common.confirm"),
      t("calendar.alerts.delete_confirm", { name: torneio.name }), // Use o nome corretamente
      [
        { text: t("calendar.form.cancel_button"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const colRef = collection(db, "calendar", "torneios", "list");
              const docRef = doc(colRef, torneio.id); // Use torneio.id aqui
              await deleteDoc(docRef);
            } catch (err) {
              console.log("Erro handleDeleteTorneio:", err);
              Alert.alert(t("common.error"), t("calendar.alerts.delete_error"));
            }
          },
        },
      ]
    );
  }
  

  // --------------- Inscrever ---------------
  async function handleInscrever(t: Torneio) {
    setInscricaoTorneioId(t.id);
    setSelectedDeckId("");

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
      Alert.alert(t("common.error"), t("calendar.alerts.registration_error"));
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
      Alert.alert(t("common.success"), t("calendar.alerts.success_registration"));
      setInscricaoModalVisible(false);
    } catch (err) {
      console.log("Erro handleSalvarInscricao:", err);
      Alert.alert(t("common.error"), t("calendar.alerts.registration_error"));
    }
  }

  // --------------- Detalhes do Torneio ---------------
  async function handleOpenDetalhes(t: Torneio) {
    setDetalhesTorneio(t);
    setDetalhesModalVisible(true);
  }
  function closeDetalhes() {
    setDetalhesModalVisible(false);
    setDetalhesTorneio(null);
  }

  // --------------- Ver Inscrições ---------------
  async function openInscricoesModal(t: Torneio) {
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
      arr.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
      setInscricoes(arr);

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

  // --------------- Juiz: Confirmar ou Recusar ---------------
  async function confirmJudge(tournament: Torneio) {

  try {
    const colRef = collection(db, "calendar", "torneios", "list");
    const docRef = doc(colRef, tournament.id);
    await updateDoc(docRef, { judgeAccepted: true });

    // Exibe alerta de sucesso
    Alert.alert(
      t("common.success"),
      t("calendar.alerts.judge_confirmed", { tournamentName: tournament.name })
    );

    // Envia notificação para o criador do torneio
    sendNotifToHost(
      tournament.createdBy,
      tournament.id,
      tournament.name,
      t("calendar.alerts.judge_notif_host_confirmed")
    );
  } catch (err) {
    console.log("Erro confirmJudge:", err);

    // Exibe alerta de erro
    Alert.alert(t("common.error"), t("calendar.alerts.judge_notif_host_confirmed"));
  }
}

async function declineJudge(tournament: Torneio) {

  try {
    const colRef = collection(db, "calendar", "torneios", "list");
    const docRef = doc(colRef, tournament.id);
    await updateDoc(docRef, { judge: "", judgeAccepted: false });

    // Exibe alerta de sucesso
    Alert.alert(
      t("common.success"),
      t("calendar.alerts.judge_declined", { tournamentName: tournament.name })
    );

    // Envia notificação para o criador do torneio
    sendNotifToHost(
      tournament.createdBy,
      tournament.id,
      tournament.name,
      t("calendar.alerts.judge_notif_host_declined")
    );
  } catch (err) {
    console.log("Erro declineJudge:", err);

    // Exibe alerta de erro
    Alert.alert(t("common.error"), t("calendar.alerts.judge_decline_error"));
  }
}
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
    } catch (err) {
      console.log("Erro ao notificar host:", err);
    }
  }

  // --------------- Carregar Deck p/ sub-modal PDF ---------------
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

  function renderDeckPdfModal() {
    return (
      <Modal
        visible={deckPdfModalVisible}
        animationType="slide"
        onRequestClose={() => setDeckPdfModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <Text style={styles.modalTitle}>{/* Falta i18n? */}Detalhes do Deck</Text>
          <Text style={{ color: "#ccc", textAlign: "center", marginBottom: 20 }}>
            {t("calendar.registration.title")}:
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
                          {card.category}: {card.name}
                        </Text>
                        <Text style={styles.cardSub}>
                          Qtd: {card.quantity}
                        </Text>
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
                {t("calendar.registration.no_decks")}
              </Text>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.button, { margin: 16 }]}
            onPress={() => setDeckPdfModalVisible(false)}
          >
            <Text style={styles.buttonText}>
              {t("calendar.details.close_button")}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  // -------------- Render card --------------
  function renderCard(tor: Torneio) {
    const dt = moment(tor.date, "DD/MM/YYYY");
    const isFuture = dt.isSameOrAfter(moment(), "day");
    const eventLabel = tor.eventType || "Cup";

    const judgeName = judgeMap[tor.judge] || t("calendar.card.judge_label");
    const headJudgeName = headJudgeMap[tor.headJudge] || t("calendar.card.head_judge_label");
    const isThisJudgePending = tor.judge === playerId && tor.judgeAccepted === false;
    const canAccessDetails = isHost || (tor.judge === playerId && tor.judgeAccepted);

    return (
      <View style={styles.card} key={`t-${tor.id}`}>
        <Text style={styles.cardTitle}>{tor.name}</Text>
        <Text style={styles.cardSub}>
          {tor.date} {t("calendar.form.time_label")?.split(" ")[0] || "às"} {tor.time} | [{eventLabel}]
        </Text>
        <Text style={styles.cardSub}>
          {t("calendar.card.creator_label")}: {tor.createdBy}
          {"\n"}
          {t("calendar.card.judge_label")}: {judgeName}
          {tor.judgeAccepted ? " (Confirmado)" : " (Pendente)"}
          {"\n"}
          {t("calendar.card.head_judge_label")}: {headJudgeName}
        </Text>

        {isThisJudgePending && (
          <View style={{ flexDirection: "row", marginTop: 8 }}>
            <TouchableOpacity
              style={[styles.buttonSmall, { marginRight: 8 }]}
              onPress={() => confirmJudge(tor)}
            >
              <Text style={styles.buttonSmallText}>{t("common.confirm")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buttonSmall, { backgroundColor: "#FF3333" }]}
              onPress={() => declineJudge(tor)}
            >
              <Text style={styles.buttonSmallText}>{t("common.decline")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {isHost && (
          <View style={{ flexDirection: "row", marginTop: 6 }}>
            <TouchableOpacity
              style={[styles.buttonSmall, { marginRight: 8 }]}
              onPress={() => openEditModal(tor)}
            >
              <Text style={styles.buttonSmallText}>{t("common.edit")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buttonSmall, { backgroundColor: "#FF3333" }]}
              onPress={() => handleDeleteTorneio(tor)}
            >
              <Text style={styles.buttonSmallText}>{t("common.delete")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {isFuture ? (
          <View style={{ flexDirection: "row", marginTop: 8 }}>
            {canAccessDetails && (
              <TouchableOpacity
                style={[styles.inscreverButton, { marginRight: 8 }]}
                onPress={() => handleOpenDetalhes(tor)}
              >
                <Text style={styles.inscreverButtonText}>
                  {t("calendar.card.details_button")}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.inscreverButton}
              onPress={() => handleInscrever(tor)}
            >
              <Text style={styles.inscreverButtonText}>
                {t("calendar.card.register_button")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.inscreverButton, { backgroundColor: "#777", marginTop: 8 }]}
            onPress={() => (canAccessDetails ? handleOpenDetalhes(tor) : null)}
          >
            <Text style={styles.inscreverButtonText}>
              {canAccessDetails
                ? t("calendar.card.details_button")
                : t("calendar.card.already_occurred")}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // -------------- Modal de Detalhes --------------
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
            <Text style={styles.modalTitle}>{t("calendar.details.title")}</Text>

            <Text style={styles.modalLabel}>{t("calendar.details.name_label")}</Text>
            <Text style={styles.modalInput}>{detalhesTorneio.name}</Text>

            <Text style={styles.modalLabel}>{t("calendar.details.date_label")}</Text>
            <Text style={styles.modalInput}>{detalhesTorneio.date}</Text>

            <Text style={styles.modalLabel}>{t("calendar.details.time_label")}</Text>
            <Text style={styles.modalInput}>{detalhesTorneio.time}</Text>

            <Text style={styles.modalLabel}>{t("calendar.details.event_type_label")}</Text>
            <Text style={styles.modalInput}>{detalhesTorneio.eventType}</Text>

            <Text style={styles.modalLabel}>{t("calendar.details.judge_label")}</Text>
            <Text style={styles.modalInput}>
              {judgeMap[detalhesTorneio.judge] || "Sem juiz"}
              {detalhesTorneio.judgeAccepted ? " (Confirmado)" : " (Pendente)"}
            </Text>

            <Text style={styles.modalLabel}>{t("calendar.details.head_judge_label")}</Text>
            <Text style={styles.modalInput}>
              {headJudgeMap[detalhesTorneio.headJudge] || "Sem head judge"}
            </Text>

            <TouchableOpacity
              style={[styles.button, { marginTop: 20 }]}
              onPress={() => openInscricoesModal(detalhesTorneio)}
            >
              <Text style={styles.buttonText}>
                {t("calendar.details.view_inscriptions_button")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: "#999", marginTop: 20 }]}
              onPress={closeDetalhes}
            >
              <Text style={styles.buttonText}>
                {t("calendar.details.close_button")}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  // -------------- Sub-modal Inscrições --------------
  function renderInscricoesModal() {
    return (
      <Modal
        visible={inscricoesModalVisible}
        animationType="slide"
        onRequestClose={closeInscricoesModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView style={{ padding: 16 }}>
            <Text style={styles.modalTitle}>
              {/* Falta no JSON: "calendar.inscriptions.title" */}
              {t("calendar.inscriptions.title", "Inscrições / Decks")}
            </Text>

            {inscricoes.length === 0 ? (
              <Text style={{ color: "#ccc", marginVertical: 10 }}>
                {t("calendar.inscriptions.none", "Nenhuma inscrição encontrada.")}
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
                    {t("jogador.header", "Jogador")}:{" "}
                    {playerNameMap[ins.userId] || ins.userId}
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
              <Text style={styles.buttonText}>
                {t("calendar.details.close_button")}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  // -------------------------------- RENDER PRINCIPAL --------------------------------
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handlePrevMonth}>
          {/* t("calendar.header.prev_month") => "<" */}
          <Text style={styles.headerButton}>{t("calendar.header.prev_month")}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {currentMonth.format("MMMM [de] YYYY")}
        </Text>
        <TouchableOpacity onPress={handleNextMonth}>
          {/* t("calendar.header.next_month") => ">" */}
          <Text style={styles.headerButton}>{t("calendar.header.next_month")}</Text>
        </TouchableOpacity>
      </View>

      {isHost && (
        <TouchableOpacity style={styles.createButton} onPress={openCreateModal}>
          <Text style={styles.createButtonText}>
            {t("calendar.create_tournament")}
          </Text>
        </TouchableOpacity>
      )}

      <ScrollView style={{ flex: 1, marginTop: 10 }}>
        {torneios.map((t) => renderCard(t))}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView style={{ padding: 16 }}>
            <Text style={styles.modalTitle}>
              {editId
                ? /* Falta i18n: "Editar Torneio" */
                  t("calendar.edit_tournament", "Editar Torneio")
                : t("calendar.create_tournament")}
            </Text>

            <Text style={styles.modalLabel}>
              {t("calendar.form.name_label")}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
            />

            <Text style={styles.modalLabel}>
              {t("calendar.form.date_label")}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={editDate}
              onChangeText={setEditDate}
            />

            <Text style={styles.modalLabel}>
              {t("calendar.form.time_label")}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={editTime}
              onChangeText={setEditTime}
            />

            <Text style={styles.modalLabel}>
              {t("calendar.form.event_type_label")}
            </Text>
            <Picker
              selectedValue={editEventType}
              onValueChange={(v) => setEditEventType(v)}
              style={[styles.modalInput, { color: "#fff" }]}
            >
              <Picker.Item label={t("calendar.event_types.cup")} value="Cup" />
              <Picker.Item
                label={t("calendar.event_types.challenger")}
                value="Challenger"
              />
              <Picker.Item
                label={t("calendar.event_types.pre_release")}
                value="Pre-release"
              />
              <Picker.Item
                label={t("calendar.event_types.liguinha")}
                value="Liguinha"
              />
              <Picker.Item
                label={t("calendar.event_types.special_event")}
                value="Evento Especial"
              />
            </Picker>

            <Text style={styles.modalLabel}>
              {t("calendar.form.judge_label")}
            </Text>
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

            <Text style={styles.modalLabel}>
              {t("calendar.form.head_judge_label")}
            </Text>
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
                <Text style={styles.buttonText}>
                  {t("calendar.form.cancel_button")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={handleSaveTorneio}>
                <Text style={styles.buttonText}>
                  {t("calendar.form.save_button")}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal DETALHES */}
      {detalhesModalVisible && renderDetalhesModal()}

      {/* Sub-modal INSCRIÇÕES */}
      {renderInscricoesModal()}

      {/* Sub-modal PDF do Deck */}
      {renderDeckPdfModal()}

      {/* Modal INSCRIÇÃO (Deck) */}
      <Modal
        visible={inscricaoModalVisible}
        animationType="slide"
        onRequestClose={() => setInscricaoModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView style={{ padding: 16 }}>
            <Text style={styles.modalTitle}>
              {t("calendar.registration.title")}
            </Text>
            {userDecks.length === 0 && (
              <Text style={{ color: "#fff", marginBottom: 10 }}>
                {t("calendar.registration.no_decks")}
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
                <Text style={styles.buttonText}>
                  {t("calendar.form.cancel_button")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={handleSalvarInscricao}>
                <Text style={styles.buttonText}>
                  {t("calendar.registration.submit_button")}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

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
