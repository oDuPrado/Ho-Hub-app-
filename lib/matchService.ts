// lib/matchService.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebaseConfig";

export interface MatchData {
  id: string;
  outcomeNumber?: number; // 1 (P1 vence), 2 (P2 vence), 3 (empate), 10 (WO)
  player1_id?: string;
  player2_id?: string;
}

/** Busca todas as partidas do usuário (ou global), respeitando o filtro do AsyncStorage */
export async function fetchAllMatches(): Promise<MatchData[]> {
  try {
    const storedUserId = await AsyncStorage.getItem("@userId");
    const filterType = await AsyncStorage.getItem("@filterType"); // "all"|"city"|"league"
    const cityStored = await AsyncStorage.getItem("@selectedCity");
    const leagueStored = await AsyncStorage.getItem("@leagueId");

    if (!storedUserId) {
      console.warn("⚠️ Nenhum usuário logado.");
      return [];
    }

    // 1) Obter as ligas que atendem ao filtro
    let leaguesToFetch: string[] = [];
    if (!filterType || filterType === "all") {
      // TUDO: pega todas as ligas
      const leaguesSnap = await getDocs(collection(db, "leagues"));
      leaguesSnap.forEach((docSnap) => {
        leaguesToFetch.push(docSnap.id);
      });
    } else if (filterType === "city" && cityStored) {
      // CIDADE
      const qCity = query(collection(db, "leagues"), where("city", "==", cityStored));
      const citySnapshot = await getDocs(qCity);
      citySnapshot.forEach((docSnap) => {
        leaguesToFetch.push(docSnap.id);
      });
    } else if (filterType === "league" && leagueStored) {
      leaguesToFetch.push(leagueStored);
    } else {
      console.warn("⚠️ Filtro inválido ou não definido. Retornando vazio.");
      return [];
    }

    if (leaguesToFetch.length === 0) {
      console.log("Nenhuma liga encontrada para esse filtro.");
      return [];
    }

    // 2) Para cada liga, pega torneios -> rounds -> matches
    let allMatches: MatchData[] = [];
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
          const roundId = rDoc.id;
          const matchesRef = collection(
            db,
            `leagues/${leagueId}/tournaments/${tId}/rounds/${roundId}/matches`
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

/** Busca todas as partidas em TODAS as ligas (ignora o filtro).
 * Útil para o cálculo de TÍTULOS (global).
 */
export async function fetchAllMatchesGlobal(): Promise<MatchData[]> {
  try {
    // Pega TODAS as ligas
    const leaguesSnap = await getDocs(collection(db, "leagues"));
    let allMatches: MatchData[] = [];

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
