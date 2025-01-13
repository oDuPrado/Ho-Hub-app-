import React, { useEffect, useState } from "react";
import { useRouter } from "expo-router";
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
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import { useTranslation } from "react-i18next"; // <--- i18n

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
  const router = useRouter();
  const { t } = useTranslation(); // <--- i18n

  const [deckName, setDeckName] = useState("");
  const [deckContent, setDeckContent] = useState("");

  const [decks, setDecks] = useState<DeckData[]>([]);
  const [authUid, setAuthUid] = useState("");
  const [playerId, setPlayerId] = useState("");

  // Modal de edição
  const [modalVisible, setModalVisible] = useState(false);
  const [editDeckId, setEditDeckId] = useState<string | null>(null);
  const [editDeckName, setEditDeckName] = useState("");
  const [editPokemons, setEditPokemons] = useState<CardLine[]>([]);
  const [editTrainers, setEditTrainers] = useState<CardLine[]>([]);
  const [editEnergies, setEditEnergies] = useState<CardLine[]>([]);

  // --------------------------------------------
  // Função para calcular total de cartas em CardLine[]
  // --------------------------------------------
  const calculateTotalFromCards = (cards: CardLine[]): number => {
    return cards.reduce((sum, card) => sum + card.quantity, 0);
  };

  // --------------------------------------------
  // Efeito: Pega UID do auth e playerId do AsyncStorage
  // --------------------------------------------
  useEffect(() => {
    const user = auth.currentUser;
    if (user?.uid) {
      setAuthUid(user.uid);
    }

    (async () => {
      try {
        const storedPlayerId = await AsyncStorage.getItem("@userId");
        if (storedPlayerId) {
          setPlayerId(storedPlayerId);
        }
      } catch (err) {
        console.log("Erro ao obter @userId do AsyncStorage", err);
      }
    })();
  }, []);

  // --------------------------------------------
  // Efeito: onSnapshot p/ decks
  // --------------------------------------------
  useEffect(() => {
    if (!playerId) return;

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
      },
      (error) => {
        console.log("Erro no onSnapshot decks:", error);
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

  // --------------------------------------------
  // parseDeckContent
  // --------------------------------------------
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
      if (currentBlock === "POKEMON") {
        pokemons.push(parsedLine);
      } else if (currentBlock === "TRAINER") {
        trainers.push(parsedLine);
      } else if (currentBlock === "ENERGY") {
        energies.push(parsedLine);
      }
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

  // --------------------------------------------
  // handleCreateDeck
  // --------------------------------------------
  async function handleCreateDeck() {
    if (!authUid) {
      Alert.alert(t("common.error"), "authUid ausente ou não logado.");
      return;
    }
    if (!deckName.trim()) {
      Alert.alert(t("common.error"), t("decks.label_name"));
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
      const decksRef = collection(db, "decks");
      await addDoc(decksRef, {
        authUid,
        playerId: playerId ?? "",
        name: deckName.trim(),
        createdAt: new Date().toISOString(),
        pokemons: safePokemons.map((c) => ({
          quantity: c.quantity,
          name: c.name,
          expansion: c.expansion || null,
          cardNumber: c.cardNumber || null,
        })),
        trainers: safeTrainers.map((c) => ({
          quantity: c.quantity,
          name: c.name,
          expansion: c.expansion || null,
          cardNumber: c.cardNumber || null,
        })),
        energies: safeEnergies.map((c) => ({
          quantity: c.quantity,
          name: c.name,
          expansion: c.expansion || null,
          cardNumber: c.cardNumber || null,
        })),
      });
      Alert.alert(t("common.success"), t("decks.create_success"));
      setDeckName("");
      setDeckContent("");
    } catch (err) {
      console.log("Erro ao criar deck:", err);
      Alert.alert(t("common.error"), t("decks.create_error"));
    }
  }

  // --------------------------------------------
  // handleDeleteDeck
  // --------------------------------------------
  async function handleDeleteDeck(deckId: string, deckNameToShow: string) {
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

      await deleteDoc(deckRef);
      Alert.alert(t("common.success"), t("decks.delete_success"));

      setDecks((prevDecks) => prevDecks.filter((d) => d.id !== deckId));
    } catch (err) {
      console.log("Erro ao excluir deck:", err);
      Alert.alert(t("common.error"), t("decks.delete_error"));
    }
  }

  // --------------------------------------------
  // openEditModal
  // --------------------------------------------
  function openEditModal(deck: DeckData) {
    setEditDeckId(deck.id);
    setEditDeckName(deck.name);
    setEditPokemons([...deck.pokemons]);
    setEditTrainers([...deck.trainers]);
    setEditEnergies([...deck.energies]);
    setModalVisible(true);
  }

  function addLine(cat: "POKEMON" | "TRAINER" | "ENERGY") {
    const newCard: CardLine = {
      _tempId: uuidv4(),
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

  function removeLine(cat: "POKEMON" | "TRAINER" | "ENERGY", _tempId: string) {
    if (cat === "POKEMON") {
      setEditPokemons((prev) => prev.filter((p) => p._tempId !== _tempId));
    } else if (cat === "TRAINER") {
      setEditTrainers((prev) => prev.filter((p) => p._tempId !== _tempId));
    } else {
      setEditEnergies((prev) => prev.filter((p) => p._tempId !== _tempId));
    }
  }

  // --------------------------------------------
  // handleSaveEdit
  // --------------------------------------------
  async function handleSaveEdit() {
    if (!editDeckId) return;

    const allCards = [...editPokemons, ...editTrainers, ...editEnergies];
    if (allCards.some((c) => c.quantity < 1)) {
      Alert.alert(t("common.error"), t("decks.invalid_quantity"));
      return;
    }

    try {
      const safePokemons = sanitizeCardLines(editPokemons);
      const safeTrainers = sanitizeCardLines(editTrainers);
      const safeEnergies = sanitizeCardLines(editEnergies);

      const deckRef = doc(db, "decks", editDeckId);
      await updateDoc(deckRef, {
        name: editDeckName.trim(),
        pokemons: safePokemons.map((c) => ({
          quantity: c.quantity,
          name: c.name,
          expansion: c.expansion || null,
          cardNumber: c.cardNumber || null,
        })),
        trainers: safeTrainers.map((c) => ({
          quantity: c.quantity,
          name: c.name,
          expansion: c.expansion || null,
          cardNumber: c.cardNumber || null,
        })),
        energies: safeEnergies.map((c) => ({
          quantity: c.quantity,
          name: c.name,
          expansion: c.expansion || null,
          cardNumber: c.cardNumber || null,
        })),
      });
      Alert.alert(t("common.success"), t("decks.update_success"));
      setModalVisible(false);
    } catch (err) {
      console.log("Erro ao atualizar deck:", err);
      Alert.alert(t("common.error"), t("decks.update_error"));
    }
  }

  // --------------------------------------------
  // Render
  // --------------------------------------------
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text style={styles.heading}>{t("decks.heading")}</Text>

        <ScrollView style={{ flex: 1 }}>
          {decks.map((deck) => (
            <View key={`deck-${deck.id}`} style={styles.deckCard}>
              <TouchableOpacity onPress={() => openEditModal(deck)}>
                <Text style={styles.deckTitle}>{deck.name}</Text>
                <Text style={styles.deckInfo}>
                  {t("common.close")}:{" "}
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
                onPress={() =>
                  Alert.alert(
                    t("common.confirmation_title"),
                    t("decks.delete_confirm", { deckName: deck.name }),
                    [
                      { text: t("calendar.form.cancel_button"), style: "cancel" },
                      {
                        text: t("common.delete"),
                        style: "destructive",
                        onPress: () => handleDeleteDeck(deck.id, deck.name),
                      },
                    ]
                  )
                }
              >
                <Text style={styles.deleteButtonText}>{t("common.delete")}</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Form p/ criar deck */}
          <View style={styles.form}>
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
            <Text style={styles.modalHeading}>{t("decks.edit_title")}</Text>

            <Text style={styles.label}>{t("decks.label_name")}</Text>
            <TextInput
              style={styles.input}
              value={editDeckName}
              onChangeText={setEditDeckName}
            />

            {/* Pokémons */}
            <Text style={styles.sectionTitle}>{t("decks.pokemons")}</Text>
            {editPokemons.map((card) => (
              <View style={styles.cardLineContainer} key={`pk-${card._tempId}`}>
                <TextInput
                  style={[styles.inputLine, { flex: 1 }]}
                  keyboardType="numeric"
                  value={String(card.quantity)}
                  onChangeText={(val) => {
                    const num = parseInt(val || "") || 0;
                    setEditPokemons((prev) => {
                      const copy = [...prev];
                      const idx = copy.findIndex((x) => x._tempId === card._tempId);
                      if (idx >= 0) {
                        copy[idx].quantity = num;
                      }
                      return copy;
                    });
                  }}
                />
                <TextInput
                  style={[styles.inputLine, { flex: 3 }]}
                  placeholder="Nome"
                  value={card.name}
                  onChangeText={(v) => {
                    setEditPokemons((prev) => {
                      const cpy = [...prev];
                      const idx = cpy.findIndex((x) => x._tempId === card._tempId);
                      if (idx >= 0) {
                        cpy[idx].name = v;
                      }
                      return cpy;
                    });
                  }}
                />
                <TextInput
                  style={[styles.inputLine, { flex: 1 }]}
                  placeholder="EXP"
                  value={card.expansion ?? ""}
                  onChangeText={(v) => {
                    setEditPokemons((prev) => {
                      const cpy = [...prev];
                      const idx = cpy.findIndex((x) => x._tempId === card._tempId);
                      if (idx >= 0) {
                        cpy[idx].expansion = v === "" ? null : v;
                      }
                      return cpy;
                    });
                  }}
                />
                <TextInput
                  style={[styles.inputLine, { flex: 1 }]}
                  placeholder="No."
                  value={card.cardNumber ?? ""}
                  onChangeText={(v) => {
                    setEditPokemons((prev) => {
                      const cpy = [...prev];
                      const idx = cpy.findIndex((x) => x._tempId === card._tempId);
                      if (idx >= 0) {
                        cpy[idx].cardNumber = v === "" ? null : v;
                      }
                      return cpy;
                    });
                  }}
                />

                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeLine("POKEMON", card._tempId)}
                >
                  <Text style={styles.removeButtonText}>X</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.buttonSmall, { backgroundColor: "#555" }]}
              onPress={() => addLine("POKEMON")}
            >
              <Text style={styles.buttonText}>+ {t("decks.pokemons")}</Text>
            </TouchableOpacity>

            {/* Treinadores */}
            <Text style={styles.sectionTitle}>{t("decks.trainers")}</Text>
            {editTrainers.map((card) => (
              <View style={styles.cardLineContainer} key={`tr-${card._tempId}`}>
                <TextInput
                  style={[styles.inputLine, { flex: 1 }]}
                  keyboardType="numeric"
                  value={String(card.quantity)}
                  onChangeText={(val) => {
                    const num = parseInt(val || "") || 0;
                    setEditTrainers((prev) => {
                      const copy = [...prev];
                      const idx = copy.findIndex((x) => x._tempId === card._tempId);
                      if (idx >= 0) {
                        copy[idx].quantity = num;
                      }
                      return copy;
                    });
                  }}
                />
                <TextInput
                  style={[styles.inputLine, { flex: 3 }]}
                  placeholder="Nome"
                  value={card.name}
                  onChangeText={(v) => {
                    setEditTrainers((prev) => {
                      const cpy = [...prev];
                      const idx = cpy.findIndex((x) => x._tempId === card._tempId);
                      if (idx >= 0) {
                        cpy[idx].name = v;
                      }
                      return cpy;
                    });
                  }}
                />
                <TextInput
                  style={[styles.inputLine, { flex: 1 }]}
                  placeholder="EXP"
                  value={card.expansion ?? ""}
                  onChangeText={(v) => {
                    setEditTrainers((prev) => {
                      const cpy = [...prev];
                      const idx = cpy.findIndex((x) => x._tempId === card._tempId);
                      if (idx >= 0) {
                        cpy[idx].expansion = v === "" ? null : v;
                      }
                      return cpy;
                    });
                  }}
                />
                <TextInput
                  style={[styles.inputLine, { flex: 1 }]}
                  placeholder="No."
                  value={card.cardNumber ?? ""}
                  onChangeText={(v) => {
                    setEditTrainers((prev) => {
                      const cpy = [...prev];
                      const idx = cpy.findIndex((x) => x._tempId === card._tempId);
                      if (idx >= 0) {
                        cpy[idx].cardNumber = v === "" ? null : v;
                      }
                      return cpy;
                    });
                  }}
                />

                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeLine("TRAINER", card._tempId)}
                >
                  <Text style={styles.removeButtonText}>X</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.buttonSmall, { backgroundColor: "#555" }]}
              onPress={() => addLine("TRAINER")}
            >
              <Text style={styles.buttonText}>+ {t("decks.trainers")}</Text>
            </TouchableOpacity>

            {/* Energias */}
            <Text style={styles.sectionTitle}>{t("decks.energies")}</Text>
            {editEnergies.map((card) => (
              <View style={styles.cardLineContainer} key={`en-${card._tempId}`}>
                <TextInput
                  style={[styles.inputLine, { flex: 1 }]}
                  keyboardType="numeric"
                  value={String(card.quantity)}
                  onChangeText={(val) => {
                    const num = parseInt(val || "") || 0;
                    setEditEnergies((prev) => {
                      const copy = [...prev];
                      const idx = copy.findIndex((x) => x._tempId === card._tempId);
                      if (idx >= 0) {
                        copy[idx].quantity = num;
                      }
                      return copy;
                    });
                  }}
                />
                <TextInput
                  style={[styles.inputLine, { flex: 3 }]}
                  placeholder="Nome"
                  value={card.name}
                  onChangeText={(v) => {
                    setEditEnergies((prev) => {
                      const cpy = [...prev];
                      const idx = cpy.findIndex((x) => x._tempId === card._tempId);
                      if (idx >= 0) {
                        cpy[idx].name = v;
                      }
                      return cpy;
                    });
                  }}
                />
                <TextInput
                  style={[styles.inputLine, { flex: 1 }]}
                  placeholder="EXP"
                  value={card.expansion ?? ""}
                  onChangeText={(v) => {
                    setEditEnergies((prev) => {
                      const cpy = [...prev];
                      const idx = cpy.findIndex((x) => x._tempId === card._tempId);
                      if (idx >= 0) {
                        cpy[idx].expansion = v === "" ? null : v;
                      }
                      return cpy;
                    });
                  }}
                />
                <TextInput
                  style={[styles.inputLine, { flex: 1 }]}
                  placeholder="No."
                  value={card.cardNumber ?? ""}
                  onChangeText={(v) => {
                    setEditEnergies((prev) => {
                      const cpy = [...prev];
                      const idx = cpy.findIndex((x) => x._tempId === card._tempId);
                      if (idx >= 0) {
                        cpy[idx].cardNumber = v === "" ? null : v;
                      }
                      return cpy;
                    });
                  }}
                />

                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeLine("ENERGY", card._tempId)}
                >
                  <Text style={styles.removeButtonText}>X</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.buttonSmall, { backgroundColor: "#555" }]}
              onPress={() => addLine("ENERGY")}
            >
              <Text style={styles.buttonText}>+ {t("decks.energies")}</Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: "#999" }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.buttonText}>{t("calendar.form.cancel_button")}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.button} onPress={handleSaveEdit}>
                <Text style={styles.buttonText}>{t("calendar.form.save_button")}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ------------- ESTILOS -------------
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
  modalContainer: {
    flex: 1,
    backgroundColor: DARK,
  },
  modalHeading: {
    fontSize: 20,
    color: WHITE,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    color: PRIMARY,
    fontSize: 18,
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
});
