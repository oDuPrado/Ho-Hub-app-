// app/(tabs)/decks.tsx
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
} from "react-native";
import {
  collection,
  onSnapshot,
  deleteDoc,
  addDoc,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "../../lib/firebaseConfig";
import { v4 as uuidv4 } from "uuid";
import { useTranslation } from "react-i18next";

import * as Animatable from "react-native-animatable";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface CardLine {
  _tempId: string;
  quantity: number;
  name: string;
  expansion?: string | null;
  cardNumber?: string | null;
}

interface DeckData {
  id: string;
  name: string;
  createdAt: string;
  pokemons: CardLine[];
  trainers: CardLine[];
  energies: CardLine[];
}

export default function DecksScreen() {
  const { t } = useTranslation();

  const [deckName, setDeckName] = useState("");
  const [deckContent, setDeckContent] = useState("");

  const [decks, setDecks] = useState<DeckData[]>([]);
  const [authUid, setAuthUid] = useState("");
  const [playerId, setPlayerId] = useState("");

  // Loading
  const [loading, setLoading] = useState(false);

  // Modal de edição
  const [modalVisible, setModalVisible] = useState(false);
  const [editDeckId, setEditDeckId] = useState<string | null>(null);
  const [editDeckName, setEditDeckName] = useState("");
  const [editPokemons, setEditPokemons] = useState<CardLine[]>([]);
  const [editTrainers, setEditTrainers] = useState<CardLine[]>([]);
  const [editEnergies, setEditEnergies] = useState<CardLine[]>([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (user?.uid) {
      setAuthUid(user.uid);
    }
    (async () => {
      try {
        const storedId = await AsyncStorage.getItem("@userId");
        if (storedId) {
          setPlayerId(storedId);
        }
      } catch (err) {
        console.log("Erro ao obter @userId:", err);
      }
    })();
  }, []);

  useEffect(() => {
    if (!playerId) return;

    setLoading(true);
    const decksRef = collection(db, "decks");
    const q = query(decksRef, where("playerId", "==", playerId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const newDecks: DeckData[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          newDecks.push({
            id: docSnap.id,
            name: d.name,
            createdAt: d.createdAt,
            pokemons: convertFirestoreToCardLines(d.pokemons),
            trainers: convertFirestoreToCardLines(d.trainers),
            energies: convertFirestoreToCardLines(d.energies),
          });
        });
        setDecks(newDecks);
        setLoading(false);
      },
      (error) => {
        console.log("Erro no onSnapshot decks:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [playerId]);

  function convertFirestoreToCardLines(arr?: any[]): CardLine[] {
    if (!arr) return [];
    return arr.map((item) => ({
      _tempId: uuidv4(),
      quantity: item.quantity || 1,
      name: item.name || "",
      expansion: item.expansion || null,
      cardNumber: item.cardNumber || null,
    }));
  }

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

      if (!currentBlock) {
        continue;
      }

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
      const reg3letters = /^[A-Z]{3}$/; // Ex: "SWS" "BST"
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
      _tempId: uuidv4(),
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

  async function handleCreateDeck() {
    if (!authUid) {
      Alert.alert(t("common.error"), "Usuário não logado (authUid).");
      return;
    }
    if (!deckName.trim()) {
      Alert.alert(t("common.error"), t("decks.label_name"));
      return;
    }

    const { pokemons, trainers, energies } = parseDeckContent(deckContent);
    const safePokemons = sanitizeCardLines(pokemons);
    const safeTrainers = sanitizeCardLines(trainers);
    const safeEnergies = sanitizeCardLines(energies);

    if (
      safePokemons.length === 0 &&
      safeTrainers.length === 0 &&
      safeEnergies.length === 0
    ) {
      Alert.alert(t("common.error"), t("decks.no_cards_detected"));
      return;
    }
    if (
      [...safePokemons, ...safeTrainers, ...safeEnergies].some(
        (c) => c.quantity < 1
      )
    ) {
      Alert.alert(t("common.error"), t("decks.invalid_quantity"));
      return;
    }

    try {
      setLoading(true);
      const decksRef = collection(db, "decks");
      await addDoc(decksRef, {
        authUid,
        playerId,
        name: deckName.trim(),
        createdAt: new Date().toISOString(),
        pokemons: safePokemons.map(toFirestoreCard),
        trainers: safeTrainers.map(toFirestoreCard),
        energies: safeEnergies.map(toFirestoreCard),
      });
      setLoading(false);
      Alert.alert(t("common.success"), t("decks.create_success"));
      setDeckName("");
      setDeckContent("");
    } catch (err) {
      console.log("Erro ao criar deck:", err);
      Alert.alert(t("common.error"), t("decks.create_error"));
      setLoading(false);
    }
  }

  function toFirestoreCard(c: CardLine) {
    return {
      quantity: c.quantity,
      name: c.name,
      expansion: c.expansion || null,
      cardNumber: c.cardNumber || null,
    };
  }

  async function handleDeleteDeck(deckId: string, deckName: string) {
    try {
      const deckRef = doc(db, "decks", deckId);
      const deckSnap = await getDoc(deckRef);

      if (!deckSnap.exists()) {
        Alert.alert(t("common.error"), "Deck não encontrado.");
        return;
      }
      const deckData = deckSnap.data();
      if (deckData.playerId !== playerId) {
        Alert.alert(t("common.error"), "Você não tem permissão.");
        return;
      }

      setLoading(true);
      await deleteDoc(deckRef);
      setLoading(false);
      Alert.alert(t("common.success"), t("decks.delete_success"));
    } catch (err) {
      console.log("Erro ao excluir deck:", err);
      Alert.alert(t("common.error"), t("decks.delete_error"));
      setLoading(false);
    }
  }

  function openEditModal(deck: DeckData) {
    setEditDeckId(deck.id);
    setEditDeckName(deck.name);
    setEditPokemons([...deck.pokemons]);
    setEditTrainers([...deck.trainers]);
    setEditEnergies([...deck.energies]);
    setModalVisible(true);
  }

  function addLine(category: "POKEMON" | "TRAINER" | "ENERGY") {
    const newLine: CardLine = {
      _tempId: uuidv4(),
      quantity: 1,
      name: "",
    };
    if (category === "POKEMON") setEditPokemons((prev) => [...prev, newLine]);
    else if (category === "TRAINER") setEditTrainers((prev) => [...prev, newLine]);
    else setEditEnergies((prev) => [...prev, newLine]);
  }

  function removeLine(category: "POKEMON" | "TRAINER" | "ENERGY", id: string) {
    if (category === "POKEMON") {
      setEditPokemons((prev) => prev.filter((c) => c._tempId !== id));
    } else if (category === "TRAINER") {
      setEditTrainers((prev) => prev.filter((c) => c._tempId !== id));
    } else {
      setEditEnergies((prev) => prev.filter((c) => c._tempId !== id));
    }
  }

  async function handleSaveEdit() {
    if (!editDeckId) return;

    const allCards = [...editPokemons, ...editTrainers, ...editEnergies];
    if (allCards.some((c) => c.quantity < 1)) {
      Alert.alert(t("common.error"), t("decks.invalid_quantity"));
      return;
    }

    try {
      setLoading(true);
      const deckRef = doc(db, "decks", editDeckId);
      await updateDoc(deckRef, {
        name: editDeckName.trim(),
        pokemons: editPokemons.map(toFirestoreCard),
        trainers: editTrainers.map(toFirestoreCard),
        energies: editEnergies.map(toFirestoreCard),
      });
      setLoading(false);
      Alert.alert(t("common.success"), t("decks.update_success"));
      setModalVisible(false);
    } catch (err) {
      console.log("Erro ao atualizar deck:", err);
      Alert.alert(t("common.error"), t("decks.update_error"));
      setLoading(false);
    }
  }

  function calculateTotalFromCards(cards: CardLine[]) {
    return cards.reduce((acc, c) => acc + c.quantity, 0);
  }

  // Render
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#1E1E1E" }}>
      {/* Header manual */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("decks.heading", "Meus Decks")}</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {loading && (
          <View style={styles.loadingOverlay}>
            <Animatable.Text
              animation="pulse"
              iterationCount="infinite"
              style={styles.loadingText}
            >
              Carregando...
            </Animatable.Text>
          </View>
        )}

        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
          {/* Lista de decks */}
          {decks.map((deck) => (
            <Animatable.View
              key={deck.id}
              style={styles.deckCard}
              animation="fadeInUp"
            >
              <TouchableOpacity
                onPress={() => openEditModal(deck)}
                style={{ flex: 1, marginRight: 8 }}
              >
                <Text style={styles.deckTitle}>{deck.name}</Text>
                <Text style={styles.deckInfo}>
                  {deck.createdAt
                    ? new Date(deck.createdAt).toLocaleString()
                    : "Desconhecido"}
                </Text>
                <Text style={styles.deckInfo}>
                  {t("decks.pokemons")}: {calculateTotalFromCards(deck.pokemons)} |{" "}
                  {t("decks.trainers")}: {calculateTotalFromCards(deck.trainers)} |{" "}
                  {t("decks.energies")}: {calculateTotalFromCards(deck.energies)} | Total:{" "}
                  {calculateTotalFromCards(deck.pokemons) +
                    calculateTotalFromCards(deck.trainers) +
                    calculateTotalFromCards(deck.energies)}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  Alert.alert(
                    t("common.confirmation_title", "Confirmação"),
                    t("decks.delete_confirm", { deckName: deck.name }),
                    [
                      { text: t("calendar.form.cancel_button", "Cancelar"), style: "cancel" },
                      {
                        text: t("common.delete", "Excluir"),
                        style: "destructive",
                        onPress: () => handleDeleteDeck(deck.id, deck.name),
                      },
                    ]
                  );
                }}
              >
                <MaterialCommunityIcons name="delete" size={20} color="#FFF" />
                <Text style={styles.deleteButtonText}>{t("common.delete")}</Text>
              </TouchableOpacity>
            </Animatable.View>
          ))}

          {/* Form p/ criar deck */}
          <Animatable.View animation="fadeInUp" delay={100} style={styles.form}>
            <Text style={styles.formTitle}>{t("decks.create_button", "Criar Deck")}</Text>

            <Text style={styles.label}>{t("decks.label_name")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("decks.placeholder_name") || ""}
              placeholderTextColor="#aaa"
              value={deckName}
              onChangeText={setDeckName}
            />

            <Text style={styles.label}>{t("decks.label_deck_list")}</Text>
            <Text style={styles.tip}>{t("decks.tip_deck_list")}</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              multiline
              placeholder={t("decks.placeholder_deck_list") || ""}
              placeholderTextColor="#aaa"
              value={deckContent}
              onChangeText={setDeckContent}
            />

            <TouchableOpacity style={styles.button} onPress={handleCreateDeck}>
              <Text style={styles.buttonText}>{t("decks.create_button")}</Text>
            </TouchableOpacity>
          </Animatable.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal de edição */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Header manual do modal */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="arrow-left" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t("decks.edit_title", "Editar Deck")}</Text>
            </View>

            <ScrollView style={{ flex: 1, padding: 16, backgroundColor: "#1E1E1E" }}>
              <Text style={styles.label}>{t("decks.label_name")}</Text>
              <TextInput
                style={styles.input}
                value={editDeckName}
                onChangeText={setEditDeckName}
                placeholderTextColor="#999"
              />

              {/* Pokémons */}
              {renderSection("POKEMON", t("decks.pokemons", "Pokémons"), editPokemons, setEditPokemons)}

              {/* Treinadores */}
              {renderSection("TRAINER", t("decks.trainers", "Treinadores"), editTrainers, setEditTrainers)}

              {/* Energias */}
              {renderSection("ENERGY", t("decks.energies", "Energias"), editEnergies, setEditEnergies)}

              {/* Botões do Modal */}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: "#777", marginRight: 8 }]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.buttonText}>
                    {t("calendar.form.cancel_button", "Cancelar")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.button} onPress={handleSaveEdit}>
                  <Text style={styles.buttonText}>
                    {t("calendar.form.save_button", "Salvar")}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  function renderSection(
    category: "POKEMON" | "TRAINER" | "ENERGY",
    title: string,
    data: CardLine[],
    setData: React.Dispatch<React.SetStateAction<CardLine[]>>
  ) {
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <TouchableOpacity
            style={styles.sectionAddBtn}
            onPress={() => addLine(category)}
          >
            <MaterialCommunityIcons name="plus-circle" size={20} color="#4CAF50" />
            <Text style={styles.sectionAddText}>Adicionar</Text>
          </TouchableOpacity>
        </View>

        {data.map((card) => (
          <View key={card._tempId} style={styles.cardLineContainer}>
            <TextInput
              style={[styles.inputLine, { width: 60 }]}
              keyboardType="numeric"
              placeholder="Qtd"
              placeholderTextColor="#999"
              value={String(card.quantity)}
              onChangeText={(val) => {
                const num = parseInt(val || "") || 0;
                setData((prev) => {
                  const copy = [...prev];
                  const idx = copy.findIndex((x) => x._tempId === card._tempId);
                  if (idx >= 0) copy[idx].quantity = num;
                  return copy;
                });
              }}
            />
            <TextInput
              style={[styles.inputLine, { flex: 2 }]}
              placeholder="Nome"
              placeholderTextColor="#999"
              value={card.name}
              onChangeText={(val) => {
                setData((prev) => {
                  const copy = [...prev];
                  const idx = copy.findIndex((x) => x._tempId === card._tempId);
                  if (idx >= 0) copy[idx].name = val;
                  return copy;
                });
              }}
            />
            <TextInput
              style={[styles.inputLine, { width: 60 }]}
              placeholder="EXP"
              placeholderTextColor="#999"
              value={card.expansion ?? ""}
              onChangeText={(val) => {
                setData((prev) => {
                  const copy = [...prev];
                  const idx = copy.findIndex((x) => x._tempId === card._tempId);
                  if (idx >= 0) copy[idx].expansion = val === "" ? null : val;
                  return copy;
                });
              }}
            />
            <TextInput
              style={[styles.inputLine, { width: 60 }]}
              placeholder="No."
              placeholderTextColor="#999"
              value={card.cardNumber ?? ""}
              onChangeText={(val) => {
                setData((prev) => {
                  const copy = [...prev];
                  const idx = copy.findIndex((x) => x._tempId === card._tempId);
                  if (idx >= 0) copy[idx].cardNumber = val === "" ? null : val;
                  return copy;
                });
              }}
            />

            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeLine(category, card._tempId)}
            >
              <MaterialCommunityIcons name="close" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  }
}

const styles = StyleSheet.create({
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
  loadingOverlay: {
    position: "absolute",
    top: 80,
    width: "100%",
    alignItems: "center",
    zIndex: 999,
  },
  loadingText: {
    color: "#E3350D",
    fontSize: 18,
    fontWeight: "bold",
  },
  container: {
    flex: 1,
    padding: 16,
  },
  deckCard: {
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
  },
  deckTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  deckInfo: {
    color: "#bbb",
    fontSize: 13,
    marginBottom: 2,
  },
  deleteButton: {
    backgroundColor: "#E3350D",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  deleteButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 4,
  },
  form: {
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    padding: 16,
    marginTop: 6,
  },
  formTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  label: {
    color: "#FFF",
    fontSize: 14,
    marginTop: 8,
  },
  tip: {
    color: "#888",
    fontSize: 12,
    marginBottom: 4,
    marginTop: 2,
  },
  input: {
    backgroundColor: "#4A4A4A",
    color: "#FFF",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    marginVertical: 6,
  },
  button: {
    backgroundColor: "#E3350D",
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#1E1E1E",
  },
  modalHeader: {
    backgroundColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalTitle: {
    color: "#E3350D",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 20,
  },
  sectionContainer: {
    marginTop: 16,
    backgroundColor: "#333",
    borderRadius: 6,
    padding: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#E3350D",
    fontSize: 16,
    fontWeight: "bold",
  },
  sectionAddBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionAddText: {
    color: "#4CAF50",
    marginLeft: 4,
    fontWeight: "bold",
  },
  cardLineContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  inputLine: {
    backgroundColor: "#4A4A4A",
    color: "#FFF",
    borderRadius: 6,
    marginRight: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
  },
  removeButton: {
    backgroundColor: "#888",
    padding: 6,
    borderRadius: 6,
  },
});
