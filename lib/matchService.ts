//////////////////////////////////////////
// ARQUIVO: matchService.ts
//////////////////////////////////////////

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

/** ==== INTERFACES ==== */

// Dados das partidas
export interface MatchData {
  id: string;
  outcomeNumber?: number; // 1 (P1 vence), 2 (P2 vence), 3 (empate), 10 (WO)
  player1_id?: string;
  player2_id?: string;
}

// Dados agregados para estatísticas do jogador
export interface PlayerStatsData {
  wins: number;
  losses: number;
  draws: number;
  matchesTotal: number;
  opponentsList: string[];
  tournamentPlacements: TournamentHistoryItem[];
  updatedAt?: any; // opcional, se você quiser salvar data
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
 * Dados agregados de Clássicos, lidos do documento 
 * /leagues/{leagueId}/players/{playerId}/stats/classics
 */
export interface ClassicsData {
  opponents: {
    [oppId: string]: {
      matches: number;
      wins: number;    // vitórias do jogador
      losses: number;  // derrotas do jogador (equivalente a vitórias do oponente)
      draws: number;
    };
  };
  updatedAt?: any;
}

// Tipo de item de histórico de torneios
export interface TournamentHistoryItem {
  tournamentId: string;
  tournamentName: string;
  place: number;
  totalPlayers: number;
  roundCount: number;
  date: string; // ISO string
}

// =============== FUNÇÕES DE LEITURA DE STATS ===============

/**
 * Lê o documento /stats/classics de um jogador.
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
      console.warn(`Histórico não encontrado para ${playerId} na liga ${leagueId}`);
      return [];
    }

    const data = snap.data();

    if (!data || !data.latestTournaments) {
      console.warn("⚠️ Campo 'latestTournaments' não encontrado no histórico.");
      return [];
    }

    if (!Array.isArray(data.latestTournaments)) {
      console.error("❌ 'latestTournaments' não é um array!", data.latestTournaments);
      return [];
    }

    // 🔥 Certifica que 'place' é extraído corretamente
    const tournaments = data.latestTournaments.map((t: any) => ({
      tournamentId: t.tournamentId || "Desconhecido",
      tournamentName: t.tournamentName || "Torneio Sem Nome",
      place: t.place ?? -1,
      totalPlayers: t.totalPlayers ?? 0,
      roundCount: t.roundCount ?? 0,
      date: t.date || new Date().toISOString(),
    }));

    return tournaments;
  } catch (err) {
    console.error("Erro ao buscar histórico:", err);
    return [];
  }
}

/**
 * NOVA FUNÇÃO que retorna uma lista de Clássicos ativos entre dois jogadores
 * usando os dados do /stats/classics do Player A.
 */
import { getActiveClassicosForDuo, PlayerVsPlayerStats } from "../app/classicosConfig";

export async function fetchActiveClassicosForDuo(
  leagueId: string,
  playerA: string,
  playerB: string
): Promise<ReturnType<typeof getActiveClassicosForDuo>> {
  try {
    const classicsData = await fetchPlayerClassicsStats(leagueId, playerA);
    if (!classicsData || !classicsData.opponents[playerB]) {
      return [];
    }
    const statsData = classicsData.opponents[playerB];
    const stats: PlayerVsPlayerStats = {
      playerA,
      playerB,
      matches: statsData.matches,
      winsA: statsData.wins,
      winsB: statsData.losses, // perdas de A são vitórias de B
      draws: statsData.draws,
    };

    return getActiveClassicosForDuo(stats);
  } catch (error) {
    console.error("Erro ao calcular Clássicos entre os jogadores:", error);
    return [];
  }
}

/**
 * Calcula o maior rival do jogador com base no `/stats/classics`
 */
export async function fetchRivalByFilter(userId: string): Promise<RivalData | null> {
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
        const balanceFactor = 1 / (1 + winDiff); // Se diferença for 0, valor 1

        // Simples fórmula de "rivalidade"
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
            wrPercentage: ((userWins + (draws * 0.5)) / totalMatches) * 100
          };
        }
      }
    }

    if (!topRivalId) {
      console.warn("⚠️ Nenhum rival encontrado para esse jogador.");
      return null;
    }

    const rivalRef = doc(db, `leagues/${leaguesToFetch[0]}/players/${topRivalId}`);
    const rivalSnap = await getDoc(rivalRef);
    const rivalName = rivalSnap.exists()
      ? rivalSnap.data()?.fullname || `User ${topRivalId}`
      : `User ${topRivalId}`;

    return {
      rivalId: topRivalId,
      rivalName,
      matches: finalStats.matches,
      userWins: finalStats.userWins,
      rivalWins: finalStats.rivalWins,
      lastWinner: finalStats.lastWinner as "user" | "rival" | "empate",
      wrPercentage: finalStats.wrPercentage,
      updatedAt,
    };    
  } catch (err) {
    console.error("❌ Erro ao calcular rival com classics:", err);
    return null;
  }
}

