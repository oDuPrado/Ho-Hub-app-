import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
  Linking,
  Alert,
  SafeAreaView,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";

import { useTranslation } from "react-i18next";
import * as Animatable from "react-native-animatable";
import { Ionicons } from "@expo/vector-icons";

/**
 * Tipagens originais + novas
 */
interface CardData {
  id: string;
  name: string;
  images: {
    small: string;
    large?: string;
  };
  tcgplayer?: {
    url: string;
    updatedAt: string;
    prices: {
      [rarity: string]: {
        low?: number | null;
        mid?: number | null;
        high?: number | null;
        market?: number | null;
        directLow?: number | null;
      };
    };
  };
  set?: {
    id: string;
    name: string;
    series: string;
    printedTotal?: number;
    releaseDate?: string;
    images?: {
      symbol: string;
      logo: string;
    };
  };
  number?: string;

  // Campos que podem existir na API
  supertype?: string; // "Pokémon", "Trainer", "Energy"
  rarity?: string;
}

interface CollectionData {
  id: string;
  name: string;
  ptcgoCode?: string;
  printedTotal?: number;
  series?: string;
  releaseDate?: string;
  images?: {
    symbol: string;
    logo: string;
  };
}

type TradeType = "sale" | "trade" | "want";

interface CreatingState {
  visible: boolean;
  card: CardData | null;
  action: "have" | "want";
  type: TradeType;
  priceMode: "manual" | "liga";
  priceValue: string;
  ligaPercent: string;
  obs: string;
}

/** Modal para adicionar à Coleção (Tenho/Quero) */
interface AddToCollectionModalState {
  visible: boolean;
  card: CardData | null;
  mode: "have" | "wish";
}

/** Opções de Ordenação */
type SortOption =
  | "none"
  | "nameAsc"
  | "nameDesc"
  | "type"
  | "rarity"
  | "priceLow"
  | "priceHigh";

