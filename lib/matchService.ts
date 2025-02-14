//////////////////////////////////////
// ARQUIVO: matchService.ts
//////////////////////////////////////
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "./firebaseConfig";

// ==== INTERFACES ====
export interface MatchData {
  id: string;
  outcomeNumber?: number; // 1 (P1 vence), 2 (P2 vence), 3 (empate), 10 (WO)
  player1_id?: string;
  player2_id?: string;
}

// Dados agregados para stats
export interface PlayerStatsData {
  wins: number;
  losses: number;
  draws: number;
  matchesTotal: number;
  opponentsList: string[];
  updatedAt?: any;
}

// Dados de Rival
export interface RivalData {
  rivalId: string;
  rivalName: string;
  matches: number;
  userWins: number;
  rivalWins: number;
  lastWinner: "user" | "rival" | "empate";
  wrPercentage: number;
  updatedAt?: any;
}

/** 
 * Novíssima interface de Clássicos
 */
export interface ClassicsData {
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

/** Tipo de item de histórico */
export interface TournamentHistoryItem {
  tournamentId: string;
  tournamentName: string;
  place: number;
  totalPlayers: number;
  roundCount: number;
  date: string; // ISO string
}

/** 
 * Lê /stats/classics de um jogador.
 * Se não existir, retorna null.
 */
export async function fetchPlayerClassicsStats(
  leagueId: string, 
  playerId: string
): Promise<ClassicsData | null> {
  try {
    const classicsRef = doc(db, `leagues/${leagueId}/players/${playerId}/stats`, "classics");
    const snap = await getDoc(classicsRef);
    if (!snap.exists()) return null;
    return snap.data() as ClassicsData;
  } catch (error) {
    console.error("Erro ao ler classics:", error);
    return null;
  }
}


/** Lê stats/aggregated */
export async function fetchPlayerStatsAggregated(
  leagueId: string,
  playerId: string
): Promise<PlayerStatsData | null> {
  try {
    const statsRef = doc(db, `leagues/${leagueId}/players/${playerId}/stats/aggregated`);
    const snap = await getDoc(statsRef);
    if (!snap.exists()) {
      return null;
    }
    return snap.data() as PlayerStatsData;
  } catch (error) {
    console.error("Erro ao ler stats agregadas:", error);
    return null;
  }
}

/** Lê stats/rival */
export async function fetchPlayerRival(
  leagueId: string,
  playerId: string
): Promise<RivalData | null> {
  try {
    const rivalRef = doc(db, `leagues/${leagueId}/players/${playerId}/stats/rival`);
    const snap = await getDoc(rivalRef);
    if (!snap.exists()) {
      return null;
    }
    return snap.data() as RivalData;
  } catch (error) {
    console.error("Erro ao ler rival:", error);
    return null;
  }
}

/**
 * Busca TODAS as partidas respeitando o filtro:
 *  - all   => todas as ligas
 *  - city  => todas as ligas de determinada cidade
 *  - league=> liga específica
 */
export async function fetchAllMatches(): Promise<MatchData[]> {
  const filterType = await AsyncStorage.getItem("@filterType");
  const cityStored = await AsyncStorage.getItem("@selectedCity");
  const leagueStored = await AsyncStorage.getItem("@leagueId");

  try {
    let leaguesToFetch: string[] = [];

    if (!filterType || filterType === "all") {
      const leaguesSnap = await getDocs(collection(db, "leagues"));
      leaguesSnap.forEach((docSnap) => {
        leaguesToFetch.push(docSnap.id);
      });
    } else if (filterType === "city" && cityStored) {
      const qCity = query(collection(db, "leagues"), where("city", "==", cityStored));
      const citySnapshot = await getDocs(qCity);
      citySnapshot.forEach((docSnap) => {
        leaguesToFetch.push(docSnap.id);
      });
    } else if (filterType === "league" && leagueStored) {
      leaguesToFetch.push(leagueStored);
    } else {
      console.warn("Filtro inválido ou não definido, retornando vazio.");
      return [];
    }

    if (leaguesToFetch.length === 0) {
      console.log("Nenhuma liga encontrada para esse filtro. Retornando vazio.");
      return [];
    }

    let allMatches: MatchData[] = [];

    for (const lid of leaguesToFetch) {
      const tournamentsRef = collection(db, `leagues/${lid}/tournaments`);
      const tournamentsSnap = await getDocs(tournamentsRef);

      if (tournamentsSnap.empty) continue;

      for (const tDoc of tournamentsSnap.docs) {
        const tId = tDoc.id;
        const roundsRef = collection(db, `leagues/${lid}/tournaments/${tId}/rounds`);
        const roundsSnap = await getDocs(roundsRef);

        if (roundsSnap.empty) continue;

        for (const rDoc of roundsSnap.docs) {
          const matchesRef = collection(db, `leagues/${lid}/tournaments/${tId}/rounds/${rDoc.id}/matches`);
          const matchesSnap = await getDocs(matchesRef);

          if (matchesSnap.empty) continue;

          matchesSnap.forEach((mDoc) => {
            const matchData = mDoc.data() as MatchData;
            allMatches.push({ ...matchData, id: mDoc.id });
          });
        }
      }
    }

    return allMatches;
  } catch (error) {
    console.error("Erro em fetchAllMatches:", error);
    return [];
  }
}

/** Igual ao anterior, mas ignora o filtro e pega TODAS as ligas. */
export async function fetchAllMatchesGlobal(): Promise<MatchData[]> {
  try {
    let allMatches: MatchData[] = [];
    const leaguesSnap = await getDocs(collection(db, "leagues"));

    for (const leagueDoc of leaguesSnap.docs) {
      const leagueId = leagueDoc.id;
      const tournamentsRef = collection(db, `leagues/${leagueId}/tournaments`);
      const tournamentsSnap = await getDocs(tournamentsRef);

      if (tournamentsSnap.empty) continue;

      for (const tDoc of tournamentsSnap.docs) {
        const tId = tDoc.id;
        const roundsRef = collection(db, `leagues/${leagueId}/tournaments/${tId}/rounds`);
        const roundsSnap = await getDocs(roundsRef);

        if (roundsSnap.empty) continue;

        for (const rDoc of roundsSnap.docs) {
          const matchesRef = collection(db, `leagues/${leagueId}/tournaments/${tId}/rounds/${rDoc.id}/matches`);
          const matchesSnap = await getDocs(matchesRef);

          if (matchesSnap.empty) continue;

          matchesSnap.forEach((mDoc) => {
            const matchData = mDoc.data() as MatchData;
            allMatches.push({ ...matchData, id: mDoc.id });
          });
        }
      }
    }
    return allMatches;
  } catch (error) {
    console.error("Erro em fetchAllMatchesGlobal:", error);
    return [];
  }
}

/** 
 * Soma as estatísticas agregadas do usuário de acordo com o filtro (all, city ou league).
 */
export async function fetchAllStatsByFilter(userId: string): Promise<PlayerStatsData> {
  const defaultStats: PlayerStatsData = {
    wins: 0,
    losses: 0,
    draws: 0,
    matchesTotal: 0,
    opponentsList: [],
  };

  try {
    const filterType = await AsyncStorage.getItem("@filterType");
    const cityStored = await AsyncStorage.getItem("@selectedCity");
    const leagueStored = await AsyncStorage.getItem("@leagueId");

    let leaguesToFetch: string[] = [];

    if (!filterType || filterType === "all") {
      const leaguesSnap = await getDocs(collection(db, "leagues"));
      leaguesSnap.forEach((docSnap) => {
        leaguesToFetch.push(docSnap.id);
      });
    } else if (filterType === "city" && cityStored) {
      const qCity = query(collection(db, "leagues"), where("city", "==", cityStored));
      const citySnapshot = await getDocs(qCity);
      citySnapshot.forEach((docSnap) => {
        leaguesToFetch.push(docSnap.id);
      });
    } else if (filterType === "league" && leagueStored) {
      leaguesToFetch.push(leagueStored);
    } else {
      console.warn("Filtro inválido ou não definido. Retornando stats zeradas.");
      return defaultStats;
    }

    if (leaguesToFetch.length === 0) {
      console.log("Nenhuma liga encontrada para esse filtro.");
      return defaultStats;
    }

    let finalStats = { ...defaultStats };

    for (const lid of leaguesToFetch) {
      const aggregated = await fetchPlayerStatsAggregated(lid, userId);
      if (aggregated) {
        finalStats.wins += aggregated.wins;
        finalStats.losses += aggregated.losses;
        finalStats.draws += aggregated.draws;
        finalStats.matchesTotal += aggregated.matchesTotal;

        const union = new Set([
          ...finalStats.opponentsList,
          ...aggregated.opponentsList,
        ]);
        finalStats.opponentsList = Array.from(union);
      }
    }

    return finalStats;
  } catch (error) {
    console.error("Erro em fetchAllStatsByFilter:", error);
    return defaultStats;
  }
}


/**
 * Calcula o maior rival do jogador com base no `/stats/classics`
 */
export async function fetchRivalByFilter(userId: string): Promise<RivalData | null> {
  try {
    // 🔥 1️⃣ Busca os filtros armazenados
    const filterType = await AsyncStorage.getItem("@filterType");
    const cityStored = await AsyncStorage.getItem("@selectedCity");
    const leagueStored = await AsyncStorage.getItem("@leagueId");

    let leaguesToFetch: string[] = [];

    if (!filterType || filterType === "all") {
      // 🔥 Busca todas as ligas do Firebase
      const leaguesSnap = await getDocs(collection(db, "leagues"));
      leaguesSnap.forEach((docSnap) => {
        leaguesToFetch.push(docSnap.id);
      });
    } else if (filterType === "city" && cityStored) {
      // 🔥 Busca ligas de uma cidade específica
      const qCity = query(collection(db, "leagues"), where("city", "==", cityStored));
      const citySnapshot = await getDocs(qCity);
      citySnapshot.forEach((docSnap) => {
        leaguesToFetch.push(docSnap.id);
      });
    } else if (filterType === "league" && leagueStored) {
      // 🔥 Usa apenas a liga selecionada
      leaguesToFetch.push(leagueStored);
    } else {
      console.warn("⚠️ Nenhuma liga válida encontrada para calcular o rival.");
      return null;
    }

    if (leaguesToFetch.length === 0) {
      console.log("⚠️ Nenhuma liga correspondente encontrada.");
      return null;
    }

    let topRivalId = "";
    let topScore = -Infinity;
    let finalStats = {
      matches: 0,
      userWins: 0,
      rivalWins: 0,
      draws: 0,
      lastWinner: "empate",
      wrPercentage: 0,
    };

    let updatedAt = null;

    // 🔄 2️⃣ Percorre todas as ligas e busca os dados de classics
    for (const lid of leaguesToFetch) {
      const classicsData = await fetchPlayerClassicsStats(lid, userId);
      if (!classicsData || !classicsData.opponents) continue;

      updatedAt = classicsData.updatedAt || null;

      for (const oppId in classicsData.opponents) {
        const matchData = classicsData.opponents[oppId];

        const totalMatches = matchData.matches;
        const userWins = matchData.wins;
        const rivalWins = matchData.losses;
        const draws = matchData.draws;
        const lastWinner = userWins > rivalWins ? "user" : rivalWins > userWins ? "rival" : "empate";

        const winDiff = Math.abs(userWins - rivalWins);
        const balanceFactor = 1 / (1 + winDiff); // Se for 0 (empate), isso vale 1

        // 🔥 Fórmula de rivalidade:
        const score = totalMatches * balanceFactor + (lastWinner === "rival" ? 0.5 : 0);

        if (score > topScore) {
          topScore = score;
          topRivalId = oppId;
          finalStats = {
            matches: totalMatches,
            userWins,
            rivalWins,
            draws,
            lastWinner,
            wrPercentage: totalMatches > 0 ? (userWins / totalMatches) * 100 : 0,
          };
        }
      }
    }

    if (!topRivalId) {
      console.warn("⚠️ Nenhum rival encontrado para esse jogador.");
      return null;
    }

    // 🔥 3️⃣ Buscar o nome do rival no Firebase
    const rivalRef = doc(db, `leagues/${leaguesToFetch[0]}/players/${topRivalId}`);
    const rivalSnap = await getDoc(rivalRef);
    const rivalName = rivalSnap.exists() ? rivalSnap.data()?.fullname || `User ${topRivalId}` : `User ${topRivalId}`;

    return {
      rivalId: topRivalId,
      rivalName,
      matches: finalStats.matches,
      userWins: finalStats.userWins,
      rivalWins: finalStats.rivalWins,
      lastWinner: finalStats.lastWinner as "user" | "rival" | "empate", // 👈 Forçando o tipo correto
      wrPercentage: finalStats.wrPercentage,
      updatedAt,
    };    
  } catch (err) {
    console.error("❌ Erro ao calcular rival com classics:", err);
    return null;
  }
}

// =============== NOVA FUNÇÃO: fetchPlayerHistory ===============

/**
 * Retorna os últimos torneios do jogador (até 15),
 * salvos em /leagues/<leagueId>/players/<playerId>/stats/history
 */
export async function fetchPlayerHistory(
  leagueId: string,
  playerId: string
): Promise<TournamentHistoryItem[]> {
  try {
    const docRef = doc(db, `leagues/${leagueId}/players/${playerId}/stats`, "history");
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return [];
    }
    const data = snap.data();
    if (!data || !data.latestTournaments) {
      return [];
    }
    return data.latestTournaments as TournamentHistoryItem[];
  } catch (err) {
    console.error("Erro ao buscar histórico:", err);
    return [];
  }
}