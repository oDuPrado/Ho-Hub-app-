//////////////////////////////////////
// ARQUIVO: titlesConfig.ts
//////////////////////////////////////
export type TitleCategory = "SÉRIA" | "ENGRAÇADA" | "ÚNICA" | "EXCLUSIVO";

export interface PlayerStats {
  userId: string;              // 🔥 Agora cada jogador tem um ID único
  wins: number;                // Vitórias
  losses: number;              // Derrotas
  draws: number;               // Empates
  matchesTotal: number;        // Partidas jogadas
  uniqueOpponents: number;     // Oponentes únicos enfrentados
  tournamentPlacements?: number[]; // Colocações do jogador em torneios
}

export interface TitleItem {
  id: number;
  title: string;
  description: string;
  category: TitleCategory;
  condition: (stats: PlayerStats) => boolean;
  unlocked?: boolean;
  icon?: string; // ✅ Adicionamos a propriedade de ícone
}

// ==================================================
//  TÍTULOS - CATEGORIA: SÉRIA
// ==================================================
const titlesSeria: TitleItem[] = [
  {
    // [EXISTENTE: ID=101] (Renomeado)
    id: 101,
    title: "Mestre de Kanto",
    description: "Você venceu 20 partidas, provando ser tão forte quanto o campeão original dos primórdios Pokémon!",
    category: "SÉRIA",
    condition: (stats) => stats.wins >= 20,
  },
  {
    // [EXISTENTE: ID=999] (Renomeado)
    id: 999,
    title: "A Jornada Começa",
    description: "Conquistou sua primeira vitória, como Ash iniciando sua aventura Pokémon.",
    category: "SÉRIA",
    condition: (stats) => stats.wins >= 1,
  },
  {
    // [EXISTENTE: ID=102] (Renomeado)
    id: 102,
    title: "Kamehameha Final", 
    description: "Com pelo menos 30 vitórias, seu poder é digno de um guerreiro que ultrapassou seus limites!",
    category: "SÉRIA",
    condition: (stats) => stats.wins >= 30,
  },
  {
    // [EXISTENTE: ID=401] (Renomeado)
    id: 401,
    title: "Guardião do Sky Pillar",
    description: "Vença 50 partidas e proteja os céus.",
    category: "SÉRIA",
    condition: (stats) => stats.wins >= 50,
  },
  {
    // [EXISTENTE: ID=405] (Renomeado)
    id: 405,
    title: "Caminho do Poder",
    description: "Atinja 100 partidas jogadas, mostrando a trajetórtoria do verdadeiro Poder.",
    category: "SÉRIA",
    condition: (stats) => stats.matchesTotal >= 100,
  },

  // ======= Novos Títulos SÉRIA (10 novos) =======
  {
    id: 406,
    title: "Conquistador de Johto",
    description: "Atinja 75 vitórias e domine a região de Johto.",
    category: "SÉRIA",
    condition: (stats) => stats.wins >= 75,
  },
  {
    id: 407,
    title: "Top 3 Desafiante",
    description: "Fique entre os 3 primeiros em pelo menos 3 torneios oficiais.",
    category: "SÉRIA",
    condition: (stats) =>
      (stats.tournamentPlacements?.filter((p) => p <= 3).length ?? 0) >= 3,
  },
  {
    id: 408,
    title: "Oitavo Anjo",
    description: "Jogue ao menos 50 partidas, demonstrando determinação sobre-humana.",
    category: "SÉRIA",
    condition: (stats) => stats.matchesTotal >= 50,
  },
  {
    id: 409,
    title: "Conquistador de 100 Unowns",
    description: "Enfrente 20 oponentes únicos, explorando várias formas como os Unowns.",
    category: "SÉRIA",
    condition: (stats) => stats.uniqueOpponents >= 20,
  },
  {
    id: 410,
    title: "Hakuna Matata da Vitória",
    description: "Atinja 90 vitórias, sem medo do fracasso em sua jornada.",
    category: "SÉRIA",
    condition: (stats) => stats.wins >= 90,
  },
  {
    id: 411,
    title: "Elite dos 4",
    description: "Complete 4 torneios no top 3, mostrando seu poder de Liga Pokémon.",
    category: "SÉRIA",
    condition: (stats) =>
      (stats.tournamentPlacements?.filter((p) => p <= 3).length ?? 0) >= 4,
  },
  {
    id: 412,
    title: "Faça Elevar seu cosmo!",
    description: "Participe de 150 partidas, elevando seu Cosmo como um Cavaleiro de Atena.",
    category: "SÉRIA",
    condition: (stats) => stats.matchesTotal >= 150,
  },
  {
    id: 413,
    title: "Z-Crystal Supremo",
    description: "Com 120 vitórias, seu golpe Z já ultrapassou o limite dos treinadores comuns.",
    category: "SÉRIA",
    condition: (stats) => stats.wins >= 120,
  },
  {
    id: 414,
    title: "Subindo a cachoeira",
    description: "Mesmo após 10 derrotas, acumulou ao menos 10 vitórias para se tornar um dragão.",
    category: "SÉRIA",
    condition: (stats) => stats.losses >= 10 && stats.wins >= 10,
  },
  {
    id: 415,
    title: "Apenas 1 nao é o Suciente",
    description: "Conquiste o primeiro lugar em pelo menos 2 torneios diferentes.",
    category: "SÉRIA",
    condition: (stats) =>
      (stats.tournamentPlacements?.filter((p) => p === 1).length ?? 0) >= 2,
  },
  {
    id: 416,
    title: "Jinchuuriki Pokémon",
    description: "Você alcançou 200 vitórias. Sua força Pokémon desperta como um bijuu selado dentro de você.",
    category: "SÉRIA",
    condition: (stats) => stats.wins >= 200,
  },
  {
    id: 417,
    title: "Ultra Instinto Pokémon",
    description: "Venceu 10 partidas consecutivas sem derrotas ou empates. Sua técnica já superou os limites humanos!",
    category: "SÉRIA",
    condition: (stats) => stats.wins >= 10 && stats.losses === 0 && stats.draws === 0,
  },
  {
    id: 418,
    title: "Lenda dos Sete Mares",
    description: "Você enfrentou 50 oponentes únicos, navegando por batalhas como um verdadeiro Rei dos Piratas.",
    category: "SÉRIA",
    condition: (stats) => stats.uniqueOpponents >= 50,
  },
  {
    id: 419,
    title: "Exterminador de Titãs",
    description: "Alcance 250 partidas, demonstrando coragem digna do Corpo de Exploração Pokémon.",
    category: "SÉRIA",
    condition: (stats) => stats.matchesTotal >= 250,
  },
  {
    id: 420,
    title: "Cavaleiro de Platina",
    description: "Alcance o top 1 em pelo menos 3 torneios. Seu cosmo brilha mais que a armadura dos Cavaleiros.",
    category: "SÉRIA",
    condition: (stats) => (stats.tournamentPlacements?.filter(p => p === 1).length ?? 0) >= 3,
  },  
];