export default function CardsSearchScreen() {
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCards, setFilteredCards] = useState<CardData[]>([]);
  const [collections, setCollections] = useState<CollectionData[]>([]);

  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(false);

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("Jogador");

  /** Para 'salvar post' (Trocas) */
  const [leagueId, setLeagueId] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");

  /** Modal de detalhes */
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  /** Modal de criação/edição (Tenho/Quero) */
  const [createState, setCreateState] = useState<CreatingState>({
    visible: false,
    card: null,
    action: "have",
    type: "trade",
    priceMode: "manual",
    priceValue: "",
    ligaPercent: "5%",
    obs: "",
  });

  /** 1) Coleção selecionada */
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");

  /** 2) Modal para escolher a coleção */
  const [collectionModalVisible, setCollectionModalVisible] = useState(false);
  const [collectionSearchQuery, setCollectionSearchQuery] = useState("");

  /** 3) Modal para ordenação (engrenagem) */
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>("none");

  /** 4) Modal para "Tenho" e "Quero" do grid */
  const [addToCollectionModal, setAddToCollectionModal] =
    useState<AddToCollectionModalState>({
      visible: false,
      card: null,
      mode: "have",
    });

  /**
   * 5) Gamificação: quantas cartas do set eu tenho?
   *    -> Por enquanto, local. No futuro, iremos buscar do Firestore.
   *    // TODO: Buscar as cartas que o jogador realmente possui:
   *    // ex: useEffect(() => { ... }, []);
   */
  const [userOwnedCards, setUserOwnedCards] = useState<string[]>([]);
  const [userWishlist, setUserWishlist] = useState<string[]>([]);

  /** Carrega a lista de coleções + info do AsyncStorage */
  useEffect(() => {
    (async () => {
      try {
        const storedId = await AsyncStorage.getItem("@userId");
        const storedName = (await AsyncStorage.getItem("@userName")) || "Jogador";
        const storedFilterType = await AsyncStorage.getItem("@filterType");
        const storedLeagueId = await AsyncStorage.getItem("@leagueId");

        setPlayerId(storedId);
        setPlayerName(storedName);
        setFilterType(storedFilterType || "");
        setLeagueId(storedLeagueId || "");
      } catch (err) {
        console.error("Erro ao buscar dados do AsyncStorage:", err);
      }
    })();

    (async () => {
      try {
        setLoading(true);
        const resp = await fetch("https://api.pokemontcg.io/v2/sets");
        const data = await resp.json();
        if (data && data.data) {
          const all: CollectionData[] = data.data.map((col: any) => ({
            id: col.id,
            name: col.name,
            ptcgoCode: col.ptcgoCode,
            printedTotal: col.printedTotal,
            series: col.series,
            releaseDate: col.releaseDate,
            images: col.images,
          }));
          setCollections(all);
        }
      } catch (error) {
        console.error("Erro ao buscar coleções:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** Busca cartas pelo query (nome, setCode, etc.) [original] */
  async function searchCard(query: string) {
    setLoading(true);
    try {
      const text = query.trim();
      if (/^\d+$/.test(text)) {
        setFilteredCards([]);
        setLoading(false);
        return;
      }

      if (!text) {
        // Se limpou a busca, mas há uma coleção selecionada, refaz o fetch
        if (selectedCollectionId) {
          await fetchCardsByCollection(selectedCollectionId);
        } else {
          setFilteredCards([]);
        }
        setLoading(false);
        return;
      }

      /** Ex: "PGO 68" */
      const parts = text.split(/\s+/);
      if (parts.length === 2) {
        const setCode = parts[0].toUpperCase();
        const cardNumber = parts[1];
        const matchedSet = collections.find(
          (c) => (c.ptcgoCode || "").toUpperCase() === setCode
        );
        if (matchedSet) {
          const url = `https://api.pokemontcg.io/v2/cards?q=set.id:"${matchedSet.id}" number:"${cardNumber}"`;
          const response = await fetch(url);
          const data = await response.json();
          if (data && data.data) setFilteredCards(data.data);
          else setFilteredCards([]);
          setLoading(false);
          return;
        }
      }

      /** Se digitou apenas o setCode (ex: "PGO") */
      const up = text.toUpperCase();
      const matchedSet2 = collections.find(
        (c) => (c.ptcgoCode || "").toUpperCase() === up
      );
      if (matchedSet2) {
        const url = `https://api.pokemontcg.io/v2/cards?q=set.id:"${matchedSet2.id}"`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data && data.data) setFilteredCards(data.data);
        else setFilteredCards([]);
        setLoading(false);
        return;
      }

      /** Caso contrário, busca por nome */
      const nameUrl = `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(
        text
      )}"`;
      const resp2 = await fetch(nameUrl);
      const data2 = await resp2.json();
      if (data2 && data2.data) setFilteredCards(data2.data);
      else setFilteredCards([]);
    } catch (error) {
      console.error("Erro ao buscar cartas:", error);
      setFilteredCards([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchChange(txt: string) {
    setSearchQuery(txt);
    searchCard(txt);
  }

  /** Busca cartas pela coleção */
  async function fetchCardsByCollection(colId: string) {
    if (!colId) return;
    setLoading(true);
    try {
      const url = `https://api.pokemontcg.io/v2/cards?q=set.id:"${colId}"&pageSize=300`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data && data.data) setFilteredCards(data.data);
      else setFilteredCards([]);
    } catch (err) {
      console.error("Erro ao buscar cartas da coleção:", err);
      setFilteredCards([]);
    } finally {
      setLoading(false);
    }
  }

  /** Abrir / fechar modal de coleção */
  function openCollectionModal() {
    setCollectionSearchQuery("");
    setCollectionModalVisible(true);
  }
  function closeCollectionModal() {
    setCollectionModalVisible(false);
  }

  /** Handler de quando clicar numa coleção na lista do modal */
  async function handleSelectCollection(colId: string) {
    setSelectedCollectionId(colId);
    setSearchQuery("");
    closeCollectionModal();
    await fetchCardsByCollection(colId);
  }

  /** Botão "Limpar filtro" => remove coleção selecionada */
  function clearCollectionFilter() {
    setSelectedCollectionId("");
    setFilteredCards([]);
    closeCollectionModal();
  }

  /** Filtro de coleções dentro do modal (por nome) */
  const filteredCollectionList = useMemo(() => {
    if (!collectionSearchQuery.trim()) return collections;
    return collections.filter((col) =>
      col.name.toLowerCase().includes(collectionSearchQuery.toLowerCase())
    );
  }, [collectionSearchQuery, collections]);

  /**
   *  Modal de Ordenação (engrenagem)
   */
  function openSortModal() {
    setSortModalVisible(true);
  }
  function closeSortModal() {
    setSortModalVisible(false);
  }
  function selectSortOption(opt: SortOption) {
    setSortOption(opt);
    closeSortModal();
  }

  /**
   * Lógica de ordenação
   */
  function sortCards(cards: CardData[]): CardData[] {
    if (!cards || cards.length === 0) return [];
    let sorted = [...cards];

    switch (sortOption) {
      case "nameAsc":
        sorted.sort((a, b) => (a.name > b.name ? 1 : -1));
        break;
      case "nameDesc":
        sorted.sort((a, b) => (a.name < b.name ? 1 : -1));
        break;
      case "type":
        sorted.sort((a, b) => {
          const typeA = a.supertype || "";
          const typeB = b.supertype || "";
          return typeA.localeCompare(typeB);
        });
        break;
      case "rarity":
        sorted.sort((a, b) => {
          const rA = a.rarity || "zzz";
          const rB = b.rarity || "zzz";
          return rA.localeCompare(rB);
        });
        break;
      case "priceLow":
        sorted.sort((a, b) => {
          const pa = getFirstPrice(a) || Infinity;
          const pb = getFirstPrice(b) || Infinity;
          return pa - pb;
        });
        break;
      case "priceHigh":
        sorted.sort((a, b) => {
          const pa = getFirstPrice(a) || 0;
          const pb = getFirstPrice(b) || 0;
          return pb - pa;
        });
        break;
      default:
        // "none" => sem ordenação
        break;
    }
    return sorted;
  }
  function getFirstPrice(card: CardData): number | null {
    if (!card.tcgplayer || !card.tcgplayer.prices) return null;
    for (let rarityKey of Object.keys(card.tcgplayer.prices)) {
      const info = card.tcgplayer.prices[rarityKey];
      if (info.market) return info.market;
      if (info.mid) return info.mid;
    }
    return null;
  }

  /** Cards exibidos = filteredCards + sortOption */
  const displayedCards = useMemo(() => {
    return sortCards(filteredCards);
  }, [filteredCards, sortOption]);

  /**
   * Modal de detalhes (original)
   */
  function openCardModal(card: CardData) {
    setSelectedCard(card);
    setDetailModalVisible(true);
  }
  function closeCardModal() {
    setSelectedCard(null);
    setDetailModalVisible(false);
  }

  /**
   * Criar Post: Tenho / Quero (original)
   */
  function handleHaveOrWant(card: CardData, action: "have" | "want") {
    setCreateState({
      visible: true,
      card,
      action,
      type: action === "have" ? "sale" : "want",
      priceMode: "manual",
      priceValue: "",
      ligaPercent: "5%",
      obs: "",
    });
  }
  function closeCreateModal() {
    setCreateState((prev) => ({ ...prev, visible: false, card: null }));
  }

  /** Salvar post (Trocas) [original] */
  async function handleSavePost() {
    if (!playerId) {
      Alert.alert("Erro", "Você não está logado.");
      return;
    }
    if (!createState.card) {
      Alert.alert("Erro", "Nenhuma carta selecionada.");
      return;
    }
    if (filterType !== "league" || !leagueId) {
      Alert.alert("Filtro inválido", "Para criar um post, selecione uma liga.");
      closeCreateModal();
      return;
    }

    const collRef = collection(db, `leagues/${leagueId}/trades`);
    try {
      const snap = await getDocs(collRef);
      const userPosts = snap.docs.filter((d) => d.data().ownerId === playerId);
      if (userPosts.length >= 5) {
        Alert.alert("Limite Atingido", "Você já tem 5 posts criados.");
        closeCreateModal();
        return;
      }
    } catch (error) {
      console.error("Erro ao buscar posts do usuário:", error);
    }

    let finalPrice = "";
    if (createState.type === "sale") {
      if (createState.priceMode === "manual") {
        if (!createState.priceValue.trim()) {
          Alert.alert("Erro", "Informe o preço manualmente.");
          return;
        }
        finalPrice = createState.priceValue.trim();
      } else {
        finalPrice = `Liga - ${createState.ligaPercent}`;
      }
    } else if (createState.type === "trade") {
      finalPrice = "Troca";
    } else {
      finalPrice = "Quero";
    }

    try {
      const docRef = doc(collRef);
      await setDoc(docRef, {
        cardName: createState.card.name,
        cardImage: createState.card.images.small,
        type: createState.type,
        price: finalPrice,
        obs: createState.obs,
        ownerId: playerId,
        ownerName: playerName,
        interested: [],
        createdAt: Date.now(),
      });

      Alert.alert("Sucesso", "Post criado com sucesso!");
      closeCreateModal();
    } catch (err) {
      Alert.alert("Erro", "Falha ao criar o post de troca/venda.");
      console.error("ERRO ao criar post:", err);
    }
  }

  /**
   * Botão "Tenho" / "Quero" no grid -> abre modal
   */
  function onPressHaveInGrid(card: CardData) {
    setAddToCollectionModal({ visible: true, card, mode: "have" });
  }
  function onPressWantInGrid(card: CardData) {
    setAddToCollectionModal({ visible: true, card, mode: "wish" });
  }

  /** Confirmar no modal "Coleção" ou "Wishlist" */
  function handleConfirmAddCollection(folder: string) {
    if (!addToCollectionModal.card) return;
    const id = addToCollectionModal.card.id;

    if (addToCollectionModal.mode === "have") {
      setUserOwnedCards((prev) => {
        if (!prev.includes(id)) {
          return [...prev, id];
        }
        return prev;
      });
      Alert.alert("Coleção", `Adicionado na pasta: ${folder}`);
    } else {
      setUserWishlist((prev) => {
        if (!prev.includes(id)) {
          return [...prev, id];
        }
        return prev;
      });
      Alert.alert("Wishlist", `Adicionado na Wishlist: ${folder}`);
    }
    setAddToCollectionModal({ visible: false, card: null, mode: "have" });
  }
  function handleCloseAddCollectionModal() {
    setAddToCollectionModal({ visible: false, card: null, mode: "have" });
  }

  /** Info da coleção selecionada (para gamificação) */
  const selectedCollectionInfo = useMemo(() => {
    return collections.find((c) => c.id === selectedCollectionId);
  }, [selectedCollectionId, collections]);

  /** Quantas cartas tenho dessa coleção */
  const totalInCollection = useMemo(() => {
    if (!selectedCollectionId) return 0;
    return userOwnedCards.filter((cardId) => {
      const c = filteredCards.find((fc) => fc.id === cardId);
      return c?.set?.id === selectedCollectionId;
    }).length;
  }, [userOwnedCards, selectedCollectionId, filteredCards]);

  const totalCardsInSet = selectedCollectionInfo?.printedTotal || 0;
  const completionPercentage =
    totalCardsInSet > 0
      ? Math.round((totalInCollection / totalCardsInSet) * 100)
      : 0;

  const SCREEN_WIDTH = Dimensions.get("window").width;
  const CARD_GRID_WIDTH = (SCREEN_WIDTH - 48) / 3;

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Cartas Pokémon TCG</Text>

        {/* Ícone de engrenagem para abrir o SortModal */}
        <TouchableOpacity style={styles.gearButton} onPress={openSortModal}>
          <Ionicons name="settings-sharp" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Barra de busca + Botão de filtrar coleção */}
      <View style={{ paddingHorizontal: 6 }}>
        <Animatable.View animation="fadeInDown" style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder='Buscar carta (Ex: "PGO 68")'
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={handleSearchChange}
          />
        </Animatable.View>

        <TouchableOpacity style={styles.filterButton} onPress={openCollectionModal}>
          <Ionicons name="albums" size={18} color="#FFF" style={{ marginRight: 6 }} />
          <Text style={styles.filterButtonText}>
            {selectedCollectionId ? "Mudar Coleção" : "Filtrar Coleção"}
          </Text>
        </TouchableOpacity>
      </View>

      {/** Se houver coleção selecionada, mostra info */}
      {selectedCollectionInfo && (
        <Animatable.View animation="fadeIn" style={styles.collectionInfoContainer}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.collectionInfoTitle}>{selectedCollectionInfo.name}</Text>
              <Text style={styles.collectionInfoText}>
                Série: {selectedCollectionInfo.series}
              </Text>
              <Text style={styles.collectionInfoText}>
                Lançamento:{" "}
                {selectedCollectionInfo.releaseDate || "Desconhecida"}
              </Text>
              <Text style={styles.collectionInfoText}>
                Total: {selectedCollectionInfo.printedTotal || "--"} cartas
              </Text>
            </View>
            {selectedCollectionInfo.images?.logo && (
              <Image
                source={{ uri: selectedCollectionInfo.images.logo }}
                style={styles.collectionLogo}
                resizeMode="contain"
              />
            )}
          </View>

          {/* Barra de progresso */}
          {totalCardsInSet > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.collectionInfoText}>
                Você tem {totalInCollection}/{totalCardsInSet} ({completionPercentage}%)
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${completionPercentage}%` },
                  ]}
                />
              </View>
            </View>
          )}
        </Animatable.View>
      )}

      {loading && (
        <View style={{ marginVertical: 10 }}>
          <ActivityIndicator size="large" color="#E3350D" />
        </View>
      )}

      {/* GRID */}
      <ScrollView contentContainerStyle={styles.gridContainer}>
        {!loading && displayedCards.length === 0 && searchQuery.length > 0 && (
          <Animatable.Text
            style={styles.noResultsText}
            animation="fadeIn"
            duration={500}
          >
            Nenhuma carta encontrada.
          </Animatable.Text>
        )}

        <View style={styles.gridWrapper}>
          {displayedCards.map((card) => {
            const iHaveIt = userOwnedCards.includes(card.id);
            const iWantIt = userWishlist.includes(card.id);

            return (
              <Animatable.View
                key={card.id}
                style={[
                  styles.gridItem,
                  { width: CARD_GRID_WIDTH, marginHorizontal: 4 },
                ]}
                animation="fadeInUp"
                duration={600}
              >
                {/* Clique abre modal de detalhes */}
                <TouchableOpacity
                  style={styles.cardInner}
                  onPress={() => openCardModal(card)}
                  activeOpacity={0.9}
                >
                  <Image
                    source={{ uri: card.images.small }}
                    style={{
                      width: CARD_GRID_WIDTH * 0.9,
                      height: CARD_GRID_WIDTH * 1.2,
                      marginBottom: 4,
                    }}
                    resizeMode="contain"
                  />
                  <Text style={styles.cardNameGrid} numberOfLines={1}>
                    {card.name}
                  </Text>
                  <Text style={styles.cardSetInfoGrid} numberOfLines={1}>
                    {card.set?.name} - {card.number}
                  </Text>
                </TouchableOpacity>

                {/* Botões "Tenho" e "Quero" */}
                <View style={styles.gridButtonsRow}>
                  <TouchableOpacity
                    style={[
                      styles.haveButton,
                      iHaveIt && { backgroundColor: "#66BB6A" },
                    ]}
                    onPress={() => onPressHaveInGrid(card)}
                  >
                    <Ionicons name="checkmark-done" size={18} color="#FFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.wantButton,
                      iWantIt && { backgroundColor: "#EC407A" },
                    ]}
                    onPress={() => onPressWantInGrid(card)}
                  >
                    <Ionicons name="heart" size={18} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </Animatable.View>
            );
          })}
        </View>
      </ScrollView>

      {/** MODAL de Detalhes */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeCardModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {selectedCard && (
              <>
                <Text style={styles.modalTitle}>{selectedCard.name}</Text>

                <Animatable.Image
                  animation="pulse"
                  iterationCount="infinite"
                  duration={6000}
                  source={{ uri: selectedCard.images.small }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />

                {selectedCard.tcgplayer ? (
                  <>
                    <Text style={styles.modalText}>
                      Preço atualizado em: {selectedCard.tcgplayer.updatedAt}
                    </Text>

                    <View style={styles.rarityRow}>
                      {Object.keys(selectedCard.tcgplayer.prices).map((rarity) => {
                        const priceData = selectedCard.tcgplayer!.prices[rarity];
                        return (
                          <View key={rarity} style={styles.rarityCard}>
                            <Text style={styles.rarityCardTitle}>{rarity}</Text>
                            <Text style={styles.rarityCardPrice}>
                              Low: ${priceData.low?.toFixed(2) ?? "--"}
                            </Text>
                            <Text style={styles.rarityCardPrice}>
                              Mid: ${priceData.mid?.toFixed(2) ?? "--"}
                            </Text>
                            <Text style={styles.rarityCardPrice}>
                              Market: ${priceData.market?.toFixed(2) ?? "--"}
                            </Text>
                            <Text style={styles.rarityCardPrice}>
                              High: ${priceData.high?.toFixed(2) ?? "--"}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    <TouchableOpacity
                      style={styles.linkButton}
                      onPress={() =>
                        selectedCard.tcgplayer?.url &&
                        Linking.openURL(selectedCard.tcgplayer.url)
                      }
                    >
                      <Ionicons
                        name="open-outline"
                        size={18}
                        color="#FFF"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.linkButtonText}>Abrir TCGPlayer</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.modalText}>(Sem info de preço)</Text>
                )}

                <View style={styles.actionButtonsContainer}>
                  <Animatable.View animation="bounceIn" delay={200}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleHaveOrWant(selectedCard, "have")}
                    >
                      <Ionicons
                        name="checkmark-done"
                        size={18}
                        color="#FFF"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.actionButtonText}>Tenho</Text>
                    </TouchableOpacity>
                  </Animatable.View>

                  <Animatable.View animation="bounceIn" delay={400}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleHaveOrWant(selectedCard, "want")}
                    >
                      <Ionicons
                        name="heart"
                        size={18}
                        color="#FFF"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.actionButtonText}>Quero</Text>
                    </TouchableOpacity>
                  </Animatable.View>
                </View>

                <TouchableOpacity style={styles.closeButton} onPress={closeCardModal}>
                  <Ionicons name="close" size={20} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.closeButtonText}>Fechar</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/** MODAL de Criação de Post (Tenho/Quero) */}
      <Modal
        visible={createState.visible}
        animationType="slide"
        onRequestClose={closeCreateModal}
        transparent={false}
      >
        <SafeAreaView style={styles.modalCreateContainer}>
          <ScrollView style={{ padding: 16 }}>
            {createState.card && (
              <>
                <Text style={styles.modalTitle}>
                  {createState.action === "have"
                    ? `Tenho esta Carta`
                    : `Quero esta Carta`}
                </Text>

                <Image
                  source={{ uri: createState.card.images.small }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
                <Text style={styles.modalText}>{createState.card.name}</Text>

                {createState.action === "have" && (
                  <>
                    <Text style={styles.modalLabel}>Tipo</Text>
                    <View style={{ flexDirection: "row", marginBottom: 10 }}>
                      <TouchableOpacity
                        style={[
                          styles.switchTypeButton,
                          createState.type === "sale" && styles.switchTypeButtonActive,
                        ]}
                        onPress={() =>
                          setCreateState((prev) => ({ ...prev, type: "sale" }))
                        }
                      >
                        <Ionicons
                          name="cash-outline"
                          size={16}
                          color="#FFF"
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.switchTypeText}>Venda</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.switchTypeButton,
                          createState.type === "trade" && styles.switchTypeButtonActive,
                        ]}
                        onPress={() =>
                          setCreateState((prev) => ({ ...prev, type: "trade" }))
                        }
                      >
                        <Ionicons
                          name="swap-horizontal"
                          size={16}
                          color="#FFF"
                          style={{ marginRight: 4 }}
                        />
                        <Text style={styles.switchTypeText}>Troca</Text>
                      </TouchableOpacity>
                    </View>

                    {createState.type === "sale" && (
                      <>
                        <Text style={styles.modalLabel}>Preço</Text>
                        <View style={{ flexDirection: "row", marginBottom: 12 }}>
                          <TouchableOpacity
                            style={[
                              styles.switchTypeButton,
                              createState.priceMode === "manual" &&
                                styles.switchTypeButtonActive,
                            ]}
                            onPress={() =>
                              setCreateState((prev) => ({
                                ...prev,
                                priceMode: "manual",
                              }))
                            }
                          >
                            <Ionicons
                              name="create-outline"
                              size={16}
                              color="#FFF"
                              style={{ marginRight: 4 }}
                            />
                            <Text style={styles.switchTypeText}>Manual</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.switchTypeButton,
                              createState.priceMode === "liga" &&
                                styles.switchTypeButtonActive,
                            ]}
                            onPress={() =>
                              setCreateState((prev) => ({
                                ...prev,
                                priceMode: "liga",
                              }))
                            }
                          >
                            <Ionicons
                              name="stats-chart"
                              size={16}
                              color="#FFF"
                              style={{ marginRight: 4 }}
                            />
                            <Text style={styles.switchTypeText}>Liga-%</Text>
                          </TouchableOpacity>
                        </View>

                        {createState.priceMode === "manual" ? (
                          <TextInput
                            style={styles.modalInput}
                            value={createState.priceValue}
                            onChangeText={(val) =>
                              setCreateState((prev) => ({ ...prev, priceValue: val }))
                            }
                            placeholder='Ex: "R$ 15,00"'
                            placeholderTextColor="#888"
                          />
                        ) : (
                          <View style={{ flexDirection: "row" }}>
                            {["5%", "10%", "15%", "20%"].map((opt) => (
                              <TouchableOpacity
                                key={opt}
                                style={[
                                  styles.switchTypeButton,
                                  createState.ligaPercent === opt &&
                                    styles.switchTypeButtonActive,
                                ]}
                                onPress={() =>
                                  setCreateState((prev) => ({
                                    ...prev,
                                    ligaPercent: opt,
                                  }))
                                }
                              >
                                <Text style={styles.switchTypeText}>{opt}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </>
                    )}
                  </>
                )}

                {createState.action === "want" && (
                  <Text style={[styles.modalLabel, { marginBottom: 6 }]}>
                    Você deseja obter esta carta (tipo: "want").
                  </Text>
                )}

                <Text style={styles.modalLabel}>Observações</Text>
                <TextInput
                  style={[styles.modalInput, { height: 60 }]}
                  multiline
                  value={createState.obs}
                  onChangeText={(val) =>
                    setCreateState((prev) => ({ ...prev, obs: val }))
                  }
                  placeholder="Detalhes..."
                  placeholderTextColor="#999"
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.button, { backgroundColor: "#999" }]}
                    onPress={closeCreateModal}
                  >
                    <Ionicons
                      name="close-circle"
                      size={16}
                      color="#FFF"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.buttonText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.button, { marginLeft: 8 }]}
                    onPress={handleSavePost}
                  >
                    <Ionicons
                      name="send"
                      size={16}
                      color="#FFF"
                      style={{ marginRight: 4 }}
                    />
                    <Text style={styles.buttonText}>Enviar</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/** Modal "Tenho / Quero" do grid */}
      <Modal
        visible={addToCollectionModal.visible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseAddCollectionModal}
      >
        <View style={styles.addCollectionOverlay}>
          <View style={styles.addCollectionContainer}>
            <Text style={styles.modalTitle}>
              {addToCollectionModal.mode === "have"
                ? "Adicionar à Minha Coleção"
                : "Adicionar à Wishlist"}
            </Text>

            {addToCollectionModal.card && (
              <>
                <Image
                  source={{ uri: addToCollectionModal.card.images.small }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
                <Text
                  style={[
                    styles.modalText,
                    { marginBottom: 8, textAlign: "center" },
                  ]}
                >
                  {addToCollectionModal.card.name}
                </Text>
              </>
            )}

            <Text style={styles.modalLabel}>Selecione uma pasta:</Text>
            <View style={{ flexDirection: "row", marginVertical: 6 }}>
              <TouchableOpacity
                style={styles.switchTypeButton}
                onPress={() => handleConfirmAddCollection("Coleção Geral")}
              >
                <Ionicons
                  name="albums"
                  size={16}
                  color="#FFF"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.switchTypeText}>Coleção Geral</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.switchTypeButton, { marginLeft: 8 }]}
                onPress={() => handleConfirmAddCollection("Pasta Específica")}
              >
                <Ionicons
                  name="folder-open"
                  size={16}
                  color="#FFF"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.switchTypeText}>Pasta Específica</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Ou crie uma pasta nova:</Text>
            <TouchableOpacity
              style={[
                styles.switchTypeButton,
                { backgroundColor: "#555", marginTop: 4 },
              ]}
              onPress={() => handleConfirmAddCollection("Nova Pasta")}
            >
              <Ionicons
                name="add-circle"
                size={16}
                color="#FFF"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.switchTypeText}>Criar Pasta</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: "#999", marginTop: 20 }]}
              onPress={handleCloseAddCollectionModal}
            >
              <Ionicons
                name="close-circle"
                size={16}
                color="#FFF"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.buttonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/** MODAL Ordenação */}
      <Modal
        visible={sortModalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeSortModal}
      >
        <View style={styles.sortOverlay}>
          <View style={styles.sortContainer}>
            <Text style={styles.modalTitle}>Ordenar por</Text>

            <TouchableOpacity
              style={styles.sortOptionButton}
              onPress={() => selectSortOption("none")}
            >
              <Text style={styles.sortOptionText}>
                {sortOption === "none" ? "✓ " : ""}
                Nenhum
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sortOptionButton}
              onPress={() => selectSortOption("nameAsc")}
            >
              <Text style={styles.sortOptionText}>
                {sortOption === "nameAsc" ? "✓ " : ""}
                Nome (A-Z)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sortOptionButton}
              onPress={() => selectSortOption("nameDesc")}
            >
              <Text style={styles.sortOptionText}>
                {sortOption === "nameDesc" ? "✓ " : ""}
                Nome (Z-A)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sortOptionButton}
              onPress={() => selectSortOption("type")}
            >
              <Text style={styles.sortOptionText}>
                {sortOption === "type" ? "✓ " : ""}
                Tipo (Pokémon/Trainer)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sortOptionButton}
              onPress={() => selectSortOption("rarity")}
            >
              <Text style={styles.sortOptionText}>
                {sortOption === "rarity" ? "✓ " : ""}
                Raridade
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sortOptionButton}
              onPress={() => selectSortOption("priceLow")}
            >
              <Text style={styles.sortOptionText}>
                {sortOption === "priceLow" ? "✓ " : ""}
                Menor Preço
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sortOptionButton}
              onPress={() => selectSortOption("priceHigh")}
            >
              <Text style={styles.sortOptionText}>
                {sortOption === "priceHigh" ? "✓ " : ""}
                Maior Preço
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: "#999", marginTop: 20 }]}
              onPress={closeSortModal}
            >
              <Ionicons
                name="close-circle"
                size={16}
                color="#FFF"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.buttonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/** MODAL Lista de Coleções */}
      <Modal
        visible={collectionModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeCollectionModal}
      >
        <View style={styles.addCollectionOverlay}>
          <View style={styles.addCollectionContainer}>
            <Text style={styles.modalTitle}>Selecionar Coleção</Text>

            <View style={styles.searchContainerSmall}>
              <Ionicons name="search" size={20} color="#999" style={{ marginRight: 6 }} />
              <TextInput
                style={styles.searchInputSmall}
                placeholder="Buscar coleção..."
                placeholderTextColor="#999"
                value={collectionSearchQuery}
                onChangeText={setCollectionSearchQuery}
              />
            </View>

            <ScrollView style={{ maxHeight: 300, width: "100%", marginTop: 10 }}>
              {filteredCollectionList.map((col) => (
                <TouchableOpacity
                  key={col.id}
                  style={styles.collectionItem}
                  onPress={() => handleSelectCollection(col.id)}
                >
                  <Text style={styles.collectionItemText}>{col.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: "#999", marginTop: 10 }]}
              onPress={clearCollectionFilter}
            >
              <Ionicons
                name="close-circle"
                size={16}
                color="#FFF"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.buttonText}>Limpar Filtro</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: "#444", marginTop: 10 }]}
              onPress={closeCollectionModal}
            >
              <Ionicons
                name="arrow-down-circle"
                size={16}
                color="#FFF"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.buttonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/** ESTILOS */
const DARK = "#1E1E1E";
const PRIMARY = "#E3350D";
const SECONDARY = "#FFFFFF";
const GRAY = "#2A2A2A";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 5,
    paddingBottom: 6,
    backgroundColor: "#000",
  },
  title: {
    fontSize: 20,
    color: SECONDARY,
    fontWeight: "bold",
  },
  gearButton: {
    padding: 6,
  },

  searchContainer: {
    flexDirection: "row",
    backgroundColor: GRAY,
    borderRadius: 8,
    alignItems: "center",
    paddingHorizontal: 10,
    marginTop: 8,
  },
  searchInput: {
    flex: 1,
    color: SECONDARY,
    paddingVertical: 6,
    fontSize: 16,
  },

  filterButton: {
    flexDirection: "row",
    backgroundColor: "#444",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  filterButtonText: {
    color: "#FFF",
    fontWeight: "bold",
  },

  collectionInfoContainer: {
    backgroundColor: "#333",
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 6,
    marginBottom: 6,
  },
  collectionInfoTitle: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  collectionInfoText: {
    color: "#EEE",
    fontSize: 12,
  },
  collectionLogo: {
    width: 80,
    height: 40,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#777",
    borderRadius: 4,
    marginTop: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    backgroundColor: "#4CAF50",
    borderRadius: 4,
  },

  gridContainer: {
    paddingHorizontal: 8,
    paddingBottom: 60,
    alignItems: "center",
  },
  gridWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  gridItem: {
    marginBottom: 12,
    backgroundColor: "#292929",
    borderRadius: 8,
    padding: 6,
  },
  cardInner: {
    alignItems: "center",
  },
  cardNameGrid: {
    color: SECONDARY,
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
  },
  cardSetInfoGrid: {
    color: "#CCC",
    fontSize: 12,
    marginTop: 2,
  },
  gridButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 6,
  },
  haveButton: {
    backgroundColor: "#4A4A4A",
    width: 34,
    height: 34,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  wantButton: {
    backgroundColor: "#4A4A4A",
    width: 34,
    height: 34,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },

  noResultsText: {
    color: SECONDARY,
    marginTop: 10,
    fontSize: 16,
    fontStyle: "italic",
  },

  /** MODAL DETALHES */
  modalContainer: {
    flex: 1,
    backgroundColor: DARK,
  },
  modalScroll: {
    padding: 20,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 22,
    color: SECONDARY,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  modalImage: {
    width: 160,
    height: 220,
    marginBottom: 20,
    alignSelf: "center",
  },
  modalText: {
    color: SECONDARY,
    fontSize: 14,
    marginBottom: 10,
  },
  rarityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  rarityCard: {
    backgroundColor: "#333",
    borderRadius: 8,
    padding: 10,
    margin: 5,
    width: 130,
    alignItems: "center",
  },
  rarityCardTitle: {
    fontSize: 14,
    color: PRIMARY,
    fontWeight: "bold",
    marginBottom: 6,
  },
  rarityCardPrice: {
    color: SECONDARY,
    fontSize: 12,
  },
  linkButton: {
    flexDirection: "row",
    backgroundColor: PRIMARY,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 10,
    alignSelf: "center",
    alignItems: "center",
  },
  linkButtonText: {
    color: SECONDARY,
    fontSize: 14,
    fontWeight: "bold",
  },
  actionButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginTop: 20,
    width: "100%",
  },
  actionButton: {
    flexDirection: "row",
    backgroundColor: "#4A4A4A",
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center",
    marginHorizontal: 4,
  },
  actionButtonText: {
    color: SECONDARY,
    fontSize: 14,
    fontWeight: "bold",
  },
  closeButton: {
    flexDirection: "row",
    backgroundColor: PRIMARY,
    padding: 12,
    borderRadius: 8,
    alignSelf: "center",
    marginTop: 30,
    alignItems: "center",
  },
  closeButtonText: {
    color: SECONDARY,
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 4,
  },

  /** MODAL CREATE POST */
  modalCreateContainer: {
    flex: 1,
    backgroundColor: DARK,
  },
  modalLabel: {
    color: SECONDARY,
    fontSize: 14,
    marginVertical: 6,
  },
  switchTypeButton: {
    flexDirection: "row",
    backgroundColor: "#444",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    alignItems: "center",
  },
  switchTypeButtonActive: {
    backgroundColor: "#666",
  },
  switchTypeText: {
    color: SECONDARY,
    fontWeight: "bold",
  },
  modalInput: {
    backgroundColor: "#444",
    color: SECONDARY,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    marginTop: 4,
  },
  modalButtons: {
    flexDirection: "row",
    marginTop: 16,
    justifyContent: "center",
  },
  button: {
    flexDirection: "row",
    backgroundColor: PRIMARY,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
  },
  buttonText: {
    color: SECONDARY,
    fontWeight: "bold",
    marginLeft: 4,
  },

  /** MODAL "TENHO/QUERO" */
  addCollectionOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  addCollectionContainer: {
    backgroundColor: DARK,
    width: "80%",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },

  /** MODAL "ORDENAÇÃO" */
  sortOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  sortContainer: {
    backgroundColor: DARK,
    width: "80%",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  sortOptionButton: {
    paddingVertical: 6,
    width: "100%",
  },
  sortOptionText: {
    color: "#FFF",
    fontSize: 14,
  },

  /** MODAL "LISTA DE COLEÇÕES" */
  searchContainerSmall: {
    flexDirection: "row",
    backgroundColor: GRAY,
    borderRadius: 8,
    alignItems: "center",
    paddingHorizontal: 10,
  },
  searchInputSmall: {
    flex: 1,
    color: SECONDARY,
    paddingVertical: 6,
    fontSize: 14,
  },
  collectionItem: {
    paddingVertical: 8,
    borderBottomColor: "#444",
    borderBottomWidth: 1,
  },
  collectionItemText: {
    color: "#FFF",
    fontSize: 14,
  },
});