/**
 * NOVA FUNÇÃO: soma as estatísticas agregadas do usuário, usando o mesmo filtro,
 * e calcula XP total + nível (usando uma progressão cumulativa), com CACHE para evitar consultas extras.
 * 
 * Regras de XP:
 *  - Vitória = +100 XP
 *  - Empate = +50 XP
 *  - Derrota = +20 XP
 *  - 1º lugar em torneio = +500 XP
 *  - 2º lugar = +300 XP
 *  - 3º lugar = +200 XP
 *  - Participação = +100 XP
 * 
 * A progressão cumulativa será:
 *  - Para chegar ao Nível 1: 50 XP
 *  - Para chegar ao Nível 2: 50 + 150 = 200 XP
 *  - Para chegar ao Nível 3: 200 + 250 = 450 XP
 *  - Para chegar ao Nível 4: 450 + 350 = 800 XP
 *  - Para chegar ao Nível 5: 800 + 450 = 1250 XP
 *  - Para chegar ao Nível 6: 1250 + 550 = 1800 XP
 *  ... e assim sucessivamente (incremento = 100*(n–1) + 50).
 */
export async function fetchAllStatsByFilter(
  userId: string
): Promise<
  PlayerStatsData & {
    xp: number;
    level: number;
    xpForCurrentLevel: number;
    xpForNextLevel: number;
    xpProgress: number; // XP já acumulado no nível atual
    xpRemaining: number; // XP faltando para subir de nível
  }
