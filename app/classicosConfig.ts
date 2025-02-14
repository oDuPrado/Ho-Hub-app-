////////////////////////////////////////
// ARQUIVO: classicosConfig.ts
////////////////////////////////////////

/**
 * Estatísticas de um confronto entre dois jogadores,
 * derivadas de /stats/classics do Firestore.
 */
export interface PlayerVsPlayerStats {
  playerA: string;
  playerB: string;
  matches: number; // total de partidas
  winsA: number;   // vitórias do playerA
  winsB: number;   // vitórias do playerB
  draws: number;   // empates
}

/** Níveis de “tier” para um clássico */
export type ClassicoTier = "Épico" | "Lendário" | "Arceus";

/** Estrutura de cada item de Clássico */
export interface ClassicoItem {
  id: number;
  title: string;
  description: string;
  tier: ClassicoTier;
  condition: (stats: PlayerVsPlayerStats) => boolean;
}

/**
 * Retorna a diferença absoluta de vitórias
 * entre Player A e Player B.
 */
function getWinDifference(stats: PlayerVsPlayerStats): number {
  return Math.abs(stats.winsA - stats.winsB);
}

/**
 * Retorna o winRate do Player A e do Player B.
 */
function getWinRates(stats: PlayerVsPlayerStats) {
  const wrA = stats.matches > 0 ? stats.winsA / stats.matches : 0;
  const wrB = stats.matches > 0 ? stats.winsB / stats.matches : 0;
  return { wrA, wrB };
}

/**
 * Lista principal dos Clássicos
 * Mantivemos os 12 antigos (IDs existentes) + 6 novos (2 de cada tier)
 * A ideia é deixar as condições mais “acirradas” e competitivas.
 */
