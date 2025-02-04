import React, { useEffect, useState } from "react";
import moment from "moment";
import "moment/locale/pt-br";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Modal,
  TextInput,
  Image,
  ActivityIndicator,
  Switch,
  Alert,
  TouchableOpacity,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
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
  getDocs,
} from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";

import {
  vipPlayers,
  HOST_PLAYER_IDS,
  HEAD_JUDGE_PLAYER_IDS,
  JUDGE_PLAYER_IDS,
  fetchRoleMembers,
} from "../hosts";

import * as Animatable from "react-native-animatable";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { TouchableWithoutFeedback } from "react-native-gesture-handler";

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
  maxVagas?: number;
  inscricoesAbertura?: string;
  inscricoesFechamento?: string;
  prioridadeVip?: boolean;
  inscricoesVipAbertura?: string;
  inscricoesVipFechamento?: string;
}

interface Inscricao {
  userId: string;
  deckId?: string;
  createdAt: string;
}

interface Espera {
  userId: string;
  deckId?: string;
  createdAt: string;
  vip: boolean;
}

interface DeckData {
  id: string;
  name: string;
  playerId: string;
}

export default function CalendarScreen() {
  const [playerId, setPlayerId] = useState("");
  const [isHost, setIsHost] = useState(false);

  const [leagueId, setLeagueId] = useState("1186767"); // fallback

  const [torneios, setTorneios] = useState<Torneio[]>([]);
  const [currentMonth, setCurrentMonth] = useState(moment());

  // Mapeamentos de nomes
  const [judgeMap, setJudgeMap] = useState<Record<string, string>>({});
  const [headJudgeMap, setHeadJudgeMap] = useState<Record<string, string>>({});
  const [playerNameMap, setPlayerNameMap] = useState<Record<string, string>>({});

  // Opções de Judge e HeadJudge (modal)
  const [judgeOptions, setJudgeOptions] = useState<{ userId: string; fullname: string }[]>([]);
  const [headJudgeOptions, setHeadJudgeOptions] = useState<{ userId: string; fullname: string }[]>([]);

  // Modal CRIAR/EDITAR
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");  // dd/mm/aaaa
  const [editTime, setEditTime] = useState("");  // hh:mm
  const [editJudge, setEditJudge] = useState("");
  const [editHeadJudge, setEditHeadJudge] = useState("");
  const [editEventType, setEditEventType] = useState("Cup");

  // Modal de seleção de Juiz
  const [judgeSelectModal, setJudgeSelectModal] = useState(false);
  const [headJudgeSelectModal, setHeadJudgeSelectModal] = useState(false);
  // Modal de seleção de Tipo de Evento
  const [eventTypeSelectModal, setEventTypeSelectModal] = useState(false);

  const [editMaxVagas, setEditMaxVagas] = useState<number | null>(null);
  const [editInscricoesAbertura, setEditInscricoesAbertura] = useState<string>("");
  const [editInscricoesFechamento, setEditInscricoesFechamento] = useState<string>("");
  const [editPrioridadeVip, setEditPrioridadeVip] = useState<boolean>(false);
  const [editInscricoesVipAbertura, setEditInscricoesVipAbertura] = useState<string>("");
  const [editInscricoesVipFechamento, setEditInscricoesVipFechamento] = useState<string>("");

  // Modal DETALHES
  const [detalhesModalVisible, setDetalhesModalVisible] = useState(false);
  const [detalhesTorneio, setDetalhesTorneio] = useState<Torneio | null>(null);

  // Sub-modal INSCRIÇÕES
  const [inscricoesModalVisible, setInscricoesModalVisible] = useState(false);
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [deckNameMap, setDeckNameMap] = useState<Record<string, string>>({});

  // Sub-modal PDF do Deck
  const [deckPdfModalVisible, setDeckPdfModalVisible] = useState(false);
  const [selectedDeckIdForPdf, setSelectedDeckIdForPdf] = useState("");

  // Modal INSCRIÇÃO (usuário)
  const [inscricaoModalVisible, setInscricaoModalVisible] = useState(false);
  const [inscricaoTorneioId, setInscricaoTorneioId] = useState<string | null>(null);
  const [userDecks, setUserDecks] = useState<DeckData[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState("");

  // Lista de Espera
  const [espera, setEspera] = useState<Espera[]>([]);
  const [esperaModalVisible, setEsperaModalVisible] = useState(false);

  // Cartas do deck
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

  // Tipo de Evento (lista)
  const eventTypesList = [
    "Challenge",
    "Cup",
    "Liga Local",
    "Pré-Release",
    "Evento Especial",
  ];

  // =========================== useEffect Inicial ===========================
  useEffect(() => {
    moment.locale("pt-br");

    (async () => {
      try {
        const pid = await AsyncStorage.getItem("@userId");
        if (pid) {
          setPlayerId(pid);
          setIsHost(HOST_PLAYER_IDS.includes(pid));
        }
        const storedLeagueId = await AsyncStorage.getItem("@leagueId");
        if (storedLeagueId) setLeagueId(storedLeagueId);

        // Carregar Judge e HeadJudge da league
        const jArray = await fetchRoleMembers(leagueId, "judge");
        const jMapObj: Record<string, string> = {};
        jArray.forEach((j) => {
          jMapObj[j.userId] = j.fullname;
        });
        setJudgeOptions(jArray);
        setJudgeMap(jMapObj);

        const hjArray = await fetchRoleMembers(leagueId, "head");
        const hjMapObj: Record<string, string> = {};
        hjArray.forEach((hj) => {
          hjMapObj[hj.userId] = hj.fullname;
        });
        setHeadJudgeOptions(hjArray);
        setHeadJudgeMap(hjMapObj);

        loadSetIdMap();
      } catch (error) {
        console.log("Erro no fetch inicial:", error);
      }
    })();
  }, [leagueId]);

  // =========================== Carrega torneios do Firestore ===========================
  useEffect(() => {
    // Precisamos de um caminho impar: leagues/{leagueId}/calendar
    // {leagueId} e "calendar" => 3 segmentos => colecao
    if (!leagueId) return;

    const colRef = collection(db, "leagues", leagueId, "calendar");
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
          maxVagas: d.maxVagas || null,
          inscricoesAbertura: d.inscricoesAbertura || "",
          inscricoesFechamento: d.inscricoesFechamento || "",
          prioridadeVip: d.prioridadeVip || false,
          inscricoesVipAbertura: d.inscricoesVipAbertura || "",
          inscricoesVipFechamento: d.inscricoesVipFechamento || "",
        });
      });
      // Filtrar só do mês atual
      const start = currentMonth.clone().startOf("month");
      const end = currentMonth.clone().endOf("month");
      const filtered = arr.filter((t) => {
        const dt = moment(t.date, "DD/MM/YYYY");
        return dt.isBetween(start, end, undefined, "[]");
      });
      setTorneios(filtered);

      // Carrega o nome do "createdBy" no playerMap
      arr.forEach(async (tor) => {
        if (tor.createdBy && !playerNameMap[tor.createdBy]) {
          const pRef = doc(db, "players", tor.createdBy);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const nm = pSnap.data().fullname || `Jogador ${tor.createdBy}`;
            setPlayerNameMap((prev) => ({ ...prev, [tor.createdBy]: nm }));
          }
        }
      });
    });
    return () => unsub();
  }, [currentMonth, leagueId]);

  // =========================== Carrega sets p/ imagens ===========================
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

  // =========================== Navegação de Mês ===========================
  function handlePrevMonth() {
    setCurrentMonth((prev) => prev.clone().subtract(1, "month"));
  }
  function handleNextMonth() {
    setCurrentMonth((prev) => prev.clone().add(1, "month"));
  }

  // =========================== CRIAR/EDITAR TORN. ===========================
  function openCreateModal() {
    setEditId(null);
    setEditName("");
    setEditDate(moment().format("DD/MM/YYYY"));
    setEditTime("10:00");
    setEditJudge("");
    setEditHeadJudge("");
    setEditEventType("Cup");
    setEditMaxVagas(null);
    setEditInscricoesAbertura("");
    setEditInscricoesFechamento("");
    setEditPrioridadeVip(false);
    setEditInscricoesVipAbertura("");
    setEditInscricoesVipFechamento("");
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
    setEditMaxVagas(t.maxVagas ?? null);
    setEditInscricoesAbertura(t.inscricoesAbertura ?? "");
    setEditInscricoesFechamento(t.inscricoesFechamento ?? "");
    setEditPrioridadeVip(t.prioridadeVip ?? false);
    setEditInscricoesVipAbertura(t.inscricoesVipAbertura ?? "");
    setEditInscricoesVipFechamento(t.inscricoesVipFechamento ?? "");

    setModalVisible(true);
  }

  function handleMaskDate(text: string, setFunc: (val: string) => void) {
    // dd/mm/aaaa => 10 caracteres
    let cleaned = text.replace(/\D/g, "");
    if (cleaned.length > 8) cleaned = cleaned.slice(0, 8);

    let formatted = "";
    if (cleaned.length <= 2) {
      formatted = cleaned;
    } else if (cleaned.length <= 4) {
      formatted = cleaned.slice(0, 2) + "/" + cleaned.slice(2);
    } else {
      formatted =
        cleaned.slice(0, 2) + "/" + cleaned.slice(2, 4) + "/" + cleaned.slice(4);
    }
    setFunc(formatted);
  }

  function handleMaskTime(text: string, setFunc: (val: string) => void) {
    // hh:mm => 5 caracteres
    let cleaned = text.replace(/\D/g, "");
    if (cleaned.length > 4) cleaned = cleaned.slice(0, 4);

    let formatted = "";
    if (cleaned.length <= 2) {
      formatted = cleaned;
    } else {
      formatted = cleaned.slice(0, 2) + ":" + cleaned.slice(2);
    }
    setFunc(formatted);
  }

  async function handleSaveTorneio() {
    if (!editName.trim()) {
      Alert.alert("Erro", "Nome do torneio é obrigatório.");
      return;
    }
    if (!moment(editDate, "DD/MM/YYYY", true).isValid()) {
      Alert.alert("Erro", "Data inválida.");
      return;
    }
    // Caminho => leagues/{leagueId}/calendar => docId
    try {
      const colRef = collection(db, "leagues", leagueId, "calendar");
      if (editId) {
        const docRef = doc(colRef, editId);
        await updateDoc(docRef, {
          name: editName.trim(),
          date: editDate,
          time: editTime,
          judge: editJudge,
          judgeAccepted: false,
          headJudge: editHeadJudge,
          eventType: editEventType,
          maxVagas: editMaxVagas,
          inscricoesAbertura: editInscricoesAbertura,
          inscricoesFechamento: editInscricoesFechamento,
          prioridadeVip: editPrioridadeVip,
          inscricoesVipAbertura: editInscricoesVipAbertura,
          inscricoesVipFechamento: editInscricoesVipFechamento,
        });
      } else {
        // Novo
        const newDoc = await addDoc(colRef, {
          name: editName.trim(),
          date: editDate,
          time: editTime,
          createdBy: playerId,
          judge: editJudge,
          headJudge: editHeadJudge,
          eventType: editEventType,
          judgeAccepted: false,
          maxVagas: editMaxVagas,
          inscricoesAbertura: editInscricoesAbertura,
          inscricoesFechamento: editInscricoesFechamento,
          prioridadeVip: editPrioridadeVip,
          inscricoesVipAbertura: editInscricoesVipAbertura,
          inscricoesVipFechamento: editInscricoesVipFechamento,
        });
        if (editJudge) {
          sendNotificationToJudge(editJudge, newDoc.id, editName.trim());
        }
      }
      setModalVisible(false);
    } catch (err) {
      console.log("Erro handleSaveTorneio:", err);
      Alert.alert("Erro", "Falha ao salvar torneio.");
    }
  }

  async function sendNotificationToJudge(judgeId: string, torneioId: string, torneioName: string) {
    try {
      const notifRef = doc(collection(db, "players", judgeId, "notifications"));
      await setDoc(notifRef, {
        type: "judge_invite",
        torneioId,
        torneioName,
        message: `Você foi convidado para ser juiz do torneio: ${torneioName}`,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.log("Erro ao notificar juiz:", err);
    }
  }

  // =========================== EXCLUIR TORNEIO ===========================
  async function handleDeleteTorneio(torneio: Torneio) {
    Alert.alert(
      "Confirmação",
      `Deseja excluir o torneio "${torneio.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              const colRef = collection(db, "leagues", leagueId, "calendar");
              const docRef = doc(colRef, torneio.id);
              await deleteDoc(docRef);
            } catch (err) {
              console.log("Erro handleDeleteTorneio:", err);
              Alert.alert("Erro", "Falha ao excluir torneio.");
            }
          },
        },
      ]
    );
  }

  // =========================== INSCRIÇÕES ===========================
  function isVip(pid: string): boolean {
    return vipPlayers.includes(pid);
  }

  async function handleInscrever(t: Torneio) {
    const agora = moment();
    if (t.prioridadeVip && isVip(playerId)) {
      if (t.inscricoesVipAbertura && agora.isBefore(moment(t.inscricoesVipAbertura, "HH:mm"))) {
        Alert.alert(
          "Inscrições VIP Não Abertas",
          `As inscrições VIP para este torneio abrem às ${t.inscricoesVipAbertura}.`
        );
        return;
      }
      if (t.inscricoesVipFechamento && agora.isAfter(moment(t.inscricoesVipFechamento, "HH:mm"))) {
        Alert.alert(
          "Inscrições VIP Encerradas",
          "As inscrições VIP para este torneio já foram encerradas."
        );
        return;
      }
    } else {
      if (t.inscricoesAbertura && agora.isBefore(moment(t.inscricoesAbertura, "HH:mm"))) {
        Alert.alert(
          "Inscrições Não Abertas",
          `As inscrições para este torneio abrem às ${t.inscricoesAbertura}.`
        );
        return;
      }
      if (t.inscricoesFechamento && agora.isAfter(moment(t.inscricoesFechamento, "HH:mm"))) {
        Alert.alert(
          "Inscrições Encerradas",
          "As inscrições para este torneio já foram encerradas."
        );
        return;
      }
    }

    // Verifica se já está inscrito
    const colRef = collection(db, "leagues", leagueId, "calendar", t.id, "inscricoes");
    const snap = await getDoc(doc(colRef, playerId));
    if (snap.exists()) {
      Alert.alert("Aviso", "Você já está inscrito neste torneio.");
      return;
    }

    // Verifica limite de vagas
    const allDocs = await getDocs(colRef);
    const totalInscricoes: Inscricao[] = [];
    allDocs.forEach((docSnap) => {
      totalInscricoes.push({
        userId: docSnap.id,
        deckId: docSnap.data().deckId,
        createdAt: docSnap.data().createdAt || "",
      });
    });

    if (t.maxVagas && totalInscricoes.length >= t.maxVagas) {
      // Tenta lista de espera
      handleWaitlist(t, isVip(playerId));
      return;
    }

    // Se chegou aqui => abre modal p/ escolher deck
    setDetalhesTorneio(t);
    setInscricaoTorneioId(t.id);
    setSelectedDeckId("");

    const decksRef = collection(db, "decks");
    onSnapshot(query(decksRef, where("playerId", "==", playerId)), (resp) => {
      const arr: DeckData[] = [];
      resp.forEach((docSnap) => {
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

  async function handleWaitlist(t: Torneio, vip: boolean) {
    Alert.alert(
      "Lista de Espera",
      "O torneio está lotado. Você foi adicionado à lista de espera."
    );
    const waitColRef = collection(db, "leagues", leagueId, "calendar", t.id, "espera");
    await setDoc(doc(waitColRef, playerId), {
      userId: playerId,
      createdAt: new Date().toISOString(),
      vip,
    });
  }

  async function handleSalvarInscricao() {
    if (!inscricaoTorneioId) return;

    if (detalhesTorneio?.eventType !== "Liga Local" && !selectedDeckId) {
      Alert.alert("Erro", "Selecione um deck para se inscrever.");
      return;
    }

    try {
      const colRef = collection(db, "leagues", leagueId, "calendar", inscricaoTorneioId, "inscricoes");
      const docRef = doc(colRef, playerId);
      await setDoc(docRef, {
        userId: playerId,
        deckId: detalhesTorneio?.eventType === "Liga Local" ? null : selectedDeckId,
        createdAt: new Date().toISOString(),
      });
      Alert.alert("Sucesso", "Inscrição realizada com sucesso!");
      setInscricaoModalVisible(false);
    } catch (err) {
      console.log("Erro handleSalvarInscricao:", err);
      Alert.alert("Erro", "Falha ao salvar inscrição.");
    }
  }

  // =========================== DETALHES DO TORNEIO ===========================
  function handleOpenDetalhes(t: Torneio) {
    setDetalhesTorneio(t);
    setDetalhesModalVisible(true);
  }
  function closeDetalhes() {
    setDetalhesModalVisible(false);
    setDetalhesTorneio(null);
  }

  // =========================== INSCRIÇÕES (LISTA) ===========================
  async function openInscricoesModa(t: Torneio) {
    setDetalhesTorneio(t);

    const colRef = collection(db, "leagues", leagueId, "calendar", t.id, "inscricoes");
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

      // Carrega info de deck e jogador
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
        if (!playerNameMap[uId]) {
          const pRef = doc(db, "players", uId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const nm = pSnap.data().fullname || `Jogador ${uId}`;
            setPlayerNameMap((prev) => ({ ...prev, [uId]: nm }));
          }
        }
      });
    });

    // Carrega lista de espera
    const waitColRef = collection(db, "leagues", leagueId, "calendar", t.id, "espera");
    onSnapshot(waitColRef, async (wanp) => {
      const arr: Espera[] = [];
      const userIdsToLoad = new Set<string>();

      wanp.forEach((ds) => {
        arr.push({
          userId: ds.id,
          deckId: ds.data().deckId,
          createdAt: ds.data().createdAt || "",
          vip: ds.data().vip || false,
        });
        userIdsToLoad.add(ds.id);
      });

      // Ordena VIP e data
      arr.sort((a, b) => {
        if (a.vip && !b.vip) return -1;
        if (!a.vip && b.vip) return 1;
        return a.createdAt.localeCompare(b.createdAt);
      });

      setEspera(arr);

      // Buscar nome do jogador
      userIdsToLoad.forEach(async (uId) => {
        if (!playerNameMap[uId]) {
          const pRef = doc(db, "players", uId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const nm = pSnap.data().fullname || `Jogador ${uId}`;
            setPlayerNameMap((prev) => ({ ...prev, [uId]: nm }));
          }
        }
      });
    });

    setInscricoesModalVisible(true);
  }

  function closeInscricoesModal() {
    setInscricoesModalVisible(false);
    setInscricoes([]);
    setEspera([]);
  }

  async function handleExcluirInscricao(tournamentId: string, pId: string) {
    try {
      const inscricaoRef = doc(db, "leagues", leagueId, "calendar", tournamentId, "inscricoes", pId);
      await deleteDoc(inscricaoRef);
      Alert.alert("Sucesso", "Inscrição excluída!");
      await handleSubirListaEspera(tournamentId);
    } catch (error) {
      console.error("Erro ao excluir inscrição:", error);
      Alert.alert("Erro", "Não foi possível excluir a inscrição.");
    }
  }

  async function handleSubirListaEspera(tournamentId: string) {
    try {
      const waitColRef = collection(db, "leagues", leagueId, "calendar", tournamentId, "espera");
      const docsSnap = await getDocs(waitColRef);
      if (docsSnap.empty) return;

      const arr: Espera[] = [];
      docsSnap.forEach((ds) => {
        arr.push({
          userId: ds.id,
          deckId: ds.data().deckId,
          createdAt: ds.data().createdAt || "",
          vip: ds.data().vip || false,
        });
      });
      // Ordena
      arr.sort((a, b) => {
        if (a.vip && !b.vip) return -1;
        if (!a.vip && b.vip) return 1;
        return a.createdAt.localeCompare(b.createdAt);
      });

      const primeiro = arr[0];
      if (!primeiro) return;

      // Move esse jogador para inscrições
      const inscricaoRef = doc(db, "leagues", leagueId, "calendar", tournamentId, "inscricoes", primeiro.userId);
      await setDoc(inscricaoRef, {
        userId: primeiro.userId,
        deckId: primeiro.deckId || null,
        createdAt: new Date().toISOString(),
      });

      // Remove da espera
      const waitDocRef = doc(db, "leagues", leagueId, "calendar", tournamentId, "espera", primeiro.userId);
      await deleteDoc(waitDocRef);

      sendNotificationToPlayer(primeiro.userId, tournamentId);
    } catch (err) {
      console.error("Erro ao subir lista de espera:", err);
    }
  }

  async function sendNotificationToPlayer(uId: string, tournamentId: string) {
    try {
      const notifRef = doc(collection(db, "players", uId, "notifications"));
      await setDoc(notifRef, {
        type: "waitlist_update",
        torneioId: tournamentId,
        message: "Você foi promovido da lista de espera para a inscrição!",
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.log("Erro ao notificar jogador sobre lista de espera:", err);
    }
  }

  // =========================== CONFIRMAR/RECUSAR JUIZ ===========================
  async function confirmJudge(tournament: Torneio) {
    try {
      const docRef = doc(db, "leagues", leagueId, "calendar", tournament.id);
      await updateDoc(docRef, { judgeAccepted: true });

      Alert.alert("Sucesso", `Você confirmou como juiz no torneio: ${tournament.name}`);
      sendNotifToHost(
        tournament.createdBy,
        tournament.id,
        tournament.name,
        "O juiz confirmou presença no torneio."
      );
    } catch (err) {
      console.log("Erro confirmJudge:", err);
      Alert.alert("Erro", "Falha ao confirmar juiz.");
    }
  }

  async function declineJudge(tournament: Torneio) {
    try {
      const docRef = doc(db, "leagues", leagueId, "calendar", tournament.id);
      await updateDoc(docRef, { judge: "", judgeAccepted: false });

      Alert.alert("Sucesso", `Você recusou ser juiz no torneio: ${tournament.name}`);
      sendNotifToHost(
        tournament.createdBy,
        tournament.id,
        tournament.name,
        "O juiz recusou participar do torneio."
      );
    } catch (err) {
      console.log("Erro declineJudge:", err);
      Alert.alert("Erro", "Falha ao recusar juiz.");
    }
  }

  async function sendNotifToHost(hostId: string, torneioId: string, torneioName: string, message: string) {
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

  // =========================== DECKS (PDF) ===========================
  async function loadDeckCards(deckId: string) {
    try {
      const deckRef = doc(db, "decks", deckId);
      const deckSnap = await getDoc(deckRef);
      if (!deckSnap.exists()) {
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

      deckData.pokemons?.forEach((c: any) => cards.push({ category: "Pokémon", ...c }));
      deckData.trainers?.forEach((c: any) => cards.push({ category: "Treinador", ...c }));
      deckData.energies?.forEach((c: any) => cards.push({ category: "Energia", ...c }));

      setDeckCards(cards);
      setLoadingImages(true);

      const imagePromises = cards.map(async (card) => {
        const imageUrl = await fetchCardImage(card.name, card.expansion, card.cardNumber);
        return {
          key: `${card.name}__${card.expansion}__${card.cardNumber}`,
          url: imageUrl,
        };
      });

      const imageResults = await Promise.all(imagePromises);
      const newCardImages: Record<string, string> = {};
      imageResults.forEach((result) => {
        if (result.url) {
          newCardImages[result.key] = result.url;
        }
      });

      setCardImages(newCardImages);
      setLoadingImages(false);
    } catch (err) {
      console.log("Erro loadDeckCards:", err);
      setDeckCards([]);
      setLoadingImages(false);
    }
  }

  async function fetchCardImage(cardName: string, expansion?: string, cardNumber?: string) {
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

  // =========================== RENDER ===========================
  function renderCard(tor: Torneio) {
    const dt = moment(tor.date, "DD/MM/YYYY");
    const isFuture = dt.isSameOrAfter(moment(), "day");
    const eventLabel = tor.eventType || "Cup";
    const judgeName = judgeMap[tor.judge] || "Sem Juiz";
    const headJudgeName = headJudgeMap[tor.headJudge] || "Sem Head Judge";
    const isThisJudgePending = tor.judge === playerId && tor.judgeAccepted === false;
    const canAccessDetails = isHost || (tor.judge === playerId && tor.judgeAccepted);

    const creatorName = playerNameMap[tor.createdBy] || `Jogador ${tor.createdBy}`;

    return (
      <Animatable.View
        style={styles.card}
        key={`t-${tor.id}`}
        animation="fadeInUp"
        duration={700}
      >
        <Text style={styles.cardTitle}>{tor.name}</Text>
        <Text style={styles.cardSub}>
          <MaterialCommunityIcons name="calendar" size={14} color="#ccc" />
          {"  "}
          {tor.date} às {tor.time} | [{eventLabel}]
        </Text>
        <Text style={styles.cardSub}>
          Criado por: {creatorName}
          {"\n"}
          Juiz: {judgeName}
          {tor.judgeAccepted ? " (Confirmado)" : " (Pendente)"}
          {"\n"}
          Head Judge: {headJudgeName}
        </Text>

        {isThisJudgePending && (
          <View style={{ flexDirection: "row", marginTop: 8 }}>
            <TouchableOpacity
              style={[styles.buttonSmall, { marginRight: 8 }]}
              onPress={() => confirmJudge(tor)}
            >
              <Text style={styles.buttonSmallText}>Confirmar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buttonSmall, { backgroundColor: "#FF3333" }]}
              onPress={() => declineJudge(tor)}
            >
              <Text style={styles.buttonSmallText}>Recusar</Text>
            </TouchableOpacity>
          </View>
        )}

        {isHost && (
          <View style={{ flexDirection: "row", marginTop: 6 }}>
            <TouchableOpacity
              style={[styles.buttonSmall, { marginRight: 8 }]}
              onPress={() => openEditModal(tor)}
            >
              <Text style={styles.buttonSmallText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buttonSmall, { backgroundColor: "#FF3333" }]}
              onPress={() => handleDeleteTorneio(tor)}
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
                onPress={() => handleOpenDetalhe(tor)}
              >
                <Ionicons name="information-circle" size={16} color="#fff" />
                <Text style={styles.inscreverButtonText}>  Detalhes</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.inscreverButton}
              onPress={() => handleInscrever(tor)}
            >
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <Text style={styles.inscreverButtonText}>  Inscrever</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.inscreverButton, { backgroundColor: "#777", marginTop: 8 }]}
            onPress={() => (canAccessDetails ? handleOpenDetalhes(tor) : null)}
          >
            <Ionicons name="checkmark-done-circle" size={16} color="#fff" />
            <Text style={styles.inscreverButtonText}>
              {canAccessDetails ? "Detalhes (Já ocorreu)" : "Já ocorreu"}
            </Text>
          </TouchableOpacity>
        )}
      </Animatable.View>
    );
  }

  // =========================== MODAL DETALHES ===========================
  function handleOpenDetalhe(t: Torneio) {
    setDetalhesTorneio(t);
    setDetalhesModalVisible(true);
  }
  function closeDetalhe() {
    setDetalhesModalVisible(false);
    setDetalhesTorneio(null);
  }

  // Fullscreen
  function renderDetalhesModal() {
    if (!detalhesTorneio) return null;
    const maxStr = detalhesTorneio.maxVagas
      ? detalhesTorneio.maxVagas.toString()
      : "Ilimitado";

    return (
      <Modal
        visible={detalhesModalVisible}
        animationType="slide"
        onRequestClose={closeDetalhes}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: DARK }}>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.modalTitle}>Detalhes do Torneio</Text>

            <Text style={styles.modalLabel}>Nome:</Text>
            <Text style={styles.modalInput}>{detalhesTorneio.name}</Text>

            <Text style={styles.modalLabel}>Data:</Text>
            <Text style={styles.modalInput}>{detalhesTorneio.date}</Text>

            <Text style={styles.modalLabel}>Horário:</Text>
            <Text style={styles.modalInput}>{detalhesTorneio.time}</Text>

            <Text style={styles.modalLabel}>Tipo de Evento:</Text>
            <Text style={styles.modalInput}>{detalhesTorneio.eventType}</Text>

            <Text style={styles.modalLabel}>Juiz:</Text>
            <Text style={styles.modalInput}>
              {judgeMap[detalhesTorneio.judge] || "Sem juiz"}
              {detalhesTorneio.judgeAccepted ? " (Confirmado)" : " (Pendente)"}
            </Text>

            <Text style={styles.modalLabel}>Head Judge:</Text>
            <Text style={styles.modalInput}>
              {headJudgeMap[detalhesTorneio.headJudge] || "Sem head judge"}
            </Text>

            <Text style={styles.modalLabel}>Máximo de Vagas:</Text>
            <Text style={styles.modalInput}>{maxStr}</Text>

            <Text style={styles.modalLabel}>Abertura Inscrições:</Text>
            <Text style={styles.modalInput}>
              {detalhesTorneio.inscricoesAbertura || "Não definido"}
            </Text>

            <Text style={styles.modalLabel}>Fechamento Inscrições:</Text>
            <Text style={styles.modalInput}>
              {detalhesTorneio.inscricoesFechamento || "Não definido"}
            </Text>

            {detalhesTorneio.prioridadeVip && (
              <>
                <Text style={styles.modalLabel}>Abertura (VIP):</Text>
                <Text style={styles.modalInput}>
                  {detalhesTorneio.inscricoesVipAbertura || "Não definido"}
                </Text>
                <Text style={styles.modalLabel}>Fechamento (VIP):</Text>
                <Text style={styles.modalInput}>
                  {detalhesTorneio.inscricoesVipFechamento || "Não definido"}
                </Text>
              </>
            )}

            <TouchableOpacity
              style={[styles.button, { marginTop: 20 }]}
              onPress={() => openInscricoesModal(detalhesTorneio)}
            >
              <Text style={styles.buttonText}>Ver Inscrições</Text>
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

  // =========================== MODAL INSCRIÇÕES ===========================
  async function openInscricoesModal(t: Torneio) {
    setDetalhesTorneio(t);

    const colRef = collection(db, "leagues", leagueId, "calendar", t.id, "inscricoes");
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

      // Carrega info de deck e jogador
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
        if (!playerNameMap[uId]) {
          const pRef = doc(db, "players", uId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const nm = pSnap.data().fullname || `Jogador ${uId}`;
            setPlayerNameMap((prev) => ({ ...prev, [uId]: nm }));
          }
        }
      });
    });

    // Carrega lista de espera
    const waitColRef = collection(db, "leagues", leagueId, "calendar", t.id, "espera");
    onSnapshot(waitColRef, async (wanp) => {
      const arr: Espera[] = [];
      const userIdsToLoad = new Set<string>();

      wanp.forEach((ds) => {
        arr.push({
          userId: ds.id,
          deckId: ds.data().deckId,
          createdAt: ds.data().createdAt || "",
          vip: ds.data().vip || false,
        });
        userIdsToLoad.add(ds.id);
      });

      // Ordena VIP e data
      arr.sort((a, b) => {
        if (a.vip && !b.vip) return -1;
        if (!a.vip && b.vip) return 1;
        return a.createdAt.localeCompare(b.createdAt);
      });

      setEspera(arr);

      // Buscar nome do jogador
      userIdsToLoad.forEach(async (uId) => {
        if (!playerNameMap[uId]) {
          const pRef = doc(db, "players", uId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const nm = pSnap.data().fullname || `Jogador ${uId}`;
            setPlayerNameMap((prev) => ({ ...prev, [uId]: nm }));
          }
        }
      });
    });

    setInscricoesModalVisible(true);
  }

  function closeInscricoesModa() {
    setInscricoesModalVisible(false);
    setInscricoes([]);
    setEspera([]);
  }

  function renderInscricoesModal() {
    if (!detalhesTorneio) return null;
    return (
      <Modal
        visible={inscricoesModalVisible}
        animationType="slide"
        onRequestClose={closeInscricoesModa}
      >
        <SafeAreaView style={[styles.modalContainer, { paddingBottom: 40 }]}>
          <ScrollView style={{ padding: 16 }}>
            <Text style={styles.modalTitle}>Inscrições e Decks</Text>
            {inscricoes.length === 0 ? (
              <Text style={{ color: "#ccc", marginVertical: 10 }}>
                Nenhuma inscrição encontrada.
              </Text>
            ) : (
              inscricoes.map((ins, idx) => (
                <Animatable.View
                  key={`ins-${idx}`}
                  style={[
                    styles.inscricaoItem,
                    { flexDirection: "row", justifyContent: "space-between" },
                  ]}
                  animation="fadeInUp"
                  duration={600}
                >
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => {
                      if (ins.deckId) {
                        setSelectedDeckIdForPdf(ins.deckId);
                        loadDeckCards(ins.deckId);
                        setDeckPdfModalVisible(true);
                      }
                    }}
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

                  {isHost && (
                    <TouchableOpacity
                      onPress={() => handleExcluirInscricao(detalhesTorneio.id, ins.userId)}
                      style={{
                        backgroundColor: "#fe5f55",
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 4,
                        alignSelf: "center",
                        marginLeft: 10,
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "bold" }}>
                        Excluir
                      </Text>
                    </TouchableOpacity>
                  )}
                </Animatable.View>
              ))
            )}

            <TouchableOpacity
              style={[styles.button, { marginTop: 20 }]}
              onPress={closeInscricoesModal}
            >
              <Text style={styles.buttonText}>Fechar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { marginTop: 10, backgroundColor: "#777" }]}
              onPress={() => setEsperaModalVisible(true)}
            >
              <Text style={styles.buttonText}>Ver Lista de Espera</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  // =========================== LISTA DE ESPERA MODAL ===========================
  function renderEsperaModal() {
    return (
      <Modal
        visible={esperaModalVisible}
        animationType="fade"
        onRequestClose={() => setEsperaModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView style={{ padding: 16 }}>
            <Text style={styles.modalTitle}>Lista de Espera</Text>
            {espera.length === 0 ? (
              <Text style={{ color: "#ccc", marginVertical: 10 }}>
                Nenhum jogador na lista de espera.
              </Text>
            ) : (
              espera.map((e, idx) => (
                <Animatable.View
                  key={`espera-${idx}`}
                  style={[styles.inscricaoItem, { flexDirection: "column" }]}
                  animation="fadeInUp"
                  duration={600}
                >
                  <Text style={styles.inscricaoItemText}>
                    Jogador: {playerNameMap[e.userId] || e.userId}
                  </Text>
                  <Text style={styles.inscricaoItemText}>VIP: {e.vip ? "Sim" : "Não"}</Text>
                  <Text style={styles.inscricaoItemText}>
                    Data/Hora: {formatIsoDate(e.createdAt)}
                  </Text>
                </Animatable.View>
              ))
            )}

            <TouchableOpacity
              style={[styles.button, { marginTop: 20 }]}
              onPress={() => setEsperaModalVisible(false)}
            >
              <Text style={styles.buttonText}>Fechar</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  // =========================== MODAL INSCRIÇÃO USUÁRIO ===========================
  function renderInscricaoModal() {
    return (
      <Modal
        visible={inscricaoModalVisible}
        animationType="slide"
        onRequestClose={() => setInscricaoModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { paddingBottom: 40 }]}>
          <ScrollView style={{ padding: 16 }}>
            <Text style={styles.modalTitle}>Escolha seu Deck</Text>

            {detalhesTorneio?.eventType !== "Liga Local" ? (
              userDecks.length === 0 ? (
                <Text style={{ color: "#fff", marginBottom: 10 }}>
                  Você não possui decks cadastrados.
                </Text>
              ) : (
                userDecks.map((dk) => (
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
                ))
              )
            ) : (
              <Text style={{ color: "#ccc", marginBottom: 10 }}>
                Este tipo de torneio não exige deck.
              </Text>
            )}

            <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 20 }}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: "#999" }]}
                onPress={() => setInscricaoModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={handleSalvarInscricao}>
                <Text style={styles.buttonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  }

  // =========================== MODAL DECK (PDF) ===========================
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
                          <Text style={styles.cardSub}>Expansão: {card.expansion}</Text>
                        )}
                        {card.cardNumber && (
                          <Text style={styles.cardSub}>Nº: {card.cardNumber}</Text>
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
                Nenhuma carta encontrada ou deck vazio.
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

  // =========================== SELEÇÃO DE JUÍZ E HEADJUDGE ===========================
  function renderJudgeSelectModal() {
    return (
      <Modal
        visible={judgeSelectModal}
        animationType="slide"
        transparent
        onRequestClose={() => setJudgeSelectModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPressOut={() => setJudgeSelectModal(false)}
        >
          <View style={[styles.selectModalInner]}>
            <ScrollView>
              <TouchableOpacity
                style={styles.selectScrollItem}
                onPress={() => {
                  setEditJudge("");
                  setJudgeSelectModal(false);
                }}
              >
                <Text style={{ color: "#fff" }}>Nenhum (Padrão)</Text>
              </TouchableOpacity>
              {judgeOptions.map((j) => (
                <TouchableOpacity
                  key={`judge-${j.userId}`}
                  style={styles.selectScrollItem}
                  onPress={() => {
                    setEditJudge(j.userId);
                    setJudgeSelectModal(false);
                  }}
                >
                  <Text style={{ color: "#fff" }}>{j.fullname}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  }

  function renderHeadJudgeSelectModal() {
    return (
      <Modal
        visible={headJudgeSelectModal}
        animationType="slide"
        transparent
        onRequestClose={() => setHeadJudgeSelectModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPressOut={() => setHeadJudgeSelectModal(false)}
        >
          <View style={[styles.selectModalInner]}>
            <ScrollView>
              <TouchableOpacity
                style={styles.selectScrollItem}
                onPress={() => {
                  setEditHeadJudge("");
                  setHeadJudgeSelectModal(false);
                }}
              >
                <Text style={{ color: "#fff" }}>Nenhum</Text>
              </TouchableOpacity>
              {headJudgeOptions.map((hj) => (
                <TouchableOpacity
                  key={`headjudge-${hj.userId}`}
                  style={styles.selectScrollItem}
                  onPress={() => {
                    setEditHeadJudge(hj.userId);
                    setHeadJudgeSelectModal(false);
                  }}
                >
                  <Text style={{ color: "#fff" }}>{hj.fullname}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  }

  // =========================== SELEÇÃO DO TIPO DE EVENTO ===========================
  function renderEventTypeSelectModal() {
    return (
      <Modal
        visible={eventTypeSelectModal}
        animationType="slide"
        transparent
        onRequestClose={() => setEventTypeSelectModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPressOut={() => setEventTypeSelectModal(false)}
        >
          <View style={styles.selectModalInner}>
            <ScrollView>
              {eventTypesList.map((et) => (
                <TouchableOpacity
                  key={`evtype-${et}`}
                  style={styles.selectScrollItem}
                  onPress={() => {
                    setEditEventType(et);
                    setEventTypeSelectModal(false);
                  }}
                >
                  <Text style={{ color: "#fff" }}>{et}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  }

  // =========================== RENDER FINAL ===========================
  return (
    <SafeAreaView style={styles.safe}>
      {/* Header do Mês */}
      <View style={[styles.header, { justifyContent: "space-between" }]}>
        <TouchableOpacity onPress={handlePrevMonth} style={{ paddingHorizontal: 20 }}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{currentMonth.format("MMMM [de] YYYY")}</Text>
        <TouchableOpacity onPress={handleNextMonth} style={{ paddingHorizontal: 20 }}>
          <Ionicons name="chevron-forward" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {isHost && (
        <TouchableOpacity style={styles.createButton} onPress={openCreateModal}>
          <MaterialCommunityIcons name="plus" size={20} color="#FFF" />
          <Text style={styles.createButtonText}>  Criar Torneio</Text>
        </TouchableOpacity>
      )}

      <ScrollView style={{ flex: 1, marginTop: 10 }}>
        {torneios.map((t) => renderCard(t))}
      </ScrollView>

      {/* MODAL CRIAR/EDITAR TORN. */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalContainer]}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView style={{ padding: 16 }}>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View>
                  <Text style={styles.modalTitle}>
                    {editId ? "Editar Torneio" : "Criar Torneio"}
                  </Text>

                  <Text style={styles.modalLabel}>Nome do Torneio</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editName}
                    onChangeText={setEditName}
                  />

                  <Text style={styles.modalLabel}>Data (DD/MM/AAAA)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editDate}
                    keyboardType="numeric"
                    onChangeText={(txt) => handleMaskDate(txt, setEditDate)}
                    maxLength={10}
                    placeholder="Ex: 15/03/2023"
                    placeholderTextColor="#777"
                  />

                  <Text style={styles.modalLabel}>Horário (HH:MM)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editTime}
                    keyboardType="numeric"
                    onChangeText={(txt) => handleMaskTime(txt, setEditTime)}
                    maxLength={5}
                    placeholder="Ex: 09:30"
                    placeholderTextColor="#777"
                  />

                  <Text style={styles.modalLabel}>Tipo de Evento</Text>
                  <TouchableOpacity
                    style={[styles.modalInput, styles.selectFakeInput]}
                    onPress={() => setEventTypeSelectModal(true)}
                  >
                    <Text style={{ color: "#fff" }}>{editEventType}</Text>
                  </TouchableOpacity>

                  <Text style={styles.modalLabel}>Juiz</Text>
                  <TouchableOpacity
                    style={[styles.modalInput, styles.selectFakeInput]}
                    onPress={() => setJudgeSelectModal(true)}
                  >
                    <Text style={{ color: "#fff" }}>
                      {editJudge
                        ? judgeOptions.find((j) => j.userId === editJudge)?.fullname ||
                          "Juiz Desconhecido"
                        : "Nenhum (Padrão)"}
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.modalLabel}>Head Judge</Text>
                  <TouchableOpacity
                    style={[styles.modalInput, styles.selectFakeInput]}
                    onPress={() => setHeadJudgeSelectModal(true)}
                  >
                    <Text style={{ color: "#fff" }}>
                      {editHeadJudge
                        ? headJudgeOptions.find((hj) => hj.userId === editHeadJudge)?.fullname ||
                          "Head Desconhecido"
                        : "Nenhum"}
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.modalLabel}>Máximo de Vagas</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    value={editMaxVagas?.toString() || ""}
                    onChangeText={(v) => setEditMaxVagas(Number(v) || null)}
                  />

                  <Text style={styles.modalLabel}>Abertura Inscrições (HH:MM)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editInscricoesAbertura}
                    keyboardType="numeric"
                    onChangeText={(txt) => handleMaskTime(txt, setEditInscricoesAbertura)}
                    maxLength={5}
                    placeholder="Ex: 08:00"
                    placeholderTextColor="#777"
                  />

                  <Text style={styles.modalLabel}>Fechamento Inscrições (HH:MM)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editInscricoesFechamento}
                    keyboardType="numeric"
                    onChangeText={(txt) => handleMaskTime(txt, setEditInscricoesFechamento)}
                    maxLength={5}
                    placeholder="Ex: 10:00"
                    placeholderTextColor="#777"
                  />

                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
                    <Text style={{ color: "#fff", marginRight: 10 }}>Prioridade VIP</Text>
                    <Switch value={editPrioridadeVip} onValueChange={setEditPrioridadeVip} />
                  </View>

                  {editPrioridadeVip && (
                    <>
                      <Text style={styles.modalLabel}>
                        Abertura (VIP) (HH:MM)
                      </Text>
                      <TextInput
                        style={styles.modalInput}
                        value={editInscricoesVipAbertura}
                        keyboardType="numeric"
                        onChangeText={(txt) =>
                          handleMaskTime(txt, setEditInscricoesVipAbertura)
                        }
                        maxLength={5}
                        placeholder="Ex: 07:30"
                        placeholderTextColor="#777"
                      />

                      <Text style={styles.modalLabel}>
                        Fechamento (VIP) (HH:MM)
                      </Text>
                      <TextInput
                        style={styles.modalInput}
                        value={editInscricoesVipFechamento}
                        keyboardType="numeric"
                        onChangeText={(txt) =>
                          handleMaskTime(txt, setEditInscricoesVipFechamento)
                        }
                        maxLength={5}
                        placeholder="Ex: 09:00"
                        placeholderTextColor="#777"
                      />
                    </>
                  )}

                  <View style={[styles.modalButtons, { marginTop: 20 }]}>
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
                </View>
              </TouchableWithoutFeedback>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {detalhesModalVisible && renderDetalhesModal()}
      {renderInscricoesModal()}
      {renderDeckPdfModal()}
      {renderEsperaModal()}
      {renderInscricaoModal()}

      {renderJudgeSelectModal()}
      {renderHeadJudgeSelectModal()}
      {renderEventTypeSelectModal()}
    </SafeAreaView>
  );
}

// =========================== FUNÇÕES AUXILIARES ===========================
function formatIsoDate(isoStr: string) {
  if (!isoStr) return "";
  const m = moment(isoStr);
  if (!m.isValid()) return isoStr;
  return m.format("DD/MM/YYYY HH:mm");
}

// =========================== ESTILOS ===========================
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
    backgroundColor: DARK,
    paddingVertical: 10,
  },
  headerTitle: {
    color: SECONDARY,
    fontSize: 18,
    fontWeight: "bold",
    textTransform: "capitalize",
  },
  createButton: {
    backgroundColor: PRIMARY,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonText: {
    color: SECONDARY,
    fontWeight: "bold",
    fontSize: 16,
  },
  card: {
    backgroundColor: GRAY,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 12,
    borderRadius: 8,
  },
  cardTitle: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 2,
  },
  cardSub: {
    color: "#ccc",
    fontSize: 13,
    marginVertical: 2,
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
    flexDirection: "row",
    backgroundColor: "#4CAF50",
    padding: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  inscreverButtonText: {
    color: SECONDARY,
    fontWeight: "bold",
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
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
    fontWeight: "600",
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

  // Para as listas de seleção (Juiz, HeadJudge, Tipo Evento)
  selectFakeInput: {
    justifyContent: "center",
  },
  selectModalInner: {
    backgroundColor: "#2B2B2B",
    marginHorizontal: 30,
    marginVertical: 100,
    borderRadius: 8,
    padding: 10,
    flex: 1,
  },
  selectScrollItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#555",
    paddingVertical: 10,
  },
});
