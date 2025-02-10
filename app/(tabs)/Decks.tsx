import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  getDoc,
  doc,
  query,
  where,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "../../lib/firebaseConfig";
import { v4 as uuidv4 } from "uuid";
import { useTranslation } from "react-i18next";
import * as Animatable from "react-native-animatable";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";

/** Tipagem das linhas de cartas */
interface CardLine {
  _tempId: string;
  quantity: number;
  name: string;
  expansion?: string | null;
  cardNumber?: string | null;
}

/** Tipagem do Deck */
interface DeckData {
  id: string;
  name: string;
  createdAt: string;
  pokemons: CardLine[];
  trainers: CardLine[];
  energies: CardLine[];
  style?: string[];
  archetype?: string | null;

  /** Novos campos para identificar o dono e a liga */
  ownerUid?: string;
  ownerName?: string;
  leagueId?: string;
}

/** Converte do Firestore para CardLine */
function convertFirestoreToCardLines(arr?: any[]): CardLine[] {
  if (!arr) return [];
  return arr.map((item: any) => ({
    _tempId: uuidv4(),
    quantity: item.quantity || 1,
    name: item.name || "",
    expansion: item.expansion ?? null,
    cardNumber: item.cardNumber ?? null,
  }));
}

/** Opções de Estilo + Ícones */
const STYLE_OPTIONS = [
  "controle",
  "aggro",
  "1 prize",
  "estagio 2",
  "meme",
  "vozes da minha cabeça",
];
const STYLE_ICONS: Record<string, string> = {
  "controle": "shield-check",
  "aggro": "sword-cross",
  "1 prize": "numeric-1-circle",
  "estagio 2": "numeric-2-circle",
  "meme": "emoticon-poop",
  "vozes da minha cabeça": "brain",
};

/** Opções de Arquétipo */
const ARCHETYPE_OPTIONS = [
  "Regidrago VSTAR",
  "Charizard ex",
  "Lugia Archeops",
  "Gardevoir ex",
  "Raging Bolt ex",
  "Terapagos ex",
  "Klawf Unhinged Scissors",
  "Dragapult ex",
  "Snorlax Stall PGO",
  "Palkia VSTAR",
  "Archaludon ex",
  "Gholdengo ex",
  "Roaring Moon ex",
  "Lost Zone Box",
  "Miraidon ex",
  "Iron Thorns ex",
  "Ancient Box",
  "Pidgeot Control",
  "Cornerstone Ogerpon",
  "Gouging Fire ex",
  "Ceruledge ex",
  "Banette ex",
  "Chien-Pao Baxcalibur",
  "Greninja ex",
  "Regis Ancient Wisdom",
  "Hydreigon ex",
  "Conkeldurr Gusty Swing",
  "Entei V",
  "Giratina VSTAR",
  "Arceus VSTAR",
  "Dialga VSTAR",
  "United Wings",
  "Future",
  "Bloodmoon Ursaluna Mad Bite",
  "Toedscruel Ogerpon",
  "Outros",
];

