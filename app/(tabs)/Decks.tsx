import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
  Image,
} from "react-native";
import {
  collection,
  query,
  onSnapshot,
  doc,
  getDoc,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Animatable from "react-native-animatable";
import { Ionicons } from "@expo/vector-icons";
import moment from "moment";
import "moment/locale/pt-br";
import { db } from "../../lib/firebaseConfig";
import { MaterialCommunityIcons } from "@expo/vector-icons";


/**
 * Tipagem das linhas de cartas.
 */
interface CardLine {
  incrementalId: number;
  quantity: number;
  name: string;
  expansion?: string | null;
  cardNumber?: string | null;
}

/**
 * Tipagem do Deck.
 */
interface DeckData {
  id: string;
  ownerUid: string;
  ownerName: string;
  leagueId: string;
  name: string;
  createdAt: string;
  pokemons: CardLine[];
  trainers: CardLine[];
  energies: CardLine[];
  style?: string[];
  archetype?: string | null;
}

/**
 * Formato usado no Firestore para cada carta.
 */
interface FirestoreCard {
  quantity: number;
  name: string;
  expansion?: string | null;
  cardNumber?: string | null;
}

/**
 * Para armazenar o mapeamento ptcgoCode -> setId
 */
interface SetIdMap {
  [code: string]: string;
}

/**
 * Componente Principal: DecksScreen
 */
export default function DecksScreen() {
  moment.locale("pt-br");

  const [playerId, setPlayerId] = useState("");
  const [playerName, setPlayerName] = useState("Jogador");
  const [leagueId, setLeagueId] = useState("");

  // Lista de decks
  const [decks, setDecks] = useState<DeckData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  // Modal de criação de deck
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckContent, setNewDeckContent] = useState("");
  const [newStyles, setNewStyles] = useState<string[]>([]);
  const [newArchetype, setNewArchetype] = useState<string | null>(null);

  // Modal de visualizar deck
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewDeck, setViewDeck] = useState<DeckData | null>(null);
  const [deckViewMode, setDeckViewMode] = useState<"table" | "mosaic">("table");

  // Estados auxiliares de parse (criando deck) e imagem
  const [parsing, setParsing] = useState(false);
  const [setIdMap, setSetIdMap] = useState<SetIdMap>({});
  const [deckCards, setDeckCards] = useState<
    {
      category: string;
      quantity: number;
      name: string;
      expansion?: string;
      cardNumber?: string;
    }[]
  >([]);
  const [cardImages, setCardImages] = useState<Record<string, string>>({});
  const [loadingImages, setLoadingImages] = useState(false);

  /** Opções de Estilo + Ícones */
const STYLE_OPTIONS = [
  "controle",
  "aggro",
  "1 prize",
  "estagio 2",
  "meme",
  "vozes da minha cabeça",
];
const STYLE_ICONS: Record<string, string> = {
  "controle": "shield-check",
  "aggro": "sword-cross",
  "1 prize": "numeric-1-circle",
  "estagio 2": "numeric-2-circle",
  "meme": "emoticon-poop",
  "vozes da minha cabeça": "brain",
};

  /** Opções de Arquétipo */
const ARCHETYPE_OPTIONS = [
  "Regidrago VSTAR",
  "Charizard ex",
  "Lugia Archeops",
  "Gardevoir ex",
  "Raging Bolt ex",
  "Terapagos ex",
  "Klawf Unhinged Scissors",
  "Dragapult ex",
  "Snorlax Stall PGO",
  "Palkia VSTAR",
  "Archaludon ex",
  "Gholdengo ex",
  "Roaring Moon ex",
  "Lost Zone Box",
  "Miraidon ex",
  "Iron Thorns ex",
  "Ancient Box",
  "Pidgeot Control",
  "Cornerstone Ogerpon",
  "Gouging Fire ex",
  "Ceruledge ex",
  "Banette ex",
  "Chien-Pao Baxcalibur",
  "Greninja ex",
  "Regis Ancient Wisdom",
  "Hydreigon ex",
  "Conkeldurr Gusty Swing",
  "Entei V",
  "Giratina VSTAR",
  "Arceus VSTAR",
  "Dialga VSTAR",
  "United Wings",
  "Future",
  "Bloodmoon Ursaluna Mad Bite",
  "Toedscruel Ogerpon",
  "Outros",
];

