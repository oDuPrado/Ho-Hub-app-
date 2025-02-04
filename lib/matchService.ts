// src/lib/matchService.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebaseConfig";

export interface MatchData {
  id: string;
  outcomeNumber?: number; // 1 (P1 vence), 2 (P2 vence), 3 (empate), 10 (WO)
  player1_id?: string;
  player2_id?: string;
}

/**
 * Busca todas as partidas do usuário, respeitando o filtro definido.
 * 
 * Filtros possíveis:
 * - "all": busca em todas as ligas.
 * - "city": busca em todas as ligas de uma cidade específica.
 * - "league": busca somente em uma liga específica.
 */
export async function fetchAllMatches(): Promise<MatchData[]> {
  try {
    const storedUserId = await AsyncStorage.getItem("@userId");
    const filterType = await AsyncStorage.getItem("@filterType"); // "all" | "city" | "league"
    const cityStored = await AsyncStorage.getItem("@selectedCity");
    const leagueStored = await AsyncStorage.getItem("@leagueId");

    if (!storedUserId) {
      console.warn("⚠️ Nenhum usuário logado.");
      return [];
    }

    // 1) Obter as ligas que atendem ao filtro
    let leaguesToFetch: string[] = [];
    if (filterType === "all" || !filterType) {
      // TUDO: pega todas as ligas
      const leaguesSnap = await getDocs(collection(db, "leagues"));
      leaguesSnap.forEach((docSnap) => {
        leaguesToFetch.push(docSnap.id);
      });
    } else if (filterType === "city" && cityStored) {
      // CIDADE: filtra ligas com city igual a cityStored
      const qCity = query(collection(db, "leagues"), where("city", "==", cityStored));
      const citySnapshot = await getDocs(qCity);
      citySnapshot.forEach((docSnap) => {
        leaguesToFetch.push(docSnap.id);
      });
    } else if (filterType === "league" && leagueStored) {
      // LIGA: somente a liga específica
      leaguesToFetch.push(leagueStored);
    } else {
      console.warn("⚠️ Filtro inválido ou não definido. Retornando vazio.");
      return [];
    }

    if (leaguesToFetch.length === 0) {
      console.log("Nenhuma liga encontrada para esse filtro.");
      return [];
    }

    // 2) Para cada liga, busca torneios -> rounds -> matches
    let allMatches: MatchData[] = [];
    for (const leagueId of leaguesToFetch) {
      const tournamentsRef = collection(db, `leagues/${leagueId}/tournaments`);
      const tournamentsSnap = await getDocs(tournamentsRef);

      if (tournamentsSnap.empty) continue;

      for (const tournamentDoc of tournamentsSnap.docs) {
        const tournamentId = tournamentDoc.id;
        const roundsRef = collection(db, `leagues/${leagueId}/tournaments/${tournamentId}/rounds`);
        const roundsSnap = await getDocs(roundsRef);
        if (roundsSnap.empty) continue;

        for (const roundDoc of roundsSnap.docs) {
          const roundId = roundDoc.id;
          const matchesRef = collection(db, `leagues/${leagueId}/tournaments/${tournamentId}/rounds/${roundId}/matches`);
          const matchesSnap = await getDocs(matchesRef);
          if (matchesSnap.empty) continue;

          matchesSnap.forEach((docSnap) => {
            const matchData = docSnap.data() as MatchData;
            // Inclui o id do documento
            allMatches.push({ ...matchData, id: docSnap.id });
          });
        }
      }
    }

    console.log(`Total de partidas obtidas (filtro: ${filterType}):`, allMatches.length);
    return allMatches;
  } catch (error) {
    console.error("🔥 Erro ao buscar partidas:", error);
    return [];
  }
}
