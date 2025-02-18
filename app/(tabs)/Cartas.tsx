import React, { useState, useEffect } from "react";
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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";

import { useTranslation } from "react-i18next";
import * as Animatable from "react-native-animatable";
import { Ionicons } from "@expo/vector-icons";

/**
 * Tipagens Originais
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
  };
  number?: string;
}

interface CollectionData {
  id: string;
  name: string;
  ptcgoCode?: string;
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

/**
 * Componente Principal
 */
export default function CardsSearchScreen() {
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCards, setFilteredCards] = useState<CardData[]>([]);
  const [collections, setCollections] = useState<CollectionData[]>([]);

  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(false);

  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState("Jogador");

  /**
   * Carrega coleções (sets) e dados do AsyncStorage (playerId, playerName)
   */
  useEffect(() => {
    console.log("🔄 [Cartas] Iniciando carregamento de dados...");
  
    (async () => {
      try {
        const storedId = await AsyncStorage.getItem("@userId");
        const storedName = (await AsyncStorage.getItem("@userName")) || "Jogador";
        const storedFilterType = await AsyncStorage.getItem("@filterType");
        const storedLeagueId = await AsyncStorage.getItem("@leagueId");
  
        console.log("📢 [Cartas] AsyncStorage retornou playerId:", storedId);
        console.log("📢 [Cartas] AsyncStorage retornou filterType:", storedFilterType);
        console.log("📢 [Cartas] AsyncStorage retornou leagueId:", storedLeagueId);
  
        setPlayerId(storedId);
        setPlayerName(storedName);
        setFilterType(storedFilterType || "");
        setLeagueId(storedLeagueId || "");
  
        console.log("🎯 [Cartas] Estados atualizados:", { storedId, storedName, storedFilterType, storedLeagueId });
      } catch (err) {
        console.error("❌ [Cartas] Erro ao buscar dados do AsyncStorage:", err);
      }
    })();
  
    (async () => {
      try {
        setLoading(true);
        const resp = await fetch("https://api.pokemontcg.io/v2/sets");
        const data = await resp.json();
        if (data && data.data) {
          setCollections(data.data);
        }
      } catch (error) {
        console.error("Erro ao buscar coleções:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);  

  /**
   * Filtro (para salvamento)
   */
  const [leagueId, setLeagueId] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");

  /**
   * Modal de detalhes
   */
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  /**
   * Modal de criação/edição
   */
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

  /**
   * Busca de Cartas - aceita nome, setCode, ou "setCode numero"
   */
  async function searchCard(query: string) {
    setLoading(true);
    try {
      const text = query.trim();
      if (/^\d+$/.test(text)) {
        setFilteredCards([]);
        setLoading(false);
        return;
      }

      /**
       * Verifica se o usuário digitou algo como "PGO 68"
       */
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

      /**
       * Se digitou somente o setCode
       */
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

      /**
       * Caso contrário, busca por nome
       */
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

  /**
   * Modal de Detalhes
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
   * Criar Post: Tenho / Quero
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

  /**
   * Salvar Post
   */
  async function handleSavePost() {
    console.log("🚀 Iniciando handleSavePost...");
    console.log("🔍 playerId:", playerId);
    console.log("🔍 createState.card:", createState.card);
    console.log("🔍 filterType:", filterType);
    console.log("🔍 leagueId:", leagueId);

    if (!playerId) {
      console.error("❌ ERRO: playerId está vazio!");
      Alert.alert("Erro", "Você não está logado.");
      return;
    }

    if (!createState.card) {
      console.error("❌ ERRO: Nenhuma carta foi selecionada!");
      Alert.alert("Erro", "Nenhuma carta selecionada.");
      return;
    }

    if (filterType !== "league" || !leagueId) {
      console.error(
        "❌ ERRO: Filtro inválido! filterType:",
        filterType,
        "leagueId:",
        leagueId
      );
      Alert.alert("Filtro inválido", "Para criar um post, selecione uma liga.");
      closeCreateModal();
      return;
    }

    const collRef = collection(db, `leagues/${leagueId}/trades`);

    try {
      console.log("📥 Buscando posts existentes do usuário...");
      const snap = await getDocs(collRef);
      const userPosts = snap.docs.filter((d) => d.data().ownerId === playerId);
      console.log("✅ Posts existentes:", userPosts.length);

      if (userPosts.length >= 5) {
        console.error("❌ ERRO: Limite de 5 posts atingido!");
        Alert.alert("Limite Atingido", "Você já tem 5 posts criados.");
        closeCreateModal();
        return;
      }
    } catch (error) {
      console.error("❌ Erro ao buscar posts do usuário:", error);
    }

    let finalPrice = "";
    if (createState.type === "sale") {
      if (createState.priceMode === "manual") {
        if (!createState.priceValue.trim()) {
          console.error("❌ ERRO: Preço manual não informado!");
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
      console.log("📤 Criando post no Firebase...");
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

      console.log("✅ Post criado com sucesso!");
      Alert.alert("Sucesso", "Post criado com sucesso!");
      closeCreateModal();
    } catch (err) {
      console.error("❌ ERRO ao criar post:", err);
      Alert.alert("Erro", "Falha ao criar o post de troca/venda.");
    }
  }

  /**
   * Render
   */
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Cartas Pokémon TCG</Text>

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

      {loading && (
        <View style={{ marginVertical: 10 }}>
          <ActivityIndicator size="large" color="#E3350D" />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.cardList}>
        {!loading && filteredCards.length === 0 && searchQuery.length > 0 && (
          <Animatable.Text style={styles.noResultsText} animation="fadeIn" duration={500}>
            Nenhuma carta encontrada.
          </Animatable.Text>
        )}

        {filteredCards.map((card) => (
          <Animatable.View
            key={card.id}
            style={styles.cardItemWrapper}
            animation="fadeInUp"
            duration={600}
          >
            <TouchableOpacity
              style={styles.cardItem}
              onPress={() => openCardModal(card)}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: card.images.small }}
                style={styles.cardImage}
                resizeMode="contain"
              />
              <Text style={styles.cardName}>{card.name}</Text>
              <Text style={styles.cardSetInfo}>
                {card.set?.name} - {card.number}
              </Text>
            </TouchableOpacity>
          </Animatable.View>
        ))}
      </ScrollView>

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
                        selectedCard.tcgplayer?.url && Linking.openURL(selectedCard.tcgplayer.url)
                      }
                    >
                      <Ionicons name="open-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
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
                      <Ionicons name="checkmark-done" size={18} color="#FFF" style={{ marginRight: 6 }} />
                      <Text style={styles.actionButtonText}>Tenho</Text>
                    </TouchableOpacity>
                  </Animatable.View>

                  <Animatable.View animation="bounceIn" delay={400}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleHaveOrWant(selectedCard, "want")}
                    >
                      <Ionicons name="heart" size={18} color="#FFF" style={{ marginRight: 6 }} />
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
                  {createState.action === "have" ? `Tenho esta Carta` : `Quero esta Carta`}
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
                        <Ionicons name="cash-outline" size={16} color="#FFF" style={{ marginRight: 4 }} />
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
                        <Ionicons name="swap-horizontal" size={16} color="#FFF" style={{ marginRight: 4 }} />
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
                              createState.priceMode === "manual" && styles.switchTypeButtonActive,
                            ]}
                            onPress={() =>
                              setCreateState((prev) => ({ ...prev, priceMode: "manual" }))
                            }
                          >
                            <Ionicons name="create-outline" size={16} color="#FFF" style={{ marginRight: 4 }} />
                            <Text style={styles.switchTypeText}>Manual</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.switchTypeButton,
                              createState.priceMode === "liga" && styles.switchTypeButtonActive,
                            ]}
                            onPress={() =>
                              setCreateState((prev) => ({ ...prev, priceMode: "liga" }))
                            }
                          >
                            <Ionicons name="stats-chart" size={16} color="#FFF" style={{ marginRight: 4 }} />
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
                                  createState.ligaPercent === opt && styles.switchTypeButtonActive,
                                ]}
                                onPress={() =>
                                  setCreateState((prev) => ({ ...prev, ligaPercent: opt }))
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
                    <Ionicons name="close-circle" size={16} color="#FFF" style={{ marginRight: 4 }} />
                    <Text style={styles.buttonText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.button, { marginLeft: 8 }]} onPress={handleSavePost}>
                    <Ionicons name="send" size={16} color="#FFF" style={{ marginRight: 4 }} />
                    <Text style={styles.buttonText}>Enviar</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

/**
 * Estilos Visuais
 */
const DARK = "#1E1E1E";
const PRIMARY = "#E3350D";
const SECONDARY = "#FFFFFF";
const GRAY = "#2A2A2A";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK,
    paddingTop: 40,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 24,
    color: SECONDARY,
    textAlign: "center",
    marginBottom: 10,
    fontWeight: "bold",
  },
  searchContainer: {
    flexDirection: "row",
    backgroundColor: GRAY,
    borderRadius: 8,
    alignItems: "center",
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: SECONDARY,
    paddingVertical: 6,
    fontSize: 16,
  },
  cardList: {
    alignItems: "center",
    paddingBottom: 20,
  },
  noResultsText: {
    color: SECONDARY,
    marginTop: 10,
    fontSize: 16,
    fontStyle: "italic",
  },
  cardItemWrapper: {
    width: "95%",
    marginBottom: 10,
  },
  cardItem: {
    backgroundColor: "#292929",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  cardImage: {
    width: 90,
    height: 120,
    marginBottom: 8,
  },
  cardName: {
    color: SECONDARY,
    fontSize: 16,
    textAlign: "center",
    fontWeight: "600",
  },
  cardSetInfo: {
    color: "#CCC",
    fontSize: 14,
    marginTop: 4,
  },

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
    textAlign: "center",
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
});