// Mapeamento dos arquétipos para os nomes de arquivo reais
const ARCHETYPE_IMAGE_MAP: Record<string, string> = {
  "Regidrago VSTAR": "regidrago.png",
  "Charizard ex": "charizard.png",
  "Lugia Archeops": "lugia.png",
  "Gardevoir ex": "gardevoir.png",
  "Raging Bolt ex": "raging-bolt.png",
  "Terapagos ex": "terapagos.png",
  "Klawf Unhinged Scissors": "klawf-unhinged-scissors.png",
  "Dragapult ex": "dragapult.png",
  "Snorlax Stall PGO": "snorlax.png",
  "Palkia VSTAR": "palkia.png",
  "Archaludon ex": "archaludon.png",
  "Gholdengo ex": "gholdengo.png",
  "Roaring Moon ex": "roaring-moon.png",
  "Lost Zone Box": "comfey.png", // Conforme informado, Lost Zone Box exibe a imagem do Comfey
  "Miraidon ex": "miraidon.png",
  "Iron Thorns ex": "iron-thorns.png",
  "Ancient Box": "flutter-mane.png", // Ancient Box exibirá a imagem do Flutter Mane
  "Pidgeot Control": "pidgeot.png", // Pidgeot Control exibe o Pidgeot
  "Cornerstone Ogerpon": "cornerstone-ogerpon.png",
  "Gouging Fire ex": "gouging-fire.png",
  "Ceruledge ex": "ceruledge.png",
  "Banette ex": "banette.png",
  "Chien-Pao Baxcalibur": "chien-pao.png", // Exibe somente "chien-pao.png"
  "Greninja ex": "greninja.png",
  "Regis Ancient Wisdom": "regis.png", // Exibe "regis.png" em vez de "regis-ancient-wisdom.png"
  "Hydreigon ex": "hydreigon.png",
  "Conkeldurr Gusty Swing": "conkeldurr.png", // Exibe "conkeldurr.png"
  "Entei V": "entei.png",
  "Giratina VSTAR": "giratina.png",
  "Arceus VSTAR": "arceus.png",
  "Dialga VSTAR": "dialga.png",
  "United Wings": "united-wings.png",
  "Future": "future.png", // Nesse caso, Future corresponde a "future.png" (o Pokémon é o Iron Crowns, conforme informado)
  "Bloodmoon Ursaluna Mad Bite": "bloodmoon-ursaluna.png", // Exibe "bloodmoon-ursaluna.png"
  "Toedscruel Ogerpon": "toedscruel.png", // Exibe "toedscruel.png"
  "Outros": "substitute.png", // Para "Outros", usamos a imagem de substituição
};

