//////////////////////////////////////
// hosts.ts
//////////////////////////////////////
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebaseConfig";

// ====== Listas estáticas ======
export const HOST_PLAYER_IDS = ["4729671","2289116","1186767"];
export const JUDGE_PLAYER_IDS = ["4729671","4893989","2289116","1249618"];
export const HEAD_JUDGE_PLAYER_IDS = ["4729671","2289116","1249618"];
export const BAN_PLAYER_IDS = ["5011891", "4567890"];
export const vipPlayers = ["4729671"];
export const Authuser = ["4893989","4729671"];

/**
 * Busca a lista de membros de um determinado 'roleName' (host, judge, etc.)
 * em /leagues/{leagueId}/roles/{roleName}/{playerId}.
 * Se não encontrar nenhum, retorna fallback das listas estáticas,
 * mas verifica no /players/{playerId} para ver se existe 'fullname'.
 */
export async function fetchRoleMembers(
  leagueId: string,
  roleName: "host" | "judge" | "head" | "ban" | "vip"
): Promise<{ userId: string; fullname: string }[]> {
  try {
    console.log(`Buscando ${roleName} para a liga ${leagueId}`);
    const subRef = collection(db, `leagues/${leagueId}/roles/${roleName}/members`);
    const snap = await getDocs(subRef);

    if (snap.empty) {
      console.log(`Nenhum ${roleName} encontrado em ${leagueId}, usando fallback estático`);
      return await getFallbackList(leagueId, roleName);
    }

    const results: { userId: string; fullname: string }[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      console.log(`Encontrado: ${docSnap.id} - ${d.fullname || "Sem nome"}`);

      results.push({
        userId: docSnap.id,
        fullname: d.fullname || `User ${docSnap.id}`,
      });
    });

    return results;
  } catch (error) {
    console.log("Erro em fetchRoleMembers:", error);
    return await getFallbackList(leagueId, roleName);
  }
}


/**
 * Adiciona (ou atualiza) um jogador em
 * /leagues/{leagueId}/roles/{roleName}/members/{playerId}.
 * (Porém, você está usando /leagues/{leagueId}/roles/{roleName} no Cadastros,
 *  então mantenha a coerência de layout.)
 */
export async function addRoleMember(
  leagueId: string,
  roleName: "host" | "judge" | "head" | "ban" | "vip",
  userId: string,
  fullname: string
): Promise<void> {
  try {
    // Agora corretamente salvamos dentro da subcoleção "members"
    const docRef = doc(db, `leagues/${leagueId}/roles/${roleName}/members`, userId);
    await setDoc(docRef, { fullname }, { merge: true });
    console.log(`✅ ${fullname} (${userId}) adicionado como ${roleName} na liga ${leagueId}`);
  } catch (error) {
    console.log("❌ Erro ao addRoleMember:", error);
    throw error;
  }
}

/**
 * Remove um jogador do sub-role (host, judge, etc.)
 */
export async function removeRoleMember(
  leagueId: string,
  roleName: "host" | "judge" | "head" | "ban" | "vip",
  userId: string
): Promise<void> {
  try {
    const docRef = doc(db, `leagues/${leagueId}/roles/${roleName}/members`, userId);
    await deleteDoc(docRef);
    console.log(`✅ Membro ${userId} removido de ${roleName} na liga ${leagueId}`);
  } catch (error) {
    console.log("Erro ao removeRoleMember:", error);
    throw error;
  }
}


/**
 * Se a subcoleção estiver vazia ou ocorrer erro,
 * retornamos a lista estática e tentamos buscar o 'fullname'
 * em /leagues/{leagueId}/players/{uid}.
 */
async function getFallbackList(
  leagueId: string,
  roleName: string
): Promise<{ userId: string; fullname: string }[]> {
  let arr: string[] = [];
  switch (roleName) {
    case "host":
      arr = HOST_PLAYER_IDS;
      break;
    case "judge":
      arr = JUDGE_PLAYER_IDS;
      break;
    case "head":
      arr = HEAD_JUDGE_PLAYER_IDS;
      break;
    case "ban":
      arr = BAN_PLAYER_IDS;
      break;
    case "vip":
      arr = vipPlayers;
      break;
  }

  const results: { userId: string; fullname: string }[] = [];
  for (const uid of arr) {
    // Tenta buscar no /players
    let fallbackName = uid;
    try {
      const playerDoc = doc(db, `leagues/${leagueId}/players`, uid);
      const snap = await getDoc(playerDoc);
      if (snap.exists()) {
        const pData = snap.data();
        fallbackName = pData.fullname || uid;
      }
    } catch (err) {
      console.log(`Erro ao buscar fallback do user ${uid}:`, err);
    }

    results.push({
      userId: uid,
      fullname: fallbackName,
    });
  }
  return results;
}
