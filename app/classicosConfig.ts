////////////////////////////////////////
// ARQUIVO: classicosConfig.ts
////////////////////////////////////////

import { MatchData } from "../lib/matchService";

/** Estatísticas de um confronto entre DOIS jogadores. */
export interface PlayerVsPlayerStats {
  playerA: string;
  playerB: string;
  matches: number;
  winsA: number;
  winsB: number;
  draws: number;
}

/** Estrutura de cada clássico */
export interface ClassicoItem {
  id: number;
  title: string;
  description: string;
  tier: "Épico" | "Lendário" | "Arceus";
  condition: (stats: PlayerVsPlayerStats) => boolean;
}

/** Lista de clássicos existentes e novos clássicos adicionados */
const classicosList: ClassicoItem[] = [
  {
    id: 101,
    title: "Duelo de Titãs",
    description: "Duas forças que duelam sem parar, ja tiveram mais de 250 embates!!",
    tier: "Épico",
    condition: (stats) => stats.matches >= 250,
  },
  {
    id: 202,
    title: "Voltando pra EX",
    description: "Jogadores que tem confrontos demais mas continuam se vendo nos torneios! ",
    tier: "Lendário",
    condition: (stats) =>
      stats.matches >= 10 && Math.abs(stats.winsA - stats.winsB) <= 2,
  },
  {
    id: 303,
    title: "Rivalidade nascente",
    description: "Um embate que esta nascendo, ja se enfretaram 100 vezes!!",
    tier: "Arceus",
    condition: (stats) => stats.matches >= 100,
  },
  {
    id: 404,
    title: "Do lixo, ao Luxo",
    description:
      "Depois de muitas derrotas, um dos jogadores deu a volta por cima com vitórias 2 consecutivas!",
    tier: "Épico",
    condition: (stats) =>
      stats.matches >= 8 &&
      (stats.winsA >= stats.winsB * 2 || stats.winsB >= stats.winsA * 2),
  },
  {
    id: 505,
    title: "Duelo dos Melhores",
    description:
      "os melhores jogadores, se enfretando varias vezes, buscando o titulo de melhor da liga!.",
    tier: "Lendário",
    condition: (stats) => stats.matches >= 150 && stats.draws >= 50,
  },
  // ----- Novos Clássicos Adicionados -----
  {
    id: 606,
    title: "Buscando o topo!!",
    description:
      "Uma rivalidade onde ambos jogadores alcançaram, pelo menos, 10 vice-campeonatos em seus confrontos.",
    tier: "Lendário",
    condition: (stats) =>
      stats.matches >= 10 && Math.min(stats.winsA, stats.winsB) >= 10,
  },
  {
    id: 707,
    title: "Rivais",
    description:
      "Uma rivalidade histórica com mais de 100 confrontos intensos entre os adversários.",
    tier: "Arceus",
    condition: (stats) => stats.matches > 100,
  },
  {
    id: 808,
    title: "Eternos Rivais",
    description:
      "Confrontos épicos com mais de 100 partidas e uma disputa equilibrada, com diferença de vitórias inferior a 5.",
    tier: "Arceus",
    condition: (stats) =>
      stats.matches > 100 && Math.abs(stats.winsA - stats.winsB) < 5,
  },
  {
    id: 909,
    title: "Ash vs Paul",
    description:
      "Uma batalha lendária: mais de 30 confrontos com uma diferença de pelo menos 5 vitórias a favor de um dos lados.",
    tier: "Épico",
    condition: (stats) => stats.matches > 30 && Math.abs(stats.winsA - stats.winsB) >= 5,
  },
  {
    id: 1010,
    title: "Protagonista do Anime",
    description:
      "Um duelo digno do protagonista: um dos jogadores conquistou mais de 20 vitórias sobre seu adversário.",
    tier: "Lendário",
    condition: (stats) => stats.winsA > 20 || stats.winsB > 20,
  },
  {
    id: 1111,
    title: "Contra Sayjins, Você é uma Mosca",
    description:
      "Um confronto esmagador: mais de 50 partidas com um win rate de 90% para um dos lados.",
    tier: "Arceus",
    condition: (stats) =>
      stats.matches > 50 &&
      ((stats.winsA / stats.matches >= 0.9) || (stats.winsB / stats.matches >= 0.9)),
  },
  {
    id: 1212,
    title: "Evolução Conjunta",
    description:
      "Se um evolui, o outro evolui junto: mais de 10 confrontos com uma diferença de vitórias é inferior a 2.",
    tier: "Épico",
    condition: (stats) => stats.matches > 10 && Math.abs(stats.winsA - stats.winsB) < 2,
  },
];

/**
 * Calcula estatísticas para um confronto específico entre dois jogadores:
 * contabiliza partidas, vitórias de cada lado e empates.
 */
export function computePlayerVsPlayerStats(
  allMatches: MatchData[],
  playerA: string,
  playerB: string
): PlayerVsPlayerStats {
  let matches = 0;
  let winsA = 0;
  let winsB = 0;
  let draws = 0;

  for (const match of allMatches) {
    if (
      (match.player1_id === playerA && match.player2_id === playerB) ||
      (match.player2_id === playerA && match.player1_id === playerB)
    ) {
      matches++;
      const isAplayer1 = match.player1_id === playerA;
      const outcome = match.outcomeNumber || 0;
      if (outcome === 1) {
        isAplayer1 ? winsA++ : winsB++;
      } else if (outcome === 2) {
        isAplayer1 ? winsB++ : winsA++;
      } else if (outcome === 3) {
        draws++;
      } else if (outcome === 10) {
        // WO: quem faltou perdeu
        isAplayer1 ? winsB++ : winsA++;
      }
    }
  }

  return {
    playerA,
    playerB,
    matches,
    winsA,
    winsB,
    draws,
  };
}

/**
 * Retorna quais clássicos estão ativos para um confronto entre dois jogadores,
 * com base nas estatísticas calculadas.
 */
export function getActiveClassicosForDuo(
  stats: PlayerVsPlayerStats
): ClassicoItem[] {
  return classicosList.filter((classico) => classico.condition(stats));
}

export default classicosList;
