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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Animatable from "react-native-animatable";
import { TouchableWithoutFeedback } from "react-native-gesture-handler";

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
import { useFocusEffect } from "@react-navigation/native";

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

  // Variáveis de FILTRO
  const [filterType, setFilterType] = useState<"all"|"city"|"league"|"">("");
  const [cityStored, setCityStored] = useState("");
  const [leagueStored, setLeagueStored] = useState("");

  const [torneios, setTorneios] = useState<Torneio[]>([]);
  const [currentMonth, setCurrentMonth] = useState(moment());

  // Mapeamentos de nomes (para exibir fullname)
  const [judgeMap, setJudgeMap] = useState<Record<string, string>>({});
  const [headJudgeMap, setHeadJudgeMap] = useState<Record<string, string>>({});
  const [playerNameMap, setPlayerNameMap] = useState<Record<string, string>>({});

  // Opções de Judge e HeadJudge
  const [judgeOptions, setJudgeOptions] = useState<{ userId: string; fullname: string }[]>([]);
  const [headJudgeOptions, setHeadJudgeOptions] = useState<{ userId: string; fullname: string }[]>([]);

  // Modal CRIAR/EDITAR
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");   // dd/mm/aaaa
  const [editTime, setEditTime] = useState("");   // HH:MM
  const [editJudge, setEditJudge] = useState("");
  const [editHeadJudge, setEditHeadJudge] = useState("");
  const [editEventType, setEditEventType] = useState("Cup");

  // Modal de seleção
  const [judgeSelectModal, setJudgeSelectModal] = useState(false);
  const [headJudgeSelectModal, setHeadJudgeSelectModal] = useState(false);
  const [eventTypeSelectModal, setEventTypeSelectModal] = useState(false);

  const eventTypesList = [
    "Challenge",
    "Cup",
    "Liga Local",
    "Pré-Release",
    "Evento Especial",
  ];

  // Extras
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

  // Sub-modal de PDF do Deck
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

  useEffect(() => {
    moment.locale("pt-br");

    (async () => {
      try {
        const pid = await AsyncStorage.getItem("@userId");
        if (pid) {
          setPlayerId(pid);
          setIsHost(HOST_PLAYER_IDS.includes(pid));
        } else {
          // Se não tiver user logado, poderia redirecionar para login
        }

        const fType = (await AsyncStorage.getItem("@filterType")) as
          | "all"
          | "city"
          | "league"
          | ""
          | null;
        const cStored = (await AsyncStorage.getItem("@selectedCity")) || "";
        const lStored = (await AsyncStorage.getItem("@leagueId")) || "";

        setFilterType(fType || "all");
        setCityStored(cStored);
        setLeagueStored(lStored);

        // Carregar Judge e HeadJudge via roles
        await loadJudgeData(lStored);

        // Carregar sets p/ imagens
        loadSetIdMap();
      } catch (error) {
        console.log("Erro no fetch inicial:", error);
      }
    })();
  }, []);

useFocusEffect(
  React.useCallback(() => {
    (async () => {
      try {
        console.log("🔄 Tela Calendário aberta - Atualizando filtros e torneios...");

        // Obtém os filtros armazenados
        const fType = (await AsyncStorage.getItem("@filterType")) as
          | "all"
          | "city"
          | "league"
          | ""
          | null;
        const cStored = (await AsyncStorage.getItem("@selectedCity")) || "";
        const lStored = (await AsyncStorage.getItem("@leagueId")) || "";

        // Atualiza os estados com os valores mais recentes
        setFilterType(fType || "all");
        setCityStored(cStored);
        setLeagueStored(lStored);

        console.log("📌 Novo Filter Type:", fType);
        console.log("📌 Nova League ID:", lStored);
        console.log("📌 Nova Cidade:", cStored);

        // Recarrega os torneios com base nos filtros atualizados
        loadTorneios();
      } catch (error) {
        console.log("❌ Erro ao atualizar filtros ao focar na tela Calendário:", error);
      }
    })();
  }, [])
);


  // Efeito que observa currentMonth ou filterType, etc.
  // Atualiza torneios quando algum filtro ou mês mudar