> {
  const defaultStats: PlayerStatsData = {
    wins: 0,
    losses: 0,
    draws: 0,
    matchesTotal: 0,
    opponentsList: [],
    tournamentPlacements: [],
  };

  // 1) Verifica primeiro no cache local
  const filterType = (await AsyncStorage.getItem("@filterType")) || "all";
  const cityStored = await AsyncStorage.getItem("@selectedCity");
  const leagueStored = await AsyncStorage.getItem("@leagueId");

  const cacheKey = `@xpCache_${filterType}_${userId}`;
  const cachedDataString = await AsyncStorage.getItem(cacheKey);
  let cachedData: any = null;
  if (cachedDataString) {
    try {
      cachedData = JSON.parse(cachedDataString);
    } catch (e) {
      cachedData = null;
    }
  }

  // Descobrir quais ligas vamos percorrer
  let leaguesToFetch: string[] = [];
  try {
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
    }
  } catch (error) {
    console.error("Erro ao descobrir ligas:", error);
  }

  // Se não encontrou ligas, retorna stats zeradas
  if (leaguesToFetch.length === 0) {
    return {
      ...defaultStats,
      xp: cachedData?.xp || 0,
      level: cachedData?.level || 1,
      xpForCurrentLevel: cachedData?.xpForCurrentLevel || 0,
      xpForNextLevel: cachedData?.xpForNextLevel || 50,
      xpProgress: cachedData?.xpProgress || 0,
      xpRemaining: cachedData?.xpRemaining || 50,
    };
  }

  // 2) Se tivermos cache, verificamos se precisamos atualizar
  let needsRefresh = false;
  let maxUpdatedAtServer = 0;
  for (const lid of leaguesToFetch) {
    const aggregated = await fetchPlayerStatsAggregated(lid, userId);
    if (aggregated?.updatedAt) {
      const ms = new Date(aggregated.updatedAt).getTime();
      if (ms > maxUpdatedAtServer) {
        maxUpdatedAtServer = ms;
      }
    }
  }
  if (cachedData && cachedData.maxUpdatedAt && maxUpdatedAtServer) {
    const cachedUpdatedMs = new Date(cachedData.maxUpdatedAt).getTime();
    needsRefresh = maxUpdatedAtServer > cachedUpdatedMs;
  } else {
    needsRefresh = true;
  }
  if (!needsRefresh && cachedData) {
    return {
      ...defaultStats,
      wins: cachedData.wins,
      losses: cachedData.losses,
      draws: cachedData.draws,
      matchesTotal: cachedData.matchesTotal,
      opponentsList: cachedData.opponentsList || [],
      tournamentPlacements: cachedData.tournamentPlacements || [],
      xp: cachedData.xp,
      level: cachedData.level,
      xpForCurrentLevel: cachedData.xpForCurrentLevel,
      xpForNextLevel: cachedData.xpForNextLevel,
      xpProgress: cachedData.xpProgress,
      xpRemaining: cachedData.xpRemaining,
    };
  }

  // 3) Cálculo completo
  let finalStats = { ...defaultStats };
  let totalXP = 0;
  for (const lid of leaguesToFetch) {
    const aggregated = await fetchPlayerStatsAggregated(lid, userId);
    if (aggregated) {
      finalStats.wins += aggregated.wins;
      finalStats.losses += aggregated.losses;
      finalStats.draws += aggregated.draws;
      finalStats.matchesTotal += aggregated.matchesTotal;
      const union = new Set([...finalStats.opponentsList, ...aggregated.opponentsList]);
      finalStats.opponentsList = Array.from(union);
      // XP por partidas
      totalXP += aggregated.wins * 100;
      totalXP += aggregated.draws * 50;
      totalXP += aggregated.losses * 20;
    }
    const history = await fetchPlayerHistory(lid, userId);
    if (history.length > 0) {
      finalStats.tournamentPlacements.push(...history);
      history.forEach((t) => {
        if (t.place === 1) totalXP += 500;
        else if (t.place === 2) totalXP += 300;
        else if (t.place === 3) totalXP += 200;
        else totalXP += 100;
      });
    }
  }

  // 4) Cálculo do nível usando progressão cumulativa:
  //    - Nível 1: 50 XP
  //    - Incremento para o próximo nível: 100*(n-1)+50
  let levelCounter = 1;
  let currentThreshold = 0; // xp necessário para atingir o nível atual
  let nextThreshold = 50;   // xp necessário para atingir o nível 1
  while (totalXP >= nextThreshold) {
    levelCounter++;
    currentThreshold = nextThreshold;
    const increment = 100 * (levelCounter - 1) + 50;
    nextThreshold += increment;
  }
  const finalLevel = levelCounter - 1; // nível atual
  const xpProgress = totalXP - currentThreshold; // xp acumulado no nível atual
  const xpForNext = nextThreshold - currentThreshold; // xp necessário para subir de nível
  const xpRemaining = nextThreshold - totalXP; // quanto falta para o próximo nível

  const result = {
    ...finalStats,
    xp: totalXP,
    level: finalLevel,
    xpForCurrentLevel: currentThreshold,
    xpForNextLevel: nextThreshold,
    xpProgress,
    xpRemaining,
  };

  const cacheToSave = {
    ...result,
    maxUpdatedAt: maxUpdatedAtServer
      ? new Date(maxUpdatedAtServer).toISOString()
      : new Date().toISOString(),
  };
  await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheToSave));

  return result;
}