export default function DecksScreen() {
  const { t } = useTranslation();

  // Campos obtidos do AsyncStorage
  const [ownerUid, setOwnerUid] = useState("");
  const [ownerName, setOwnerName] = useState("Jogador"); 
  const [leagueId, setLeagueId] = useState("");

  const [decks, setDecks] = useState<DeckData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  // Modal de criação
  const [modalVisible, setModalVisible] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckContent, setNewDeckContent] = useState("");

  // Campos adicionais
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);

  // Submodals
  const [styleModalVisible, setStyleModalVisible] = useState(false);
  const [archetypeModalVisible, setArchetypeModalVisible] = useState(false);

  // Modal de visualização do deck
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewDeck, setViewDeck] = useState<DeckData | null>(null);

  /**
   * 1) Carrega ownerUid, ownerName e leagueId do AsyncStorage
   */
  useEffect(() => {
    (async () => {
      try {
        console.log("[Decks] Carregando infos do AsyncStorage...");
        const uid = await AsyncStorage.getItem("@playerId"); // ID do jogador
        const uname = await AsyncStorage.getItem("@playerName"); // Nome do jogador
        const lid = await AsyncStorage.getItem("@leagueId"); // Liga

        if (uid) setOwnerUid(uid);
        if (uname) setOwnerName(uname);
        if (lid) setLeagueId(lid);

        console.log("[Decks] Dados do AsyncStorage:", { uid, uname, lid });
      } catch (err) {
        console.log("[Decks] Erro ao buscar @playerId / @playerName / @leagueId:", err);
      }
    })();
  }, []);

  /**
   * 2) Carrega decks da coleção "decks"
   *    Se quiser filtrar somente os decks desse usuário, use um where: 
   *    query(collection(db, "decks"), where("ownerUid", "==", ownerUid))
   */
  useEffect(() => {
    console.log("[Decks] Iniciando onSnapshot em 'decks' (todas ou filtrar?)");
    setLoading(true);

    // Se quiser ver SÓ seus decks, descomente a linha de "where(...)"
    const decksRef = collection(db, "decks");
    //const qDecks = query(decksRef, where("ownerUid", "==", ownerUid));
    const qDecks = query(decksRef);

    const unsubscribe = onSnapshot(
      qDecks,
      (snapshot) => {
        console.log("[Decks] onSnapshot =>", snapshot.size, "docs");
        const allDecks: DeckData[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          allDecks.push({
            id: docSnap.id,
            name: d.name,
            createdAt: d.createdAt,
            pokemons: convertFirestoreToCardLines(d.pokemons),
            trainers: convertFirestoreToCardLines(d.trainers),
            energies: convertFirestoreToCardLines(d.energies),
            style: d.style || [],
            archetype: d.archetype || null,

            // Metadados do dono
            ownerUid: d.ownerUid || "",
            ownerName: d.ownerName || "",
            leagueId: d.leagueId || "",
          });
        });

        setDecks(allDecks);
        setLoading(false);
      },
      (error) => {
        console.log("[Decks] Erro onSnapshot =>", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [ownerUid]);

  /**
   * 3) Filtra decks pelo searchTerm
   */
  const filteredDecks = decks.filter((deck) => {
    if (!searchTerm.trim()) return true;
    return deck.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  /**
   * Função de criação de deck (salva na coleção "decks")
   */
  async function handleCreateDeck() {
    console.log("[Decks] handleCreateDeck disparado...");
    if (!newDeckName.trim()) {
      Alert.alert("Erro", "Digite o nome do deck.");
      return;
    }

    console.log("[Decks] parseDeckContent...");
    const { pokemons, trainers, energies } = parseDeckContent(newDeckContent);
    if (!pokemons.length && !trainers.length && !energies.length) {
      Alert.alert("Erro", "Nenhuma carta detectada.");
      return;
    }

    setLoading(true);
    try {
      const decksRef = collection(db, "decks");
      const payload = {
        name: newDeckName.trim(),
        createdAt: new Date().toISOString(),
        pokemons: pokemons.map(toFirestoreCard),
        trainers: trainers.map(toFirestoreCard),
        energies: energies.map(toFirestoreCard),
        style: selectedStyles,
        archetype: selectedArchetype,

        // Info do dono e liga
        ownerUid,    // Vem do AsyncStorage
        ownerName,   // Vem do AsyncStorage
        leagueId,    // Vem do AsyncStorage
      };
      console.log("[Decks] Salvando deck com payload:", payload);

      const docRef = await addDoc(decksRef, payload);
      console.log("[Decks] Deck criado. docId =", docRef.id);

      Alert.alert("Sucesso", "Deck criado com sucesso!");
      // Reseta campos
      setNewDeckName("");
      setNewDeckContent("");
      setSelectedStyles([]);
      setSelectedArchetype(null);
      setModalVisible(false);
    } catch (err: any) {
      console.log("[Decks] Erro ao criar deck =>", err.code, err.message);
      Alert.alert("Erro", "Falha ao criar deck.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Deletar deck
   */
  async function handleDeleteDeck(deckId: string) {
    console.log("[Decks] handleDeleteDeck =>", deckId);
    setLoading(true);
    try {
      const deckRef = doc(db, "decks", deckId);
      const snap = await getDoc(deckRef);
      if (!snap.exists()) {
        Alert.alert("Erro", "Deck não encontrado.");
        setLoading(false);
        return;
      }
      await deleteDoc(deckRef);
      Alert.alert("Sucesso", "Deck excluído!");
    } catch (err) {
      console.log("[Decks] Erro ao deletar =>", err);
      Alert.alert("Erro", "Falha ao excluir deck.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Abre modal de visualização
   */
  function openViewDeck(deck: DeckData) {
    setViewDeck(deck);
    setViewModalVisible(true);
  }

  /**
   * Toggle de estilo
   */
  function toggleStyleOption(opt: string) {
    if (selectedStyles.includes(opt)) {
      setSelectedStyles((prev) => prev.filter((s) => s !== opt));
    } else {
      if (selectedStyles.length >= 3) {
        Alert.alert("Atenção", "Máximo de 3 estilos.");
        return;
      }
      setSelectedStyles((prev) => [...prev, opt]);
    }
  }

  /**
   * Parse do conteúdo (Pokémon/Trainer/Energy)
   */
  function parseDeckContent(text: string) {
    const lines = text.split("\n").map((l) => l.trim());
    const pokemons: CardLine[] = [];
    const trainers: CardLine[] = [];
    const energies: CardLine[] = [];

    let currentBlock: "POKEMON" | "TRAINER" | "ENERGY" | "" = "";

    for (const line of lines) {
      if (!line) continue;

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
        // Ex: "Pokémon: 13" -> ignora
        continue;
      }

      const parsed = parseSingleLine(line);
      if (currentBlock === "POKEMON") pokemons.push(parsed);
      if (currentBlock === "TRAINER") trainers.push(parsed);
      if (currentBlock === "ENERGY") energies.push(parsed);
    }

    return { pokemons, trainers, energies };
  }

  function parseSingleLine(line: string): CardLine {
    const tokens = line.split(" ").filter(Boolean);

    let quantity = 1;
    let expansion: string | null = null;
    let cardNumber: string | null = null;
    const nameParts: string[] = [];

    // Se o primeiro token for um número > 0, é a quantidade
    const firstTok = tokens[0];
    const maybeQ = parseInt(firstTok ?? "");
    let i = 0;
    if (!isNaN(maybeQ) && maybeQ > 0) {
      quantity = maybeQ;
      i = 1;
    }

    while (i < tokens.length) {
      const t = tokens[i];
      const reg3 = /^[A-Z]{3}$/; // 3 letras ex: SCR
      if (reg3.test(t)) {
        expansion = t;
        // Verifica se o próximo token é um número
        if (i + 1 < tokens.length) {
          const maybeNum = parseInt(tokens[i + 1]);
          if (!isNaN(maybeNum) && maybeNum > 0) {
            cardNumber = tokens[i + 1];
            i += 2;
            continue;
          }
        }
        i++;
        continue;
      }

      // Se for um número e não for a qty, pode ser cardNumber
      const maybeCardNum = parseInt(t);
      if (!isNaN(maybeCardNum)) {
        cardNumber = t;
        i++;
        continue;
      }

      // Caso contrário, faz parte do nome
      nameParts.push(t);
      i++;
    }

    return {
      _tempId: uuidv4(),
      quantity,
      name: nameParts.join(" "),
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

  function toFirestoreCard(c: CardLine) {
    return {
      quantity: c.quantity,
      name: c.name,
      expansion: c.expansion || null,
      cardNumber: c.cardNumber || null,
    };
  }

  /**
   * Renderiza cada deck na lista
   */
  const renderDeckItem = ({ item }: { item: DeckData }) => {
    const totalPoke = item.pokemons.reduce((acc, x) => acc + x.quantity, 0);
    const totalTrainer = item.trainers.reduce((acc, x) => acc + x.quantity, 0);
    const totalEnergy = item.energies.reduce((acc, x) => acc + x.quantity, 0);
    const totalAll = totalPoke + totalTrainer + totalEnergy;

    return (
      <Animatable.View style={styles.deckTile} animation="fadeInUp">
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => openViewDeck(item)}
          onLongPress={() =>
            Alert.alert("Excluir Deck", `Excluir o deck "${item.name}"?`, [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Excluir",
                style: "destructive",
                onPress: () => handleDeleteDeck(item.id),
              },
            ])
          }
        >
          <Text style={styles.deckName}>{item.name}</Text>
          <Text style={styles.deckDate}>
            {item.createdAt ? new Date(item.createdAt).toLocaleString() : "?"}
          </Text>
          <Text style={styles.deckCount}>
            P:{totalPoke} T:{totalTrainer} E:{totalEnergy} Total:{totalAll}
          </Text>

          {item.ownerName && (
            <Text style={styles.deckOwner}>Dono: {item.ownerName}</Text>
          )}
          {item.leagueId && (
            <Text style={styles.deckOwner}>Liga: {item.leagueId}</Text>
          )}

          {item.style?.length ? (
            <Text style={styles.deckStyle}>
              Estilos: {item.style.join(", ")}
            </Text>
          ) : null}
          {item.archetype && (
            <Text style={styles.deckStyle}>
              Arquetipo: {item.archetype}
            </Text>
          )}
        </TouchableOpacity>
      </Animatable.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header + Busca */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Meus Decks</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar deck por nome..."
          placeholderTextColor="#999"
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

      {/* Lista de decks */}
      <View style={{ flex: 1, padding: 10 }}>
        {loading && (
          <View style={styles.loadingContainer}>
            <Animatable.Text
              animation="pulse"
              iterationCount="infinite"
              style={styles.loadingText}
            >
              Carregando...
            </Animatable.Text>
          </View>
        )}
        <FlatList
          data={filteredDecks}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: "space-between" }}
          renderItem={renderDeckItem}
        />
      </View>

      {/* Botão flutuante */}
      <View style={styles.floatingButtonContainer}>
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={26} color="#FFF" style={{ marginRight: 6 }} />
          <Text style={styles.floatingButtonText}>Cadastrar Deck</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de criação */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="arrow-left" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Cadastrar Deck</Text>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              <Text style={styles.label}>Nome do Deck</Text>
              <TextInput
                style={styles.modalInput}
                value={newDeckName}
                onChangeText={setNewDeckName}
                placeholder="Ex: Deck do Charizard"
                placeholderTextColor="#999"
              />

              <Text style={styles.label}>Estilo (até 3)</Text>
              <TouchableOpacity
                style={styles.selectField}
                onPress={() => setStyleModalVisible(true)}
              >
                <Text style={styles.selectFieldText}>
                  {selectedStyles.length
                    ? selectedStyles.join(", ")
                    : "Selecione os estilos..."}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color="#FFF" />
              </TouchableOpacity>

              <Text style={styles.label}>Arquetipo</Text>
              <TouchableOpacity
                style={styles.selectField}
                onPress={() => setArchetypeModalVisible(true)}
              >
                <Text style={styles.selectFieldText}>
                  {selectedArchetype ?? "Selecione um arquetipo..."}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color="#FFF" />
              </TouchableOpacity>

              <Text style={[styles.label, { marginTop: 12 }]}>Lista do Deck</Text>
              <TextInput
                style={[styles.modalInput, { height: 100 }]}
                multiline
                value={newDeckContent}
                onChangeText={setNewDeckContent}
                placeholder="Copie e cole aqui sua lista..."
                placeholderTextColor="#999"
              />

              <TouchableOpacity style={styles.saveDeckButton} onPress={handleCreateDeck}>
                <Text style={styles.saveDeckButtonText}>Salvar Deck</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Submodal de Estilo */}
      <Modal
        visible={styleModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setStyleModalVisible(false)}
      >
        <View style={styles.subModalOverlay}>
          <View style={styles.subModalContainer}>
            <Text style={styles.subModalTitle}>Selecione até 3 Estilos</Text>
            <ScrollView style={{ maxHeight: 300, marginVertical: 10 }}>
              {STYLE_OPTIONS.map((opt) => {
                const isSelected = selectedStyles.includes(opt);
                const iconName = STYLE_ICONS[opt] || "help-circle-outline";
                return (
                  <TouchableOpacity
                    key={opt}
                    style={styles.optionRow}
                    onPress={() => toggleStyleOption(opt)}
                  >
                    <MaterialCommunityIcons
                      name={isSelected ? "checkbox-marked" : "checkbox-blank-outline"}
                      size={20}
                      color={isSelected ? "#E3350D" : "#FFF"}
                      style={{ marginRight: 8 }}
                    />
                    <MaterialCommunityIcons
                      name={iconName as keyof typeof MaterialCommunityIcons.glyphMap}
                      size={20}
                      color="#FFF"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={{ color: "#FFF" }}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeOptionButton}
              onPress={() => setStyleModalVisible(false)}
            >
              <Text style={styles.closeOptionButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Submodal de Arquétipo */}
      <Modal
        visible={archetypeModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setArchetypeModalVisible(false)}
      >
        <View style={styles.subModalOverlay}>
          <View style={styles.subModalContainer}>
            <Text style={styles.subModalTitle}>Selecione um Arquetipo</Text>
            <ScrollView style={{ maxHeight: 350, marginVertical: 10 }}>
              {ARCHETYPE_OPTIONS.map((opt) => {
                const isSelected = selectedArchetype === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={styles.optionRow}
                    onPress={() => {
                      setSelectedArchetype(opt);
                      setArchetypeModalVisible(false);
                    }}
                  >
                    <MaterialCommunityIcons
                      name={isSelected ? "radiobox-marked" : "radiobox-blank"}
                      size={20}
                      color={isSelected ? "#E3350D" : "#FFF"}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={{ color: "#FFF" }}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeOptionButton}
              onPress={() => setArchetypeModalVisible(false)}
            >
              <Text style={styles.closeOptionButtonText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Visualização de Deck */}
      <Modal
        visible={viewModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setViewModalVisible(false)}
      >
        <Animatable.View style={styles.viewModalOverlay} animation="fadeIn">
          <Animatable.View style={styles.viewModalContainer} animation="fadeInUp">
            <View style={styles.viewModalHeader}>
              <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                <MaterialCommunityIcons name="arrow-left" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.viewModalTitle}>{viewDeck?.name || "Deck"}</Text>
            </View>

            <ScrollView style={{ flex: 1, padding: 16 }}>
              {viewDeck && (
                <>
                  <Text style={styles.viewDeckInfo}>
                    Data de Criação:{" "}
                    {viewDeck.createdAt
                      ? new Date(viewDeck.createdAt).toLocaleString()
                      : "?"}
                  </Text>
                  {viewDeck.ownerName && (
                    <Text style={styles.viewDeckInfo}>
                      Dono: {viewDeck.ownerName}
                    </Text>
                  )}
                  {viewDeck.leagueId && (
                    <Text style={styles.viewDeckInfo}>
                      Liga: {viewDeck.leagueId}
                    </Text>
                  )}
                  {viewDeck.style?.length ? (
                    <Text style={styles.viewDeckInfo}>
                      Estilos: {viewDeck.style.join(", ")}
                    </Text>
                  ) : null}
                  {viewDeck.archetype && (
                    <Text style={styles.viewDeckInfo}>
                      Arquetipo: {viewDeck.archetype}
                    </Text>
                  )}

                  <Animatable.Text style={styles.deckSectionTitle} animation="fadeInRight">
                    Pokémons:
                  </Animatable.Text>
                  {viewDeck.pokemons.map((line) => (
                    <Text style={styles.deckLine} key={line._tempId}>
                      {line.quantity}x {line.name}
                      {line.expansion
                        ? ` [${line.expansion}${line.cardNumber ?? ""}]`
                        : ""}
                    </Text>
                  ))}

                  <Animatable.Text
                    style={styles.deckSectionTitle}
                    animation="fadeInRight"
                    delay={100}
                  >
                    Treinadores:
                  </Animatable.Text>
                  {viewDeck.trainers.map((line) => (
                    <Text style={styles.deckLine} key={line._tempId}>
                      {line.quantity}x {line.name}
                      {line.expansion
                        ? ` [${line.expansion}${line.cardNumber ?? ""}]`
                        : ""}
                    </Text>
                  ))}

                  <Animatable.Text
                    style={styles.deckSectionTitle}
                    animation="fadeInRight"
                    delay={200}
                  >
                    Energias:
                  </Animatable.Text>
                  {viewDeck.energies.map((line) => (
                    <Text style={styles.deckLine} key={line._tempId}>
                      {line.quantity}x {line.name}
                      {line.expansion
                        ? ` [${line.expansion}${line.cardNumber ?? ""}]`
                        : ""}
                    </Text>
                  ))}
                </>
              )}
            </ScrollView>
          </Animatable.View>
        </Animatable.View>
      </Modal>
    </SafeAreaView>
  );
}

/** Funções auxiliares de parse e formatação */
function parseSingleLine(line: string): CardLine {
  const tokens = line.split(" ").filter(Boolean);

  let quantity = 1;
  let expansion: string | null = null;
  let cardNumber: string | null = null;
  const nameParts: string[] = [];

  const firstTok = tokens[0];
  const maybeQ = parseInt(firstTok ?? "");
  let i = 0;
  if (!isNaN(maybeQ) && maybeQ > 0) {
    quantity = maybeQ;
    i = 1;
  }

  while (i < tokens.length) {
    const t = tokens[i];
    const reg3 = /^[A-Z]{3}$/; // ex: "SCR", "PAL"
    if (reg3.test(t)) {
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
    name: nameParts.join(" "),
    expansion,
    cardNumber,
  };
}

function parseDeckContent(text: string) {
  const lines = text.split("\n").map((l) => l.trim());
  const pokemons: CardLine[] = [];
  const trainers: CardLine[] = [];
  const energies: CardLine[] = [];

  let currentBlock: "POKEMON" | "TRAINER" | "ENERGY" | "" = "";

  for (const line of lines) {
    if (!line) continue;
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
      // Ex: "Pokémon: 13" => ignoramos
      continue;
    }

    const parsed = parseSingleLine(line);
    if (currentBlock === "POKEMON") pokemons.push(parsed);
    if (currentBlock === "TRAINER") trainers.push(parsed);
    if (currentBlock === "ENERGY") energies.push(parsed);
  }

  return { pokemons, trainers, energies };
}

function sanitizeCardLines(lines: CardLine[]): CardLine[] {
  return lines.map((c) => ({
    ...c,
    quantity: c.quantity > 0 ? c.quantity : 1,
    name: c.name || "",
  }));
}

function toFirestoreCard(c: CardLine) {
  return {
    quantity: c.quantity,
    name: c.name,
    expansion: c.expansion || null,
    cardNumber: c.cardNumber || null,
  };
}

/** Estilos */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
  },
  header: {
    backgroundColor: "#000",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    color: "#E3350D",
    fontSize: 22,
    fontWeight: "bold",
  },
  searchContainer: {
    flexDirection: "row",
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    margin: 12,
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    color: "#FFF",
    fontSize: 16,
  },
  loadingContainer: {
    position: "absolute",
    top: 100,
    alignSelf: "center",
    zIndex: 999,
  },
  loadingText: {
    color: "#E3350D",
    fontSize: 16,
    fontWeight: "bold",
  },
  deckTile: {
    backgroundColor: "#333",
    borderRadius: 10,
    padding: 12,
    width: "48%",
    marginBottom: 10,
  },
  deckName: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  deckDate: {
    color: "#ccc",
    fontSize: 12,
    marginBottom: 4,
  },
  deckCount: {
    color: "#ccc",
    fontSize: 12,
  },
  deckOwner: {
    color: "#999",
    fontSize: 12,
    marginTop: 6,
  },
  deckStyle: {
    color: "#4CAF50",
    fontSize: 13,
    marginTop: 4,
  },
  floatingButtonContainer: {
    position: "absolute",
    bottom: 20,
    right: 16,
  },
  floatingButton: {
    backgroundColor: "#E3350D",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 30,
  },
  floatingButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#1E1E1E",
  },
  modalHeader: {
    backgroundColor: "#000",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  modalTitle: {
    color: "#E3350D",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
  },
  label: {
    color: "#FFF",
    fontSize: 14,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: "#2A2A2A",
    color: "#FFF",
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
  },
  selectField: {
    flexDirection: "row",
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
    marginTop: 6,
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectFieldText: {
    color: "#FFF",
    fontSize: 14,
  },
  saveDeckButton: {
    backgroundColor: "#E3350D",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 20,
  },
  saveDeckButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  subModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  subModalContainer: {
    backgroundColor: "#1E1E1E",
    borderRadius: 10,
    padding: 16,
    width: "90%",
    maxHeight: "80%",
  },
  subModalTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 6,
    textAlign: "center",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
  },
  closeOptionButton: {
    backgroundColor: "#E3350D",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 14,
  },
  closeOptionButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  viewModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  viewModalContainer: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    marginTop: 70,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  viewModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#000",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  viewModalTitle: {
    color: "#E3350D",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
  },
  viewDeckInfo: {
    color: "#FFF",
    fontSize: 14,
    marginBottom: 4,
  },
  deckSectionTitle: {
    color: "#E3350D",
    fontWeight: "bold",
    fontSize: 16,
    marginTop: 10,
    marginBottom: 4,
  },
  deckLine: {
    color: "#FFF",
    fontSize: 14,
    marginLeft: 8,
    marginVertical: 2,
  },
});
