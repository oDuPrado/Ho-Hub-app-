import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
} from "react-native";

import { getDocs, collectionGroup, doc, getDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "../../lib/firebaseConfig";
import * as Animatable from "react-native-animatable";

interface PlayerStats {
  wins: number;
  losses: number;
  draws: number;
  matchesTotal: number;
  uniqueOpponents: number;
}

interface RivalData {
  rivalId: string;
  rivalName: string;
  matches: number;
}

export default function PikachuIA() {
  const [loading, setLoading] = useState(false);
  const [errorLog, setErrorLog] = useState("");

  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [aiMessageGeneric, setAiMessageGeneric] = useState("");
  const [aiMessageTip, setAiMessageTip] = useState("");
  const [aiMessageSpecific, setAiMessageSpecific] = useState("");
  
  // Bloqueio de geração
  const [generationCount, setGenerationCount] = useState(0);
  const [lastGenerationTime, setLastGenerationTime] = useState<Date | null>(null);
  const [blockGeneration, setBlockGeneration] = useState(false);

  // Rival
  const [rivalName, setRivalName] = useState<string>("nenhum");
  // Títulos e Clássicos
  const [titlesUnlocked, setTitlesUnlocked] = useState<number>(0);
  const [classicsCount, setClassicsCount] = useState<number>(0);

  // Modal Bloqueio
  const [blockModalVisible, setBlockModalVisible] = useState(false);

  const welcomeMessages = [
    "E aí, treinador! Pronto pra uma análise que vai te fazer repensar todas as suas escolhas de vida... digo, de deck?",
    "Opa, chegou o momento de dissecar esse seu baralho! Prometo ser gentil... mais ou menos.",
    "Fala, mestre Pokémon! Ou seria aprendiz? Deixa eu dar uma olhada nesse deck pra gente descobrir.",
    "Eita, olha quem voltou! Vamos ver se esse deck evoluiu ou se ainda tá no nível de um Magikarp.",
    "Salve, treinador! Pronto pra uma dose de realidade com um toque de carinho Campo-grandense?",
    "Ah, você de novo! Vamos ver se esse deck tá mais apimentado que um churrasco de domingo.",
    "Opa, opa! Chegou a hora da verdade. Seu deck tá mais organizado que a sua vida ou vice-versa?",
    "E aí, parceiro! Bora dar aquela analisada marota no seu deck? Prometo só 10% de zoeira.",
    "Fala, treinador! Pronto pra uma análise mais sincera que conversa de bar depois da terceira rodada?",
    "Opa, chegou a hora do 'sincericídio'! Seu deck tá precisando de uns conselhos à la Marco.",
    "E aí, meu chapa! Vamos ver se esse seu deck tá mais afiado que faca de churrasco ou se tá mais pra colher de plástico?",
    "Salve, salve! Pronto pra uma análise mais detalhada que cardápio de rodízio?",
    "Fala, treinador! Vamos desvendar os mistérios do seu deck ou prefere continuar na ilusão?",
    "Opa, voltou pra mais? Teu deck deve tá mais desesperado que eu procurando sombra no Parque das Nações Indígenas!",
    "E aí, meu consagrado! Bora dar aquela analisada básica no seu deck? Prometo ser mais leve que torta de maçã da vovó... ou não."
  ];
  
  const [welcomeIndex] = useState(
    Math.floor(Math.random() * welcomeMessages.length)
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        
        const storedUserId = await AsyncStorage.getItem("@userId");
        if (!storedUserId) {
          Alert.alert("Erro", "Não foi possível obter ID do jogador.");
          setLoading(false);
          return;
        }

        // Buscar todas as partidas
        const allMatches = await fetchAllMatches();
        const userMatches = allMatches.filter(
          (m) => m.player1_id === storedUserId || m.player2_id === storedUserId
        );

        // Calcular stats
        const computedStats = computeBasicStats(storedUserId, userMatches);
        setStats(computedStats);

        // Buscar maior Rival
        const biggestRival = await fetchBiggestRival(storedUserId, userMatches);
        if (biggestRival) setRivalName(biggestRival.rivalName);

        // Buscar títulos e clássicos (simulação)
        const fetchedTitles = await fetchTitlesUnlocked(storedUserId);
        setTitlesUnlocked(fetchedTitles);

        const fetchedClassics = await fetchClassicsCount(storedUserId);
        setClassicsCount(fetchedClassics);

        // Gera a primeira análise
        generateAllParts(computedStats, biggestRival, fetchedTitles, fetchedClassics);
      } catch (err) {
        console.log("Erro ao carregar stats:", err);
        setErrorLog("Falha ao carregar estatísticas.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Observa se atingiu 5 gerações e bloqueia
  useEffect(() => {
    if (generationCount >= 5) {
      setBlockGeneration(true);
      setBlockModalVisible(true);
      // Desbloqueia depois de 10min
      setTimeout(() => {
        setBlockGeneration(false);
        setGenerationCount(0);
        setBlockModalVisible(false);
      }, 10 * 60 * 1000);
    }
  }, [generationCount]);

  // Gera Nova Análise
  function handleGenerateNewAnalysis() {
    if (blockGeneration) {
      setBlockModalVisible(true);
      return;
    }
    if (stats) {
      const now = new Date();
      if (lastGenerationTime && now.getTime() - lastGenerationTime.getTime() < 10000) {
        setGenerationCount((prev) => prev + 1);
      } else {
        setGenerationCount(1);
      }
      setLastGenerationTime(now);
      generateAllParts(stats, { rivalId: "", rivalName, matches: 0 }, titlesUnlocked, classicsCount);
    }
  }

  // -------------- FUNÇÕES DE BUSCA --------------
  async function fetchAllMatches() {
    const snap = await getDocs(collectionGroup(db, "matches"));
    const matches: any[] = [];
    snap.forEach((docSnap) => {
      matches.push(docSnap.data());
    });
    return matches;
  }

  function computeBasicStats(userId: string, matches: any[]): PlayerStats {
    let wins = 0,
      losses = 0,
      draws = 0;
    const uniqueOpponents = new Set<string>();

    matches.forEach((m) => {
      const isP1 = m.player1_id === userId;
      const oppId = isP1 ? m.player2_id : m.player1_id;
      if (oppId && oppId !== "N/A") uniqueOpponents.add(oppId);

      switch (m.outcomeNumber) {
        case 1:
          isP1 ? wins++ : losses++;
          break;
        case 2:
          isP1 ? losses++ : wins++;
          break;
        case 3:
          draws++;
          break;
        case 10:
          losses++;
          break;
      }
    });

    return {
      wins,
      losses,
      draws,
      matchesTotal: matches.length,
      uniqueOpponents: uniqueOpponents.size,
    };
  }

  async function fetchBiggestRival(userId: string, matches: any[]): Promise<RivalData | null> {
    let mapRivals: Record<string, number> = {};

    matches.forEach((m: any) => {
      const isP1 = m.player1_id === userId;
      const rid = isP1 ? m.player2_id : m.player1_id;
      if (!rid) return;
      if (!mapRivals[rid]) mapRivals[rid] = 0;
      mapRivals[rid]++;
    });

    let topId = "";
    let topCount = 0;
    Object.keys(mapRivals).forEach((r) => {
      if (mapRivals[r] > topCount) {
        topCount = mapRivals[r];
        topId = r;
      }
    });
    if (!topId) return null;

    // Buscar nome no Firestore
    try {
      const docRef = doc(db, "players", topId);
      const snap = await getDoc(docRef);
      let rName = `User ${topId}`;
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.fullname) rName = data.fullname;
      }
      return {
        rivalId: topId,
        rivalName: rName,
        matches: topCount,
      };
    } catch (err) {
      return {
        rivalId: topId,
        rivalName: `User ${topId}`,
        matches: topCount,
      };
    }
  }

  // Exemplo: Buscar títulos desbloqueados
  async function fetchTitlesUnlocked(userId: string): Promise<number> {
    // Lógica fictícia
    // Retorna quantos títulos esse user tem
    // Exemplo: 4
    return 4;
  }

  // Exemplo: Buscar quantos clássicos
  async function fetchClassicsCount(userId: string): Promise<number> {
    // Lógica fictícia
    // Exemplo: 2
    return 2;
  }

  // -------------- GERA FRASES --------------
  function generateAllParts(
    st: PlayerStats,
    rival: RivalData | null,
    userTitles: number,
    userClassics: number
  ) {
    // 1) Mensagem Genérica
    const gen = getRandomGeneric();

    // 2) Dicas/Conselhos (depende de vitórias/derrotas)
    const tip = getRandomTip(st);

    // 3) Análise Específica (rival, títulos, clássicos)
    const spec = getSpecificAnalysis(st, rival, userTitles, userClassics);

    setAiMessageGeneric(gen);
    setAiMessageTip(tip);
    setAiMessageSpecific(spec);
  }

  // Mensagem genérica (debochada)
  function getRandomGeneric(): string {
    const arr = [
      "Lembre-se: cada carta no seu deck tem um propósito. Conheça-as bem!",
      "A prática leva à perfeição. Continue treinando suas estratégias!",
      "Estude o meta atual para adaptar seu deck às tendências.",
      "A paciência é uma virtude. Espere o momento certo para jogar aquela carta decisiva.",
      "Conheça não apenas suas cartas, mas também as possíveis jogadas do oponente.",
      "Nunca subestime um treinador com um Pikachu no banco. Pequenos começos podem ter finais elétricos!",
      "As cartas de energia são a base de qualquer deck. Garanta que o equilíbrio esteja certo!",
      "Seja como o Ash: nunca desista, mesmo quando parece que a partida está perdida.",
      "Pokémon do tipo Psíquico, como a Gardevoir Ex,podem ser imprevisíveis. Use habilidades como a da Kirlia para controlar o campo.",
      "Escolha um Pokémon inicial que complemente bem seu deck. Consistência é tudo!",
      "Cartas de suporte, como 'Professor's Research', podem salvar seu turno. Não as desperdice!",
      "Um treinador sábio nunca revela sua estratégia cedo demais.",
      "Os Pokémon EX e V podem ser fortes, mas são alvos fáceis para perder dois prêmios. Planeje com cuidado.",
      "Domine as cartas de busca, como 'Nest Ball' ou 'Ultra Ball', para garantir que você encontre suas peças essenciais.",
      "Se você tiver mimikyu no seu deck, lembre-se: ele não toma dano de pokemons EX e V!",
      "Construa seu deck com sinergia. Selecione cartas que funcionem bem juntas, como Chienpao Ex e baxcalibur .",
      "Siga a filosofia de Red: treine duro, jogue com determinação, e confie no seu instinto.",
      "Pokémon do EX, como Charizard, têm danos altos, mas cuidado para não esgotar suas energias.",
      "Não se esqueça de incluir cartas para lidar com decks de spread, como ataques que atingem múltiplos Pokémon.",
      "Assim como Misty confia no seu Starmie, confie no seu Pokémon atacante para liderar a batalha.",
      "Mantenha uma mão equilibrada: cartas demais podem levar ao descarte forçado ou uma Iono; cartas de menos, à inatividade.",
      "Pokémon do tipo Escuridão, como Pecharunt ex, podem surpreender o oponente. Use táticas imprevisíveis!",
      "Itens como 'Switch' podem salvar seu Pokémon de um nocaute iminente. Considere sempre ter um no deck.",
      "Planeje cada turno como se fosse o último. A previsibilidade é a maior fraqueza de um treinador.",
      "Decks baseados em Dragões podem ser poderosos, mas lembre-se: eles exigem energia mista.",
      "A habilidade de Gardevoir pode energizar pokemons psiquicos com energias do descarte. Use isso para virar partidas aparentemente perdidas.",
      "Lembre-se Pokemon e um jogo sobre recursos, administrar bem os seus!.",
      "Seja paciente como um Snorlax: às vezes, esperar o turno certo pode decidir a partida.",
      "Assim como o Brock conhece os tipos de pedra, conheça bem suas cartas de treinador para maximizar seus efeitos.",
      "Decks de tipo Água, como o de Chienpao EX, podem dar nocautes em um turno. Aproveite isso contra decks que tem apenas um atacante!",
      "Nunca subestime o impacto de cartas de ferramentas. Um 'Choice Belt' pode ser a diferença entre vitória e derrota.",
      "Pokémon EX ainda podem competir. Não descarte opções clássicas como Charizard Ex.",
      "Prepare-se para o inesperado. Como no anime, às vezes o adversário pode trazer estratégias criativas!",
      "Pesquise como os decks de controle funcionam. Eles podem ser frustrantes, mas dominar esse estilo é um diferencial.",
      "Seja como um treinador experiente: aprenda a contar cartas no deck e prever as chances do próximo saque.",
      "Decks do tipo Metal, como os de Archaludon EX, são resistentes. Use-os para combater ataques agressivos.",
      "Lembre-se de que o meta muda. Estude as cartas mais usadas e prepare respostas para elas.",
      "Pokémon do tipo Elétrico, como Miraidon EX, são rápidos, mas vulneráveis a pokemons com muita vida!.",
      "Inclua cartas que ajudem a reciclar energias ou Pokémon, como 'Super Rod'. Elas podem salvar seu jogo.",
      "Zoroark EX vai ser ainda é um dos melhores Pokémon de troca rápida. Pode anotar",
      "O cenário competitivo é como a Liga Pokémon: só os mais preparados chegam ao topo.",
      "Habilidades como a de Ogerpon Mascara Alicerce EX, que ignora dano de Pokémon com habilidades, podem ser muito úteis contra decks pesados.",
      "Treine combos simples antes de tentar jogadas complexas. O básico bem feito é muitas vezes o suficiente.",
      "Pokémon do tipo Planta podem ser subestimados. Toedscruell tem habilidades que podem virar o jogo.",
      "Estude as fraquezas e resistências dos Pokémon mais usados no meta. Explorar fraquezas pode facilitar vitórias.",
      "Sempre pense dois passos à frente. O que você faz agora pode afetar os próximos turnos.",
      "Cartas de estádio, como 'Estadio Desmoranado', podem desestabilizar completamente a estratégia do oponente.",
      "Decks de batalha rápida, como os de Fogo Corrosão, são ótimos para pressionar o adversário desde o início.",
      "Aprenda com suas derrotas. Cada partida perdida é uma oportunidade de ajustar seu deck e melhorar.",
      "Lembre-se de incluir um equilíbrio entre atacantes principais e suporte. Não dependa de um único Pokémon.",
      "O jogo pode ser comparado a um duelo entre Ash e Paul: agressão contra estratégia. Escolha o seu estilo.",
      "Um baralho focado em defesa, como o de noivern ex, pode frustrar adversários agressivos. Experimente essa abordagem.",
      "Cartas de reciclagem, como 'Maca Noturna', são cruciais em jogos longos.",
      "Decks de Regidrago Vstar ainda dominam em 2025. Aprenda como enfrentá-los ou usá-los a seu favor.",
      "Pokémon do tipo Dragão, como Dragapult EX, têm ataques únicas. Experimente decks com estratégias de espalhamento.",
      "Seja criativo com seu deck. Estratégias inesperadas podem pegar adversários desprevenidos!",
      "Itens como 'Aspirador' podem destruir equipamentos cruciais do adversário. Considere sempre tenha um à disposição.",
      "Decks de um prize, como os de ancient box , são subestimados. Eles podem salvar partidas inteiras.",
      "Pratique estratégias com amigos para simular cenários competitivos.",
      "O ataque do Greninja pode remover ameaças da bancada adversária. Use isso a seu favor!",
      "Pesquise torneios locais ou online para testar seu deck no cenário competitivo.",
      "Os melhores treinadores sabem quando recuar. Não tenha medo de trocar seu Pokémon ativo no momento certo.",
      "Seja como Cynthia: analise a situação antes de cada jogada, sem pressa, mas com precisão.",
      "Decks híbridos, que combinam tipos, podem surpreender adversários que não estão preparados para múltiplas ameaças.",
      "Estude a lista dos vencedores de torneios. Eles são exemplos claros do que funciona no meta atual.",
      "Lembre-se: a Liga Pokémon não é conquistada em um dia. Treine, ajuste e continue competindo!",
    ];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Dica: baseia-se em vitórias e derrotas
  function getRandomTip(st: PlayerStats): string {
    const arrHighWins = [
      "Seus números de vitória são impressionantes! Que tal se arriscar em torneios oficiais? 🏆",
      "Se tá ganhando tanto, tenta um deck mais ousado pra surpreender geral. 🎭",
      "Vi que você tem muitas vitórias. Já pensou em virar coach? 😂",
      "Opa, temos um Campeão da Liga aqui! Cuidado pra não tropeçar nas suas medalhas. 🥇",
      "Tá arrasando mais que um Charizard em uma floresta de Grass! 🔥",
      "Com tantas vitórias, já pode abrir seu próprio ginásio, hein? 🏋️‍♂️",
      "Eita, parece que alguém andou pegando umas Master Balls emprestadas! 🎳",
      "Tá ganhando tanto que até o Team Rocket tá com inveja. 🚀",
      "Se continuar assim, vai ter que construir uma nova prateleira só pra troféus! 🏆🏆🏆",
      "Seus oponentes devem estar mais assustados que um Caterpie enfrentando um Pidgeot! 😱",
      "Tá mais imparável que um Snorlax rolando morro abaixo! 🐻",
      "Com esse histórico, até o Red ficaria verde de inveja! 💚",
      "Suas vitórias são mais frequentes que encontros com Zubat em uma caverna! 🦇",
      "Tá mais eficiente que uma Poké Ball customizada! Qual é o seu segredo? 🤔",
      "Se suas vitórias fossem Rare Candies, seu Pokémon já seria nível 100! 🍬",
      "Parece que você encontrou a Pedra da Vitória. Cuidado pra não evoluir demais! 💎",
      "Tá mais invencível que um Magikarp... ops, quer dizer, um Gyarados Shiny! ✨",
      "Se vitórias fossem Pokémoedas, você já teria comprado a loja inteira! 💰"
    ];
    
    const arrHighLosses = [
      "Tá apanhando mais que um Magikarp fora d'água? Bora ajustar esse deck! 🐟",
      "Mais derrotas do que vitórias... Revirar o cemitério do baralho pode te salvar! 🔮",
      "Não desiste, hein? Uma hora vai, Ho-IA confia (mais ou menos). 😜",
      "Tá perdendo tanto que até o Team Rocket tá com pena. Que tal mudar de estratégia? 🚀",
      "Seu deck tá mais fraco que um Metapod usando Endurecer. Bora evoluir isso aí! 🦋",
      "Tantas derrotas que você já pode abrir um centro Pokémon só pra você! 🏥",
      "Tá mais perdido que um Psyduck com enxaqueca. Que tal rever suas táticas? 🦆",
      "Seu histórico tá mais sombrio que uma floresta cheia de Gastly. Hora de iluminar esse caminho! 👻",
      "Tá levando mais knockouts que um Snorlax numa maratona. Acorda pra vida, treinador! 💤",
      "Suas derrotas tão se acumulando mais rápido que Magnemites num ímã gigante. Hora de inverter essa polaridade! 🧲",
      "Tá mais fácil um Gyarados aprender a voar do que você ganhar uma partida. Vamos mudar isso! 🐉",
      "Seu deck tá com menos energia que um Pikachu sem pilhas. Que tal recarregar essa estratégia? 🔋",
      "Tá perdendo tanto que até um Ditto teria vergonha de te imitar. Bora dar a volta por cima! 🟣",
      "Suas chances de vitória tão menores que um Joltik. Hora de crescer, treinador! 🕷️",
      "Tá mais derrotado que um Charizard numa piscina. Vamos sair dessa água fria! 🔥"
    ];
    
    const arrDraws = [
      "Empate é igual a ficar em cima do muro. Decide logo quem é melhor nessa briga! 🤼",
      "Muitos empates? Falta um golpe final estilo 'Choque do Trovão' no deck! ⚡",
      "Tá empatando mais que Snorlax bloqueando uma passagem. Hora de acordar e dominar! 💤",
      "Empate é tipo Ditto: não sabe se transforma ou fica na forma original. Escolhe um lado! 🟣",
      "Teus jogos tão mais equilibrados que Libra na balança. Que tal desempatar isso? ⚖️",
      "Empatou de novo? Teu deck tá mais indeciso que um Eevee escolhendo evolução! 🦊",
      "Tá empatando tanto que até o Team Rocket tá confuso se ganha ou perde! 🚀",
      "Empate é bom em cabo de guerra, não em Pokémon TCG. Puxa mais forte! 💪",
      "Teus jogos tão mais empatados que nó de marinheiro. Hora de desatar essa confusão! 🪢",
      "Empate é tipo Splash do Magikarp: não faz nada. Bora evoluir pra Gyarados! 🐉",
      "Tá empatando mais que Metapod vs Metapod. Cadê o Butterfree pra resolver isso? 🦋",
      "Empate é que nem Pokébola vazia: não pega nada. Mira melhor na vitória! 🎯",
      "Teus jogos tão mais empatados que batalha de Wobbuffet. Alguém tem que ceder! 🪞",
      "Empate é tipo Poké-bolsa sem itens. Hora de encher de vitórias! 🎒",
      "Tá mais indeciso que Psyduck com dor de cabeça. Escolhe logo: vitória ou derrota! 🦆"
    ];
    
    const arrNeutral = [
      "Ser mediano não é crime, mas dá pra melhorar, vai? 😆",
      "Tá caminhando direitinho, mas ainda dá pra evoluir. Pensa na Misty: sempre dá pra ficar mais forte!",
      "Não tá ruim, mas pode ficar melhor. Bora? 🚀",
      "Teu desempenho tá mais morno que Tepig. Que tal esquentar as coisas? 🔥",
      "Tá jogando na média? Lembra que até Pikachu já foi level 5. Hora de upar! ⚡",
      "Nem quente nem frio, tá tipo Deerling no outono. Que tal mudar de estação? 🍂",
      "Teu jogo tá mais neutro que um Voltorb confuso. Positivo ou negativo, escolhe um! 🔴",
      "Mediano é apelido do meio da Pokédex. Mira mais alto, tipo Mewtwo! 🧬",
      "Tá mais indeciso que Porygon entre evoluir pra 2 ou Z. Escolhe um rumo! 💾",
      "Nem Gyarados, nem Magikarp. Tá na hora de decidir se evolui ou volta pro lago! 🌊",
      "Teu deck tá mais equilibrado que Zangoose e Seviper. Só que eles são inimigos, tá? 😅",
      "Jogando na média? Até Ash demorou pra ser campeão, mas ele chegou lá! 🏆",
      "Tá mais no meio que Unown na palavra. Hora de se destacar! 🔠",
      "Nem Groudon, nem Kyogre. Tá na hora de chamar o Rayquaza e resolver esse impasse! ☯️",
      "Teu jogo tá mais neutro que a expressão de um Sudowoodo. Mostra emoção! 🌳"
    ];
    

    // checa as estatísticas
    let chosen = [];
    if (st.wins > st.losses && st.wins >= 10) chosen = arrHighWins;
    else if (st.losses > st.wins && st.losses >= 10) chosen = arrHighLosses;
    else if (st.draws > st.wins && st.draws > st.losses) chosen = arrDraws;
    else chosen = arrNeutral;

    return chosen[Math.floor(Math.random() * chosen.length)];
  }

  // Análise específica do Rival, Títulos, Clássicos
  function getSpecificAnalysis(
    st: PlayerStats,
    rival: RivalData | null,
    userTitles: number,
    userClassics: number
  ): string {
    let msgRival = "Sem rival detectado no momento... Quanta solidão!";
    if (rival && rival.rivalName) {
      msgRival = `Seu rival mais frequente é ${rival.rivalName}, com ${rival.matches} partidas épicas!`;
    }

    const msgTitles = userTitles > 0
  ? [
    `E olha, você já conquistou ${userTitles} títulos. Só cuidado pra não deixar subir à cabeça!`,
    `Uau, ${userTitles} títulos? Tá querendo virar o Lance da vida real, é?`,
    `${userTitles} títulos? Impressionante! Mas lembra que até o Ash demorou pra ser campeão.`,
    `Com ${userTitles} títulos, você tá mais estrelado que um Clefairy usando Metronome!`,
    `${userTitles} títulos? Tá colecionando mais que o Professor Carvalho coleciona Pokémon!`,
    `Olha só, ${userTitles} títulos! Tá querendo abrir seu próprio ginásio, é?`,
    `${userTitles} títulos? Tá mais vitorioso que um Magikarp evoluindo pra Gyarados!`,
    `Com ${userTitles} títulos, você tá mais brilhante que um Pokémon shiny!`,
    `${userTitles} títulos? Tá mais famoso que o Team Rocket (e provavelmente mais bem-sucedido)!`,
    `Uau, ${userTitles} títulos! Tá mais ocupado que um Nurse Joy em dia de torneio!`,
    `${userTitles} títulos? Tá mais valioso que uma carta Charizard de primeira edição!`,
    `Com ${userTitles} títulos, você tá mais raro que um Mewtwo selvagem!`,
    `${userTitles} títulos? Tá mais imponente que um Onix usando Rock Slide!`,
    `Olha só, ${userTitles} títulos! Tá mais versátil que um Ditto em convenção de Pokémon!`,
    `${userTitles} títulos? Tá mais poderoso que um Pikachu com Light Ball!`,
    `Com ${userTitles} títulos, você tá mais respeitado que um Dragonite entre os dragões!`
  ][Math.floor(Math.random() * 16)]
  : [
    "Ainda não tem nenhum título? Pika-chateado, mas calma, tudo é treino!",
    "Zero títulos? Tá mais zerado que a Pokédex do Ash no começo da jornada!",
    "Sem títulos ainda? Tá mais atrasado que um Slowpoke pensando!",
    "Nenhum título? Tá mais vazio que uma Ultra Ball sem Pokémon!",
    "Títulos? Que títulos? Tá mais perdido que um Psyduck com dor de cabeça!",
    "Cadê os títulos? Sumiram mais rápido que um Abra usando Teleport!",
    "Sem títulos? Tá mais parado que um Snorlax bloqueando o caminho!",
    "Títulos zerados? Tá mais no início que um Charmander recém-nascido!",
    "Nenhum título ainda? Tá evoluindo mais devagar que um Metapod só usando Harden!",
    "Títulos? Acho que um Gastly pegou todos, porque não tô vendo nenhum!",
    "Zero títulos? Tá mais frio que um Articuno em uma tempestade de neve!",
    "Sem títulos? Tá mais confuso que um Spinda depois de usar Teeter Dance!",
    "Nenhum título? Tá mais vazio que o estômago de um Snorlax em dieta!",
    "Títulos? Que títulos? Tá mais invisível que um Kecleon usando camuflagem!",
    "Sem títulos ainda? Tá mais lento que uma corrida de Shuckle!",
    "Nenhum título? Tá mais no começo que um treinador escolhendo seu primeiro Pokémon!"
  ][Math.floor(Math.random() * 16)];

const msgClassics = userClassics > 0
  ? [
    `Além disso, você tem ${userClassics} clássicos ativos. Adoro uma rivalidade acirrada!`,
    `${userClassics} clássicos? Tá mais competitivo que Ash vs Gary!`,
    `Uau, ${userClassics} clássicos em andamento! Tá pegando fogo que nem a cauda de um Charizard!`,
    `Com ${userClassics} clássicos, você tá mais ocupado que um Chansey no Centro Pokémon!`,
    `${userClassics} clássicos ativos? Tá mais elétrico que um Pikachu com sobrecarga!`,
    `Olha só, ${userClassics} clássicos! Tá mais intenso que uma batalha de lendários!`,
    `${userClassics} clássicos? Tá mais agitado que um Mankey usando Thrash!`,
    `Com ${userClassics} clássicos, você tá mais disputado que uma Master Ball no mercado negro!`,
    `${userClassics} clássicos ativos? Tá mais movimentado que Vermilion City em dia de torneio!`,
    `Uau, ${userClassics} clássicos! Tá mais acelerado que um Ninjask usando Speed Boost!`,
    `${userClassics} clássicos? Tá mais famoso que o Professor Carvalho em Pallet Town!`,
    `Com ${userClassics} clássicos, você tá mais ocupado que um Ditto em dia de breeding!`,
    `${userClassics} clássicos ativos? Tá mais agitado que um Electrode prestes a explodir!`,
    `Olha só, ${userClassics} clássicos! Tá mais disputado que um Mewtwo em raid!`,
    `${userClassics} clássicos? Tá mais movimentado que uma Pokémart em promoção de Poké Balls!`,
    `Com ${userClassics} clássicos, você tá mais popular que um Eevee em convenção de evolução!`
  ][Math.floor(Math.random() * 16)]
  : [
    "Sem clássicos? Cadê a emoção dessa liga? Bora encontrar um rival de verdade!",
    "Nenhum clássico? Tá mais parado que um Metapod usando Harden!",
    "Zero clássicos? Tá mais solitário que um Cubone sem sua mãe!",
    "Sem clássicos ativos? Tá mais vazio que uma Pokébola usada!",
    "Nenhum clássico? Tá mais esquecido que um Trubbish no depósito!",
    "Cadê os clássicos? Sumiram mais rápido que um Diglett entrando na terra!",
    "Sem rivalidades clássicas? Tá mais monótono que um Magikarp só usando Splash!",
    "Nenhum clássico ativo? Tá mais parado que um Sudowoodo se fingindo de árvore!",
    "Zero clássicos? Tá mais sozinho que um Mimikyu sem fantasia!",
    "Sem clássicos? Tá mais entediante que uma batalha entre dois Metapod!",
    "Nenhuma rivalidade clássica? Tá mais pacífico que um Togepi recém-nascido!",
    "Cadê os clássicos? Tão mais perdidos que um Zubat sem ecolocalização!",
    "Sem clássicos ativos? Tá mais quieto que um Whismur com laringite!",
    "Nenhum clássico? Tá mais esquecido que um Unown no alfabeto Pokémon!",
    "Zero rivalidades épicas? Tá mais parado que um Slakoth em dia de preguiça!",
    "Sem clássicos? Tá mais solitário que um Wailord em uma Pokébola!"
  ][Math.floor(Math.random() * 16)];

return `${msgRival}\n${msgTitles}\n${msgClassics}`;

  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* MODAL BLOQUEIO */}
      <Modal
        visible={blockModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBlockModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animatable.View
            style={styles.modalContainer}
            animation="tada"
            duration={1200}
          >
            <Text style={styles.modalTitle}>PikachuIA diz:</Text>
            <Text style={styles.modalMsg}>
              Ei, calma aí! Você tá treinando mais que um Machamp na academia! Bora dar uma pausa de 10 minutos?
            </Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setBlockModalVisible(false)}
            >
              <Text style={styles.closeBtnText}>Fechar</Text>
            </TouchableOpacity>
          </Animatable.View>
        </View>
      </Modal>

      <Animatable.Text
        animation="bounceIn"
        style={styles.welcomeText}
      >
        {welcomeMessages[welcomeIndex]}
      </Animatable.Text>

      {/* Pikachu IA Info */}
      <Animatable.View
        animation="fadeInDown"
        style={styles.aiRow}
      >
        <Image
          source={require("../../assets/images/avatar/avatar6.jpg")}
          style={styles.aiIcon}
        />
        <Text style={styles.aiName}>ScauterIA</Text>
      </Animatable.View>

      {loading && (
        <ActivityIndicator
          size="large"
          color="#E3350D"
          style={{ marginVertical: 10 }}
        />
      )}

      {errorLog ? (
        <Text style={styles.errorText}>{errorLog}</Text>
      ) : (
        stats && (
          <Animatable.View
            animation="fadeInUp"
            style={styles.aiCard}
          >
            <Text style={styles.aiCardTitle}>Bora Conversar</Text>

            {/* Mensagem Genérica */}
            <Text style={styles.aiCardMessage}>
              <Text style={styles.msgLabel}>Dica: </Text>
              {aiMessageGeneric}
            </Text>

            {/* Mensagem Tip */}
            <Text style={styles.aiCardMessage}>
              <Text style={styles.msgLabel}>Analise: </Text>
              {aiMessageTip}
            </Text>

            {/* Mensagem Específica */}
            <Text style={styles.aiCardMessage}>
              <Text style={styles.msgLabel}>Só para você:: </Text>
              {aiMessageSpecific}
            </Text>
          </Animatable.View>
        )
      )}

      {!loading && (
        <TouchableOpacity
          style={styles.generateBtn}
          onPress={handleGenerateNewAnalysis}
        >
          <Text style={styles.generateBtnText}>Gerar Nova Análise</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ---------- ESTILOS ----------
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#1E1E1E",
    padding: 20,
    alignItems: "center",
  },
  welcomeText: {
    color: "#FFD700",
    fontSize: 18,
    fontStyle: "italic",
    marginBottom: 16,
    textAlign: "center",
  },
  aiRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  aiIcon: {
    width: 60,
    height: 60,
    marginRight: 10,
    resizeMode: "contain",
  },
  aiName: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  aiCard: {
    backgroundColor: "#292929",
    borderRadius: 8,
    padding: 16,
    marginVertical: 10,
    width: "100%",
    borderWidth: 1,
    borderColor: "#4D4D4D",
  },
  aiCardTitle: {
    color: "#E3350D",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  aiCardMessage: {
    color: "#FFF",
    fontSize: 15,
    marginBottom: 12,
    lineHeight: 20,
  },
  msgLabel: {
    fontWeight: "bold",
    color: "#E3350D",
  },
  generateBtn: {
    backgroundColor: "#E3350D",
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  generateBtnText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 15,
  },
  errorText: {
    color: "red",
    marginVertical: 10,
    textAlign: "center",
  },
  // Modal Bloqueio
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#2A2A2A",
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: "#555",
    width: "80%",
  },
  modalTitle: {
    color: "#E3350D",
    fontWeight: "bold",
    fontSize: 18,
    marginBottom: 10,
    textAlign: "center",
  },
  modalMsg: {
    color: "#FFF",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 15,
  },
  closeBtn: {
    backgroundColor: "#E3350D",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: "center",
  },
  closeBtnText: {
    color: "#FFF",
    fontWeight: "bold",
  },
});
