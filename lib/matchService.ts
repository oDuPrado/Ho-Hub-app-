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
 * Lê stats/aggregated de uma liga para um player.
 * Aqui, usamos um índice (por exemplo, ordenando por updatedAt) se configurado no Firebase.
 */
export async function fetchPlayerStatsAggregated(
  leagueId: string,
  playerId: string
): Promise<PlayerStatsData | null> {
  try {
    const statsRef = doc(
      db,
      `leagues/${leagueId}/players/${playerId}/stats/aggregated`
    );
    const snap = await getDoc(statsRef);
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data() as PlayerStatsData;
    return data;
  } catch (error) {
    console.error("Erro ao ler stats agregadas:", error);
    return null;
  }
}

/** 
 * Lê stats/rival de uma liga para um player.
 * Utiliza o índice configurado para a coleção stats.
 */
export async function fetchPlayerRival(
  leagueId: string,
  playerId: string
): Promise<RivalData | null> {
  try {
    const rivalRef = doc(
      db,
      `leagues/${leagueId}/players/${playerId}/stats/rival`
    );
    const snap = await getDoc(rivalRef);
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data() as RivalData;
    return data;
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
 *
 * Se você criar índices nos campos "city" (na coleção "leagues") e, se necessário,
 * incluir um orderBy, o Firestore usará os índices configurados.
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
      // Crie um índice composto no Firebase para "city"
      const qCity = query(
        collection(db, "leagues"),
        where("city", "==", cityStored)
      );
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

    // Para cada liga, buscar os torneios, rounds e matches.
    // Se você configurar índices para as subcoleções (por exemplo, em matches, orderBy player1_id, etc.)
    // eles serão usados automaticamente.
    for (const leagueId of leaguesToFetch) {
      const tournamentsRef = collection(db, `leagues/${leagueId}/tournaments`);
      const tournamentsSnap = await getDocs(tournamentsRef);

      if (tournamentsSnap.empty) continue;

      for (const tDoc of tournamentsSnap.docs) {
        const tId = tDoc.id;
        const roundsRef = collection(db, `leagues/${leagueId}/tournaments/${tId}/rounds`);
        const roundsSnap = await getDocs(roundsRef);

        if (roundsSnap.empty) continue;

        for (const rDoc of roundsSnap.docs) {
          const matchesRef = collection(
            db,
            `leagues/${leagueId}/tournaments/${tId}/rounds/${rDoc.id}/matches`
          );
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

/** 
 * Busca todas as partidas ignorando o filtro, ou seja, de TODAS as ligas.
 * Essa função pode ser usada para casos onde é necessário o conjunto completo.
 */
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
          const matchesRef = collection(
            db,
            `leagues/${leagueId}/tournaments/${tId}/rounds/${rDoc.id}/matches`
          );
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
 * Essa função é utilizada para obter dados prontos do backend.
 */
export async function fetchAllStatsByFilter(
  userId: string
): Promise<PlayerStatsData> {
  const defaultStats: PlayerStatsData = {
    wins: 0,
    losses: 0,
    draws: 0,
    matchesTotal: 0,
    opponentsList: [],
  };

  try {
    const filterType = await AsyncStorage.getItem("@filterType"); // "all"|"city"|"league"
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

    for (const leagueId of leaguesToFetch) {
      const aggregated = await fetchPlayerStatsAggregated(leagueId, userId);
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
 * Busca o Rival do usuário conforme filtro:
 * - Se filterType for "league", tenta ler o documento /stats/rival
 * - Se for "city" ou "all", retorna null
 */
export async function fetchRivalByFilter(
  userId: string
): Promise<RivalData | null> {
  try {
    const filterType = await AsyncStorage.getItem("@filterType");
    const leagueStored = await AsyncStorage.getItem("@leagueId");

    if (filterType === "league" && leagueStored) {
      const rivalDoc = await fetchPlayerRival(leagueStored, userId);
      return rivalDoc;
    } else {
      console.log("Rival não disponível para city/all. Retornando null.");
      return null;
    }
  } catch (err) {
    console.error("Erro ao buscar rival:", err);
    return null;
  }
}
