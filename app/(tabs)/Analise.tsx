// ARQUIVO: Analise.tsx
import React, { useCallback, useEffect, useState } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Animatable from "react-native-animatable";

// Importa as funções otimizadas do matchService
import { fetchAllStatsByFilter } from "../../lib/matchService";

interface PlayerStats {
  wins: number;
  losses: number;
  draws: number;
  matchesTotal: number;
  uniqueOpponents: number;
}


export default function Analise() {
  const [loading, setLoading] = useState(false);
  const [errorLog, setErrorLog] = useState("");

  // Estatísticas agregadas do jogador
  const [stats, setStats] = useState<PlayerStats | null>(null);

  // Mensagens de análise
  const [aiMessageGeneric, setAiMessageGeneric] = useState("");
  const [aiMessageTip, setAiMessageTip] = useState("");
  const [aiMessageSpecific, setAiMessageSpecific] = useState("");

  // Controle de geração (para evitar spam)
  const [generationCount, setGenerationCount] = useState(0);
  const [lastGenerationTime, setLastGenerationTime] = useState<Date | null>(null);
  const [blockGeneration, setBlockGeneration] = useState(false);

  // Modal de bloqueio de geração
  const [blockModalVisible, setBlockModalVisible] = useState(false);

  // Mensagens de boas-vindas (aleatórias)
  const welcomeMessages = [
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

  const generateAnalysis = useCallback((st: PlayerStats) => {
    const gen = getRandomGeneric();
    const tip = getRandomTip(st);
    const spec = `Você jogou um total de ${st.matchesTotal} partidas com ${st.wins} vitórias, ${st.losses} derrotas e ${st.draws} empates.`;
    setAiMessageGeneric(gen);
    setAiMessageTip(tip);
    setAiMessageSpecific(spec);
  }, [getRandomGeneric, getRandomTip]);

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
        // Obtém estatísticas agregadas do usuário usando a função otimizada
        const computedStats = await fetchAllStatsByFilter(storedUserId);
        // Converte para PlayerStats (calculando uniqueOpponents como o tamanho da lista)
        const playerStats: PlayerStats = {
          wins: computedStats.wins,
          losses: computedStats.losses,
          draws: computedStats.draws,
          matchesTotal: computedStats.matchesTotal,
          uniqueOpponents: computedStats.opponentsList.length,
        };
        setStats(playerStats);
        // Gera a análise baseada somente nas estatísticas
        generateAnalysis(playerStats);
      } catch (err) {
        console.log("Erro ao carregar estatísticas:", err);
        setErrorLog("Falha ao carregar estatísticas.");
      } finally {
        setLoading(false);
      }
    })();
  }, [generateAnalysis]);

  useEffect(() => {
    if (generationCount >= 5) {
      setBlockGeneration(true);
      setBlockModalVisible(true);
      // Desbloqueia após 10 minutos
      setTimeout(() => {
        setBlockGeneration(false);
        setGenerationCount(0);
        setBlockModalVisible(false);
      }, 10 * 60 * 1000);
    }
  }, [generationCount]);

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
      generateAnalysis(stats);
    }
  }

  function getRandomGeneric(): string {
    return welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
  }

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
    let chosen: string[] = [];
    if (st.wins > st.losses && st.wins >= 10) chosen = arrHighWins;
    else if (st.losses > st.wins && st.losses >= 10) chosen = arrHighLosses;
    else chosen = arrNeutral;
    return chosen[Math.floor(Math.random() * chosen.length)];
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Modal de bloqueio de geração */}
      <Modal
        visible={blockModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBlockModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animatable.View style={styles.modalContainer} animation="tada" duration={1200}>
            <Text style={styles.modalTitle}>PikachuIA diz:</Text>
            <Text style={styles.modalMsg}>
              Ei, calma aí! Você está gerando análises muito rápido. Dê uma pausa de 10 minutos!
            </Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setBlockModalVisible(false)}>
              <Text style={styles.closeBtnText}>Fechar</Text>
            </TouchableOpacity>
          </Animatable.View>
        </View>
      </Modal>

      <Animatable.View animation="fadeInDown" style={styles.aiRow}>
        <Image
          source={require("../../assets/images/avatar/avatar6.jpg")}
          style={styles.aiIcon}
        />
        <Text style={styles.aiName}>ScauterIA</Text>
      </Animatable.View>

      {loading && (
        <ActivityIndicator size="large" color="#E3350D" style={{ marginVertical: 10 }} />
      )}

      {errorLog ? (
        <Text style={styles.errorText}>{errorLog}</Text>
      ) : (
        stats && (
          <Animatable.View animation="fadeInUp" style={styles.aiCard}>
            <Text style={styles.aiCardTitle}>Bora Conversar</Text>
            <Text style={styles.aiCardMessage}>
              <Text style={styles.msgLabel}>Dica: </Text>
              {aiMessageGeneric}
            </Text>
            <Text style={styles.aiCardMessage}>
              <Text style={styles.msgLabel}>Analise: </Text>
              {aiMessageTip}
            </Text>
            <Text style={styles.aiCardMessage}>
              <Text style={styles.msgLabel}>Resumo: </Text>
              {aiMessageSpecific}
            </Text>
          </Animatable.View>
        )
      )}

      {!loading && (
        <TouchableOpacity style={styles.generateBtn} onPress={handleGenerateNewAnalysis}>
          <Text style={styles.generateBtnText}>Gerar Nova Análise</Text>
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
    marginBottom: 42,
    textAlign: "center",
  },
  aiRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 40, // Adicione isso para descer o ícone
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
