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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDocs, collectionGroup } from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";

interface PlayerStats {
  wins: number;
  losses: number;
  draws: number;
  matchesTotal: number;
  uniqueOpponents: number;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(false);
  const [errorLog, setErrorLog] = useState("");
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [aiMessage, setAiMessage] = useState("");
  const [generationCount, setGenerationCount] = useState(0);
  const [lastGenerationTime, setLastGenerationTime] = useState<Date | null>(
    null
  );
  const [blockGeneration, setBlockGeneration] = useState(false);

  const welcomeMessages = [
    "Olá, treinador! Pronto para evoluir suas habilidades?",
    "Bem-vindo de volta, mestre das batalhas!",
    "E aí, campeão? Vamos fortalecer esse deck ainda mais?",
    "Saudações, Treinador! Aqui é a PikachuAI!",
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

        const allMatches = await fetchAllMatches();
        const userMatches = allMatches.filter(
          (m) => m.player1_id === storedUserId || m.player2_id === storedUserId
        );

        const computedStats = computeBasicStats(storedUserId, userMatches);
        setStats(computedStats);

        generateTips(computedStats);
      } catch (err) {
        console.log("Erro ao carregar stats:", err);
        setErrorLog("Falha ao carregar estatísticas.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (generationCount >= 5) {
      Alert.alert(
        "PikachuAI diz:",
        "Ei, calma aí! Você está treinando mais que um Machamp na academia! Que tal uma pausa de 10 minutos?"
      );
      setBlockGeneration(true);

      setTimeout(() => {
        setBlockGeneration(false);
        setGenerationCount(0);
      }, 10 * 60 * 1000); // 10 minutos
    }
  }, [generationCount]);

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

    matches.forEach((match) => {
      const isPlayer1 = match.player1_id === userId;
      const opponentId = isPlayer1 ? match.player2_id : match.player1_id;
      if (opponentId && opponentId !== "N/A") uniqueOpponents.add(opponentId);

      switch (match.outcomeNumber) {
        case 1: // Player 1 win
          isPlayer1 ? wins++ : losses++;
          break;
        case 2: // Player 2 win
          isPlayer1 ? losses++ : wins++;
          break;
        case 3: // Draw
          draws++;
          break;
        case 10: // Double loss
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

  function generateTips(playerStats: PlayerStats) {
    const { wins, losses, draws } = playerStats;

    const genericMessages = [
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

    const conditionalMessages = [];
    if (wins > losses) {
      conditionalMessages.push(
        "Seu desempenho está ótimo! Considere participar de torneios onlise para testar suas habilidades.",
        "Com uma taxa de vitórias alta, você está no caminho certo para se tornar um campeão."
      );
    }
    if (losses > wins) {
      conditionalMessages.push(
        "Não desanime! Revise suas estratégias e estude o meta atual.",
        "Identifique os tipos de Pokémon que mais causam problemas e ajuste seu deck para enfrentá-los."
      );
    }
    if (draws > wins && draws > losses) {
      conditionalMessages.push(
        "Muitos empates? Talvez seja hora de ajustar sua estratégia para focar em uma vitória mais consistente.",
        "Considere cartas que forneçam um finalizador forte para evitar empates frequentes."
      );
    }

    const randomGeneric =
      genericMessages[Math.floor(Math.random() * genericMessages.length)];
    const randomConditional =
      conditionalMessages[
        Math.floor(Math.random() * conditionalMessages.length)
      ] || "Continue jogando e aprimorando suas habilidades!";

    setAiMessage(`${randomGeneric}\n\n${randomConditional}`);
  }

  function handleGenerateNewTip() {
    if (blockGeneration) {
      Alert.alert(
        "PikachuAI diz:",
        "Ei, calma aí! Você está treinando mais que um Machamp na academia! Que tal uma pausa de 10 minutos?"
      );
      return;
    }

    if (stats) {
      const now = new Date();
      if (
        lastGenerationTime &&
        now.getTime() - lastGenerationTime.getTime() < 10000
      ) {
        setGenerationCount((prev) => prev + 1);
      } else {
        setGenerationCount(1);
      }

      setLastGenerationTime(now);
      generateTips(stats);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.welcomeText}>{welcomeMessages[welcomeIndex]}</Text>

      <View style={styles.aiRow}>
        <Image
          source={require("../../assets/images/pikachu_happy.png")}
          style={styles.aiIcon}
        />
        <Text style={styles.aiName}>PikachuAI</Text>
      </View>

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
          <View style={styles.aiCard}>
            <Text style={styles.aiCardTitle}>Dicas da IA</Text>
            <Text style={styles.aiCardMessage}>{aiMessage}</Text>
          </View>
        )
      )}

      {!loading && (
        <TouchableOpacity
          style={styles.generateBtn}
          onPress={handleGenerateNewTip}
        >
          <Text style={styles.generateBtnText}>Gerar Nova Dica</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

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
    width: 50,
    height: 50,
    marginRight: 10,
    resizeMode: "contain",
  },
  aiName: {
    color: "#FFF",
    fontSize: 18,
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
    marginBottom: 8,
  },
  aiCardMessage: {
    color: "#FFF",
    fontSize: 15,
    marginBottom: 12,
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
});
