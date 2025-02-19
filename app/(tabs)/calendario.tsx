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
  inscricoesDataInicio?: string; // <-- ADICIONADO AQUI
  inscricoesDataFim?: string; // <-- ADICIONADO AQUI
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
  archetype?: string; // <-- Agora o arquétipo também será armazenado
}

export default function CalendarScreen() {
  // =========== STATES / HOOKS ===========
  const [playerId, setPlayerId] = useState("");
  const [isHost, setIsHost] = useState(false);

  // Filtros
  const [filterType, setFilterType] = useState<"all" | "city" | "league" | "">("");
  const [cityStored, setCityStored] = useState("");
  const [leagueStored, setLeagueStored] = useState("");

  // Dados
  const [torneios, setTorneios] = useState<Torneio[]>([]);
  const [currentMonth, setCurrentMonth] = useState(moment());

  // Mapeamento de nomes
  const [judgeMap, setJudgeMap] = useState<Record<string, string>>({});
  const [headJudgeMap, setHeadJudgeMap] = useState<Record<string, string>>({});
  const [playerNameMap, setPlayerNameMap] = useState<Record<string, string>>({});

  // Opções de Juiz
  const [judgeOptions, setJudgeOptions] = useState<{ userId: string; fullname: string }[]>([]);
  const [headJudgeOptions, setHeadJudgeOptions] = useState<{ userId: string; fullname: string }[]>([]);

  // Modal CRIAR/EDITAR
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editJudge, setEditJudge] = useState("");
  const [editHeadJudge, setEditHeadJudge] = useState("");
  const [editEventType, setEditEventType] = useState("Cup");
  const [editInscricoesDataInicio, setEditInscricoesDataInicio] = useState("");
  const [editInscricoesDataFim, setEditInscricoesDataFim] = useState("");

  // Modal de seleção
  const [judgeSelectModal, setJudgeSelectModal] = useState(false);
  const [headJudgeSelectModal, setHeadJudgeSelectModal] = useState(false);
  const [eventTypeSelectModal, setEventTypeSelectModal] = useState(false);

  // Listas de Tipos
  const eventTypesList = ["Challenge", "Cup", "Liga Local", "Pré-Release", "Evento Especial"];

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

  // Modal INSCRIÇÕES
  const [inscricoesModalVisible, setInscricoesModalVisible] = useState(false);
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [deckNameMap, setDeckNameMap] = useState<Record<string, string>>({});

  // Modal Deck PDF
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

  // Deck Cards
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

  // =========== LIFECYCLE ==============
  useEffect(() => {
    moment.locale("pt-br");
    (async () => {
      try {
        const pid = await AsyncStorage.getItem("@userId");
        if (pid) {
          setPlayerId(pid);
          setIsHost(HOST_PLAYER_IDS.includes(pid));
        }
        const fType = (await AsyncStorage.getItem("@filterType")) || "all";
        const cStored = (await AsyncStorage.getItem("@selectedCity")) || "";
        const lStored = (await AsyncStorage.getItem("@leagueId")) || "";

        setFilterType(fType as any);
        setCityStored(cStored);
        setLeagueStored(lStored);

        await loadJudgeData(lStored);
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

          const fType = (await AsyncStorage.getItem("@filterType")) || "all";
          const cStored = (await AsyncStorage.getItem("@selectedCity")) || "";
          const lStored = (await AsyncStorage.getItem("@leagueId")) || "";

          setFilterType(fType as any);
          setCityStored(cStored);
          setLeagueStored(lStored);

          console.log("📌 Novo Filter Type:", fType);
          console.log("📌 Nova League ID:", lStored);
          console.log("📌 Nova Cidade:", cStored);

          loadTorneios();
        } catch (error) {
          console.log("❌ Erro ao atualizar filtros ao focar:", error);
        }
      })();
    }, [])
  );

  useEffect(() => {
    console.log("🔄 Atualizando torneios - Filtros:", filterType, leagueStored, cityStored);
    loadTorneios();
  }, [currentMonth, filterType, cityStored, leagueStored]);

  // ============ FUNÇÕES DE AJUDA ============

  async function loadJudgeData(currLeagueId: string) {
    try {
      if (!currLeagueId) return;
      const jArray = await fetchRoleMembers(currLeagueId, "judge");
      const jMapObj: Record<string, string> = {};
      jArray.forEach((j) => {
        jMapObj[j.userId] = j.fullname;
      });
      setJudgeOptions(jArray);
      setJudgeMap(jMapObj);

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

  async function isVip(pid: string): Promise<boolean> {
    if (!leagueStored) {
      console.log("❌ Liga não selecionada, não foi possível verificar VIP.");
      return false;
    }
  
    try {
      const vipRef = doc(db, `leagues/${leagueStored}/roles/vip/members/${pid}`);
      const vipSnap = await getDoc(vipRef);
  
      if (vipSnap.exists()) {
        console.log(`✅ Usuário ${pid} é VIP!`);
        return true;
      } else {
        console.log(`🚫 Usuário ${pid} NÃO é VIP.`);
        return false;
      }
    } catch (err) {
      console.error("Erro ao verificar VIP:", err);
      return false;
    }
  }

  // ==================== LOAD TORNEIOS / FILTRO ====================
  async function loadTorneios() {
    try {
      const filterT = await AsyncStorage.getItem("@filterType");
      const leagueSt = await AsyncStorage.getItem("@leagueId");
      const citySt = await AsyncStorage.getItem("@selectedCity");

      if (filterT === "league" && leagueSt) {
        // Liga específica
        const colRef = collection(db, "leagues", leagueSt, "calendar");
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
              // **Adiciona aqui os novos campos:**
              inscricoesDataInicio: d.inscricoesDataInicio || "",
              inscricoesDataFim: d.inscricoesDataFim || "",
            });
          });          

          const start = currentMonth.clone().startOf("month");
          const end = currentMonth.clone().endOf("month");
          const filtered = arr.filter((t) => {
            const dt = moment(t.date, "DD/MM/YYYY");
            return dt.isBetween(start, end, undefined, "[]");
          });
          setTorneios(filtered);

          filtered.forEach(async (tor) => {
            if (tor.createdBy && !playerNameMap[tor.createdBy]) {
              const pRef = doc(db, "leagues", leagueSt, "players", tor.createdBy);
              const pSnap = await getDoc(pRef);
              if (pSnap.exists()) {
                const nm = pSnap.data().fullname || `Jogador não cadastrado: ${tor.createdBy}`;
                setPlayerNameMap((prev) => ({ ...prev, [tor.createdBy]: nm }));
              }
            }
          });
        });
      } else if (filterT === "city" && citySt) {
        // Liga da cidade
        const qCity = query(collection(db, "leagues"), where("city", "==", citySt));
        const citySnap = await getDocs(qCity);
        let arrGlobal: Torneio[] = [];

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
        const start = currentMonth.clone().startOf("month");
        const end = currentMonth.clone().endOf("month");
        const filtered = arrGlobal.filter((t) => {
          const dt = moment(t.date, "DD/MM/YYYY");
          return dt.isBetween(start, end, undefined, "[]");
        });
        setTorneios(filtered);

        filtered.forEach(async (tor) => {
          const lId = citySnap.docs[0]?.id || "";
          if (tor.createdBy && !playerNameMap[tor.createdBy]) {
            const pRef = doc(db, "leagues", lId, "players", tor.createdBy);
            const pSnap = await getDoc(pRef);
            if (pSnap.exists()) {
              const nm = pSnap.data().fullname || `Jogador não cadastrado: ${tor.createdBy}`;
              setPlayerNameMap((prev) => ({ ...prev, [tor.createdBy]: nm }));
            }
          }
        });
      } else if (filterT === "all") {
        // Todas as ligas
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
        const start = currentMonth.clone().startOf("month");
        const end = currentMonth.clone().endOf("month");
        const filtered = arrGlobal.filter((t) => {
          const dt = moment(t.date, "DD/MM/YYYY");
          return dt.isBetween(start, end, undefined, "[]");
        });
        setTorneios(filtered);

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
        // Nenhum filtro
        setTorneios([]);
      }
    } catch (err) {
      console.log("❌ Erro ao carregar torneios:", err);
    }
  }

  // ===================== MÁSCARAS =====================
  function handleMaskDate(text: string, setFunc: (val: string) => void) {
    let cleaned = text.replace(/\D/g, "");
    if (cleaned.length > 8) cleaned = cleaned.slice(0, 8);

    let formatted = "";
    if (cleaned.length <= 2) {
      formatted = cleaned;
    } else if (cleaned.length <= 4) {
      formatted = cleaned.slice(0, 2) + "/" + cleaned.slice(2);
    } else {
      formatted = cleaned.slice(0, 2) + "/" + cleaned.slice(2, 4) + "/" + cleaned.slice(4);
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

  // ===================== NAVEGAÇÃO DE MÊS =====================
  function handlePrevMonth() {
    setCurrentMonth((prev) => prev.clone().subtract(1, "month"));
  }
  function handleNextMonth() {
    setCurrentMonth((prev) => prev.clone().add(1, "month"));
  }

  // ===================== CRIAR/EDITAR TORN =====================
  async function openCreateModal() {
    try {
      const filterType = await AsyncStorage.getItem("@filterType");
      const leagueSt = await AsyncStorage.getItem("@leagueId");

      if (filterType !== "league" || !leagueSt) {
        Alert.alert("Filtro inválido", "Selecione uma liga específica primeiro.");
        return;
      }

      // Reset de campos
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
      console.error("Erro ao abrir modal:", error);
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

  async function handleSaveTorneio() {
    try {
      const leagueId = await AsyncStorage.getItem("@leagueId");
      if (!leagueId) {
        Alert.alert("Erro", "Nenhuma liga selecionada.");
        return;
      }

      const colRef = collection(db, `leagues/${leagueId}/calendar`);

      if (editId) {
        // Editar
        const docRef = doc(colRef, editId);
        await updateDoc(docRef, {
          name: editName.trim(),
          date: editDate,
          time: editTime,
          createdBy: await AsyncStorage.getItem("@userId"),
          judge: editJudge,
          headJudge: editHeadJudge,
          eventType: editEventType,
          judgeAccepted: false,
          maxVagas: editMaxVagas,
          inscricoesDataInicio: editInscricoesDataInicio,
          inscricoesDataFim: editInscricoesDataFim,
          inscricoesAbertura: editInscricoesAbertura,
          inscricoesFechamento: editInscricoesFechamento,
          prioridadeVip: editPrioridadeVip,
          inscricoesVipAbertura: editInscricoesVipAbertura,
          inscricoesVipFechamento: editInscricoesVipFechamento,
          timestamp: serverTimestamp(),
        });
      } else {
        // Criar
        const docRef = await addDoc(colRef, {
          name: editName.trim(),
          date: editDate,
          time: editTime,
          createdBy: await AsyncStorage.getItem("@userId"),
          judge: editJudge,
          headJudge: editHeadJudge,
          eventType: editEventType,
          judgeAccepted: false,
          maxVagas: editMaxVagas,
          inscricoesDataInicio: editInscricoesDataInicio,
          inscricoesDataFim: editInscricoesDataFim,
          inscricoesAbertura: editInscricoesAbertura,
          inscricoesFechamento: editInscricoesFechamento,
          prioridadeVip: editPrioridadeVip,
          inscricoesVipAbertura: editInscricoesVipAbertura,
          inscricoesVipFechamento: editInscricoesVipFechamento,
          timestamp: serverTimestamp(),
        });
      }

      setModalVisible(false);
    } catch (err) {
      console.error("Erro ao salvar torneio:", err);
      Alert.alert("Erro", "Falha ao salvar o torneio.");
    }
  }

  // ==================== DELETAR TORN ====================
  async function handleDeleteTorneio(torneio: Torneio) {
    Alert.alert("Confirmação", `Excluir o torneio "${torneio.name}"?`, [
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
            console.log("Erro ao excluir torneio:", err);
            Alert.alert("Erro", "Falha ao excluir torneio.");
          }
        },
      },
    ]);
  }

  // ==================== INSCRIÇÕES ====================
  async function handleInscrever(t: Torneio) {
    const agora = moment(); // Data e hora atuais
    console.log("🕒 Agora:", agora.format("DD/MM/YYYY HH:mm"));
  
    if (!leagueStored) {
      Alert.alert("Erro", "Liga não selecionada.");
      return;
    }
  
    const ehVip = await isVip(playerId);
  
  
    // Data de início e fim do período geral de inscrições
    const periodoInicio = t.inscricoesDataInicio
      ? moment(`${t.inscricoesDataInicio} ${t.inscricoesAbertura}`, "DD/MM/YYYY HH:mm")
      : null;
    const periodoFim = t.inscricoesDataFim
      ? moment(`${t.inscricoesDataFim} ${t.inscricoesFechamento}`, "DD/MM/YYYY HH:mm")
      : null;
  
    console.log("📅 Período Geral:");
    console.log("📌 Início:", periodoInicio?.format("DD/MM/YYYY HH:mm"));
    console.log("📌 Fim:", periodoFim?.format("DD/MM/YYYY HH:mm"));
  
    // 🚨 Se prioridadeVip NÃO estiver ativada, VIPs seguem a regra normal
    if (!t.prioridadeVip) {
      console.log("⚠️ Prioridade Apoiador está desativada! Usuário segue regra normal.");
    } else if (ehVip) {
      // Se for VIP e a prioridade está ativa, verificar se pode se inscrever antes do horário normal
      const primeiroDia = t.inscricoesDataInicio
        ? moment(t.inscricoesDataInicio, "DD/MM/YYYY")
        : null;
      const hoje = agora.clone().startOf("day");
  
      console.log("🎟️ Primeiro dia de inscrições:", primeiroDia?.format("DD/MM/YYYY"));
      console.log("📆 Hoje:", hoje.format("DD/MM/YYYY"));
      
      if (primeiroDia && hoje.isSame(primeiroDia, "day")) {
        const vipInicio = moment(
          `${t.inscricoesDataInicio} ${t.inscricoesVipAbertura}`,
          "DD/MM/YYYY HH:mm"
        );
        const vipFim = periodoInicio; // O fim VIP é o início normal
  
        /*console.log("🏅 Período VIP:");
        console.log("📌 Início VIP:", vipInicio?.format("DD/MM/YYYY HH:mm"));
        console.log("📌 Fim VIP (quando começa normal):", vipFim?.format("DD/MM/YYYY HH:mm"));*/
  
        if (agora.isBefore(vipInicio)) {
          console.log("🚫 Inscrição Apoaiador NÃO aberta ainda!");
          Alert.alert(
            "Inscrições Apoaiador Não Abertas",
            `As inscrições começam em ${t.inscricoesDataInicio} às ${t.inscricoesAbertura}.`
          );
          return;
        }
        if (vipFim && agora.isBefore(vipFim)) {
          console.log("✅ Usuário Apoaiador dentro do horário! INSCRIÇÃO LIBERADA!");
          return proceedToInscription(t);
        }
        console.log("✅ Apoaiador fora do horário Apoaiador, seguindo regra normal.");
      }
    }
  
    // Se não for VIP ou já passou do horário VIP, segue a regra geral
    if (periodoInicio && agora.isBefore(periodoInicio)) {
      console.log("🚫 Inscrição NÃO aberta ainda!");
      Alert.alert(
        "Inscrições Ainda Não Abertas",
        `As inscrições começam em ${t.inscricoesDataInicio} às ${t.inscricoesAbertura}.`
      );
      return;
    }
    if (periodoFim && agora.isAfter(periodoFim)) {
      console.log("🚫 Inscrição ENCERRADA!");
      Alert.alert(
        "Inscrições Encerradas",
        `O período de inscrições terminou em ${t.inscricoesDataFim} às ${t.inscricoesFechamento}.`
      );
      return;
    }
  
    console.log("✅ INSCRIÇÃO LIBERADA PELA REGRA NORMAL!");
    return proceedToInscription(t);
  }
  
  // Função auxiliar para seguir com a inscrição
  function proceedToInscription(t: Torneio) {
    console.log("✅ Prosseguindo com a inscrição...");
  
    // Verificar se o usuário já está inscrito
    const colRef = collection(db, "leagues", leagueStored, "calendar", t.id, "inscricoes");
    getDoc(doc(colRef, playerId)).then((snap) => {
      if (snap.exists()) {
        console.log("🚫 Usuário já está inscrito!");
        Alert.alert("Aviso", "Você já está inscrito neste torneio.");
        return;
      }
  
      /// Verificar limite de vagas
      getDocs(colRef).then((allDocs) => {
        const totalInscricoes = allDocs.docs.length;
        if (t.maxVagas && totalInscricoes >= t.maxVagas) {
          console.log("⚠️ Torneio lotado! Adicionando na lista de espera...");
          // Chama isVip(playerId) e aguarda a resolução da Promise usando then()
          isVip(playerId).then((vipStatus) => {
            handleWaitlist(t, vipStatus);
          });
          return;
        }
  
        console.log("✅ INSCRIÇÃO CONFIRMADA!");
        setDetalhesTorneio(t);
        setInscricaoTorneioId(t.id);
        setSelectedDeckId("");
  
        // Buscar decks do jogador
        const decksRef = collection(db, `players/${playerId}/decks`);
        onSnapshot(decksRef, (resp) => {
          const arr: DeckData[] = [];
          resp.forEach((docSnap) => {
            arr.push({
              id: docSnap.id,
              name: docSnap.data().name || `Deck ${docSnap.id}`,
              playerId,
              archetype: docSnap.data().archetype || "Desconhecido", // <-- Pegando o arquétipo
            });
          });
          setUserDecks(arr);
        });

        setInscricaoModalVisible(true);
      });
    });
  }
       

  async function handleWaitlist(t: Torneio, vip: boolean) {
    Alert.alert("Lista de Espera", "Torneio lotado. Adicionado à lista de espera.");
    if (!leagueStored) return;
    const waitColRef = collection(db, "leagues", leagueStored, "calendar", t.id, "espera");
    await setDoc(doc(waitColRef, playerId), {
      userId: playerId,
      createdAt: new Date().toISOString(),
      vip,
    });
  }

  async function handleSalvarInscricao() {
    if (!inscricaoTorneioId || !detalhesTorneio) return;
    if (!leagueStored) {
      Alert.alert("Erro", "Liga não selecionada.");
      return;
    }
  
    if (detalhesTorneio.eventType !== "Liga Local" && !selectedDeckId) {
      Alert.alert("Erro", "Selecione um deck ou verifique o tipo de evento.");
      return;
    }
  
    try {
      const colRef = collection(db, "leagues", leagueStored, "calendar", inscricaoTorneioId, "inscricoes");
      const docRef = doc(colRef, playerId);
  
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        Alert.alert("Aviso", "Você já se inscreveu neste torneio.");
        setInscricaoModalVisible(false);
        return;
      }
  
      // 🔥 Buscar o arquétipo do deck selecionado
      const selectedDeck = userDecks.find(d => d.id === selectedDeckId);
      const archetype = selectedDeck?.archetype || "Desconhecido"; // Se não encontrar, usa "Desconhecido"
  
      await setDoc(docRef, {
        userId: playerId,
        deckId: selectedDeckId,
        archetype: archetype, // Agora a variável está definida corretamente
        createdAt: new Date().toISOString(),
      });
  
      Alert.alert("Sucesso", "Inscrição realizada com sucesso!");
      setInscricaoModalVisible(false);
    } catch (err) {
      console.log("Erro handleSalvarInscricao:", err);
      Alert.alert("Erro", "Falha ao salvar inscrição.");
    }
  }
  
  // ================== DETALHES ==================
  function handleOpenDetalhes(t: Torneio) {
    setDetalhesTorneio(t);
    setDetalhesModalVisible(true);
  }
  function closeDetalhes() {
    setDetalhesModalVisible(false);
    setDetalhesTorneio(null);
  }

  // ================== INSCRIÇÕES ==================
  async function openInscricoesModal(t: Torneio) {
    setDetalhesTorneio(t);

    if (!leagueStored) return;
    const colRef = collection(db, "leagues", leagueStored, "calendar", t.id, "inscricoes");

    onSnapshot(colRef, async (snap) => {
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

      const userIdsSet = new Set<string>();
      const deckQueries: Promise<void>[] = [];

      arr.forEach((i) => {
        if (i.deckId) {
          deckQueries.push(
            (async () => {
              const playerDeckRef = doc(db, `players/${i.userId}/decks/${i.deckId}`);
              const playerDeckSnap = await getDoc(playerDeckRef);

              if (playerDeckSnap.exists() && i.deckId) {
                const deckName = playerDeckSnap.data().name || `Deck ${i.deckId}`;
                setDeckNameMap((prev) => ({
                  ...prev,
                  [String(i.deckId)]: deckName,
                }));
              }
            })()
          );
        }
        userIdsSet.add(i.userId);
      });

      await Promise.all(deckQueries);

      userIdsSet.forEach(async (uId) => {
        if (!playerNameMap[uId]) {
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
      const inscricaoRef = doc(db, "leagues", leagueStored, "calendar", tournamentId, "inscricoes", pId);
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
      console.log("Erro ao notificar jogador:", err);
    }
  }

  // ================= CONFIRMAR/RECUSAR JUIZ =================
  // ================= CONFIRMAR/RECUSAR JUIZ =================
async function confirmJudge(tournament: Torneio) {
  if (!leagueStored) return;
  try {
    const docRef = doc(db, "leagues", leagueStored, "calendar", tournament.id);
    await updateDoc(docRef, { judgeAccepted: true });

    // Exclui a notificação do Firebase
    await deleteJudgeNotification(tournament.judge, tournament.id);

    Alert.alert("Sucesso", `Você confirmou como juiz em: ${tournament.name}`);
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

    // Exclui a notificação do Firebase
    await deleteJudgeNotification(tournament.judge, tournament.id);

    Alert.alert("Sucesso", `Você recusou ser juiz em: ${tournament.name}`);
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

// ================= EXCLUIR NOTIFICAÇÃO DO JUIZ =================
async function deleteJudgeNotification(judgeId: string, torneioId: string) {
  if (!judgeId) return;
  try {
    const notifColRef = collection(db, "players", judgeId, "notifications");
    const notifSnap = await getDocs(notifColRef);

    notifSnap.forEach(async (docSnap) => {
      const notifData = docSnap.data();
      if (notifData.type === "judge_invite" && notifData.torneioId === torneioId) {
        await deleteDoc(doc(notifColRef, docSnap.id));
        console.log(`Notificação do juiz ${judgeId} para torneio ${torneioId} removida.`);
      }
    });
  } catch (err) {
    console.log("Erro ao excluir notificação do juiz:", err);
  }
}
  // =================== DECKS (PDF) ===================
  async function loadDeckCards(inscritoId: string, deckId: string) {
    try {
      if (!inscritoId) {
        console.error("Erro: inscritoId não definido ao carregar o deck.");
        return;
      }

      const deckRef = doc(db, `players/${inscritoId}/decks/${deckId}`);
      const deckSnap = await getDoc(deckRef);

      if (!deckSnap.exists()) {
        console.warn(`Deck ${deckId} não encontrado para o usuário ${inscritoId}.`);
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

  // ================== RENDER (layout) ==================
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
      <Animatable.View
        style={styles.card}
        key={`t-${tor.id}`}
        animation="fadeInUp"
        duration={700}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{tor.name}</Text>
          <Ionicons name="calendar-outline" size={20} color="#fff" />
        </View>
        <Text style={styles.cardSub}>
          <MaterialCommunityIcons name="clock-outline" size={14} color="#ccc" />
          {"  "}
          {tor.date} às {tor.time} | [{eventLabel}]
        </Text>

        <Text style={styles.cardSub}>
          Criador: <Text style={{ color: "#fff" }}>{creatorFullname}</Text>
          {"\n"}
          Juiz: <Text style={{ color: "#fff" }}>{judgeName}</Text>
          {tor.judgeAccepted ? " (Ok)" : " (Pendente)"}
          {"  "}
          | Head: <Text style={{ color: "#fff" }}>{headJudgeName}</Text>
        </Text>

        {isThisJudgePending && (
          <View style={styles.cardActionsRow}>
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
          <View style={styles.cardActionsRow}>
            <TouchableOpacity
              style={[styles.buttonSmall, { marginRight: 8 }]}
              onPress={() => openEditModal(tor)}
            >
              <Ionicons name="pencil" size={16} color="#FFF" />
              <Text style={styles.buttonSmallText}> Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buttonSmall, { backgroundColor: "#FF3333" }]}
              onPress={() => handleDeleteTorneio(tor)}
            >
              <Ionicons name="trash" size={16} color="#FFF" />
              <Text style={styles.buttonSmallText}> Excluir</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Botões de Inscrever / Detalhes */}
        {isFuture ? (
          <View style={styles.cardActionsRow}>
            {canAccessDetails && (
              <TouchableOpacity
                style={[styles.cardActionButton, { marginRight: 8 }]}
                onPress={() => handleOpenDetalhes(tor)}
              >
                <Ionicons name="information-circle" size={18} color="#FFF" />
                <Text style={styles.cardActionButtonText}>  Detalhes</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.cardActionButton}
              onPress={() => handleInscrever(tor)}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
              <Text style={styles.cardActionButtonText}>  Inscrever</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.cardActionButton, { backgroundColor: "#777", marginTop: 8 }]}
            onPress={() => (canAccessDetails ? handleOpenDetalhes(tor) : null)}
          >
            <Ionicons name="checkmark-done-circle" size={18} color="#FFF" />
            <Text style={styles.cardActionButtonText}>
              {canAccessDetails ? " Detalhes (Ocorrido)" : " Já ocorreu"}
            </Text>
          </TouchableOpacity>
        )}
      </Animatable.View>
    );
  }

  // ============== RENDER FINAL ==================
  return (
    <SafeAreaView style={styles.safe}>
      {/* HEADER */}
      <Animatable.View
        style={styles.headerContainer}
        animation="fadeInDown"
        duration={600}
      >
        <View style={styles.monthNavigation}>
          <TouchableOpacity onPress={handlePrevMonth} style={styles.navArrow}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {currentMonth.format("MMMM [de] YYYY")}
          </Text>
          <TouchableOpacity onPress={handleNextMonth} style={styles.navArrow}>
            <Ionicons name="chevron-forward" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {isHost && (
          <TouchableOpacity style={styles.createButton} onPress={openCreateModal}>
            <MaterialCommunityIcons name="plus" size={20} color="#FFF" />
            <Text style={styles.createButtonText}> Criar Torneio</Text>
          </TouchableOpacity>
        )}
      </Animatable.View>

      {/* LISTA DE TORNEIOS */}
<Animatable.View animation="fadeInUp" duration={800} style={{ flex: 1 }}>
  <ScrollView style={{ flex: 1, marginTop: 6 }}>
    {torneios.map((t) => renderCard(t))}
    {torneios.length === 0 && (
      <Animatable.View
        style={styles.emptyContainer}
        animation="fadeIn"
        duration={600}
      >
        <Ionicons name="alert-circle" size={40} color="#aaa" />
        <Text style={styles.emptyText}>Nenhum torneio encontrado neste mês.</Text>
      </Animatable.View>
    )}
  </ScrollView>
</Animatable.View>

      {/* MODAL CRIAR/EDITAR */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView contentContainerStyle={styles.formScroll}>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View>
                  <Text style={styles.modalTitle}>
                    {editId ? "Editar Torneio" : "Criar Torneio"}
                  </Text>

                  {/* Nome */}
                  <Text style={styles.modalLabel}>Nome do Torneio</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editName}
                    onChangeText={setEditName}
                  />

                  {/* Data */}
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

                  {/* Horário */}
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

                  {/* Tipo de Evento */}
                  <Text style={styles.modalLabel}>Tipo de Evento</Text>
                  <TouchableOpacity
                    style={[styles.modalInput, styles.selectFakeInput]}
                    onPress={() => setEventTypeSelectModal(true)}
                  >
                    <Text style={{ color: "#fff" }}>{editEventType}</Text>
                  </TouchableOpacity>

                  {/* Juiz */}
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

                  {/* Head Judge */}
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

                  {/* Máximo de Vagas */}
                  <Text style={styles.modalLabel}>Máximo de Vagas</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    value={editMaxVagas?.toString() || ""}
                    onChangeText={(v) => setEditMaxVagas(Number(v) || null)}
                  />

                  <Text style={styles.modalLabel}>Data de Abertura das Inscrições</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editInscricoesDataInicio}
                    keyboardType="numeric"
                    onChangeText={(txt) => handleMaskDate(txt, setEditInscricoesDataInicio)}
                    maxLength={10}
                    placeholder="Ex: 10/03/2025"
                    placeholderTextColor="#777"
                  />

                  <Text style={styles.modalLabel}>Data de Fechamento das Inscrições</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editInscricoesDataFim}
                    keyboardType="numeric"
                    onChangeText={(txt) => handleMaskDate(txt, setEditInscricoesDataFim)}
                    maxLength={10}
                    placeholder="Ex: 14/03/2025"
                    placeholderTextColor="#777"
                  />


                  {/* Abertura e Fechamento */}
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

                  {/* Switch VIP */}
                  <View style={styles.vipRow}>
                    <Text style={styles.modalLabelVIP}>Prioridade VIP</Text>
                    <Switch
                      value={editPrioridadeVip}
                      onValueChange={setEditPrioridadeVip}
                    />
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

                      {/*<Text style={styles.modalLabel}>Fechamento (VIP) (HH:MM)</Text>
                      <TextInput
                        style={styles.modalInput}
                        value={editInscricoesVipFechamento}
                        keyboardType="numeric"
                        onChangeText={(txt) => handleMaskTime(txt, setEditInscricoesVipFechamento)}
                        maxLength={5}
                        placeholder="Ex: 09:00"
                        placeholderTextColor="#777"
                      />*/}
                    </>
                  )}

                  <View style={{ height: 30 }} />
                  {/* BOTÕES */}
                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.button, { backgroundColor: "#999", marginRight: 20 }]}
                      onPress={() => setModalVisible(false)}
                    >
                      <Ionicons name="close-circle" size={16} color="#FFF" />
                      <Text style={styles.buttonText}> Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.button} onPress={handleSaveTorneio}>
                      <Ionicons name="save" size={16} color="#FFF" />
                      <Text style={styles.buttonText}> Salvar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* MODAL DETALHES */}
      <Modal
        visible={detalhesModalVisible}
        animationType="slide"
        onRequestClose={closeDetalhes}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: DARK }]}>
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
                  {judgeMap[detalhesTorneio.judge] || `Jogador: ${detalhesTorneio.judge}`}
                  {detalhesTorneio.judgeAccepted ? " (Confirmado)" : " (Pendente)"}
                </Text>

                <Text style={styles.modalLabel}>Head Judge:</Text>
                <Text style={styles.modalInput}>
                  {headJudgeMap[detalhesTorneio.headJudge] ||
                    `Jogador: ${detalhesTorneio.headJudge}`}
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
                  <Ionicons name="people" size={16} color="#FFF" />
                  <Text style={styles.buttonText}> Ver Inscrições</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, { backgroundColor: "#999", marginTop: 20 }]}
                  onPress={closeDetalhes}
                >
                  <Ionicons name="close" size={16} color="#FFF" />
                  <Text style={styles.buttonText}> Fechar</Text>
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
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={40} color="#999" />
                <Text style={styles.emptyText}>Nenhuma inscrição encontrada.</Text>
              </View>
            ) : (
              inscricoes.map((ins, idx) => (
                <Animatable.View
                  key={`ins-${idx}`}
                  style={[styles.inscricaoItem, styles.rowSpace]}
                  animation="fadeInUp"
                  duration={600}
                >
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => {
                      if (ins.deckId) {
                        setSelectedDeckIdForPdf(ins.deckId);
                        loadDeckCards(ins.userId, ins.deckId);
                        setDeckPdfModalVisible(true);
                      }
                    }}
                  >
                    <Text style={styles.inscricaoItemText}>
                      Jogador: {playerNameMap[ins.userId] || `Jog: ${ins.userId}`}
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
                      style={styles.deleteButton}
                    >
                      <Ionicons name="trash" size={16} color="#FFF" />
                      <Text style={styles.deleteButtonText}>Excluir</Text>
                    </TouchableOpacity>
                  )}
                </Animatable.View>
              ))
            )}

            <TouchableOpacity
              style={[styles.button, { marginTop: 20 }]}
              onPress={closeInscricoesModal}
            >
              <Ionicons name="close" size={16} color="#FFF" />
              <Text style={styles.buttonText}> Fechar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { marginTop: 10, backgroundColor: "#777" }]}
              onPress={() => setEsperaModalVisible(true)}
            >
              <Ionicons name="list" size={16} color="#FFF" />
              <Text style={styles.buttonText}> Lista de Espera</Text>
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
              <View style={styles.emptyContainer}>
                <Ionicons name="time-outline" size={40} color="#999" />
                <Text style={styles.emptyText}>Nenhum jogador na lista de espera.</Text>
              </View>
            ) : (
              espera.map((e, idx) => (
                <Animatable.View
                  key={`espera-${idx}`}
                  style={[styles.inscricaoItem, { flexDirection: "column" }]}
                  animation="fadeInUp"
                  duration={600}
                >
                  <Text style={styles.inscricaoItemText}>
                    Jogador: {playerNameMap[e.userId] || `Jog: ${e.userId}`}
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
              <Ionicons name="close" size={16} color="#FFF" />
              <Text style={styles.buttonText}> Fechar</Text>
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
                <View style={styles.emptyContainer}>
                  <Ionicons name="albums-outline" size={40} color="#999" />
                  <Text style={styles.emptyText}>Você não possui decks cadastrados.</Text>
                </View>
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
                    {dk.name} | ({dk.archetype})
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
                <Ionicons name="close" size={16} color="#FFF" />
                <Text style={styles.buttonText}> Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={handleSalvarInscricao}>
                <Ionicons name="checkmark" size={16} color="#FFF" />
                <Text style={styles.buttonText}> Salvar</Text>
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
            <Ionicons name="close" size={16} color="#FFF" />
            <Text style={styles.buttonText}> Fechar</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      {/* SELECT MODALS (Judge, HeadJudge, EventType) */}
      {renderJudgeSelectModal()}
      {renderHeadJudgeSelectModal()}
      {renderEventTypeSelectModal()}
    </SafeAreaView>
  );
  // ================== FIM DO RETURN ==================

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
          <View style={styles.selectModalInner}>
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
          <View style={styles.selectModalInner}>
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

// ============== HELPER ==============
function formatIsoDate(isoStr: string) {
  if (!isoStr) return "";
  const m = moment(isoStr);
  if (!m.isValid()) return isoStr;
  return m.format("DD/MM/YYYY HH:mm");
}

// ============== ESTILOS ==============
const DARK = "#1E1E1E";
const PRIMARY = "#E3350D";
const SECONDARY = "#FFFFFF";
const GRAY = "#333333";

const styles = StyleSheet.create({
  // Container principal da tela
  safe: {
    flex: 1,
    backgroundColor: DARK,
  },
  // Cabeçalho do calendário
  headerContainer: {
    backgroundColor: DARK,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#444",
  },
  monthNavigation: {
  flexDirection: "row", // Muda para coluna para separar os itens
  alignItems: "center", // Centraliza os itens na coluna
  justifyContent: "center", 
  marginTop: 10, // Adiciona margem superior para descer o mês
},
navArrow: {
  padding: 6,
},
headerTitle: {
  color: SECONDARY,
  fontSize: 20,
  fontWeight: "bold",
  textTransform: "capitalize",
  marginTop: 6, // Move o nome do mês mais para baixo
},

  // Botão para criar novo torneio
  createButton: {
    flexDirection: "row",
    backgroundColor: PRIMARY,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: "flex-end",
    marginTop: 10,
    alignItems: "center",
  },
  createButtonText: {
    color: SECONDARY,
    fontWeight: "bold",
    fontSize: 15,
  },
  // Cartões de torneio
  card: {
    backgroundColor: GRAY,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 10,
    padding: 12,
    // Sombra para iOS e elevação para Android (cria profundidade)
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardTitle: {
    color: PRIMARY,
    fontSize: 17,
    fontWeight: "bold",
  },
  cardSub: {
    color: "#ccc",
    fontSize: 13,
    marginVertical: 2,
  },
  cardActionsRow: {
    flexDirection: "row",
    marginTop: 6,
    alignItems: "center",
  },
  // Estilo para distribuir itens com espaço entre eles
  rowSpace: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  // Botões pequenos dentro dos cartões
  buttonSmall: {
    backgroundColor: "#555",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  buttonSmallText: {
    color: SECONDARY,
    fontWeight: "bold",
    marginLeft: 4,
  },
  // Botão de ação principal dos cartões (ex: Inscrever/Detalhes)
  cardActionButton: {
    flexDirection: "row",
    backgroundColor: "#4CAF50",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  cardActionButtonText: {
    color: SECONDARY,
    fontWeight: "bold",
    marginLeft: 4,
  },
  // Container para mensagem de lista vazia
  emptyContainer: {
    alignItems: "center",
    marginVertical: 16,
  },
  emptyText: {
    color: "#999",
    marginTop: 8,
    fontSize: 15,
  },
  // Container principal dos modais
  modalContainer: {
    flex: 1,
    backgroundColor: DARK,
  },
  // Container de conteúdo dos formulários (ScrollView)
  formScroll: {
    paddingBottom: 100,
    paddingHorizontal: 16,
  },
  // Título dos modais
  modalTitle: {
    color: SECONDARY,
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 16,
  },
  // Rótulo dos campos de formulário
  modalLabel: {
    color: SECONDARY,
    fontSize: 14,
    marginTop: 12,
    fontWeight: "600",
  },
  // Rótulo específico para campos VIP (com margem à direita)
  modalLabelVIP: {
    color: SECONDARY,
    fontSize: 14,
    fontWeight: "600",
    marginRight: 12,
  },
  // Inputs dos modais
  modalInput: {
    backgroundColor: "#4A4A4A",
    color: SECONDARY,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    marginVertical: 6,
  },
  // Estilo para inputs de seleção (ex: juiz, tipo de evento)
  selectFakeInput: {
    justifyContent: "center",
  },
  // Linha para o switch VIP
  vipRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  // Container dos botões do modal (Salvar/Cancelar)
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  // Botão padrão do modal
  button: {
    flexDirection: "row",
    backgroundColor: PRIMARY,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    marginLeft: 8,
  },
  buttonText: {
    color: SECONDARY,
    fontWeight: "bold",
  },
  // Botão para exclusão (usado, por exemplo, em inscrições)
  deleteButton: {
    backgroundColor: "#fe5f55",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    alignSelf: "center",
    marginLeft: 10,
  },
  deleteButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  // Estilo para o ScrollView principal, se necessário
  scrollView: {
    flex: 1,
  },
  // Overlay para modais (para dar efeito de fundo semitransparente)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  // Container interno dos modais de seleção (ex.: selecionar juiz, evento)
  selectModalInner: {
    backgroundColor: "#2B2B2B",
    marginHorizontal: 30,
    marginVertical: 100,
    borderRadius: 8,
    padding: 10,
    flex: 1,
  },
  // Itens da lista de seleção
  selectScrollItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#555",
    paddingVertical: 10,
  },
  // Container para o conteúdo dos cartões (imagem + texto)
  cardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  // Container para o texto do cartão
  cardText: {
    flex: 1,
    paddingRight: 10,
  },
  // Container para a imagem do cartão
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
  // Estilos para os itens de inscrição
  inscricaoItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#444",
    padding: 10,
    marginVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#666",
  },
  inscricaoItemText: {
    color: "#fff",
    fontSize: 14,
  },

  // Estilos para as opções de deck no modal de inscrição
  deckOption: {
    backgroundColor: "#555",
    padding: 12,
    borderRadius: 6,
    marginVertical: 5,
    alignItems: "center",
  },
  deckOptionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});