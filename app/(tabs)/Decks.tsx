import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  FlatList,
} from "react-native";

// 1) Importa o polyfill ANTES de tudo
import "react-native-get-random-values";

// 2) Agora importa o uuid
import { v4 as uuidv4 } from "uuid";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";

/** Tipos */
interface CardLine {
  id: string;
  quantity: number;
  name: string;
  expansion?: string | null;
  cardNumber?: string | null;
}

interface DeckData {
  id: string;
  name: string;
  createdAt: string;
  collectionId: string;
  pokemons: CardLine[];
  trainers: CardLine[];
  energies: CardLine[];
}

interface CollectionItem {
  id: string;
  name: string;
}

export default function DecksScreen() {
  const { t } = useTranslation();

  // Armazena coleções e decks localmente
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [decks, setDecks] = useState<DeckData[]>([]);

  // Form para criar deck
  const [deckName, setDeckName] = useState("");
  const [deckContent, setDeckContent] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");

  // Modal de edição do deck
  const [modalVisible, setModalVisible] = useState(false);
  const [editDeckId, setEditDeckId] = useState<string | null>(null);
  const [editDeckName, setEditDeckName] = useState("");
  const [editCollectionId, setEditCollectionId] = useState("");
  const [editPokemons, setEditPokemons] = useState<CardLine[]>([]);
  const [editTrainers, setEditTrainers] = useState<CardLine[]>([]);
  const [editEnergies, setEditEnergies] = useState<CardLine[]>([]);

  // Modal para gerenciar coleções
  const [collectionsModalVisible, setCollectionsModalVisible] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");

  // ------------------- Carrega dados locais -------------------
  useEffect(() => {
    loadLocalData();
  }, []);

  async function loadLocalData() {
    try {
      // Carrega coleções
      const colStr = await AsyncStorage.getItem("@decksCollections");
      if (colStr) {
        const arr: CollectionItem[] = JSON.parse(colStr);
        setCollections(arr);
      } else {
        // Se não houver coleções, cria uma padrão
        const defaultCollection: CollectionItem = {
          id: uuidv4(),
          name: "Padrão",
        };
        await AsyncStorage.setItem(
          "@decksCollections",
          JSON.stringify([defaultCollection])
        );
        setCollections([defaultCollection]);
      }

      // Carrega decks
      const decksStr = await AsyncStorage.getItem("@decksList");
      if (decksStr) {
        const arr: DeckData[] = JSON.parse(decksStr);
        setDecks(arr);
      } else {
        setDecks([]);
      }
    } catch (err) {
      console.log("Erro ao carregar local data:", err);
    }
  }

  // ------------------- Save Collections (AsyncStorage) -------------------
  async function saveCollections(newCollections: CollectionItem[]) {
    setCollections(newCollections);
    try {
      await AsyncStorage.setItem(
        "@decksCollections",
        JSON.stringify(newCollections)
      );
    } catch (err) {
      console.log("Erro ao salvar coleções no AsyncStorage:", err);
    }
  }

  // ------------------- Save Decks (AsyncStorage) -------------------
  async function saveDecks(newDecks: DeckData[]) {
    setDecks(newDecks);
    try {
      await AsyncStorage.setItem("@decksList", JSON.stringify(newDecks));
    } catch (err) {
      console.log("Erro ao salvar decks no AsyncStorage:", err);
    }
  }

  // ------------------- parseDeckContent -------------------
  function parseDeckContent(content: string) {
    const lines = content.split("\n").map((l) => l.trim());
    const pokemons: CardLine[] = [];
    const trainers: CardLine[] = [];
    const energies: CardLine[] = [];

    let currentBlock: "POKEMON" | "TRAINER" | "ENERGY" | "" = "";

    for (let line of lines) {
      if (!line || line.toLowerCase().startsWith("total de cartas:")) {
        continue;
      }
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

      const parsedLine = parseSingleLine(line);
      if (currentBlock === "POKEMON") pokemons.push(parsedLine);
      else if (currentBlock === "TRAINER") trainers.push(parsedLine);
      else if (currentBlock === "ENERGY") energies.push(parsedLine);
    }
    return { pokemons, trainers, energies };
  }

  function parseSingleLine(line: string): CardLine {
    const tokens = line.split(" ").filter(Boolean);
    let quantity = 1;
    let expansion: string | null = null;
    let cardNumber: string | null = null;
    let nameParts: string[] = [];

    const first = tokens[0];
    const qNum = parseInt(first ?? "");
    let startIndex = 0;
    if (!isNaN(qNum) && qNum > 0) {
      quantity = qNum;
      startIndex = 1;
    }

    let i = startIndex;
    while (i < tokens.length) {
      const t = tokens[i];
      const reg3letters = /^[A-Z]{3}$/;
      if (reg3letters.test(t)) {
        expansion = t;
        if (i + 1 < tokens.length) {
          const nextTok = tokens[i + 1];
          const nextNum = parseInt(nextTok);
          if (!isNaN(nextNum)) {
            cardNumber = nextTok;
            i += 2;
            continue;
          }
        }
        i++;
        continue;
      }

      const maybeNum = parseInt(t);
      if (!isNaN(maybeNum)) {
        cardNumber = t;
        i++;
        continue;
      }

      nameParts.push(t);
      i++;
    }

    return {
      id: uuidv4(),
      quantity,
      name: nameParts.join(" ") || "",
      expansion,
      cardNumber,
    };
  }

  function sanitizeCardLines(lines: CardLine[]): CardLine[] {
    return lines.map((c) => ({
      ...c,
      quantity: c.quantity > 0 ? c.quantity : 1,
      name: c.name || "",
    }));
  }

  // ------------------- handleCreateDeck (Local) -------------------
  async function handleCreateDeck() {
    if (!deckName.trim()) {
      Alert.alert("Erro", "Insira um nome para o deck.");
      return;
    }
    if (!selectedCollectionId) {
      Alert.alert("Erro", "Selecione uma coleção.");
      return;
    }
    const parsed = parseDeckContent(deckContent);
    const { pokemons, trainers, energies } = parsed;

    const safePokemons = sanitizeCardLines(pokemons);
    const safeTrainers = sanitizeCardLines(trainers);
    const safeEnergies = sanitizeCardLines(energies);

    if (
      safePokemons.length === 0 &&
      safeTrainers.length === 0 &&
      safeEnergies.length === 0
    ) {
      Alert.alert("Erro", "Nenhuma carta detectada no texto.");
      return;
    }

    const newDeck: DeckData = {
      id: uuidv4(),
      name: deckName.trim(),
      createdAt: new Date().toISOString(),
      collectionId: selectedCollectionId,
      pokemons: safePokemons,
      trainers: safeTrainers,
      energies: safeEnergies,
    };

    const newDecks = [...decks, newDeck];
    await saveDecks(newDecks);

    Alert.alert("Sucesso", "Deck criado com sucesso!");
    setDeckName("");
    setDeckContent("");
    setSelectedCollectionId("");
  }

  // ------------------- handleDeleteDeck (Local) -------------------
  async function handleDeleteDeck(deckId: string) {
    const newDecks = decks.filter((d) => d.id !== deckId);
    await saveDecks(newDecks);
    Alert.alert("Sucesso", "Deck excluído.");
  }

  // ------------------- openEditModal (Local) -------------------
  function openEditModal(deck: DeckData) {
    setEditDeckId(deck.id);
    setEditDeckName(deck.name);
    setEditCollectionId(deck.collectionId);
    setEditPokemons([...deck.pokemons]);
    setEditTrainers([...deck.trainers]);
    setEditEnergies([...deck.energies]);
    setModalVisible(true);
  }

  function addLine(cat: "POKEMON" | "TRAINER" | "ENERGY") {
    const newCard: CardLine = {
      id: uuidv4(),
      quantity: 1,
      name: "",
    };
    if (cat === "POKEMON") {
      setEditPokemons((prev) => [...prev, newCard]);
    } else if (cat === "TRAINER") {
      setEditTrainers((prev) => [...prev, newCard]);
    } else {
      setEditEnergies((prev) => [...prev, newCard]);
    }
  }

  function removeLine(cat: "POKEMON" | "TRAINER" | "ENERGY", id: string) {
    if (cat === "POKEMON") {
      setEditPokemons((prev) => prev.filter((p) => p.id !== id));
    } else if (cat === "TRAINER") {
      setEditTrainers((prev) => prev.filter((p) => p.id !== id));
    } else {
      setEditEnergies((prev) => prev.filter((p) => p.id !== id));
    }
  }

  // ------------------- handleSaveEdit (Local) -------------------
  async function handleSaveEdit() {
    if (!editDeckId) return;

    const safePokemons = sanitizeCardLines(editPokemons);
    const safeTrainers = sanitizeCardLines(editTrainers);
    const safeEnergies = sanitizeCardLines(editEnergies);

    // Salva local
    const updatedDecks = decks.map((dk) => {
      if (dk.id === editDeckId) {
        return {
          ...dk,
          name: editDeckName.trim(),
          collectionId: editCollectionId,
          pokemons: safePokemons,
          trainers: safeTrainers,
          energies: safeEnergies,
        };
      }
      return dk;
    });

    await saveDecks(updatedDecks);
    Alert.alert("Sucesso", "Deck atualizado.");
    setModalVisible(false);
  }

  // ------------------- Coleções (Local) -------------------
  function openCollectionsModal() {
    setCollectionsModalVisible(true);
    setNewCollectionName("");
  }

  async function handleCreateCollection() {
    if (!newCollectionName.trim()) {
      Alert.alert("Erro", "Digite um nome para a coleção.");
      return;
    }
    // Verifica se já existe
    const alreadyExists = collections.some(
      (c) => c.name.toLowerCase() === newCollectionName.trim().toLowerCase()
    );
    if (alreadyExists) {
      Alert.alert("Erro", "Já existe uma coleção com este nome.");
      return;
    }

    const newCol: CollectionItem = {
      id: uuidv4(),
      name: newCollectionName.trim(),
    };

    const newCols = [...collections, newCol];
    await saveCollections(newCols);
    setNewCollectionName("");
    Alert.alert("Sucesso", "Coleção criada com sucesso.");
  }

  async function handleDeleteCollection(colId: string) {
    // Se tiver decks nessa coleção, não pode excluir
    const hasDecks = decks.some((d) => d.collectionId === colId);
    if (hasDecks) {
      Alert.alert("Erro", "Existe(m) deck(s) nessa coleção. Exclua os decks primeiro.");
      return;
    }
    const newCols = collections.filter((c) => c.id !== colId);
    await saveCollections(newCols);
    Alert.alert("Sucesso", "Coleção removida.");
  }

  function calculateTotalFromCards(cards: CardLine[]): number {
    return cards.reduce((sum, c) => sum + c.quantity, 0);
  }

  // ------------------- Render -------------------
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text style={styles.heading}>MEUS DECKS</Text>

        <TouchableOpacity
          style={styles.collectionsButton}
          onPress={openCollectionsModal}
        >
          <Text style={styles.collectionsButtonText}>Gerenciar Coleções</Text>
        </TouchableOpacity>

        <ScrollView style={{ flex: 1 }}>
          {decks.map((deck) => {
            const colName =
              collections.find((c) => c.id === deck.collectionId)?.name ||
              "???";
            return (
              <View key={deck.id} style={styles.deckCard}>
                <TouchableOpacity onPress={() => openEditModal(deck)}>
                  <Text style={styles.deckTitle}>{deck.name}</Text>
                  <Text style={styles.deckInfo}>
                    Criado em: {new Date(deck.createdAt).toLocaleString()}
                  </Text>
                  <Text style={styles.deckInfo}>Coleção: {colName}</Text>
                  <Text style={styles.deckInfo}>
                    Pokémons: {calculateTotalFromCards(deck.pokemons)} | Treinadores:{" "}
                    {calculateTotalFromCards(deck.trainers)} | Energias:{" "}
                    {calculateTotalFromCards(deck.energies)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() =>
                    Alert.alert(
                      "Excluir Deck",
                      `Deseja excluir o deck "${deck.name}"?`,
                      [
                        { text: "Cancelar", style: "cancel" },
                        {
                          text: "Excluir",
                          style: "destructive",
                          onPress: () => handleDeleteDeck(deck.id),
                        },
                      ]
                    )
                  }
                >
                  <Text style={styles.deleteButtonText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Form p/ criar deck */}
          <View style={styles.form}>
            <Text style={styles.label}>Nome do Deck</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Deck Pikachu..."
              placeholderTextColor="#aaa"
              value={deckName}
              onChangeText={setDeckName}
            />

            <Text style={styles.label}>Selecione a Coleção</Text>
            {collections.length === 0 ? (
              <Text style={{ color: "#999", fontStyle: "italic" }}>
                Nenhuma coleção
              </Text>
            ) : (
              <FlatList
                data={collections}
                horizontal
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 40, marginBottom: 12 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.colBubble,
                      item.id === selectedCollectionId && styles.colBubbleSelected,
                    ]}
                    onPress={() => setSelectedCollectionId(item.id)}
                  >
                    <Text style={styles.colBubbleText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
            )}

            <Text style={styles.label}>Conteúdo do Deck (texto)</Text>
            <Text style={styles.tip}>
              Coloque "Pokémon:", "Treinador:", "Energia:" para separar as seções
            </Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              multiline
              placeholder={`Exemplo:\nPokémon:\n4 Pikachu SUM 42\n3 Raichu SUM 43\nTreinador:\n4 Poké Bola\nEnergia:\n6 Lightning`}
              placeholderTextColor="#aaa"
              value={deckContent}
              onChangeText={setDeckContent}
            />

            <TouchableOpacity style={styles.button} onPress={handleCreateDeck}>
              <Text style={styles.buttonText}>Criar Deck</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal de edição */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView style={{ padding: 16 }}>
            <Text style={styles.modalHeading}>Editar Deck</Text>
            <Text style={styles.label}>Nome do Deck</Text>
            <TextInput
              style={styles.input}
              value={editDeckName}
              onChangeText={setEditDeckName}
            />

            <Text style={styles.label}>Coleção</Text>
            <FlatList
              data={collections}
              horizontal
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 40, marginBottom: 12 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.colBubble,
                    item.id === editCollectionId && styles.colBubbleSelected,
                  ]}
                  onPress={() => setEditCollectionId(item.id)}
                >
                  <Text style={styles.colBubbleText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />

            {/* Pokémons */}
            <Text style={styles.sectionTitle}>Pokémons</Text>
            {editPokemons.map((card) => (
              <View style={styles.cardLineContainer} key={card.id}>
                <TextInput
                  style={[styles.inputLine, { flex: 1 }]}
                  keyboardType="numeric"
                  value={String(card.quantity)}
                  onChangeText={(val) => {
                    const num = parseInt(val || "") || 1;
                    setEditPokemons((prev) =>
                      prev.map((p) =>
                        p.id === card.id ? { ...p, quantity: num } : p
                      )
                    );
                  }}
                />
                <TextInput
                  style={[styles.inputLine, { flex: 3 }]}
                  placeholder="Nome"
                  value={card.name}
                  onChangeText={(v) => {
                    setEditPokemons((prev) =>
                      prev.map((p) =>
                        p.id === card.id ? { ...p, name: v } : p
                      )
                    );
                  }}
                />
                <TextInput
                  style={[styles.inputLine, { flex: 1 }]}
                  placeholder="EXP"
                  value={card.expansion ?? ""}
                  onChangeText={(v) => {
                    setEditPokemons((prev) =>
                      prev.map((p) =>
                        p.id === card.id ? { ...p, expansion: v || null } : p
                      )
                    );
                  }}
                />
                <TextInput
                  style={[styles.inputLine, { flex: 1 }]}
                  placeholder="No."
                  value={card.cardNumber ?? ""}
                  onChangeText={(v) => {
                    setEditPokemons((prev) =>
                      prev.map((p) =>
                        p.id === card.id ? { ...p, cardNumber: v || null } : p
                      )
                    );
                  }}
                />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeLine("POKEMON", card.id)}
                >
                  <Text style={styles.removeButtonText}>X</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.buttonSmall, { backgroundColor: "#555" }]}
              onPress={() => addLine("POKEMON")}
            >
              <Text style={styles.buttonText}>+ Pokémon</Text>
            </TouchableOpacity>

            {/* Treinadores */}
            <Text style={styles.sectionTitle}>Treinadores</Text>
            {editTrainers.map((card) => (
              <View style={styles.cardLineContainer} key={card.id}>
                <TextInput
                  style={[styles.inputLine, { flex: 1 }]}
                  keyboardType="numeric"
                  value={String(card.quantity)}
                  onChangeText={(val) => {
                    const num = parseInt(val || "") || 1;
                    setEditTrainers((prev) =>
                      prev.map((p) =>
                        p.id === card.id ? { ...p, quantity: num } : p
                      )
                    );
                  }}
                />
                <TextInput
                  style={[styles.inputLine, { flex: 3 }]}
                  placeholder="Nome"
                  value={card.name}
                  onChangeText={(v) => {
                    setEditTrainers((prev) =>
                      prev.map((p) =>
                        p.id === card.id ? { ...p, name: v } : p
                      )
                    );
                  }}
                />
                <TextInput
                  style={[styles.inputLine, { flex: 1 }]}
                  placeholder="EXP"
                  value={card.expansion ?? ""}
                  onChangeText={(v) => {
                    setEditTrainers((prev) =>
                      prev.map((p) =>
                        p.id === card.id ? { ...p, expansion: v || null } : p
                      )
                    );
                  }}
                />
                <TextInput
                  style={[styles.inputLine, { flex: 1 }]}
                  placeholder="No."
                  value={card.cardNumber ?? ""}
                  onChangeText={(v) => {
                    setEditTrainers((prev) =>
                      prev.map((p) =>
                        p.id === card.id ? { ...p, cardNumber: v || null } : p
                      )
                    );
                  }}
                />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeLine("TRAINER", card.id)}
                >
                  <Text style={styles.removeButtonText}>X</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.buttonSmall, { backgroundColor: "#555" }]}
              onPress={() => addLine("TRAINER")}
            >
              <Text style={styles.buttonText}>+ Treinador</Text>
            </TouchableOpacity>

            {/* Energias */}
            <Text style={styles.sectionTitle}>Energias</Text>
            {editEnergies.map((card) => (
              <View style={styles.cardLineContainer} key={card.id}>
                <TextInput
                  style={[styles.inputLine, { flex: 1 }]}
                  keyboardType="numeric"
                  value={String(card.quantity)}
                  onChangeText={(val) => {
                    const num = parseInt(val || "") || 1;
                    setEditEnergies((prev) =>
                      prev.map((p) =>
                        p.id === card.id ? { ...p, quantity: num } : p
                      )
                    );
                  }}
                />
                <TextInput
                  style={[styles.inputLine, { flex: 3 }]}
                  placeholder="Nome"
                  value={card.name}
                  onChangeText={(v) => {
                    setEditEnergies((prev) =>
                      prev.map((p) =>
                        p.id === card.id ? { ...p, name: v } : p
                      )
                    );
                  }}
                />
                <TextInput
                  style={[styles.inputLine, { flex: 1 }]}
                  placeholder="EXP"
                  value={card.expansion ?? ""}
                  onChangeText={(v) => {
                    setEditEnergies((prev) =>
                      prev.map((p) =>
                        p.id === card.id ? { ...p, expansion: v || null } : p
                      )
                    );
                  }}
                />
                <TextInput
                  style={[styles.inputLine, { flex: 1 }]}
                  placeholder="No."
                  value={card.cardNumber ?? ""}
                  onChangeText={(v) => {
                    setEditEnergies((prev) =>
                      prev.map((p) =>
                        p.id === card.id ? { ...p, cardNumber: v || null } : p
                      )
                    );
                  }}
                />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeLine("ENERGY", card.id)}
                >
                  <Text style={styles.removeButtonText}>X</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.buttonSmall, { backgroundColor: "#555" }]}
              onPress={() => addLine("ENERGY")}
            >
              <Text style={styles.buttonText}>+ Energia</Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: "#999" }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.button} onPress={handleSaveEdit}>
                <Text style={styles.buttonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal de Coleções */}
      <Modal
        visible={collectionsModalVisible}
        animationType="slide"
        onRequestClose={() => setCollectionsModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <Text style={styles.modalHeading}>Coleções</Text>

          <FlatList
            data={collections}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.colRow}>
                <Text style={styles.colName}>{item.name}</Text>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => {
                    // se tiver decks nessa coleção, não pode excluir
                    const hasDecks = decks.some((d) => d.collectionId === item.id);
                    if (hasDecks) {
                      Alert.alert(
                        "Erro",
                        "Existe(m) deck(s) nessa coleção. Exclua-os primeiro."
                      );
                      return;
                    }
                    Alert.alert(
                      "Excluir Coleção",
                      `Deseja excluir a coleção "${item.name}"?`,
                      [
                        { text: "Cancelar", style: "cancel" },
                        {
                          text: "Excluir",
                          style: "destructive",
                          onPress: async () => {
                            const newCols = collections.filter((c) => c.id !== item.id);
                            await saveCollections(newCols);
                            Alert.alert("Sucesso", "Coleção removida.");
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Text style={styles.deleteButtonText}>X</Text>
                </TouchableOpacity>
              </View>
            )}
          />

          <View style={{ padding: 16 }}>
            <Text style={styles.label}>Nova Coleção</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Standard"
              placeholderTextColor="#aaa"
              value={newCollectionName}
              onChangeText={setNewCollectionName}
            />
            <TouchableOpacity style={styles.button} onPress={handleCreateCollection}>
              <Text style={styles.buttonText}>Criar Coleção</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, { margin: 16, backgroundColor: "#666" }]}
            onPress={() => setCollectionsModalVisible(false)}
          >
            <Text style={styles.buttonText}>Fechar</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const DARK = "#1E1E1E";
const PRIMARY = "#E3350D";
const WHITE = "#FFFFFF";
const GRAY = "#333333";

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: DARK,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  heading: {
    fontSize: 22,
    color: WHITE,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
  },
  deckCard: {
    backgroundColor: GRAY,
    borderRadius: 8,
    padding: 12,
    marginVertical: 6,
  },
  deckTitle: {
    color: WHITE,
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 4,
  },
  deckInfo: {
    color: "#bbb",
    fontSize: 13,
  },
  form: {
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  label: {
    color: WHITE,
    fontSize: 14,
    marginTop: 8,
  },
  tip: {
    color: "#888",
    fontSize: 12,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#4A4A4A",
    color: WHITE,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    marginVertical: 6,
  },
  button: {
    backgroundColor: PRIMARY,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "bold",
  },
  collectionsButton: {
    backgroundColor: "#666",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: "center",
  },
  collectionsButtonText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: "bold",
  },
  deleteButton: {
    backgroundColor: "#FF3B30",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 10,
    alignSelf: "flex-start",
  },
  deleteButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: DARK,
  },
  modalHeading: {
    fontSize: 20,
    color: WHITE,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 16,
  },
  buttonSmall: {
    backgroundColor: PRIMARY,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 6,
    alignSelf: "flex-start",
  },
  removeButton: {
    backgroundColor: "#888",
    marginLeft: 4,
    padding: 6,
    borderRadius: 4,
  },
  removeButtonText: {
    color: WHITE,
    fontWeight: "bold",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 20,
  },
  sectionTitle: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  cardLineContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  inputLine: {
    backgroundColor: "#4A4A4A",
    color: WHITE,
    borderRadius: 6,
    marginHorizontal: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
  },
  colBubble: {
    backgroundColor: "#444",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
    marginVertical: 6,
  },
  colBubbleSelected: {
    backgroundColor: PRIMARY,
  },
  colBubbleText: {
    color: WHITE,
    fontWeight: "bold",
  },
  colRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
    borderBottomColor: "#666",
    borderBottomWidth: 1,
  },
  colName: {
    color: WHITE,
    fontSize: 16,
  },
});
