import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image } from "react-native";
import { useLocalSearchParams } from "expo-router";
import axios from "axios"; // Biblioteca para requisições HTTP
import { doc, getDoc } from "firebase/firestore"; // Firestore
import { db } from "../../lib/firebaseConfig"; // Configuração do Firebase

interface CardLine {
  quantity: number;
  name: string;
  imageUrl?: string; // URL da imagem da carta
}

const API_KEY = "8d293a2a-4949-4d04-a06c-c20672a7a12c"; // Chave da API do Pokémon TCG

export default function DeckViewer() {
  const { deckName, deckId } = useLocalSearchParams(); // Corrigido para useLocalSearchParams
  const [cards, setCards] = useState<CardLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDeckAndCards() {
      if (!deckId) return;

      try {
        // Buscar o deck do Firestore
        const docRef = doc(db, "decks", deckId as string);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          console.log("Deck não encontrado no Firestore");
          return;
        }

        const deckData = docSnap.data();
        const cardLines: CardLine[] = deckData.cards || [];

        // Buscar detalhes de cada carta na API
        const updatedCards = await Promise.all(
          cardLines.map(async (card) => {
            try {
              const response = await axios.get(
                `https://api.pokemontcg.io/v2/cards?q=name:"${card.name}"`,
                {
                  headers: {
                    "X-Api-Key": API_KEY, // Inclui a chave da API
                  },
                }
              );
              const imageUrl = response.data.data[0]?.images?.small || null;
              return { ...card, imageUrl };
            } catch (error) {
              console.error(`Erro ao buscar a carta "${card.name}":`, error);
              return { ...card, imageUrl: null };
            }
          })
        );

        setCards(updatedCards);
      } catch (error) {
        console.error("Erro ao buscar deck ou cartas:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDeckAndCards();
  }, [deckId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando Deck...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Visualizar Deck</Text>
      <Text style={styles.deckName}>Deck: {deckName || "Sem nome"}</Text>
      <Text style={styles.deckName}>ID: {deckId || "?"}</Text>

      <ScrollView contentContainerStyle={styles.gridContainer}>
        {cards.map((card, index) => (
          <View style={styles.cardItem} key={`${card.name}-${index}`}>
            {card.imageUrl ? (
              <Image
                source={{ uri: card.imageUrl }}
                style={styles.cardImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.placeholderText}>Imagem não disponível</Text>
            )}
            <Text style={styles.cardText}>
              {card.quantity}x {card.name}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    padding: 16,
  },
  title: {
    color: "#E3350D",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  deckName: {
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 6,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 8,
  },
  cardItem: {
    width: "45%",
    backgroundColor: "#333",
    margin: 5,
    borderRadius: 6,
    padding: 10,
    alignItems: "center",
  },
  cardText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "500",
    marginTop: 6,
    textAlign: "center",
  },
  cardImage: {
    width: "100%",
    height: 120,
  },
  placeholderText: {
    color: "#FFF",
    fontSize: 12,
    textAlign: "center",
    marginTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
  },
  loadingText: {
    color: "#FFF",
    fontSize: 16,
  },
});