const classicosList: ClassicoItem[] = [
  // ============================
  // 12 CLÁSSICOS ANTIGOS (IDs Iguais, Títulos Iguais), com condições mais “intensas”
  // ============================

  {
    id: 101,
    title: "Duelo de Titãs",
    description: "Duas forças que duelam sem parar, já tiveram mais de 300 embates!",
    tier: "Épico",
    condition: (stats) => stats.matches >= 300,
  },
  {
    id: 202,
    title: "Voltando pra EX",
    description: "Jogadores que já se enfrentaram bastante, mas mantêm um confronto equilibrado.",
    tier: "Lendário",
    condition: (stats) => {
      const difference = getWinDifference(stats);
      return stats.matches >= 20 && difference <= 3;
    },
  },
  {
    id: 303,
    title: "Rivalidade nascente",
    description: "Um embate que está ficando sério, já se enfrentaram 150 vezes!",
    tier: "Arceus",
    condition: (stats) => stats.matches >= 150,
  },
  {
    id: 404,
    title: "Do lixo, ao Luxo",
    description: "Depois de um começo conturbado, um dos jogadores dobrou as vitórias do outro!",
    tier: "Épico",
    condition: (stats) =>
      stats.matches >= 15 &&
      (stats.winsA >= stats.winsB * 2 || stats.winsB >= stats.winsA * 2),
  },
  {
    id: 505,
    title: "Duelo dos Melhores",
    description: "Grandes batalhas, mais de 200 partidas e vários empates intensos!",
    tier: "Lendário",
    condition: (stats) => stats.matches >= 200 && stats.draws >= 70,
  },
  {
    id: 606,
    title: "Buscando o topo!!",
    description: "Uma rivalidade onde ambos já atingiram pelo menos 15 vitórias!",
    tier: "Arceus",
    condition: (stats) => {
      const minWins = Math.min(stats.winsA, stats.winsB);
      return stats.matches >= 30 && minWins >= 15;
    },
  },
  {
    id: 707,
    title: "Rivais",
    description: "Uma rivalidade histórica com mais de 150 confrontos intensos.",
    tier: "Arceus",
    condition: (stats) => stats.matches > 150,
  },
  {
    id: 808,
    title: "Eternos Rivais",
    description: "Se enfrentaram mais de 150 vezes, com diferença de vitórias menor que 8.",
    tier: "Arceus",
    condition: (stats) => {
      const difference = getWinDifference(stats);
      return stats.matches > 150 && difference < 8;
    },
  },
  {
    id: 909,
    title: "Ash vs Paul",
    description: "Uma batalha lendária: mais de 60 confrontos e diferença de 10 vitórias pro lado dominante.",
    tier: "Épico",
    condition: (stats) => {
      const difference = getWinDifference(stats);
      return stats.matches > 60 && difference >= 10;
    },
  },
  {
    id: 1010,
    title: "Protagonista do Anime",
    description: "Um dos lados alcançou mais de 30 vitórias totais no confronto.",
    tier: "Lendário",
    condition: (stats) => stats.winsA > 30 || stats.winsB > 30,
  },
  {
    id: 1111,
    title: "Contra Sayjins, Você é uma Mosca",
    description: "Mais de 80 partidas, e um dos lados tem 90% de win rate!",
    tier: "Arceus",
    condition: (stats) => {
      const { wrA, wrB } = getWinRates(stats);
      return stats.matches > 80 && (wrA >= 0.9 || wrB >= 0.9);
    },
  },
  {
    id: 1212,
    title: "Evolução Conjunta",
    description: "Ambos evoluíram quase juntos: +20 partidas e a diferença de vitórias é menor que 3.",
    tier: "Épico",
    condition: (stats) => {
      const difference = getWinDifference(stats);
      return stats.matches > 20 && difference < 3;
    },
  },

  // ============================
  // 6 NOVOS CLÁSSICOS (2 por tier)
  // ============================

  // (Épico) - 2 novos
  {
    id: 1313,
    title: "Batalha Explosiva",
    description: "Mais de 80 partidas, mas raros empates. É fogo contra fogo!",
    tier: "Épico",
    condition: (stats) => stats.matches >= 80 && stats.draws <= 5,
  },
  {
    id: 1414,
    title: "Heróis Anônimos",
    description: "50 partidas ou mais, e praticamente nenhuma diferença de vitórias!",
    tier: "Épico",
    condition: (stats) => {
      const difference = getWinDifference(stats);
      return stats.matches >= 50 && difference < 2;
    },
  },

  // (Lendário) - 2 novos
  {
    id: 1515,
    title: "Confronto do Destino",
    description: "Duas lendas em convergência: 200 partidas e diferença de vitórias menor ou igual a 2.",
    tier: "Lendário",
    condition: (stats) => {
      const difference = getWinDifference(stats);
      return stats.matches >= 200 && difference <= 2;
    },
  },
  {
    id: 1616,
    title: "Lendas se Encontram",
    description: "Quando um lado já acumula 150 vitórias, definitivamente é lendário.",
    tier: "Lendário",
    condition: (stats) => {
      const maxWins = Math.max(stats.winsA, stats.winsB);
      return stats.matches >= 250 && maxWins >= 150;
    },
  },

  // (Arceus) - 2 novos
  {
    id: 1717,
    title: "Choque de Dimensões",
    description: "500 partidas ou mais, mas a diferença de vitórias ainda é menor que 10!",
    tier: "Arceus",
    condition: (stats) => {
      const difference = getWinDifference(stats);
      return stats.matches >= 500 && difference < 10;
    },
  },
  {
    id: 1818,
    title: "Deuses da Arena",
    description: "Mais de 400 partidas, com um lado acima de 80% e o outro acima de 50%. Poderes divinos!",
    tier: "Arceus",
    condition: (stats) => {
      const { wrA, wrB } = getWinRates(stats);
      return (
        stats.matches >= 400 &&
        ((wrA >= 0.8 && wrB >= 0.5) || (wrB >= 0.8 && wrA >= 0.5))
      );
    },
  },
];

/**
 * Verifica quais clássicos estão ativos para um determinado
 * confronto (já computado) entre dois jogadores.
 */
export function getActiveClassicosForDuo(stats: PlayerVsPlayerStats): ClassicoItem[] {
  return classicosList.filter((classico) => classico.condition(stats));
}

export default classicosList;