// Função que retorna a URL do ícone do arquétipo
function getArchetypeIconUrl(archetype: string): string {
  const fileName = ARCHETYPE_IMAGE_MAP[archetype];
  if (!fileName) {
    // Caso o arquétipo não esteja mapeado, usa o ícone de substituição
    return "https://limitless3.nyc3.cdn.digitaloceanspaces.com/pokemon/substitute.png";
  }
  return `https://r2.limitlesstcg.net/pokemon/gen9/${fileName}`;
}


  // Modais auxiliares de seleção
  const [stylesModalVisible, setStylesModalVisible] = useState(false);
  const [archetypeModalVisible, setArchetypeModalVisible] = useState(false);

  /**
   * Carrega dados do AsyncStorage (userId, userName, leagueId) e o setIdMap
   */
  useEffect(() => {
    (async () => {
      try {
        const pId = await AsyncStorage.getItem("@userId");
        const pName = await AsyncStorage.getItem("@userName");
        const lId = await AsyncStorage.getItem("@leagueId");
        if (pId) setPlayerId(pId);
        if (pName) setPlayerName(pName);
        if (lId) setLeagueId(lId);

        // Carrega sets (ptcgoCode -> setId)
        loadSetIdMap();
      } catch (error) {
        console.log("Erro ao buscar dados do AsyncStorage:", error);
      }
    })();
  }, []);

  /**
   * Busca decks do Firestore
   */
  useEffect(() => {
    setLoading(true);
    const decksRef = collection(db, "decks");
    const decksQuery = query(decksRef);

    const unsubscribe = onSnapshot(decksQuery, (snapshot) => {
      const deckArray: DeckData[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        deckArray.push({
          id: docSnap.id,
          ownerUid: d.ownerUid || "",
          ownerName: d.ownerName || "",
          leagueId: d.leagueId || "",
          name: d.name || "",
          createdAt: d.createdAt,
          pokemons: convertFirestoreToCardLines(d.pokemons),
          trainers: convertFirestoreToCardLines(d.trainers),
          energies: convertFirestoreToCardLines(d.energies),
          style: d.style || [],
          archetype: d.archetype || null,
        });
      });
      setDecks(deckArray);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [playerId]);

  /**
   * Filtro de decks pelo termo de busca
   */
  const filteredDecks = decks.filter((deck) => {
    if (!searchTerm.trim()) return true;
    return deck.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  /**
   * Carrega setIdMap
   */
  async function loadSetIdMap() {
    try {
      const response = await fetch("https://api.pokemontcg.io/v2/sets");
      const data = await response.json();
      if (data && data.data) {
        const map: Record<string, string> = {};
        const groupedSets: Record<string, any[]> = {};
        data.data.forEach((setItem: any) => {
          const code = setItem.ptcgoCode?.toUpperCase();
          if (!code) return;
          if (!groupedSets[code]) groupedSets[code] = [];
          groupedSets[code].push(setItem);
        });
        Object.keys(groupedSets).forEach((code) => {
          const sets = groupedSets[code];
          const bestSet = sets.reduce((prev, curr) =>
            curr.total > prev.total ? curr : prev
          );
          map[code] = bestSet.id;
        });
        setSetIdMap(map);
      }
    } catch (error) {
      console.log("Erro ao carregar setIdMap:", error);
    }
  }

  /**
   * Lógica de criar deck
   */
  async function handleCreateDeck() {
    if (!newDeckName.trim()) {
      Alert.alert("Erro", "O deck precisa de um nome.");
      return;
    }
    setParsing(true);
    setLoading(true);
    try {
      const { pokemons, trainers, energies } = await parseDeckContentChunked(newDeckContent);
      if (!pokemons.length && !trainers.length && !energies.length) {
        Alert.alert("Erro", "Nenhuma carta detectada na lista.");
        setParsing(false);
        setLoading(false);
        return;
      }

      const payload = {
        ownerUid: playerId,
        ownerName: playerName,
        leagueId,
        name: newDeckName.trim(),
        createdAt: new Date().toISOString(),
        pokemons: pokemons.map(toFirestoreCard),
        trainers: trainers.map(toFirestoreCard),
        energies: energies.map(toFirestoreCard),
        style: newStyles,
        archetype: newArchetype,
      };

      const refDecks = collection(db, "decks");
      await addDoc(refDecks, payload);

      setNewDeckName("");
      setNewDeckContent("");
      setNewStyles([]);
      setNewArchetype(null);
      setCreateModalVisible(false);

      Alert.alert("Sucesso", "Deck criado com sucesso!");
    } catch (error) {
      console.log("Erro ao criar deck:", error);
      Alert.alert("Erro", "Falha ao criar deck.");
    } finally {
      setParsing(false);
      setLoading(false);
    }
  }

  /**
   * Excluir deck
   */
  async function handleDeleteDeck(deck: DeckData) {
    setLoading(true);
    try {
      const deckRef = doc(db, "decks", deck.id);
      await deleteDoc(deckRef);
      Alert.alert("Sucesso", "Deck excluído!");
    } catch (error) {
      console.log("Erro ao excluir deck:", error);
      Alert.alert("Erro", "Falha ao excluir deck.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Ao clicar no card, abrimos a visualização e carregamos as imagens
   */
  function openViewModal(deck: DeckData) {
    setViewDeck(deck);
    setDeckViewMode("table");
    setViewModalVisible(true);
    loadDeckImages(deck);
  }

  /**
   * Fecha modal de visualização
   */
  function closeViewModal() {
    setViewModalVisible(false);
    setViewDeck(null);
  }

  /**
   * Carrega as cartas + imagens
   */
  async function loadDeckImages(deck: DeckData) {
    const allCards = [
      ...deck.pokemons.map((c) => ({
        ...c,
        category: "Pokémon",
        expansion: c.expansion ?? undefined,
        cardNumber: c.cardNumber ?? undefined,
      })),
      ...deck.trainers.map((c) => ({
        ...c,
        category: "Treinador",
        expansion: c.expansion ?? undefined,
        cardNumber: c.cardNumber ?? undefined,
      })),
      ...deck.energies.map((c) => ({
        ...c,
        category: "Energia",
        expansion: c.expansion ?? undefined,
        cardNumber: c.cardNumber ?? undefined,
      })),
    ];

    setDeckCards(allCards);
    setLoadingImages(true);

    const imagePromises = allCards.map(async (card) => {
      const keyStr = `${card.name}__${card.expansion || ""}__${card.cardNumber || ""}`;
      const url = await fetchCardImage(card.name, card.expansion, card.cardNumber);
      return { key: keyStr, url };
    });

    const results = await Promise.all(imagePromises);
    const newMap: Record<string, string> = {};
    results.forEach((item) => {
      if (item.url) {
        newMap[item.key] = item.url;
      }
    });

    setCardImages(newMap);
    setLoadingImages(false);
  }

  /**
   * Chama API TCG para pegar imagem
   */
  async function fetchCardImage(
    cardName: string,
    expansion?: string,
    cardNumber?: string
  ): Promise<string | null> {
    try {
      if (!cardName) return null;
      const sanitized = cardName.replace(/\bPH\b/g, "").trim();
      let queryParts: string[] = [`name:"${encodeURIComponent(sanitized)}"`];

      if (expansion) {
        const setId = setIdMap[expansion.toUpperCase()];
        if (setId) {
          queryParts.push(`set.id:"${setId}"`);
        }
      }
      if (cardNumber) {
        queryParts.push(`number:"${cardNumber}"`);
      }

      const finalQuery = queryParts.join("%20");
      const url = `https://api.pokemontcg.io/v2/cards?q=${finalQuery}`;
      const resp = await fetch(url, {
        headers: {
          "X-Api-Key": "8d293a2a-4949-4d04-a06c-c20672a7a12c",
        },
      });
      const data = await resp.json();
      if (data && data.data && data.data.length > 0) {
        return data.data[0].images.small ?? null;
      }
      return null;
    } catch (error) {
      console.log("Erro em fetchCardImage:", error);
      return null;
    }
  }

  /**
   * Renderiza cada deck no FlatList
   */
  function renderDeckItem({ item }: { item: DeckData }) {
    const totalPoke = item.pokemons.reduce((acc, c) => acc + c.quantity, 0);
    const totalTrea = item.trainers.reduce((acc, c) => acc + c.quantity, 0);
    const totalEner = item.energies.reduce((acc, c) => acc + c.quantity, 0);
    const totalAll = totalPoke + totalTrea + totalEner;
  
    return (
      <Animatable.View style={styles.deckCard} animation="fadeInUp">
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => openViewModal(item)}
          onLongPress={() => {
            Alert.alert("Excluir Deck", `Deseja excluir ${item.name}?`, [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Excluir",
                style: "destructive",
                onPress: () => handleDeleteDeck(item),
              },
            ]);
          }}
        >
          {/* Cabeçalho do card com nome */}
          <View style={styles.deckHeaderRow}>
            <Text style={styles.deckName}>{item.name}</Text>
          </View>

            {/* Linha para exibir os estilos, abaixo do nome */}
            {!!item.style?.length && (
              <View style={styles.deckStyleRow}>
                <Text style={styles.deckStyle} numberOfLines={2}>
                  {item.style.join(", ")}
                </Text>
              </View>
            )}

            {/* Linha para exibir o arquétipo com o ícone */}
            {item.archetype && (
              <View style={styles.archetypeIconContainer}>
                <Image
                  source={{ uri: getArchetypeIconUrl(item.archetype) }}
                  style={styles.archetypeIcon}
                  resizeMode="contain"
                />
                <Text style={styles.archetypeLabel}>{item.archetype}</Text>
              </View>
            )}

          {/* Linha com data */}
          <View style={styles.deckHeaderRow}>
            <Text style={styles.deckDate}>
              {item.createdAt ? formatDate(item.createdAt) : ""}
            </Text>
          </View>
  
          {/* Dono */}
          <Text style={styles.deckOwner}>
            Dono: {item.ownerName || `User ${item.ownerUid}`}
          </Text>
  
          {/* Quantidade de cartas */}
          <Text style={styles.deckCount}>
            P: {totalPoke} T: {totalTrea} E: {totalEner} | Total: {totalAll}
          </Text>
        </TouchableOpacity>
      </Animatable.View>
    );
  }  

  // ==================== RENDER PRINCIPAL ====================
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meus Decks</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#999" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar deck..."
          placeholderTextColor="#999"
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <Animatable.Text animation="pulse" iterationCount="infinite" style={styles.loadingText}>
            Carregando...
          </Animatable.Text>
        </View>
      )}

      <FlatList
        data={filteredDecks}
        keyExtractor={(deckItem) => deckItem.id}
        renderItem={renderDeckItem}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 10 }}
      />

      {/* Botão flutuante para criar deck */}
      <View style={styles.floatingContainer}>
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => setCreateModalVisible(true)}
        >
          <Ionicons name="add" size={22} color="#FFF" style={{ marginRight: 6 }} />
          <Text style={styles.floatingButtonText}>Criar Deck</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de criação de deck */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
        transparent
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Criar Deck</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text style={styles.label}>Nome do Deck</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Deck do Pikachu"
                placeholderTextColor="#999"
                value={newDeckName}
                onChangeText={setNewDeckName}
              />

              <Text style={styles.label}>Lista do Deck</Text>
              <TextInput
                style={[styles.input, { height: 80 }]}
                multiline
                placeholder="Cole a lista aqui..."
                placeholderTextColor="#999"
                value={newDeckContent}
                onChangeText={setNewDeckContent}
              />

              {parsing && (
                <View style={styles.parseOverlay}>
                  <ActivityIndicator size="large" color="#E3350D" />
                  <Text style={{ color: "#FFF", marginTop: 10 }}>Processando Deck...</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setStylesModalVisible(true)}
              >
                <Ionicons name="color-filter" size={16} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.selectButtonText}>
                  {newStyles.length ? `Estilos: ${newStyles.join(", ")}` : "Selecionar Estilos"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.selectButton, { marginTop: 12 }]}
                onPress={() => setArchetypeModalVisible(true)}
              >
                <Ionicons name="options" size={16} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.selectButtonText}>
                  {newArchetype ? `Arquetipo: ${newArchetype}` : "Selecionar Arquetipo"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, { marginTop: 20 }]}
                onPress={handleCreateDeck}
                disabled={parsing}
              >
                <Text style={styles.buttonText}>Salvar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
  visible={stylesModalVisible}
  transparent
  animationType="fade"
  onRequestClose={() => setStylesModalVisible(false)}
