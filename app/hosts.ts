// hosts.ts
import { collection, doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebaseConfig";

// Listas estáticas de playerId
export const HOST_PLAYER_IDS = ["4893989", "4729671","2289116"];
export const JUDGE_PLAYER_IDS = ["4893989", "2289116"];
export const HEAD_JUDGE_PLAYER_IDS = ["3456789", "4567890"];
export const BAN_PLAYER_IDS = ["5011891", "4567890"];

/**
 * Busca infos de uma lista de playerIds no Firestore (coleção "players/{uid}")
 */
export async function fetchHostsInfo(playerIds: string[]) {
  const results: { userId: string; fullname: string }[] = [];

  for (const pid of playerIds) {
    try {
      const docRef = doc(collection(db, "players"), pid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const d = snap.data();
        results.push({
          userId: pid,
          fullname: d.fullname || `User ${pid}`,
        });
      } else {
        results.push({
          userId: pid,
          fullname: `Desconhecido (${pid})`,
        });
      }
    } catch (error) {
      console.log("Erro fetchHostsInfo:", error);
      results.push({
        userId: pid,
        fullname: `Erro Carregar (${pid})`,
      });
    }
  }

  return results;
}