// ==================================================
//  TÍTULOS - CATEGORIA: ENGRAÇADA
// ==================================================
const titlesEngracada: TitleItem[] = [
  {
    // [EXISTENTE: ID=201] (Renomeado)
    id: 201,
    title: "Miau, Que Empate!",
    description: "Acumulou 5 empates, como se a Equipe Rocket tivesse bagunçado tudo!",
    category: "ENGRAÇADA",
    condition: (stats) => stats.draws >= 5,
  },
  {
    // [EXISTENTE: ID=404] (Renomeado)
    id: 404,
    title: "Erro 404: Vitória Não Encontrada",
    description: "Possui mais derrotas do que vitórias, mas segue firme na luta!",
    category: "ENGRAÇADA",
    condition: (stats) => stats.losses > stats.wins,
  },

  // ======= Novos Títulos ENGRAÇADA (13 novos) =======
  {
    id: 202,
    title: "Empate denovo? Empate denovo!",
    description: "Conseguiu 10 empates, deixando seus adversários confusos: isso é talento ou sorte?",
    category: "ENGRAÇADA",
    condition: (stats) => stats.draws >= 10,
  },
  {
    id: 203,
    title: "Poké Bola Furada",
    description: "Tenha 10 derrotas e nenhum 1º lugar ainda. A captura não foi bem-sucedida.",
    category: "ENGRAÇADA",
    condition: (stats) =>
      stats.losses >= 10 &&
      (stats.tournamentPlacements?.every((p) => p !== 1) ?? true),
  },
  {
    id: 204,
    title: "Pikachu Zonzo",
    description: "Colecionou 3 ou mais empates sem conseguir uma só vitória.",
    category: "ENGRAÇADA",
    condition: (stats) => stats.draws >= 3 && stats.wins === 0,
  },
  {
    id: 205,
    title: "Treinamento do Mestre Kame",
    description: "Fez sua primeira (ou segunda) partida e já empatou. Treino pesado!",
    category: "ENGRAÇADA",
    condition: (stats) => stats.draws >= 1 && stats.matchesTotal <= 2,
  },
  {
    id: 206,
    title: "Rivalidade de anime Shonen",
    description: "Já enfrentou 10 oponentes únicos, mas ainda não chegou a 10 vitórias.",
    category: "ENGRAÇADA",
    condition: (stats) => stats.uniqueOpponents >= 10 && stats.wins < 10,
  },
  {
    id: 207,
    title: "Sofredor das Muralhas",
    description: "Tenha 20 ou mais derrotas, erguendo muralhas de frustrações.",
    category: "ENGRAÇADA",
    condition: (stats) => stats.losses >= 20,
  },
  {
    id: 208,
    title: "Mais Filler em Naruto?",
    description: "Participe de 200 partidas, como se estivesse em um arco filler infinito.",
    category: "ENGRAÇADA",
    condition: (stats) => stats.matchesTotal >= 200,
  },
  {
    id: 209,
    title: "Magikarp Saltitante",
    description: "Possui mais derrotas que vitórias, mas ao menos 1 vitória foi garantida!",
    category: "ENGRAÇADA",
    condition: (stats) => stats.losses > stats.wins && stats.wins >= 1,
  },
  {
    id: 210,
    title: "Zubat? Zubat! Zubat...",
    description: "Acumulou 20 empates, atormentando todos como Zubats em cavernas.",
    category: "ENGRAÇADA",
    condition: (stats) => stats.draws >= 20,
  },
  {
    id: 211,
    title: "Equipe Rocket Decolando Denovo",
    description: "Jogou 50 partidas e conquistou menos de 20 vitórias. Que fase...",
    category: "ENGRAÇADA",
    condition: (stats) => stats.matchesTotal >= 50 && stats.wins < 20,
  },
  {
    id: 212,
    title: "Chuunibyou Ativado",
    description: "Alcançou 15 derrotas e 15 vitórias, achando que é herói e vilão ao mesmo tempo.",
    category: "ENGRAÇADA",
    condition: (stats) => stats.losses >= 15 && stats.wins >= 15,
  },
  {
    id: 213,
    title: "O Meme Continua",
    description: "Todas as partidas foram empates. Nani?!",
    category: "ENGRAÇADA",
    condition: (stats) =>
      stats.draws === stats.matchesTotal && stats.matchesTotal > 0,
  },
  {
    id: 214,
    title: "Chorando no Chuveiro",
    description: "Acumulou 30 derrotas ou mais. O sofrimento molda o guerreiro!",
    category: "ENGRAÇADA",
    condition: (stats) => stats.losses >= 30,
  },
  {
    id: 215,
    title: "Fuga das Galinhas Pokémon",
    description: "Desistiu (W.O.) de pelo menos 3 partidas. Às vezes, correr é a melhor estratégia!",
    category: "ENGRAÇADA",
    condition: (stats) => stats.matchesTotal >= 3 && stats.losses >= 3 && stats.wins === 0,
  },
  {
    id: 216,
    title: "Slowpoke das Partidas",
    description: "Fez 30 partidas e ainda não venceu nenhuma. Tudo ao seu tempo!",
    category: "ENGRAÇADA",
    condition: (stats) => stats.matchesTotal >= 30 && stats.wins === 0,
  },
  {
    id: 217,
    title: "Psyduck Confuso",
    description: "Acumulou 15 empates. Seu Pokémon ainda não entendeu o que fazer...",
    category: "ENGRAÇADA",
    condition: (stats) => stats.draws >= 15,
  },
  {
    id: 218,
    title: "Itachi da Derrota",
    description: "Perdeu 50 partidas. Talvez você esteja protegendo alguém em segredo?",
    category: "ENGRAÇADA",
    condition: (stats) => stats.losses >= 50,
  },
  {
    id: 219,
    title: "Saitama Entediado",
    description: "Você venceu suas primeiras 3 partidas consecutivas, mas depois nunca mais jogou. Vitória demais também cansa!",
    category: "ENGRAÇADA",
    condition: (stats) => stats.wins === 3 && stats.matchesTotal === 3,
  },  
];

