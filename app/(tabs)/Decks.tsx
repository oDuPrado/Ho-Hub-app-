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
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";

// ------------------------------------------------
// Tipos
// ------------------------------------------------
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

// ------------------------------------------------
export default function DecksScreen() {
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

  // Função para calcular o total de cartas em um array de CardLine[]
  const calculateTotalFromCards = (cards: CardLine[]): number => {
    return cards.reduce((sum, card) => sum + card.quantity, 0);
  };

  // ------------------------------------------------
  // Efeito: Pega UID do auth e playerId do AsyncStorage
  // ------------------------------------------------
  useEffect(() => {
    const user = auth.currentUser;
    if (user?.uid) {
      setAuthUid(user.uid);
      console.log("authUid detectado:", user.uid);
    } else {
      console.log("Nenhum authUid detectado. user:", user);
    }

    (async () => {
      try {
        const storedPlayerId = await AsyncStorage.getItem("@userId");
        if (storedPlayerId) {
          setPlayerId(storedPlayerId);
          console.log("playerId (AsyncStorage) =", storedPlayerId);
        } else {
          console.log("Nenhum @userId encontrado no AsyncStorage.");
        }
      } catch (err) {
        console.log("Erro ao obter @userId do AsyncStorage", err);
      }
    })();
  }, []);

  // ------------------------------------------------
  // Efeito: onSnapshot p/ decks
  // ------------------------------------------------
  useEffect(() => {
    if (!playerId) return; // Se o playerId não existir, não faz a busca

    console.log("Iniciando onSnapshot de decks para playerId =", playerId);

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
        console.log("Decks atualizados. total =", newDecks.length);
      },
      (error) => {
        console.log("Erro no onSnapshot decks:", error);
      }
    );

    return () => unsubscribe(); // Para de ouvir as mudanças ao desmontar o componente
  }, [playerId]); // O playerId é o gatilho para essa query

  // ------------------------------------------------
  // Converte array do Firestore p/ CardLine
  // ------------------------------------------------
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

  // ------------------------------------------------
  // parseDeckContent
  // ------------------------------------------------
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
        // caso não tenha bloco definido, ignore a linha
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

  // ------------------------------------------------
  // parseSingleLine (ex.: "1 Togepi SSP 70")
  // ------------------------------------------------
  function parseSingleLine(line: string): CardLine {
    const tokens = line.split(" ").filter(Boolean);
    let quantity = 1;
    let expansion: string | null = null;
    let cardNumber: string | null = null;
    let nameParts: string[] = [];

    // Tenta quantity no primeiro token
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
      const reg3letters = /^[A-Z]{3}$/; // 3 letras maiúsculas
      if (reg3letters.test(t)) {
        expansion = t;
        // Verifica se o próximo token é número
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

  // ------------------------------------------------
  // sanitizeCardLines
  // ------------------------------------------------
  function sanitizeCardLines(lines: CardLine[]): CardLine[] {
    return lines.map((c) => ({
      ...c,
      quantity: c.quantity && c.quantity > 0 ? c.quantity : 1,
      name: c.name || "",
    }));
  }

  // ------------------------------------------------
  // handleCreateDeck
  // ------------------------------------------------
  async function handleCreateDeck() {
    console.log("handleCreateDeck disparado...");
    console.log("authUid:", authUid);
    console.log("deckName:", deckName.trim());
    console.log("deckContent:", deckContent);

    if (!authUid) {
      Alert.alert("Erro", "authUid ausente ou não logado como anônimo.");
      return;
    }
    if (!deckName.trim()) {
      Alert.alert("Erro", "Informe um nome para o deck.");
      return;
    }

    const parsed = parseDeckContent(deckContent);
    console.log("resultado parseDeckContent = ", parsed);
    const { pokemons, trainers, energies } = parsed;

    const safePokemons = sanitizeCardLines(pokemons);
    const safeTrainers = sanitizeCardLines(trainers);
    const safeEnergies = sanitizeCardLines(energies);

    // Se TUDO veio vazio, não cria
    if (
      safePokemons.length === 0 &&
      safeTrainers.length === 0 &&
      safeEnergies.length === 0
    ) {
      Alert.alert(
        "Erro",
        "Nenhuma carta detectada. Verifique se há blocos 'Pokémon:', 'Treinador:' ou 'Energia:'"
      );
      return;
    }

    // Se tiver quantity < 1
    if (
      [...safePokemons, ...safeTrainers, ...safeEnergies].some(
        (c) => c.quantity < 1
      )
    ) {
      Alert.alert(
        "Erro",
        "Alguma carta está com quantity < 1. Corrija antes de criar."
      );
      return;
    }

    try {
      console.log("Tentando addDoc() em /decks ...");
      const decksRef = collection(db, "decks");
      const docRef = await addDoc(decksRef, {
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
      console.log("Deck criado docId =", docRef.id);
      Alert.alert("Sucesso", "Deck criado com sucesso!");
      setDeckName("");
      setDeckContent("");
    } catch (err) {
      console.log("Erro ao criar deck:", err);
      Alert.alert(
        "Erro",
        "Falha ao criar deck. Verifique as regras do Firestore e logs."
      );
    }
  }
  // ------------------------------------------------
  // DeleteDeck
  // ------------------------------------------------
  async function handleDeleteDeck(deckId: string) {
    try {
      console.log("Tentando excluir deck com ID:", deckId);

      // Obter referência ao documento no Firestore
      const deckRef = doc(db, "decks", deckId);
      const deckSnap = await getDoc(deckRef);

      if (!deckSnap.exists()) {
        Alert.alert("Erro", "Deck não encontrado.");
        console.log("Deck não encontrado no Firestore.");
        return;
      }

      // Obter dados do documento
      const deckData = deckSnap.data();
      console.log("Dados do deck:", deckData);

      // Verificar se o playerId no documento corresponde ao playerId do frontend
      console.log("Player ID no documento:", deckData?.playerId);
      console.log("Player ID no frontend (AsyncStorage):", playerId);

      if (deckData.playerId !== playerId) {
        Alert.alert("Erro", "Você não tem permissão para excluir este deck.");
        console.log(
          `Permissão negada: playerId no documento (${deckData.playerId}) não corresponde ao playerId do frontend (${playerId}).`
        );
        return;
      }

      // Excluir o deck
      await deleteDoc(deckRef);
      console.log("Deck excluído com sucesso!");
      Alert.alert("Sucesso", "Deck excluído com sucesso!");

      // Atualizar estado local para remover o deck da lista
      setDecks((prevDecks) => prevDecks.filter((deck) => deck.id !== deckId));
    } catch (err) {
      console.log("Erro ao excluir deck:", err);
      Alert.alert("Erro", "Falha ao excluir o deck. Tente novamente.");
    }
  }

  // ------------------------------------------------
  // openEditModal
  // ------------------------------------------------
  function openEditModal(deck: DeckData) {
    setEditDeckId(deck.id);
    setEditDeckName(deck.name);
    setEditPokemons([...deck.pokemons]);
    setEditTrainers([...deck.trainers]);
    setEditEnergies([...deck.energies]);
    setModalVisible(true);
  }

  // ------------------------------------------------
  // addLine
  // ------------------------------------------------
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

  // ------------------------------------------------
  // removeLine
  // ------------------------------------------------
  function removeLine(cat: "POKEMON" | "TRAINER" | "ENERGY", _tempId: string) {
    if (cat === "POKEMON") {
      setEditPokemons((prev) => prev.filter((p) => p._tempId !== _tempId));
    } else if (cat === "TRAINER") {
      setEditTrainers((prev) => prev.filter((p) => p._tempId !== _tempId));
    } else {
      setEditEnergies((prev) => prev.filter((p) => p._tempId !== _tempId));
    }
  }

  // ------------------------------------------------
  // handleSaveEdit
  // ------------------------------------------------
  async function handleSaveEdit() {
    if (!editDeckId) return;

    const allCards = [...editPokemons, ...editTrainers, ...editEnergies];
    if (allCards.some((c) => c.quantity < 1)) {
      Alert.alert(
        "Erro",
        "Existe carta com quantity < 1. Ajuste antes de salvar."
      );
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
      Alert.alert("Sucesso", "Deck atualizado!");
      setModalVisible(false);
    } catch (err) {
      console.log("Erro ao atualizar deck:", err);
      Alert.alert("Erro", "Falha ao atualizar deck.");
    }
  }

  // ------------------------------------------------
  // Render
  // ------------------------------------------------
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text style={styles.heading}>Meus Decks</Text>

        <ScrollView style={{ flex: 1 }}>
          {/* Lista de decks */}
          {decks.map((deck) => (
            <TouchableOpacity
              key={`deck-${deck.id}`}
              style={styles.deckCard}
              onPress={() => openEditModal(deck)}
            >
              <Text style={styles.deckTitle}>{deck.name}</Text>
              <Text style={styles.deckInfo}>
                Criado em:{" "}
                {deck.createdAt
                  ? new Date(deck.createdAt).toLocaleString()
                  : "Desconhecido"}
              </Text>
              <Text style={styles.deckInfo}>
                Pokémons: {calculateTotalFromCards(deck.pokemons)} |
                Treinadores: {calculateTotalFromCards(deck.trainers)} |
                Energias: {calculateTotalFromCards(deck.energies)} | Total de
                Cartas:{" "}
                {calculateTotalFromCards(deck.pokemons) +
                  calculateTotalFromCards(deck.trainers) +
                  calculateTotalFromCards(deck.energies)}
              </Text>

              {/* Botão de exclusão */}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() =>
                  Alert.alert(
                    "Confirmação",
                    `Tem certeza que deseja excluir o deck "${deck.name}"?`,
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
            </TouchableOpacity>
          ))}

          {/* Form p/ criar deck */}
          <View style={styles.form}>
            <Text style={styles.label}>Nome do Deck</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Gholdengo Attack"
              placeholderTextColor="#aaa"
              value={deckName}
              onChangeText={setDeckName}
            />

            <Text style={styles.label}>Lista do Deck (texto)</Text>
            <Text style={styles.tip}>
              “Pokémon: X” / “Treinador: Y” / “Energia: Z”...
            </Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              multiline
              placeholder="Pokémon: 10\n1 Togepi...\nTreinador: 18\n1 Energy Search...\nEnergia: 8\n1 Basic..."
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

            {/* Pokémons */}
            <Text style={styles.sectionTitle}>Pokémons</Text>
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
                      const idx = copy.findIndex(
                        (x) => x._tempId === card._tempId
                      );
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
                      const idx = cpy.findIndex(
                        (x) => x._tempId === card._tempId
                      );
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
                      const idx = cpy.findIndex(
                        (x) => x._tempId === card._tempId
                      );
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
                      const idx = cpy.findIndex(
                        (x) => x._tempId === card._tempId
                      );
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
              <Text style={styles.buttonText}>+ Pokémon</Text>
            </TouchableOpacity>

            {/* Treinadores */}
            <Text style={styles.sectionTitle}>Treinadores</Text>
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
                      const idx = copy.findIndex(
                        (x) => x._tempId === card._tempId
                      );
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
                      const idx = cpy.findIndex(
                        (x) => x._tempId === card._tempId
                      );
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
                      const idx = cpy.findIndex(
                        (x) => x._tempId === card._tempId
                      );
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
                      const idx = cpy.findIndex(
                        (x) => x._tempId === card._tempId
                      );
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
              <Text style={styles.buttonText}>+ Treinador</Text>
            </TouchableOpacity>

            {/* Energias */}
            <Text style={styles.sectionTitle}>Energias</Text>
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
                      const idx = copy.findIndex(
                        (x) => x._tempId === card._tempId
                      );
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
                      const idx = cpy.findIndex(
                        (x) => x._tempId === card._tempId
                      );
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
                      const idx = cpy.findIndex(
                        (x) => x._tempId === card._tempId
                      );
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
                      const idx = cpy.findIndex(
                        (x) => x._tempId === card._tempId
                      );
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
    </SafeAreaView>
  );
}

// ---------------------------------------------------
// Styles
// ---------------------------------------------------
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
    backgroundColor: "#FF3B30", // Vermelho
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
