export type TitleCategory = "SÉRIA" | "ENGRAÇADA" | "ÚNICA";

export interface PlayerStats {
  wins: number;
  losses: number;
  draws: number;
  matchesTotal: number;
  tournamentsPlayed: number;
  top8Count: number;
  positiveStreak: number;
  negativeStreak: number;
  uniqueOpponents: number;
  comebackWins: number;
  flawlessTournamentWins: number;
  regionalWins: number;
  bigTournamentWins: number;
  helpedBeginners: number;
  luckyWins: number;
  memeDeckWins: number;
  matchesAfterMidnight: number;
  matchesAfterMidnightWins: number;
  ownedTitlesCount: number;
  beatAllPlayersInTournament: number;
  firstTournamentWinner?: boolean;
  firstAchieved?: boolean;
}

export interface TitleItem {
  id: number;
  title: string;
  description: string;
  category: TitleCategory;
  condition: (stats: PlayerStats) => boolean;
  unlocked?: boolean; // Adicionada a propriedade opcional
}


const titles: TitleItem[] = [
  {
    id: 101,
    title: "Mestre Pokémon",
    description: "Venceu 10 torneios grandes.",
    category: "SÉRIA",
    condition: (stats) => stats.bigTournamentWins >= 10,
  },

  {
    id: 999,
    title: "Primeira Vitória",
    description: "Conquistou sua primeira vitória em uma partida.",
    category: "SÉRIA",
    condition: (stats) => stats.wins >= 1,
  },
  {
    id: 102,
    title: "Invicto",
    description: "Venceu um torneio sem perder nenhuma partida.",
    category: "SÉRIA",
    condition: (stats) => stats.flawlessTournamentWins >= 1,
  },
  {
    id: 201,
    title: "Vitória no Memedeck",
    description: "Venceu ao menos 1 partida usando deck 'meme'.",
    category: "ENGRAÇADA",
    condition: (stats) => stats.memeDeckWins >= 1,
  },
  {
    id: 301,
    title: "Primeiro Campeão",
    description: "Foi o primeiro jogador a vencer um torneio oficial.",
    category: "ÚNICA",
    condition: (stats) => stats.firstTournamentWinner === true,
  },
  // ... acrescente outras
];

export default titles;

export const TITLE_COLORS: Record<TitleCategory, string> = {
  SÉRIA: "#0C7BCD", // azul forte
  ENGRAÇADA: "#F5A623", // laranja
  ÚNICA: "#7F12EE", // roxo especial
};
