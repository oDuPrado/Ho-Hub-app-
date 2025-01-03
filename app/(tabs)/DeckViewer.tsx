import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function DeckViewer({ route }: any) {
  const { deck } = route.params; // Pegando o nome do deck passado pela navegação

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Visualizar Deck</Text>
      <Text style={styles.deckName}>Deck: {deck}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
  },
  title: {
    color: "#E3350D",
    fontSize: 24,
    fontWeight: "bold",
  },
  deckName: {
    color: "#FFFFFF",
    fontSize: 18,
    marginTop: 10,
  },
});
