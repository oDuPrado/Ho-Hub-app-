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
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";

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
}

interface CollectionData {
  id: string;
  name: string;
  ptcgoCode?: string;
}

/** Para criar um post no Firestore, podemos ter esses tipos */
type TradeType = "sale" | "trade" | "want";

/** Estrutura do modal de criação (edição) */
interface CreatingState {
  visible: boolean;
  card: CardData | null;
  action: "have" | "want"; // Se clicou em "Tenho" ou "Quero"
  type: TradeType; // sale, trade ou want
  priceMode: "manual" | "liga";
  priceValue: string; // ex. "R$ 10,00"
  ligaPercent: string; // ex. "5%"
  obs: string;
}

export default function CardsSearchScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCards, setFilteredCards] = useState<CardData[]>([]);
  const [collections, setCollections] = useState<CollectionData[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(false);

  // user info
  const [playerId, setPlayerId] = useState("");
  const [playerName, setPlayerName] = useState("Jogador");

  // Modal de detalhes
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Modal de criação/edição
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

  useEffect(() => {
    (async () => {
      const uid = await AsyncStorage.getItem("@userId");
      const uname = await AsyncStorage.getItem("@userName");
      if (uid) setPlayerId(uid);
      if (uname) setPlayerName(uname);
    })();
    async function fetchCollections() {
      try {
        const resp = await fetch("https://api.pokemontcg.io/v2/sets");
        const data = await resp.json();
        if (data && data.data) {
          setCollections(data.data);
        }
      } catch (err) {
        console.error("Erro ao buscar coleções:", err);
      }
    }
    fetchCollections();
  }, []);

  async function searchCard(query: string) {
    setLoading(true);
    try {
      const text = query.trim();
      if (/^\d+$/.test(text)) {
        setFilteredCards([]);
        setLoading(false);
        return;
      }

      const parts = text.split(/\s+/);
      if (parts.length === 2) {
        const setCode = parts[0].toUpperCase();
        const cardNumber = parts[1];
        const matchedSet = collections.find(
          (c) => (c.ptcgoCode || "").toUpperCase() === setCode
        );
        if (matchedSet) {
          const url = `https://api.pokemontcg.io/v2/cards?q=set.id:"${matchedSet.id}" number:"${cardNumber}"`;
          console.log("Consulta (set+num):", url);
          const response = await fetch(url);
          const data = await response.json();
          if (data && data.data) setFilteredCards(data.data);
          else setFilteredCards([]);
          setLoading(false);
          return;
        }
      }

      const up = text.toUpperCase();
      const matchedSet2 = collections.find(
        (c) => (c.ptcgoCode || "").toUpperCase() === up
      );
      if (matchedSet2) {
        const url = `https://api.pokemontcg.io/v2/cards?q=set.id:"${matchedSet2.id}"`;
        console.log("Consulta (apenas set):", url);
        const resp = await fetch(url);
        const data = await resp.json();
        if (data && data.data) setFilteredCards(data.data);
        else setFilteredCards([]);
        setLoading(false);
        return;
      }

      // assume nome da carta
      const nameUrl = `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(
        text
      )}"`;
      console.log("Consulta (nome):", nameUrl);
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

  // ------------------- DETALHES  -------------------
  function openCardModal(card: CardData) {
    setSelectedCard(card);
    setDetailModalVisible(true);
  }
  function closeCardModal() {
    setSelectedCard(null);
    setDetailModalVisible(false);
  }

  // --------------- CRIAR (Tenho/Quero) ---------------
  function handleHaveOrWant(card: CardData, action: "have" | "want") {
    // Abre modal de criação com defaults
    setCreateState({
      visible: true,
      card,
      action,
      // se é "have", default type= "trade" ou "sale"?
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

  // --------------- Salvar post --------------
  async function handleSavePost() {
    if (!playerId) {
      Alert.alert("Erro", "Você não está logado");
      return;
    }
    if (!createState.card) {
      Alert.alert("Erro", "Nenhuma carta selecionada");
      return;
    }
    // Pega contagem do user
    const collRef = collection(db, "trade");
    const snapshot = await getDocs(collRef);
    const userPosts = snapshot.docs.filter(
      (d) => d.data().ownerId === playerId
    );
    if (userPosts.length >= 5) {
      Alert.alert(
        "Limite Atingido",
        "Você já tem 5 cartas publicadas simultaneamente."
      );
      closeCreateModal();
      return;
    }

    let finalPrice = "";
    if (createState.type === "sale") {
      // Se for venda, pega price
      if (createState.priceMode === "manual") {
        if (!createState.priceValue.trim()) {
          Alert.alert("Erro", "Informe um valor ou ex: 'R$ 10,00'");
          return;
        }
        finalPrice = createState.priceValue.trim();
      } else {
        // "liga"
        finalPrice = `Liga - ${createState.ligaPercent}`;
      }
    } else if (createState.type === "trade") {
      finalPrice = "Troca";
    } else {
      // want
      finalPrice = "Quero";
    }

    try {
      const docRef = doc(collRef); // gera um novo ID
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
      Alert.alert("Sucesso", "Publicação criada!");
      closeCreateModal();
    } catch (err) {
      console.log("Erro ao criar post:", err);
      Alert.alert("Erro", "Falha ao criar post.");
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Consulta de Cartas (Pokémon TCG)</Text>
      <TextInput
        style={styles.searchInput}
        placeholder='Busque: "PGO 68", "PGO" ou "Pikachu"'
        placeholderTextColor="#999"
        value={searchQuery}
        onChangeText={handleSearchChange}
      />
      {loading && <ActivityIndicator size="large" color="#E3350D" />}

      <ScrollView contentContainerStyle={styles.cardList}>
        {!loading && filteredCards.length === 0 && searchQuery.length > 0 && (
          <Text style={styles.noResultsText}>Nenhum resultado encontrado.</Text>
        )}

        {filteredCards.map((card) => (
          <TouchableOpacity
            key={card.id}
            style={styles.cardItem}
            onPress={() => openCardModal(card)}
          >
            <Image
              source={{ uri: card.images.small }}
              style={styles.cardImage}
              resizeMode="contain"
            />
            <Text style={styles.cardName}>{card.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Modal de Detalhes */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeCardModal}
      >
        <View style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {selectedCard && (
              <>
                <Text style={styles.modalTitle}>{selectedCard.name}</Text>

                <Image
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
                      {Object.keys(selectedCard.tcgplayer.prices).map(
                        (rarity) => {
                          const priceData =
                            selectedCard.tcgplayer!.prices[rarity];
                          return (
                            <View key={rarity} style={styles.rarityCard}>
                              <Text style={styles.rarityCardTitle}>
                                {rarity}
                              </Text>
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
                        }
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.linkButton}
                      onPress={() =>
                        selectedCard.tcgplayer?.url &&
                        Linking.openURL(selectedCard.tcgplayer.url)
                      }
                    >
                      <Text style={styles.linkButtonText}>Abrir TCGPlayer</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.modalText}>
                    (Sem info de preço no TCGPlayer)
                  </Text>
                )}

                {/* Botões para "Tenho esta carta" ou "Quero esta carta" */}
                <View style={styles.actionButtonsContainer}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() =>
                      // Abre modal de criação
                      handleHaveOrWant(selectedCard, "have")
                    }
                  >
                    <Text style={styles.actionButtonText}>
                      Tenho esta carta
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleHaveOrWant(selectedCard, "want")}
                  >
                    <Text style={styles.actionButtonText}>
                      Quero esta carta
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={closeCardModal}
                >
                  <Text style={styles.closeButtonText}>Fechar</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Modal de Criação/Edição de Card */}
      <Modal
        visible={createState.visible}
        animationType="slide"
        onRequestClose={closeCreateModal}
      >
        <SafeAreaView style={styles.modalCreateContainer}>
          <ScrollView style={{ padding: 16 }}>
            {createState.card && (
              <>
                <Text style={styles.modalTitle}>
                  {createState.action === "have"
                    ? "Tenho esta carta"
                    : "Quero esta carta"}
                </Text>

                <Image
                  source={{ uri: createState.card.images.small }}
                  style={styles.modalImage}
                  resizeMode="contain"
                />
                <Text style={styles.modalText}>{createState.card.name}</Text>

                {/* Se action="have", escolhe sale ou trade */}
                {createState.action === "have" ? (
                  <>
                    <Text style={styles.modalLabel}>Tipo</Text>
                    <View style={{ flexDirection: "row", marginBottom: 10 }}>
                      <TouchableOpacity
                        style={[
                          styles.switchTypeButton,
                          createState.type === "sale" &&
                            styles.switchTypeButtonActive,
                        ]}
                        onPress={() =>
                          setCreateState((prev) => ({ ...prev, type: "sale" }))
                        }
                      >
                        <Text style={styles.switchTypeText}>Venda</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.switchTypeButton,
                          createState.type === "trade" &&
                            styles.switchTypeButtonActive,
                        ]}
                        onPress={() =>
                          setCreateState((prev) => ({ ...prev, type: "trade" }))
                        }
                      >
                        <Text style={styles.switchTypeText}>Troca</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Se type=sale, define price */}
                    {createState.type === "sale" && (
                      <>
                        <Text style={styles.modalLabel}>Preço</Text>
                        <View
                          style={{ flexDirection: "row", marginBottom: 12 }}
                        >
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
                            <Text style={styles.switchTypeText}>Liga-%</Text>
                          </TouchableOpacity>
                        </View>

                        {createState.priceMode === "manual" ? (
                          <TextInput
                            style={styles.modalInput}
                            value={createState.priceValue}
                            onChangeText={(val) =>
                              setCreateState((prev) => ({
                                ...prev,
                                priceValue: val,
                              }))
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
                ) : (
                  // se action= "want", definimos type="want" fixo
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
                    <Text style={styles.buttonText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.button}
                    onPress={handleSavePost}
                  >
                    <Text style={styles.buttonText}>Salvar</Text>
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

const DARK = "#1E1E1E";
const PRIMARY = "#E3350D";
const SECONDARY = "#FFFFFF";
const GRAY = "#2A2A2A";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK,
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 24,
    color: SECONDARY,
    textAlign: "center",
    marginBottom: 20,
    fontWeight: "bold",
  },
  searchInput: {
    backgroundColor: GRAY,
    color: SECONDARY,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    marginBottom: 10,
  },
  cardList: {
    alignItems: "center",
    paddingBottom: 20,
  },
  noResultsText: {
    color: SECONDARY,
    marginTop: 10,
  },
  cardItem: {
    backgroundColor: "#292929",
    padding: 10,
    marginVertical: 6,
    borderRadius: 8,
    width: "95%",
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
    backgroundColor: PRIMARY,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 10,
    alignSelf: "center",
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
    backgroundColor: "#4A4A4A",
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  actionButtonText: {
    color: SECONDARY,
    fontSize: 14,
    fontWeight: "bold",
  },
  closeButton: {
    backgroundColor: PRIMARY,
    padding: 12,
    borderRadius: 8,
    alignSelf: "center",
    marginTop: 30,
  },
  closeButtonText: {
    color: SECONDARY,
    fontWeight: "bold",
    fontSize: 16,
  },
  // Modal Create
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
    backgroundColor: "#444",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
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
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 16,
  },
  button: {
    backgroundColor: PRIMARY,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  buttonText: {
    color: SECONDARY,
    fontWeight: "bold",
  },
});