// ==================================================
//  TÍTULOS - CATEGORIA: ÚNICA
// ==================================================
const titlesUnica: TitleItem[] = [
  {
    // [EXISTENTE: ID=301] (Renomeado)
    id: 301,
    title: "Campeão de Alola",
    description: "Ficou em 1º lugar em pelo menos um torneio, como Ash em Alola.",
    category: "ÚNICA",
    condition: (stats) =>
      (stats.tournamentPlacements?.filter((p) => p === 1).length ?? 0) >= 1,
  },
  {
    // [EXISTENTE: ID=402] (Renomeado)
    id: 402,
    title: "Viajante Interdimensional",
    description: "Enfrentou 30 oponentes únicos, como quem cruza múltiplos universos.",
    category: "ÚNICA",
    condition: (stats) => stats.uniqueOpponents >= 15,
  },
  {
    // [EXISTENTE: ID=403] (Renomeado)
    id: 403,
    title: "Campeão Épico",
    description: "Venceu 20 torneios, conquistando o ápice em grandes eventos.",
    category: "ÚNICA",
    condition: (stats) =>
      (stats.tournamentPlacements?.filter((p) => p === 1).length ?? 0) >= 20,
  },

  // ======= Novos Títulos ÚNICA (12 novos) =======
  {
    id: 302,
    title: "Lendário Alquimista",
    description: "Participe de 300 partidas, transmutando derrotas e vitórias em experiência.",
    category: "ÚNICA",
    condition: (stats) => stats.matchesTotal >= 300,
  },
  {
    id: 303,
    title: "Compartilhador de Aura",
    description: "Enfrentou 30 oponentes únicos, conectando-se como Lucario.",
    category: "ÚNICA",
    condition: (stats) => stats.uniqueOpponents >= 30,
  },
  {
    id: 304,
    title: "O Escolhido",
    description: "Jogue 500 partidas, sendo considerado uma verdadeira lenda digital.",
    category: "ÚNICA",
    condition: (stats) => stats.matchesTotal >= 500,
  },
  {
    id: 305,
    title: "Além das Estrelas",
    description: "Alcance 200 vitórias, brilhando como uma estrela cadente.",
    category: "ÚNICA",
    condition: (stats) => stats.wins >= 200,
  },
  {
    id: 306,
    title: "Invencível de JoJo",
    description: "Permanecer sem derrotas (0) com 10 ou mais vitórias. Ora Ora Ora!",
    category: "ÚNICA",
    condition: (stats) => stats.losses === 0 && stats.wins >= 10,
  },
  {
    id: 307,
    title: "A Lenda de Sinnoh",
    description: "Ficou no top 3 em 10 torneios, dominando completamente a região de Sinnoh.",
    category: "ÚNICA",
    condition: (stats) =>
      (stats.tournamentPlacements?.filter((p) => p <= 3).length ?? 0) >= 10,
  },
  {
    id: 308,
    title: "Devorador de Vilões",
    description: "Tenha 150 vitórias e menos de 30 derrotas, dignos de um verdadeiro herói.",
    category: "ÚNICA",
    condition: (stats) => stats.wins >= 150 && stats.losses < 30,
  },
  {
    id: 309,
    title: "Deus Shinobi",
    description: "Obtenha 250 vitórias em pelo menos 250 partidas. Poder absoluto!",
    category: "ÚNICA",
    condition: (stats) => stats.wins >= 250 && stats.matchesTotal >= 250,
  },
  {
    id: 310,
    title: "Asas de Ho-Oh",
    description: "Tenha ao menos 300 vitórias, erguendo-se como a fênix lendária.",
    category: "ÚNICA",
    condition: (stats) => stats.wins >= 300,
  },
  {
    id: 311,
    title: "Sem Limites",
    description: "Participe de 1000 partidas, rompendo todas as barreiras.",
    category: "ÚNICA",
    condition: (stats) => stats.matchesTotal >= 1000,
  },
  {
    id: 312,
    title: "Conquistador de Galar",
    description: "Alcance o 1º lugar em 5 torneios, reafirmando sua supremacia.",
    category: "ÚNICA",
    condition: (stats) =>
      (stats.tournamentPlacements?.filter((p) => p === 1).length ?? 0) >= 5,
  },
  {
    id: 313,
    title: "Reserva Perfeita",
    description: "Não perdeu nenhuma partida (0 derrotas) após disputar pelo menos 20 jogos.",
    category: "ÚNICA",
    condition: (stats) => stats.losses === 0 && stats.wins >= 20,
  },
  {
    id: 314,
    title: "Hokage Pokémon",
    description: "Venceu 10 torneios. Você é reconhecido e respeitado em todas as vilas Pokémon!",
    category: "ÚNICA",
    condition: (stats) => (stats.tournamentPlacements?.filter(p => p === 1).length ?? 0) >= 10,
  },
  {
    id: 315,
    title: "Pokémon de Elite",
    description: "Permaneça invicto após 30 partidas consecutivas, digno da Elite dos Quatro.",
    category: "ÚNICA",
    condition: (stats) => stats.losses === 0 && stats.matchesTotal >= 30,
  },
  {
    id: 316,
    title: "Dominador dos Quatro Elementos",
    description: "Obteve 100 vitórias, 25 empates e 25 derrotas. Você dominou o equilíbrio das batalhas.",
    category: "ÚNICA",
    condition: (stats) => stats.wins === 100 && stats.draws === 25 && stats.losses === 25,
  },
  {
    id: 317,
    title: "Guerreiro Z Supremo",
    description: "Com 500 vitórias, seu poder de luta ultrapassa 9000!",
    category: "ÚNICA",
    condition: (stats) => stats.wins >= 500,
  },
  {
    id: 318,
    title: "Senhor dos Dragões",
    description: "Participe de 700 partidas, domando a força dos Pokémon mais poderosos.",
    category: "ÚNICA",
    condition: (stats) => stats.matchesTotal >= 700,
  },  
];

