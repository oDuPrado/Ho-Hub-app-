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

/** Estrutura de dados da carta retornada pela API */
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

/** Estrutura de dados do set (coleção) */
interface CollectionData {
  id: string; // ex.: "pgo"
  name: string; // ex.: "Pokémon GO"
  ptcgoCode?: string; // ex.: "PGO"
}

/** Componente principal da tela de trocas */
export default function TradeScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCards, setFilteredCards] = useState<CardData[]>([]);
  const [collections, setCollections] = useState<CollectionData[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(false);

  /** Carrega as coleções na montagem */
  useEffect(() => {
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

  /**
   * Faz a busca de acordo com a string digitada:
   * - Se contiver " " e bater com (setcode + number), ex: "PGO 68"
   * - Se corresponder a algum setcode sozinho, ex: "PGO"
   * - Senão, assume que é nome da carta, ex: "Pikachu"
   */
  async function searchCard(query: string) {
    setLoading(true);
    try {
      const text = query.trim();
      // se for só número, ignore
      if (/^\d+$/.test(text)) {
        setFilteredCards([]);
        setLoading(false);
        return;
      }

      // 1) Tenta setCode + number
      const parts = text.split(/\s+/); // separa por espaços
      if (parts.length === 2) {
        // Ex.: "PGO" "68"
        const setCode = parts[0].toUpperCase();
        const cardNumber = parts[1];
        // Tenta achar collection com ptcgoCode = setCode
        const matchedSet = collections.find(
          (c) => (c.ptcgoCode || "").toUpperCase() === setCode
        );
        if (matchedSet) {
          // faz a query para set.id e number
          const url = `https://api.pokemontcg.io/v2/cards?q=set.id:"${matchedSet.id}" number:"${cardNumber}"`;
          console.log("Consulta à API (set+num):", url);
          const response = await fetch(url);
          const data = await response.json();
          if (data && data.data) {
            setFilteredCards(data.data);
          } else {
            setFilteredCards([]);
          }
          setLoading(false);
          return;
        }
      }

      // 2) Tenta achar se text bate com setCode (apenas 1 parte ou +)
      const up = text.toUpperCase();
      const matchedSet2 = collections.find(
        (c) => (c.ptcgoCode || "").toUpperCase() === up
      );
      if (matchedSet2) {
        // retorna todas as cartas do set
        const url = `https://api.pokemontcg.io/v2/cards?q=set.id:"${matchedSet2.id}"`;
        console.log("Consulta à API (apenas set):", url);
        const resp = await fetch(url);
        const data = await resp.json();
        if (data && data.data) {
          setFilteredCards(data.data);
        } else {
          setFilteredCards([]);
        }
        setLoading(false);
        return;
      }

      // 3) Se não bateu, assume que é nome de carta
      // ex: "Pikachu"
      const nameUrl = `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(
        text
      )}"`;
      console.log("Consulta à API (nome):", nameUrl);
      const resp2 = await fetch(nameUrl);
      const data2 = await resp2.json();
      if (data2 && data2.data) {
        setFilteredCards(data2.data);
      } else {
        setFilteredCards([]);
      }
    } catch (error) {
      console.error("Erro ao buscar cartas:", error);
      setFilteredCards([]);
    } finally {
      setLoading(false);
    }
  }

  /** Chamado quando o texto do input muda */
  function handleSearchChange(txt: string) {
    setSearchQuery(txt);
    searchCard(txt);
  }

  /** Abre modal de detalhes */
  function openCardModal(card: CardData) {
    setSelectedCard(card);
  }

  /** Fecha modal de detalhes */
  function closeCardModal() {
    setSelectedCard(null);
  }

  /** Lida com clique em "Tenho essa carta" ou "Quero essa carta" */
  function handleCardAction(action: "have" | "want") {
    Alert.alert(
      action === "have" ? "Você tem a carta" : "Você quer a carta",
      "É para Troca ou Compra/Venda?",
      [
        {
          text: "Troca",
          onPress: () => console.log(action, "Troca"),
        },
        {
          text: "Compra/Venda",
          onPress: () => console.log(action, "Compra/Venda"),
        },
        {
          text: "Cancelar",
          style: "cancel",
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Área de Trocas</Text>

      <TextInput
        style={styles.searchInput}
        placeholder='Busque por "PGO 68", "PGO" ou "Pikachu"'
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

      {/* Modal de Detalhes da Carta */}
      {selectedCard && (
        <Modal
          visible={!!selectedCard}
          animationType="slide"
          transparent={false}
          onRequestClose={closeCardModal}
        >
          <View style={styles.modalContainer}>
            <ScrollView contentContainerStyle={styles.modalScroll}>
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

                  {/* Container de raridades em "linha" com wrap */}
                  <View style={styles.rarityRow}>
                    {Object.keys(selectedCard.tcgplayer.prices).map(
                      (rarity) => {
                        const priceData =
                          selectedCard.tcgplayer!.prices[rarity];
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
                  (Nenhuma informação de preço disponível)
                </Text>
              )}

              {/* Botões de ação */}
              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleCardAction("have")}
                >
                  <Text style={styles.actionButtonText}>Tenho esta carta</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleCardAction("want")}
                >
                  <Text style={styles.actionButtonText}>Quero esta carta</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={closeCardModal}
              >
                <Text style={styles.closeButtonText}>Fechar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

/** Estilos */
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
});