useEffect(() => {
  console.log("🔄 Atualizando torneios - Filtros:");
  console.log("📍 Filter Type:", filterType);
  console.log("📍 League ID:", leagueStored);
  console.log("📍 City:", cityStored);
  
  loadTorneios();
}, [currentMonth, filterType, cityStored, leagueStored]);; // <-- Removi cityStored se não for necessário

  async function loadJudgeData(currLeagueId: string) {
    try {
      if (!currLeagueId) return;

      // Buscar "judge"
      const jArray = await fetchRoleMembers(currLeagueId, "judge");
      const jMapObj: Record<string, string> = {};
      jArray.forEach((j) => {
        jMapObj[j.userId] = j.fullname;
      });
      setJudgeOptions(jArray);
      setJudgeMap(jMapObj);

      // Buscar "head"
      const hjArray = await fetchRoleMembers(currLeagueId, "head");
      const hjMapObj: Record<string, string> = {};
      hjArray.forEach((hj) => {
        hjMapObj[hj.userId] = hj.fullname;
      });
      setHeadJudgeOptions(hjArray);
      setHeadJudgeMap(hjMapObj);
    } catch (err) {
      console.log("Erro loadJudgeData:", err);
    }
  }

  // ============== Carrega Torneios (Respeitando Filtro) ==============
  async function loadTorneios() {
    try {
      // 1️⃣ Recupera os valores mais recentes do filtro e do leagueId do AsyncStorage
      const filterType = await AsyncStorage.getItem("@filterType");
      const leagueStored = await AsyncStorage.getItem("@leagueId");
      const cityStored = await AsyncStorage.getItem("@selectedCity");
  
      // Log para depuração: imprime os valores atuais do filtro e da liga
      console.log("🔍 Filter Type atualizado:", filterType);
      console.log("🔍 League ID atualizado:", leagueStored);
      console.log("🔍 Cidade armazenada:", cityStored);
  
      // 2️⃣ Verifica o tipo de filtro e realiza a busca de torneios de acordo com ele
      if (filterType === "league" && leagueStored) {
        // Caso: Filtro "league" (liga específica)
        console.log("📡 Buscando torneios na liga:", leagueStored);
        const colRef = collection(db, "leagues", leagueStored, "calendar");
        onSnapshot(colRef, (snap) => {
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
          // 3️⃣ Aplica filtro por data (mês atual)
          const start = currentMonth.clone().startOf("month");
          const end = currentMonth.clone().endOf("month");
          const filtered = arr.filter((t) => {
            const dt = moment(t.date, "DD/MM/YYYY");
            return dt.isBetween(start, end, undefined, "[]");
          });
          console.log(`✅ Torneios encontrados na liga ${leagueStored}:`, filtered.length);
          setTorneios(filtered);
  
          // 4️⃣ Para cada torneio filtrado, busca o nome do criador (fullname) na subcoleção "players"
          filtered.forEach(async (tor) => {
            if (tor.createdBy && !playerNameMap[tor.createdBy]) {
              const pRef = doc(db, "leagues", leagueStored, "players", tor.createdBy);
              const pSnap = await getDoc(pRef);
              if (pSnap.exists()) {
                const nm = pSnap.data().fullname || `Jogador não cadastrado: ${tor.createdBy}`;
                setPlayerNameMap((prev) => ({ ...prev, [tor.createdBy]: nm }));
              } else {
                setPlayerNameMap((prev) => ({
                  ...prev,
                  [tor.createdBy]: `Jogador não cadastrado: ${tor.createdBy}`,
                }));
              }
            }
          });
        });
      } else if (filterType === "city" && cityStored) {
        // Caso: Filtro "city" – pega todas as ligas da cidade armazenada
        console.log("📡 Buscando torneios nas ligas da cidade:", cityStored);
        const qCity = query(collection(db, "leagues"), where("city", "==", cityStored));
        const citySnap = await getDocs(qCity);
        let arrGlobal: Torneio[] = [];
        // Percorre cada liga encontrada na cidade
        for (const leagueDoc of citySnap.docs) {
          const lId = leagueDoc.id;
          const colRef = collection(db, "leagues", lId, "calendar");
          const colSnap = await getDocs(colRef);
          colSnap.forEach((docSnap) => {
            const d = docSnap.data();
            arrGlobal.push({
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
        }
        // Aplica filtro por mês
        const start = currentMonth.clone().startOf("month");
        const end = currentMonth.clone().endOf("month");
        const filtered = arrGlobal.filter((t) => {
          const dt = moment(t.date, "DD/MM/YYYY");
          return dt.isBetween(start, end, undefined, "[]");
        });
        console.log(`✅ Torneios encontrados na cidade ${cityStored}:`, filtered.length);
        setTorneios(filtered);
  
        // Para cada torneio, busca o nome do criador usando a liga onde foi criado (simplificação)
        filtered.forEach(async (tor) => {
          // Como não temos o leagueId direto no torneio, usaremos o primeiro league da cidade
          const lId = citySnap.docs[0]?.id || "";
          if (tor.createdBy && !playerNameMap[tor.createdBy]) {
            const pRef = doc(db, "leagues", lId, "players", tor.createdBy);
            const pSnap = await getDoc(pRef);
            if (pSnap.exists()) {
              const nm = pSnap.data().fullname || `Jogador não cadastrado: ${tor.createdBy}`;
              setPlayerNameMap((prev) => ({ ...prev, [tor.createdBy]: nm }));
            } else {
              setPlayerNameMap((prev) => ({
                ...prev,
                [tor.createdBy]: `Jogador não cadastrado: ${tor.createdBy}`,
              }));
            }
          }
        });
      } else if (filterType === "all") {
        // Caso: Filtro "all" – busca torneios de todas as ligas
        console.log("📡 Buscando torneios de todas as ligas");
        const leaguesSnap = await getDocs(collection(db, "leagues"));
        let arrGlobal: Torneio[] = [];
        for (const leagueDoc of leaguesSnap.docs) {
          const lId = leagueDoc.id;
          const colRef = collection(db, "leagues", lId, "calendar");
          const colSnap = await getDocs(colRef);
          colSnap.forEach((docSnap) => {
            const d = docSnap.data();
            arrGlobal.push({
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
        }
        // Filtra pelo mês atual
        const start = currentMonth.clone().startOf("month");
        const end = currentMonth.clone().endOf("month");
        const filtered = arrGlobal.filter((t) => {
          const dt = moment(t.date, "DD/MM/YYYY");
          return dt.isBetween(start, end, undefined, "[]");
        });
        console.log(`✅ Torneios encontrados (all):`, filtered.length);
        setTorneios(filtered);
  
        // Para cada torneio, tenta buscar o nome do criador em qualquer liga
        filtered.forEach(async (tor) => {
          const leaguesSnap2 = await getDocs(collection(db, "leagues"));
          for (const lDoc of leaguesSnap2.docs) {
            const pRef = doc(db, "leagues", lDoc.id, "players", tor.createdBy);
            const pSnap = await getDoc(pRef);
            if (pSnap.exists()) {
              const nm = pSnap.data().fullname || `Jogador não cadastrado: ${tor.createdBy}`;
              setPlayerNameMap((prev) => ({ ...prev, [tor.createdBy]: nm }));
              break;
            }
          }
        });
      } else {
        // Se não houver um filterType válido, define torneios como vazio
        console.log("⚠️ Nenhum filtro válido encontrado.");
        setTorneios([]);
      }
    } catch (err) {
      console.log("❌ Erro ao carregar torneios:", err);
    }
  }
  
  // =========================== loadSetIdMap ===========================
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

  // =========================== NAVEGAÇÃO DE MÊS ===========================
  function handlePrevMonth() {
    setCurrentMonth((prev) => prev.clone().subtract(1, "month"));
  }
  function handleNextMonth() {
    setCurrentMonth((prev) => prev.clone().add(1, "month"));
  }

  // =========================== CRIAR/EDITAR TORN ===========================
  async function openCreateModal() {
    try {
      // Obtém os valores armazenados
      const filterType = await AsyncStorage.getItem("@filterType");
      const leagueStored = await AsyncStorage.getItem("@leagueId");
  
      // Log dos valores armazenados
      console.log("🔍 Filter Type:", filterType);
      console.log("🔍 League ID armazenado:", leagueStored);
  
      // Se o filtro não for "league" ou não houver um leagueId válido, exibe alerta
      if (filterType !== "league" || !leagueStored) {
        Alert.alert(
          "Filtro inválido",
          "Para criar torneio, selecione uma liga específica primeiro."
        );
        return;
      }
  
      // Configuração inicial do torneio
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
    } catch (error) {
      console.error("❌ Erro ao abrir modal de criação de torneio:", error);
    }
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
    try {
      // Recupera o ID da liga selecionada antes de criar o torneio
      const leagueId = await AsyncStorage.getItem("@leagueId");
  
      // Se por algum motivo não tiver um ID de liga válido, exibe um erro
      if (!leagueId) {
        Alert.alert("Erro", "Não foi possível obter a liga para criar o torneio.");
        console.error("❌ ERRO: Tentativa de criar torneio sem League ID!");
        return;
      }
  
      console.log("📌 Criando torneio na liga:", leagueId);
  
      // Caminho correto para salvar na liga selecionada
      const colRef = collection(db, `leagues/${leagueId}/calendar`);
  
      if (editId) {
        // Se for edição de torneio existente
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
        console.log(`✏️ Torneio ${editId} atualizado na liga ${leagueId}`);
      } else {
        // Criar novo torneio
        const docRef = await addDoc(colRef, {
          name: editName.trim(),
          date: editDate,
          time: editTime,
          createdBy: await AsyncStorage.getItem("@userId"), // Obtém ID do usuário logado
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
          timestamp: serverTimestamp(),
        });
  
        console.log(`✅ Novo torneio criado na liga ${leagueId}: ${docRef.id}`);
      }
  
      setModalVisible(false);
    } catch (err) {
      console.error("❌ Erro ao salvar torneio:", err);
      Alert.alert("Erro", "Falha ao salvar o torneio.");
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

  // =========================== EXCLUIR TORN ===========================
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
              if (!leagueStored) {
                Alert.alert("Erro", "Sem leagueId para excluir torneio.");
                return;
              }
              const colRef = collection(db, "leagues", leagueStored, "calendar");
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

    // Checa VIP
    if (t.prioridadeVip && isVip(playerId)) {
      if (t.inscricoesVipAbertura && agora.isBefore(moment(t.inscricoesVipAbertura, "HH:mm"))) {
        Alert.alert("Inscrições VIP Não Abertas", `Abrem às ${t.inscricoesVipAbertura}.`);
        return;
      }
      if (t.inscricoesVipFechamento && agora.isAfter(moment(t.inscricoesVipFechamento, "HH:mm"))) {
        Alert.alert("Inscrições VIP Encerradas", "As inscrições VIP foram encerradas.");
        return;
      }
    } else {
      if (t.inscricoesAbertura && agora.isBefore(moment(t.inscricoesAbertura, "HH:mm"))) {
        Alert.alert("Inscrições Não Abertas", `Abrem às ${t.inscricoesAbertura}.`);
        return;
      }
      if (t.inscricoesFechamento && agora.isAfter(moment(t.inscricoesFechamento, "HH:mm"))) {
        Alert.alert("Inscrições Encerradas", "Não é mais possível se inscrever.");
        return;
      }
    }

    if (!leagueStored) {
      Alert.alert("Erro", "Filtro inválido ou leagueId não selecionada.");
      return;
    }

    // Verifica se já está inscrito
    const colRef = collection(db, "leagues", leagueStored, "calendar", t.id, "inscricoes");
    const snap = await getDoc(doc(colRef, playerId));
    if (snap.exists()) {
      Alert.alert("Aviso", "Você já se inscreveu neste torneio.");
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

    // Se chegou aqui, abre modal p/ escolher deck
    setDetalhesTorneio(t);
    setInscricaoTorneioId(t.id);
    setSelectedDeckId("");

    const decksRef = collection(db, "decks");
    onSnapshot(query(decksRef, where("ownerUid", "==", playerId)), (resp) => {
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
    Alert.alert("Lista de Espera", "O torneio está lotado. Você foi adicionado à lista de espera.");
    if (!leagueStored) return;
    const waitColRef = collection(db, "leagues", leagueStored, "calendar", t.id, "espera");
    await setDoc(doc(waitColRef, playerId), {
      userId: playerId,
      createdAt: new Date().toISOString(),
      vip,
    });
  }

  async function handleSalvarInscricao() {
    if (!inscricaoTorneioId || !detalhesTorneio) {
      return;
    }
    if (!leagueStored) {
      Alert.alert("Erro", "Nenhuma liga selecionada para esta inscrição.");
      return;
    }

    // Se não for "Liga Local", precisa de deck
    if (detalhesTorneio.eventType !== "Liga Local" && !selectedDeckId) {
      Alert.alert("Erro", "Selecione um deck para se inscrever ou verifique tipo de evento.");
      return;
    }

    try {
      const colRef = collection(db, "leagues", leagueStored, "calendar", inscricaoTorneioId, "inscricoes");
      const docRef = doc(colRef, playerId);
      // Verifica se por acaso acabou de se inscrever (anti-lag)
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        Alert.alert("Aviso", "Você já se inscreveu neste torneio (possível duplicado).");
        setInscricaoModalVisible(false);
        return;
      }

      await setDoc(docRef, {
        userId: playerId,
        deckId: detalhesTorneio.eventType === "Liga Local" ? null : selectedDeckId,
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

  // =========================== LISTA INSCRICOES ===========================
  async function openInscricoesModal(t: Torneio) {
    setDetalhesTorneio(t);

    if (!leagueStored) return;
    const colRef = collection(db, "leagues", leagueStored, "calendar", t.id, "inscricoes");
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

      // Carrega info do Deck / Jogador
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
          // Tenta achar jogador na subcoleção da league
          const pRef = doc(db, "leagues", leagueStored, "players", uId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const nm = pSnap.data().fullname || `Jogador não cadastrado: ${uId}`;
            setPlayerNameMap((prev) => ({ ...prev, [uId]: nm }));
          } else {
            setPlayerNameMap((prev) => ({
              ...prev,
              [uId]: `Jogador não cadastrado: ${uId}`,
            }));
          }
        }
      });
    });

    // Lista de espera
    const waitColRef = collection(db, "leagues", leagueStored, "calendar", t.id, "espera");
    onSnapshot(waitColRef, (wanp) => {
      const arr: Espera[] = [];
      wanp.forEach((ds) => {
        arr.push({
          userId: ds.id,
          deckId: ds.data().deckId,
          createdAt: ds.data().createdAt || "",
          vip: ds.data().vip || false,
        });
      });
      arr.sort((a, b) => {
        if (a.vip && !b.vip) return -1;
        if (!a.vip && b.vip) return 1;
        return a.createdAt.localeCompare(b.createdAt);
      });
      setEspera(arr);

      // Carregar nome
      arr.forEach(async (obj) => {
        if (!playerNameMap[obj.userId]) {
          const pRef = doc(db, "leagues", leagueStored, "players", obj.userId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const nm = pSnap.data().fullname || `Jogador não cadastrado: ${obj.userId}`;
            setPlayerNameMap((prev) => ({ ...prev, [obj.userId]: nm }));
          } else {
            setPlayerNameMap((prev) => ({
              ...prev,
              [obj.userId]: `Jogador não cadastrado: ${obj.userId}`,
            }));
          }
        }
      });
    });

    setInscricoesModalVisible(true);
  }

  function closeInscricoesModal() {
    setInscricoes([]);
    setEspera([]);
    setInscricoesModalVisible(false);
  }

  async function handleExcluirInscricao(tournamentId: string, pId: string) {
    if (!leagueStored) return;
    try {
      const inscricaoRef = doc(
        db,
        "leagues",
        leagueStored,
        "calendar",
        tournamentId,
        "inscricoes",
        pId
      );
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
      if (!leagueStored) return;
      const waitColRef = collection(db, "leagues", leagueStored, "calendar", tournamentId, "espera");
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
      arr.sort((a, b) => {
        if (a.vip && !b.vip) return -1;
        if (!a.vip && b.vip) return 1;
        return a.createdAt.localeCompare(b.createdAt);
      });

      const primeiro = arr[0];
      if (!primeiro) return;

      // Move para inscrições
      const inscricaoRef = doc(
        db,
        "leagues",
        leagueStored,
        "calendar",
        tournamentId,
        "inscricoes",
        primeiro.userId
      );
      await setDoc(inscricaoRef, {
        userId: primeiro.userId,
        deckId: primeiro.deckId || null,
        createdAt: new Date().toISOString(),
      });

      // Remove da espera
      const waitDocRef = doc(
        db,
        "leagues",
        leagueStored,
        "calendar",
        tournamentId,
        "espera",
        primeiro.userId
      );
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
    if (!leagueStored) return;
    try {
      const docRef = doc(db, "leagues", leagueStored, "calendar", tournament.id);
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
    if (!leagueStored) return;
    try {
      const docRef = doc(db, "leagues", leagueStored, "calendar", tournament.id);
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
        headers: { "X-Api-Key": "8d293a2a-4949-4d04-a06c-c20672a7a12c" },
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

    const creatorFullname =
      playerNameMap[tor.createdBy] || `Jogador não cadastrado: ${tor.createdBy}`;

    return (
      <Animatable.View style={styles.card} key={`t-${tor.id}`} animation="fadeInUp" duration={700}>
        <Text style={styles.cardTitle}>{tor.name}</Text>
        <Text style={styles.cardSub}>
          <MaterialCommunityIcons name="calendar" size={14} color="#ccc" />
          {"  "}
          {tor.date} às {tor.time} | [{eventLabel}]
        </Text>
        <Text style={styles.cardSub}>
          Criado por: {creatorFullname}
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
                onPress={() => handleOpenDetalhes(tor)}
              >
                <Ionicons name="information-circle" size={16} color="#fff" />
                <Text style={styles.inscreverButtonText}>  Detalhes</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.inscreverButton} onPress={() => handleInscrever(tor)}>
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

  return (
    <SafeAreaView style={styles.safe}>
      {/* HEADER MÊS */}
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

      {/* MODAL CRIAR/EDITAR */}
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
                    placeholder="Ex: 15/03/2025"
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
                          `Jogador não cadastrado: ${editJudge}`
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
                          `Jogador não cadastrado: ${editHeadJudge}`
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
                      <Text style={styles.modalLabel}>Abertura (VIP) (HH:MM)</Text>
                      <TextInput
                        style={styles.modalInput}
                        value={editInscricoesVipAbertura}
                        keyboardType="numeric"
                        onChangeText={(txt) => handleMaskTime(txt, setEditInscricoesVipAbertura)}
                        maxLength={5}
                        placeholder="Ex: 07:30"
                        placeholderTextColor="#777"
                      />

                      <Text style={styles.modalLabel}>Fechamento (VIP) (HH:MM)</Text>
                      <TextInput
                        style={styles.modalInput}
                        value={editInscricoesVipFechamento}
                        keyboardType="numeric"
                        onChangeText={(txt) => handleMaskTime(txt, setEditInscricoesVipFechamento)}
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

      {/* MODAL DETALHES (fullscreen) */}
      <Modal
        visible={detalhesModalVisible}
        animationType="slide"
        onRequestClose={closeDetalhes}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#1E1E1E" }}>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {detalhesTorneio && (
              <>
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
                  {judgeMap[detalhesTorneio.judge] || `Jogador não cadastrado: ${detalhesTorneio.judge}`}
                  {detalhesTorneio.judgeAccepted ? " (Confirmado)" : " (Pendente)"}
                </Text>

                <Text style={styles.modalLabel}>Head Judge:</Text>
                <Text style={styles.modalInput}>
                  {headJudgeMap[detalhesTorneio.headJudge] ||
                    `Jogador não cadastrado: ${detalhesTorneio.headJudge}`}
                </Text>

                <Text style={styles.modalLabel}>Máx. Vagas:</Text>
                <Text style={styles.modalInput}>
                  {detalhesTorneio.maxVagas ? detalhesTorneio.maxVagas : "Ilimitado"}
                </Text>

                <Text style={styles.modalLabel}>Abertura:</Text>
                <Text style={styles.modalInput}>
                  {detalhesTorneio.inscricoesAbertura || "Não definido"}
                </Text>

                <Text style={styles.modalLabel}>Fechamento:</Text>
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
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL INSCRIÇÕES */}
      <Modal
        visible={inscricoesModalVisible}
        animationType="slide"
        onRequestClose={closeInscricoesModal}
      >
        <SafeAreaView style={[styles.modalContainer, { paddingBottom: 40 }]}>
          <ScrollView style={{ padding: 16 }}>
            <Text style={styles.modalTitle}>Inscrições / Decks</Text>
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
                      Jogador: {playerNameMap[ins.userId] || `Jogador não cadastrado: ${ins.userId}`}
                    </Text>
                    <Text style={styles.inscricaoItemText}>
                      Deck: {ins.deckId ? deckNameMap[ins.deckId] || `(Deck ${ins.deckId})` : "Sem deck"}
                    </Text>
                    <Text style={styles.inscricaoItemText}>
                      Data/Hora: {formatIsoDate(ins.createdAt)}
                    </Text>
                  </TouchableOpacity>

                  {isHost && (
                    <TouchableOpacity
                      onPress={() => handleExcluirInscricao(detalhesTorneio?.id || "", ins.userId)}
                      style={{
                        backgroundColor: "#fe5f55",
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 4,
                        alignSelf: "center",
                        marginLeft: 10,
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "bold" }}>Excluir</Text>
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
              <Text style={styles.buttonText}>Lista de Espera</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL LISTA DE ESPERA */}
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
                    Jogador: {playerNameMap[e.userId] || `Jogador não cadastrado: ${e.userId}`}
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

      {/* MODAL INSCRIÇÃO (ESCOLHER DECK) */}
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
                Este tipo de torneio (Liga Local) não exige deck.
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

      {/* MODAL DETALHES DECK (PDF) */}
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

      {renderJudgeSelectModal()}
      {renderHeadJudgeSelectModal()}
      {renderEventTypeSelectModal()}
    </SafeAreaView>
  );

  // =========================== SELEÇÃO DE JUÍZ, HEAD, EVENT TYPE ===========================
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
}

// ================ FUNÇÕES AUXILIARES ================
function formatIsoDate(isoStr: string) {
  if (!isoStr) return "";
  const m = moment(isoStr);
  if (!m.isValid()) return isoStr;
  return m.format("DD/MM/YYYY HH:mm");
}

// ================ ESTILOS ================
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