// ==================================================
//  TÍTULOS - CATEGORIA: EXCLUSIVO
// ==================================================
export const titlesExclusivo: TitleItem[] = [
  {
    id: 5001,
    title: "Choice Band Lendária",
    description:
      "Nos campos de batalha Pokémon existe uma lenda silenciosa, um treinador cuja identidade pouco importa, mas cuja Choice Band é reverenciada por todos que enfrentam seu poder. Alguns dizem que a força de seus Pokémon aumenta drasticamente ao vestir essa faixa. Somente o verdadeiro portador desse legado pode ostentar este título lendário.",
    category: "EXCLUSIVO",
    condition: (stats) => stats.userId === "2289116",
    icon: "karate",
  },
  {
    id: 5002,
    title: "O Primeiro Campeão",
    description:
      "Em uma época em que as batalhas Pokémon eram apenas sonhos distantes, ele já dominava arenas e escrevia seu nome na história. Único campeão regional até hoje, seu legado não envelhece e sua glória permanece intocada pelo tempo. Este título é reservado ao lendário pioneiro cuja jornada inspira gerações.",
    category: "EXCLUSIVO",
    condition: (stats) => stats.userId === "822800",
    icon: "trophy",
  },
  {
    id: 5003,
    title: "Rei do Piratas",
    description: "Um treinador cujo domínio sobre os torneios transcende eras e gerações.",
    category: "EXCLUSIVO",
    condition: (stats) => stats.userId === "ID_DO_JOGADOR",
    icon: "crown",
  },
  {
    id: 5004,
    title: "Lenda Viva",
    description: "Sua história e feitos são contados em todas as ligas. Um verdadeiro imortal das batalhas Pokémon.",
    category: "EXCLUSIVO",
    condition: (stats) => stats.userId === "ID_DO_JOGADOR",
    icon: "sword-cross",
  },
  {
    id: 5005,
    title: "Aquele que Derrotou RED",
    description: "Entre todos os treinadores, apenas um superou o lendário RED, vencendo a batalha que parecia impossível. Seu nome inspira temor e admiração, e sua técnica impecável é considerada o ápice absoluto das batalhas Pokémon.",
    category: "EXCLUSIVO",
    condition: (stats) => stats.userId === "ID_DO_JOGADOR",
    icon: "yin-yang",
  },  
  {
    id: 5006,
    title: "Último Mestre Pokémon",
    description: "Treinador definitivo, aquele cuja técnica é referência em todas as gerações.",
    category: "EXCLUSIVO",
    condition: (stats) => stats.userId === "ID_DO_JOGADOR",
    icon: "pokeball",
  },
  {
    id: 5007,
    title: "Monarca das Sombras",
    description: "Apenas corra se ver seu gengar!.",
    category: "EXCLUSIVO",
    condition: (stats) => stats.userId === "ID_DO_JOGADOR",
    icon: "ghost",
  },
  
];


// ==================================================
// JUNTA TUDO NUM SÓ ARRAY
// ==================================================
const titles: TitleItem[] = [
  // SÉRIA
  ...titlesSeria,
  // ENGRAÇADA
  ...titlesEngracada,
  // ÚNICA
  ...titlesUnica,
  // EXCLUSIVO
  ...titlesExclusivo,
];

export default titles;

// Cores (pode manter ou alterar à vontade)
export const TITLE_COLORS: Record<TitleCategory, string> = {
  SÉRIA: "#0C7BCD",
  ENGRAÇADA: "#F5A623",
  ÚNICA: "#7F12EE",
  EXCLUSIVO: "#D4AF37", // 🔥 Dourado para destacar títulos exclusivos
};