>
  <View style={styles.subModalOverlay}>
    <View style={styles.subModalContainer}>
      <Text style={styles.subModalTitle}>Selecione até 3 estilos</Text>
      <ScrollView>
        {STYLE_OPTIONS.map((opt) => {
          const selected = newStyles.includes(opt);
          const iconName = STYLE_ICONS[opt] || "help-circle-outline";
          return (
            <TouchableOpacity
              key={opt}
              style={styles.subModalItem}
              onPress={() => toggleStyleOption(opt)}
            >
              {/* Ícone de seleção */}
              <Ionicons
                name={selected ? "checkbox" : "square-outline"}
                size={20}
                color={selected ? "#E3350D" : "#FFF"}
                style={{ marginRight: 8 }}
              />
              {/* Ícone do estilo */}
              <MaterialCommunityIcons
                name={iconName as any}
                size={20}
                color="#FFF"
                style={{ marginRight: 8 }}
              />

              <Text style={{ color: "#FFF" }}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <TouchableOpacity
        style={styles.closeOptionButton}
        onPress={() => setStylesModalVisible(false)}
      >
        <Text style={styles.closeOptionButtonText}>OK</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>

      {/* Submodal de arquétipo (create) */}
      <Modal
        visible={archetypeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setArchetypeModalVisible(false)}
      >
        <View style={styles.subModalOverlay}>
          <View style={styles.subModalContainer}>
            <Text style={styles.subModalTitle}>Selecione um Arquetipo</Text>
            <ScrollView>
              {ARCHETYPE_OPTIONS.map((opt) => {
                const selected = newArchetype === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={styles.subModalItem}
                    onPress={() => {
                      setNewArchetype(opt);
                      setArchetypeModalVisible(false);
                    }}
                  >
                    <Ionicons
                      name={selected ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={selected ? "#E3350D" : "#FFF"}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={{ color: "#FFF" }}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeOptionButton}
              onPress={() => setArchetypeModalVisible(false)}
            >
              <Text style={styles.closeOptionButtonText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de visualização de deck */}
      <Modal
        visible={viewModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeViewModal}
      >
        <Animatable.View style={styles.viewModalOverlay} animation="fadeIn">
          <Animatable.View style={styles.viewModalContainer} animation="fadeInUp">
            <View style={styles.viewModalHeader}>
              <TouchableOpacity onPress={closeViewModal}>
                <Ionicons name="arrow-back" size={22} color="#FFF" />
              </TouchableOpacity>

              <Text style={styles.viewModalTitle}>
                {viewDeck?.name ?? "Deck"}
              </Text>

              {/* Alternar Tabela / Mosaico */}
              <View style={styles.deckViewSwitchRow}>
                <TouchableOpacity
                  style={[
                    styles.deckViewSwitchButton,
                    deckViewMode === "table" && styles.deckViewSwitchButtonActive,
                  ]}
                  onPress={() => setDeckViewMode("table")}
                >
                  <Ionicons name="list" size={16} color="#FFF" />
                  <Text style={styles.deckViewSwitchText}> Lista</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.deckViewSwitchButton,
                    deckViewMode === "mosaic" && styles.deckViewSwitchButtonActive,
                  ]}
                  onPress={() => setDeckViewMode("mosaic")}
                >
                  <Ionicons name="images" size={16} color="#FFF" />
                  <Text style={styles.deckViewSwitchText}> Imagem</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {viewDeck && (
                <>
                  <View style={styles.deckDetailHeaderRow}>
                    <Text style={styles.deckDetailHeaderText}>
                      Data: {formatDate(viewDeck.createdAt)}
                    </Text>
                    <Text style={[styles.deckDetailHeaderText, { marginLeft: 10 }]}>
                      Dono: {viewDeck.ownerName || `User ${viewDeck.ownerUid}`}
                    </Text>
                  </View>

                  {/* Liga removida do card inicial, mas aqui pode aparecer se quiser
                      Se não quiser, basta remover este if. */}
                  {!!viewDeck.style?.length && (
                    <Text style={[styles.deckDetailHeaderText, { marginTop: 4 }]}>
                      Estilos: {viewDeck.style.join(", ")}
                    </Text>
                  )}
                  {!!viewDeck.archetype && (
                    <Text style={[styles.deckDetailHeaderText, { marginTop: 4 }]}>
                      Arquetipo: {viewDeck.archetype}
                    </Text>
                  )}

                  {deckViewMode === "table" ? (
                    <RenderDeckTable
                      deck={viewDeck}
                      cardImages={cardImages}
                      loadingImages={loadingImages}
                    />
                  ) : (
                    <RenderDeckMosaic
                      deck={viewDeck}
                      cardImages={cardImages}
                      loadingImages={loadingImages}
                    />
                  )}
                </>
              )}
            </ScrollView>
          </Animatable.View>
        </Animatable.View>
      </Modal>
    </SafeAreaView>
  );

  // =================== FUNÇÃO DE TOGGLE DE ESTILO ===================
  function toggleStyleOption(opt: string) {
    if (newStyles.includes(opt)) {
      setNewStyles((prev) => prev.filter((s) => s !== opt));
    } else {
      if (newStyles.length >= 3) {
        Alert.alert("Atenção", "Máximo de 3 estilos.");
        return;
      }
      setNewStyles((prev) => [...prev, opt]);
    }
  }
}

/**
 * Exibe as cartas em tabela.
 */
function RenderDeckTable({
  deck,
  cardImages,
  loadingImages,
}: {
  deck: DeckData;
  cardImages: Record<string, string>;
  loadingImages: boolean;
}) {
  const allCards = [
    ...deck.pokemons.map((c) => ({ ...c, category: "Pokémon" })),
    ...deck.trainers.map((c) => ({ ...c, category: "Treinador" })),
    ...deck.energies.map((c) => ({ ...c, category: "Energia" })),
  ];

  return (
    <View style={{ marginTop: 10 }}>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderText, { flex: 1 }]}>Qtd</Text>
        <Text style={[styles.tableHeaderText, { flex: 2 }]}>Tipo</Text>
        <Text style={[styles.tableHeaderText, { flex: 3 }]}>Nome</Text>
        <Text style={[styles.tableHeaderText, { flex: 2 }]}>Exp</Text>
        <Text style={[styles.tableHeaderText, { flex: 1 }]}>Nº</Text>
      </View>
      {allCards.map((card, index) => {
        const keyStr = `${card.name}__${card.expansion ?? ""}__${card.cardNumber ?? ""}`;
        const imgUrl = cardImages[keyStr];
        return (
          <View
            key={`tab-${index}`}
            style={[
              styles.tableRow,
              { backgroundColor: index % 2 === 0 ? "#2A2A2A" : "#3A3A3A" },
            ]}
          >
            <Text style={[styles.tableRowText, { flex: 1 }]}>{card.quantity}</Text>
            <Text style={[styles.tableRowText, { flex: 2 }]}>{card.category}</Text>
            <Text style={[styles.tableRowText, { flex: 3 }]} numberOfLines={1}>
              {card.name}
            </Text>
            <Text style={[styles.tableRowText, { flex: 2 }]}>
              {card.expansion ?? ""}
            </Text>
            <Text style={[styles.tableRowText, { flex: 1 }]}>
              {card.cardNumber ?? ""}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Exibe as cartas em mosaico, com imagens.
 */
function RenderDeckMosaic({
  deck,
  cardImages,
  loadingImages,
}: {
  deck: DeckData;
  cardImages: Record<string, string>;
  loadingImages: boolean;
}) {
  const allCards = [
    ...deck.pokemons.map((c) => ({ ...c, category: "Pokémon" })),
    ...deck.trainers.map((c) => ({ ...c, category: "Treinador" })),
    ...deck.energies.map((c) => ({ ...c, category: "Energia" })),
  ];

  return (
    <View style={{ marginTop: 10 }}>
      {loadingImages && (
        <View style={styles.imageLoadingOverlay}>
          <ActivityIndicator size="large" color="#E3350D" />
          <Text style={{ color: "#FFF", marginTop: 10 }}>Carregando imagens...</Text>
        </View>
      )}

      <View style={styles.mosaicContainer}>
        {allCards.map((card, index) => {
          const keyStr = `${card.name}__${card.expansion ?? ""}__${card.cardNumber ?? ""}`;
          const imgUrl = cardImages[keyStr];
          return (
            <View key={`mosaic-${index}`} style={styles.mosaicItem}>
              <View style={styles.mosaicImageWrapper}>
                {imgUrl ? (
                  <Image
                    source={{ uri: imgUrl }}
                    style={styles.mosaicImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.noImageBox}>
                    <Text style={styles.noImageText}>Sem Imagem</Text>
                  </View>
                )}
                <View style={styles.mosaicQtyBox}>
                  <Text style={styles.mosaicQtyText}>{card.quantity}</Text>
                </View>
              </View>
              <Text style={styles.mosaicName} numberOfLines={2}>
                {card.name}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// =============== PARSE EM CHUNKS ===============
async function parseDeckContentChunked(text: string): Promise<{
  pokemons: CardLine[];
  trainers: CardLine[];
  energies: CardLine[];
}> {
  return new Promise((resolve) => {
    const lines = text.split("\n").map((l) => l.trim());
    const total = lines.length;

    const pokemons: CardLine[] = [];
    const trainers: CardLine[] = [];
    const energies: CardLine[] = [];

    let currentBlock: "POKEMON" | "TRAINER" | "ENERGY" | "" = "";
    let currentIndex = 0;
    let incrementalId = 1;

    function processBlock() {
      const endIndex = Math.min(currentIndex + 20, total);
      for (let i = currentIndex; i < endIndex; i++) {
        const line = lines[i];
        if (!line) continue;
        const lower = line.toLowerCase();

        if (lower.startsWith("pokémon:") || lower.startsWith("pokemon:")) {
          currentBlock = "POKEMON";
          continue;
        }
        if (lower.startsWith("treinador:") || lower.startsWith("trainer:")) {
          currentBlock = "TRAINER";
          continue;
        }
        if (lower.startsWith("energia:") || lower.startsWith("energy:")) {
          currentBlock = "ENERGY";
          continue;
        }
        if (!currentBlock) continue;

        const parsed = parseSingleLine(line, incrementalId);
        incrementalId++;

        if (currentBlock === "POKEMON") {
          pokemons.push(parsed);
        } else if (currentBlock === "TRAINER") {
          trainers.push(parsed);
        } else if (currentBlock === "ENERGY") {
          energies.push(parsed);
        }
      }
      currentIndex = endIndex;
      if (currentIndex < total) {
        setTimeout(processBlock, 0);
      } else {
        resolve({ pokemons, trainers, energies });
      }
    }
    processBlock();
  });
}

function parseSingleLine(line: string, incrementalId: number): CardLine {
  const tokens = line.split(" ").filter(Boolean);
  let quantity = 1;
  let expansion: string | null = null;
  let cardNumber: string | null = null;
  const nameParts: string[] = [];

  let index = 0;
  const first = tokens[0];
  const maybeQ = parseInt(first ?? "", 10);
  if (!isNaN(maybeQ) && maybeQ > 0) {
    quantity = maybeQ;
    index = 1;
  }

  while (index < tokens.length) {
    const tok = tokens[index];
    if (/^[A-Z]{3}$/.test(tok)) {
      expansion = tok;
      if (index + 1 < tokens.length) {
        const nextTok = tokens[index + 1];
        const nextNum = parseInt(nextTok, 10);
        if (!isNaN(nextNum) && nextNum > 0) {
          cardNumber = nextTok;
          index += 2;
          continue;
        }
      }
      index++;
      continue;
    }
    const possibleNum = parseInt(tok, 10);
    if (!isNaN(possibleNum) && possibleNum > 0) {
      cardNumber = tok;
      index++;
      continue;
    }
    nameParts.push(tok);
    index++;
  }

  return {
    incrementalId,
    quantity,
    name: nameParts.join(" "),
    expansion,
    cardNumber,
  };
}

function convertFirestoreToCardLines(arr: any[]): CardLine[] {
  if (!arr) return [];
  return arr.map((obj: any, index: number) => ({
    incrementalId: index + 1,
    quantity: obj.quantity || 1,
    name: obj.name || "",
    expansion: obj.expansion || null,
    cardNumber: obj.cardNumber || null,
  }));
}

function toFirestoreCard(c: CardLine): FirestoreCard {
  return {
    quantity: c.quantity,
    name: c.name,
    expansion: c.expansion || null,
    cardNumber: c.cardNumber || null,
  };
}

/** Formatação de datas */
function formatDate(dateIso: string) {
  if (!dateIso) return "";
  const m = moment(dateIso);
  if (!m.isValid()) return dateIso;
  return m.format("DD/MM/YYYY HH:mm");
}

/** Estilos visuais */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1E1E1E",
  },
  header: {
    backgroundColor: "#000",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    color: "#E3350D",
    fontSize: 20,
    fontWeight: "bold",
  },
  searchBar: {
    flexDirection: "row",
    backgroundColor: "#2A2A2A",
    alignItems: "center",
    margin: 10,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: "#FFF",
  },
  loadingOverlay: {
    position: "absolute",
    top: 100,
    width: "100%",
    alignItems: "center",
    zIndex: 999,
  },
  loadingText: {
    color: "#E3350D",
    fontSize: 16,
    fontWeight: "bold",
  },
  deckCard: {
    width: "48%",
    backgroundColor: "#333",
    borderRadius: 8,
    marginBottom: 10,
    padding: 12,
    // Aumenta o tamanho para acomodar as informações extras
    minHeight: 150,
  },
  deckHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  deckName: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "bold",
    maxWidth: "80%", // Evita que o nome estoure o card
  },
  deckStyle: {
    color: "#4CAF50",
    fontSize: 13,
    fontWeight: "bold",
    maxWidth: "80%",
  },
  deckArchetype: {
    color: "#FFF",
    fontSize: 13,
    fontStyle: "italic",
    maxWidth: "65%",
  },
  deckDate: {
    color: "#999",
    fontSize: 12,
  },
  deckOwner: {
    color: "#ccc",
    fontSize: 12,
    marginTop: 2,
  },
  deckStyleRow: {
    marginBottom: 4,
  },
  deckCount: {
    color: "#ccc",
    fontSize: 12,
    marginTop: 4,
  },
  floatingContainer: {
    position: "absolute",
    bottom: 20,
    right: 20,
  },
  floatingButton: {
    backgroundColor: "#E3350D",
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  floatingButtonText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#1E1E1E",
  },
  modalHeader: {
    backgroundColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalTitle: {
    color: "#E3350D",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
  },
  label: {
    color: "#FFF",
    fontSize: 14,
    marginTop: 14,
  },
  input: {
    backgroundColor: "#2A2A2A",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: "#FFF",
    marginTop: 6,
  },
  parseOverlay: {
    alignItems: "center",
    marginVertical: 10,
  },
  selectButton: {
    backgroundColor: "#444",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  selectButtonText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  button: {
    backgroundColor: "#E3350D",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  subModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  subModalContainer: {
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    width: "90%",
    maxHeight: "80%",
    padding: 16,
  },
  subModalTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  subModalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#555",
  },
  closeOptionButton: {
    backgroundColor: "#E3350D",
    borderRadius: 6,
    alignItems: "center",
    paddingVertical: 10,
    marginTop: 14,
  },
  closeOptionButtonText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  viewModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  viewModalContainer: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    marginTop: 60,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  viewModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#000",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  viewModalTitle: {
    color: "#E3350D",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
  },
  deckViewSwitchRow: {
    flexDirection: "row",
    marginLeft: "auto",
  },
  deckViewSwitchButton: {
    flexDirection: "row",
    backgroundColor: "#555",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: "center",
    marginLeft: 8,
  },
  deckViewSwitchButtonActive: {
    backgroundColor: "#777",
  },
  deckViewSwitchText: {
    color: "#FFF",
    fontWeight: "bold",
    marginLeft: 4,
  },
  deckDetailHeaderRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  deckDetailHeaderText: {
    color: "#FFF",
    fontSize: 14,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#444",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    marginTop: 10,
  },
  tableHeaderText: {
    color: "#FFF",
    fontWeight: "bold",
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  tableRowText: {
    color: "#FFF",
    fontSize: 13,
    textAlign: "center",
  },
  mosaicContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
  },
  mosaicItem: {
    width: "33%",
    alignItems: "center",
    marginBottom: 14,
  },
  mosaicImageWrapper: {
    width: 80,
    height: 110,
    backgroundColor: "#444",
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  mosaicImage: {
    width: "100%",
    height: "100%",
    borderRadius: 6,
  },
  noImageBox: {
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
  },
  noImageText: {
    color: "#aaa",
    fontSize: 12,
    textAlign: "center",
  },
  mosaicQtyBox: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#E3350D",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mosaicQtyText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 12,
  },
  mosaicName: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 4,
    width: "100%",
  },
  imageLoadingOverlay: {
    alignItems: "center",
    marginVertical: 10,
  },
  archetypeIconContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  archetypeIcon: {
    width: 30,
    height: 30,
    marginRight: 6,
  },
  archetypeLabel: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
  },
});

