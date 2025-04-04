import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  SafeAreaView,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  FlatList,
} from "react-native";
import * as Animatable from "react-native-animatable";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

/** Tipagens para Binder e Cartas */
type BinderType = "master" | "pokemon" | "trainer" | "general";

interface MinimalCardData {
  id: string;
  name: string;
  images?: {
    small: string;
  };
  rarity?: string;
  number?: string;
  releaseDate?: string;
  setId?: string; // <- agora tá de boa
}

interface Binder {
  id: string;
  name: string;
  binderType: BinderType;
  reference?: string; // Ex: setId, pokemonName, "AllTrainers"
  createdAt: number;

  allCards: MinimalCardData[];
  quantityMap: Record<string, number>;
}

/** Para criar o Blinder via Modal */
interface CreatingBinderState {
  visible: boolean;
  step: number;                // 1=Tipo, 2=Detalhes, 3=Treinador
  name: string;
  binderType: BinderType | null;

  // Master e Pokémon
  selectedCollectionId: string;
  pokemonName: string;

  // Trainer
  trainerCategory: "item" | "supporter" | "energy" | "all";
  trainerCollectionId: string; // setId ou ""

  loadingCards: boolean;
  fetchedCards: MinimalCardData[];
}

/** Para coleções (Master Set, Trainer...) */
interface CollectionData {
  id: string;
  name: string;
  ptcgoCode?: string;
  printedTotal?: number;
  series?: string;
  releaseDate?: string;
  images?: {
    symbol: string;
    logo: string;
  };
}

/** Ordenação do Binder Detalhe */
type BinderSortOption = "number" | "name" | "rarity" | "quantity" | "release";

/** Componente Principal */
export default function CollectionsScreen() {
  /** Lista de Binders, selectedBinder */
  const [binders, setBinders] = useState<Binder[]>([]);
  const [selectedBinder, setSelectedBinder] = useState<Binder | null>(null);

  /** Coleções (para Master / Trainer) */
  const [collections, setCollections] = useState<CollectionData[]>([]);
  const [collectionModalVisible, setCollectionModalVisible] = useState(false);
  const [collectionSearchQuery, setCollectionSearchQuery] = useState("");

  /** Ordenação do Blinder Detalhe (padrão = 'number') */
  const [binderSort, setBinderSort] = useState<BinderSortOption>("number");
  const [sortModalVisible, setSortModalVisible] = useState(false);

  /** Criação do Blinder (modal “bonitão”) */
  const [createBinderState, setCreateBinderState] = useState<CreatingBinderState>({
    visible: false,
    step: 1,
    name: "",
    binderType: null,
    selectedCollectionId: "",
    pokemonName: "",
    trainerCategory: "all",
    trainerCollectionId: "",
    loadingCards: false,
    fetchedCards: [],
  });

  /** Carrega do AsyncStorage + Coleções */
  useEffect(() => {
    loadBindersFromStorage();
    loadCollections();
  }, []);

  async function loadBindersFromStorage() {
    try {
      const json = await AsyncStorage.getItem("@userBinders");
      if (json) {
        const arr = JSON.parse(json) as Binder[];
        setBinders(arr);
      }
    } catch (err) {
      console.log("Erro ao carregar binders:", err);
    }
  }
  async function saveBindersToStorage(updated: Binder[]) {
    setBinders(updated);
    try {
      await AsyncStorage.setItem("@userBinders", JSON.stringify(updated));
    } catch (err) {
      console.log("Erro ao salvar binders:", err);
    }
  }
  async function loadCollections() {
    try {
      const resp = await fetch("https://api.pokemontcg.io/v2/sets");
      const data = await resp.json();
      if (data && data.data) {
        const all: CollectionData[] = data.data.map((col: any) => ({
          id: col.id,
          name: col.name,
          ptcgoCode: col.ptcgoCode,
          printedTotal: col.printedTotal,
          series: col.series,
          releaseDate: col.releaseDate,
          images: col.images,
        }));
        setCollections(all);
      }
    } catch (err) {
      console.log("Erro ao carregar coleções:", err);
    }
  }

  /** HOME */
  function openCreateBinderModal() {
    setCreateBinderState({
      visible: true,
      step: 1,
      name: "",
      binderType: null,
      selectedCollectionId: "",
      pokemonName: "",
      trainerCategory: "all",
      trainerCollectionId: "",
      loadingCards: false,
      fetchedCards: [],
    });
  }
  function closeCreateBinderModal() {
    setCreateBinderState((prev) => ({ ...prev, visible: false }));
  }

  function openBinderDetail(binder: Binder) {
    setSelectedBinder(binder);
    setBinderSort("number"); // padrão
  }
  function closeBinderDetail() {
    setSelectedBinder(null);
  }

  function handleDeleteBinder(binder: Binder) {
    Alert.alert("Excluir", `Deseja excluir o binder "${binder.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          const updated = binders.filter((b) => b.id !== binder.id);
          saveBindersToStorage(updated);
          if (selectedBinder?.id === binder.id) setSelectedBinder(null);
        },
      },
    ]);
  }

  /** =========== CRIAÇÃO DE BINDER (Modal) =========== */
  function goToStep(step: number) {
    setCreateBinderState((prev) => ({ ...prev, step }));
  }
  function selectBinderType(tp: BinderType) {
    // Se for “trainer”, vamos step=3 (tela trainerCategory)
    if (tp === "trainer") {
      setCreateBinderState((prev) => ({
        ...prev,
        binderType: "trainer",
        step: 3,  // pular direto p/ trainerCategory
      }));
    } else {
      setCreateBinderState((prev) => ({
        ...prev,
        binderType: tp,
        step: 2,
      }));
    }
  }

  /** Sub-step: para “trainer”, user escolhe category e setId ou "All" */
  function handleSelectTrainerCategory(cat: "item"|"supporter"|"energy"|"all") {
    setCreateBinderState((prev) => ({ ...prev, trainerCategory: cat }));
  }
  function handleSelectTrainerCollection(setId: string) {
    setCreateBinderState((prev) => ({ ...prev, trainerCollectionId: setId }));
  }

  /** Filtra coleções no modal (master/trainer) */
  const filteredCollectionList = useMemo(() => {
    if (!collectionSearchQuery.trim()) return collections;
    return collections.filter((col) =>
      col.name.toLowerCase().includes(collectionSearchQuery.toLowerCase())
    );
  }, [collectionSearchQuery, collections]);

  function openCollectionModal() {
    setCollectionSearchQuery("");
    setCollectionModalVisible(true);
  }
  function closeCollectionModal() {
    setCollectionModalVisible(false);
  }
  function selectCollection(colId: string) {
    if (createBinderState.binderType === "master") {
      // Master Set
      setCreateBinderState((prev) => ({ ...prev, selectedCollectionId: colId }));
    } else if (createBinderState.binderType === "trainer") {
      // Trainer
      setCreateBinderState((prev) => ({ ...prev, trainerCollectionId: colId }));
    }
    closeCollectionModal();
  }

  /** Busca Cartas da API */
  async function fetchCardsForBinder() {
    const {
      binderType,
      selectedCollectionId,
      pokemonName,
      trainerCategory,
      trainerCollectionId,
    } = createBinderState;

    setCreateBinderState((prev) => ({ ...prev, loadingCards: true, fetchedCards: [] }));

    try {
      if (binderType === "master") {
        if (!selectedCollectionId) {
          Alert.alert("Erro", "Selecione uma coleção para o Master Set.");
          setCreateBinderState((prev) => ({ ...prev, loadingCards: false }));
          return;
        }
        const url = `https://api.pokemontcg.io/v2/cards?q=set.id:"${selectedCollectionId}"&pageSize=500`;
        const data = await fetchApi(url);
        setCreateBinderState((prev) => ({ ...prev, fetchedCards: data, loadingCards: false }));
      }
      else if (binderType === "pokemon") {
        if (!pokemonName.trim()) {
          Alert.alert("Erro", "Digite o nome do Pokémon.");
          setCreateBinderState((prev) => ({ ...prev, loadingCards: false }));
          return;
        }
        const query = encodeURIComponent(`name:"${pokemonName}" supertype:pokemon`);
        const url = `https://api.pokemontcg.io/v2/cards?q=${query}&pageSize=500`;
        const data = await fetchApi(url);
        setCreateBinderState((prev) => ({ ...prev, fetchedCards: data, loadingCards: false }));
      }
      else if (binderType === "trainer") {
        // Monta a query de trainer
        let typeQuery = "";
        if (trainerCategory === "item") {
          typeQuery = `supertype:trainer subtype:item`;
        } else if (trainerCategory === "supporter") {
          typeQuery = `supertype:trainer subtype:supporter`;
        } else if (trainerCategory === "energy") {
          // Nesse caso, supertype=energy
          typeQuery = `supertype:energy`;
        } else {
          // all => supertype:trainer ou supertype:energy
          // podemos separar e unir? Pra simplificar, coloco: (supertype:trainer or supertype:energy)
          // mas a API não lida bem com "or"
          // Então vamos buscar trainer + energy
          // OU consultamos 2x e juntamos. Farei 2 fetch e junto.
          const data1 = await fetchApi(`https://api.pokemontcg.io/v2/cards?q=supertype:trainer&pageSize=500`);
          const data2 = await fetchApi(`https://api.pokemontcg.io/v2/cards?q=supertype:energy&pageSize=500`);
          let combined = [...data1, ...data2];

          // Se trainerCollectionId != "", filtra por set.id
          if (trainerCollectionId) {
            combined = combined.filter((c) => c.setId === trainerCollectionId);
          }

          setCreateBinderState((prev) => ({ ...prev, fetchedCards: combined, loadingCards: false }));
          return;
        }

        // Agora, se trainerCollectionId != "", incluímos set.id
        let finalUrl = `https://api.pokemontcg.io/v2/cards?q=${typeQuery}`;
        if (trainerCollectionId) {
          finalUrl += ` set.id:"${trainerCollectionId}"`;
        }
        finalUrl += `&pageSize=500`;
        const data = await fetchApi(finalUrl);
        setCreateBinderState((prev) => ({ ...prev, fetchedCards: data, loadingCards: false }));
      }
      else {
        // "general" => sem busca
        Alert.alert("Ops", "Por enquanto esse tipo não faz busca automática.");
        setCreateBinderState((prev) => ({ ...prev, loadingCards: false }));
      }
    } catch (err) {
      console.log("Erro no fetchCardsForBinder:", err);
      setCreateBinderState((prev) => ({ ...prev, loadingCards: false, fetchedCards: [] }));
    }
  }

  /** Aux: fetch e parse minimal data */
  async function fetchApi(url: string): Promise<MinimalCardData[]> {
    const resp = await fetch(url);
    const json = await resp.json();
    if (json && json.data) {
      return json.data.map((c: any) => ({
        id: c.id,
        name: c.name,
        images: c.images,
        rarity: c.rarity || "",
        number: c.number,
        releaseDate: c.set?.releaseDate,
        // Extra: c.setId?
        setId: c.set?.id,
      }));
    }
    return [];
  }

  /** Finalizar a criação do Blinder => Salva local */
  function handleCreateBinder() {
    const {
      name,
      binderType,
      fetchedCards,
      selectedCollectionId,
      pokemonName,
      trainerCategory,
      trainerCollectionId,
    } = createBinderState;

    if (!binderType) {
      Alert.alert("Erro", "Selecione um tipo de Binder.");
      return;
    }
    if (!name.trim()) {
      Alert.alert("Erro", "Dê um nome ao seu Binder.");
      return;
    }

    const newBinder: Binder = {
      id: `binder_${Date.now()}`,
      name: name.trim(),
      binderType,
      createdAt: Date.now(),
      allCards: fetchedCards,
      quantityMap: {},
    };

    // reference
    if (binderType === "master") {
      newBinder.reference = selectedCollectionId || "AllSets";
    } else if (binderType === "pokemon") {
      newBinder.reference = pokemonName.trim();
    } else if (binderType === "trainer") {
      if (trainerCategory === "all") {
        newBinder.reference = trainerCollectionId
          ? `AllTrainers + set:${trainerCollectionId}`
          : `AllTrainers(AllSets)`;
      } else {
        newBinder.reference = `${trainerCategory} + set:${trainerCollectionId || "AllSets"}`;
      }
    }

    const updated = [...binders, newBinder];
    saveBindersToStorage(updated);

    Alert.alert("Sucesso", "Binder criado com sucesso!");
    closeCreateBinderModal();
  }

  // =========== DETALHES DO BINDER (FlatList c/3 colunas) ===========

  function incrementCardQuantity(cardId: string) {
    if (!selectedBinder) return;
    const oldVal = selectedBinder.quantityMap[cardId] || 0;
    const newVal = oldVal + 1;
    const updatedQuantity = { ...selectedBinder.quantityMap, [cardId]: newVal };
    const updatedBinder = { ...selectedBinder, quantityMap: updatedQuantity };
    const updatedList = binders.map((b) => (b.id === updatedBinder.id ? updatedBinder : b));
    saveBindersToStorage(updatedList);
    setSelectedBinder(updatedBinder);
  }

  function decrementCardQuantity(cardId: string) {
    if (!selectedBinder) return;
    const oldVal = selectedBinder.quantityMap[cardId] || 0;
    if (oldVal === 0) return;
    const newVal = oldVal - 1;
    const updatedQuantity = { ...selectedBinder.quantityMap, [cardId]: newVal };
    const updatedBinder = { ...selectedBinder, quantityMap: updatedQuantity };
    const updatedList = binders.map((b) => (b.id === updatedBinder.id ? updatedBinder : b));
    saveBindersToStorage(updatedList);
    setSelectedBinder(updatedBinder);
  }

  /** Monta array final do Binder (aplica sort) */
  const binderDisplayCards = useMemo(() => {
    if (!selectedBinder) return [];
    const arr = [...selectedBinder.allCards];

    switch (binderSort) {
      case "number":
        arr.sort((a, b) => parseCardNumber(a.number) - parseCardNumber(b.number));
        break;
      case "name":
        arr.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "rarity":
        arr.sort((a, b) => (a.rarity || "").localeCompare(b.rarity || ""));
        break;
      case "quantity":
        arr.sort((a, b) => {
          const qa = selectedBinder.quantityMap[a.id] || 0;
          const qb = selectedBinder.quantityMap[b.id] || 0;
          return qb - qa;
        });
        break;
      case "release":
        arr.sort((a, b) => {
          const da = a.releaseDate || "9999/99/99";
          const db = b.releaseDate || "9999/99/99";
          return da.localeCompare(db);
        });
        break;
    }

    return arr;
  }, [selectedBinder, binderSort]);

  function parseCardNumber(numStr?: string): number {
    if (!numStr) return 9999;
    const match = numStr.match(/^(\d+)/);
    if (!match) return 9999;
    return parseInt(match[1], 10);
  }

  /** Render item do FlatList */
  const SCREEN_WIDTH = Dimensions.get("window").width;
  const cardWidth = (SCREEN_WIDTH - 42) / 3; // ajustado p/ 3 colunas

  function renderCardItem({ item }: { item: MinimalCardData }) {
    if (!selectedBinder) return null;
    const q = selectedBinder.quantityMap[item.id] || 0;
    const hasIt = q > 0;
    return (
      <Animatable.View
        style={[styles.cardItemContainer, { width: cardWidth }]}
        animation="fadeIn"
        duration={500}
      >
        <View style={styles.cardImageWrapper}>
          {item.images?.small ? (
            <Image
              source={{ uri: item.images.small }}
              style={{ width: cardWidth * 0.85, height: cardWidth * 1.1 }}
              resizeMode="contain"
            />
          ) : (
            <Ionicons name="image" size={48} color="#999" />
          )}
          {!hasIt && <View style={styles.grayOverlay} />}
        </View>

        <Text style={styles.cardNameGrid} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.cardRarityGrid} numberOfLines={1}>
          {item.rarity}
        </Text>

        {/* +, Q, - */}
        <View style={styles.qtyRow}>
          <TouchableOpacity style={styles.qtyButton} onPress={() => incrementCardQuantity(item.id)}>
            <Ionicons name="add-circle" size={20} color="#FFF" />
          </TouchableOpacity>
          {q > 0 ? (
            <Text style={styles.cardQuantityText}>x{q}</Text>
          ) : (
            <Text style={[styles.cardQuantityText, { color: "#F44336" }]}>
              (Falta)
            </Text>
          )}
          <TouchableOpacity style={styles.qtyButton} onPress={() => decrementCardQuantity(item.id)}>
            <Ionicons name="remove-circle" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </Animatable.View>
    );
  }

  /** Modal de ordenação (engrenagem) */
  function openSortModal() {
    setSortModalVisible(true);
  }
  function closeSortModal() {
    setSortModalVisible(false);
  }
  function selectSortOption(opt: BinderSortOption) {
    setBinderSort(opt);
    setSortModalVisible(false);
  }

  // =========== RENDER PRINCIPAL ===========
  return (
    <SafeAreaView style={styles.container}>
      {/* HOME (se !selectedBinder) */}
      {!selectedBinder && (
        <View style={styles.headerRow}>
          <Text style={styles.title}>Minhas Coleções (Binders)</Text>

          <TouchableOpacity style={styles.createButton} onPress={openCreateBinderModal}>
            <Ionicons name="add-circle" size={20} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={{ color: "#FFF", fontWeight: "bold" }}>Criar Binder</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Grid de Binders */}
      {!selectedBinder && (
        <ScrollView contentContainerStyle={styles.gridContainer}>
          {binders.length === 0 && (
            <Text style={{ color: "#999", marginTop: 20 }}>
              Você ainda não criou nenhum Binder.
            </Text>
          )}
          <View style={styles.gridWrapper}>
            {binders.map((binder) => {
              const total = binder.allCards.length;
              const hasCount = Object.values(binder.quantityMap).reduce((acc, q) => acc + q, 0);
              const perc = total > 0 ? Math.round((hasCount / total) * 100) : 0;

              return (
                <Animatable.View
                  key={binder.id}
                  style={styles.binderCard}
                  animation="fadeInUp"
                  duration={600}
                >
                  <TouchableOpacity
                    style={styles.binderInner}
                    onPress={() => openBinderDetail(binder)}
                  >
                    <Ionicons name="albums" size={40} color="#FFF" style={{ marginBottom: 8 }} />
                    <Text style={styles.binderName}>{binder.name}</Text>
                    <Text style={styles.binderType}>
                      Tipo: {binder.binderType.toUpperCase()}
                    </Text>
                    {binder.reference && (
                      <Text style={styles.binderReference}>{binder.reference}</Text>
                    )}
                    <Text style={styles.binderProgress}>
                      {hasCount}/{total} ({perc}%)
                    </Text>
                  </TouchableOpacity>

                  {/* Botão Excluir */}
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteBinder(binder)}
                  >
                    <Ionicons name="trash" size={16} color="#FFF" />
                  </TouchableOpacity>
                </Animatable.View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Detalhe do Blinder (FlatList 3 colunas) */}
      {selectedBinder && (
        <View style={{ flex: 1, backgroundColor: "#111" }}>
          {/* Header do Binder */}
          <View style={styles.binderDetailHeader}>
            <TouchableOpacity style={{ flexDirection: "row", alignItems: "center" }} onPress={closeBinderDetail}>
              <Ionicons name="arrow-back" size={22} color="#FFF" />
              <Text style={{ color: "#FFF", marginLeft: 6 }}>Voltar</Text>
            </TouchableOpacity>

            <Text style={styles.binderDetailTitle}>{selectedBinder.name}</Text>

            <TouchableOpacity style={styles.sortIconButton} onPress={openSortModal}>
              <Ionicons name="settings" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={binderDisplayCards}
            keyExtractor={(item) => item.id}
            numColumns={3}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={{ paddingBottom: 80 }}
            renderItem={renderCardItem}
          />
        </View>
      )}

      {/* ============== MODAL CRIAÇÃO DE BLINDER BONITÃO ============== */}
      <Modal
        visible={createBinderState.visible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeCreateBinderModal}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#222" }}>
          <Animatable.View animation="fadeInUp" style={{ flex: 1 }}>
            {createBinderState.step === 1 && (
              <ScrollView contentContainerStyle={styles.modalStepContainer}>
                <Text style={styles.modalTitle}>Criar Novo Blinder</Text>
                <Text style={styles.label}>Escolha o Tipo:</Text>

                {/* Opções de Type com ícones */}
                <View style={styles.typeIconsRow}>
                  <TouchableOpacity
                    style={styles.typeIconOption}
                    onPress={() => selectBinderType("master")}
                  >
                    <Ionicons name="ribbon" size={40} color="#FDD835" style={{ marginBottom: 6 }}/>
                    <Text style={styles.typeIconText}>Master Set</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.typeIconOption}
                    onPress={() => selectBinderType("pokemon")}
                  >
                    <Ionicons name="logo-octocat" size={40} color="#42A5F5" style={{ marginBottom: 6 }}/>
                    <Text style={styles.typeIconText}>Pokémon</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.typeIconOption}
                    onPress={() => selectBinderType("trainer")}
                  >
                    <Ionicons name="school" size={40} color="#EF5350" style={{ marginBottom: 6 }}/>
                    <Text style={styles.typeIconText}>Trainer</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.typeIconOption}
                    onPress={() => selectBinderType("general")}
                  >
                    <Ionicons name="globe" size={40} color="#AB47BC" style={{ marginBottom: 6 }}/>
                    <Text style={styles.typeIconText}>Geral</Text>
                  </TouchableOpacity>
                </View>

                <Text style={{ color: "#CCC", marginTop: 20, textAlign: "center" }}>
                  Escolha o tipo que deseja criar.
                </Text>

                <TouchableOpacity
                  style={[styles.button, { backgroundColor: "#999", marginTop: 30, alignSelf: "center" }]}
                  onPress={closeCreateBinderModal}
                >
                  <Ionicons name="close-circle" size={16} color="#FFF" style={{ marginRight: 4 }} />
                  <Text style={styles.buttonText}>Cancelar</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {createBinderState.step === 2 && (
              <ScrollView contentContainerStyle={styles.modalStepContainer}>
                <Text style={styles.modalTitle}>Detalhes do Binder</Text>

                {/* Nome */}
                <Text style={styles.label}>Nome do Binder</Text>
                <TextInput
                  style={styles.modalInput}
                  value={createBinderState.name}
                  onChangeText={(val) =>
                    setCreateBinderState((prev) => ({ ...prev, name: val }))
                  }
                  placeholder="Ex: 'Meu Master Set SWSH9'"
                  placeholderTextColor="#999"
                />

                {/* Se for Master => escolhe a coleção */}
                {createBinderState.binderType === "master" && (
                  <>
                    <Text style={styles.label}>Coleção (Master Set)</Text>
                    <TouchableOpacity
                      style={styles.selectCollectionButton}
                      onPress={() => {
                        openCollectionModal();
                      }}
                    >
                      <Ionicons name="albums" size={16} color="#FFF" style={{ marginRight: 6 }} />
                      <Text style={{ color: "#FFF", fontWeight: "bold" }}>
                        {createBinderState.selectedCollectionId
                          ? `Selecionada: ${createBinderState.selectedCollectionId}`
                          : "Selecionar Coleção"}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Se for Pokémon => pede o nome do Pokémon */}
                {createBinderState.binderType === "pokemon" && (
                  <>
                    <Text style={styles.label}>Nome do Pokémon</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={createBinderState.pokemonName}
                      onChangeText={(val) =>
                        setCreateBinderState((prev) => ({ ...prev, pokemonName: val }))
                      }
                      placeholder="Ex: 'Charizard'"
                      placeholderTextColor="#999"
                    />
                  </>
                )}

                {/* Se for 'general' => só define um nome, sem busca */}
                {/* Botão de buscar se for master/pokemon */}
                {(createBinderState.binderType === "master" ||
                  createBinderState.binderType === "pokemon") && (
                  <TouchableOpacity
                    style={[styles.button, { marginTop: 12 }]}
                    onPress={fetchCardsForBinder}
                  >
                    <Ionicons name="cloud-download" size={16} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.buttonText}>Buscar Cartas</Text>
                  </TouchableOpacity>
                )}
                {createBinderState.loadingCards && (
                  <ActivityIndicator size="large" color="#E3350D" style={{ marginTop: 10 }} />
                )}
                {!!createBinderState.fetchedCards.length && (
                  <Text style={{ color: "#FFF", marginTop: 10 }}>
                    {createBinderState.fetchedCards.length} cartas encontradas!
                  </Text>
                )}

                {/* Botões */}
                <View style={{ flexDirection: "row", justifyContent: "space-evenly", marginTop: 20 }}>
                  <TouchableOpacity
                    style={[styles.button, { backgroundColor: "#999" }]}
                    onPress={() => setCreateBinderState((prev) => ({ ...prev, step: 1 }))}
                  >
                    <Ionicons name="arrow-back" size={16} color="#FFF" style={{ marginRight: 4 }} />
                    <Text style={styles.buttonText}>Voltar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button]}
                    onPress={handleCreateBinder}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.buttonText}>Criar</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

            {createBinderState.step === 3 && (
              <ScrollView contentContainerStyle={styles.modalStepContainer}>
                <Text style={styles.modalTitle}>Treinadores</Text>
                <Text style={styles.label}>Nome do Blinder</Text>
                <TextInput
                  style={styles.modalInput}
                  value={createBinderState.name}
                  onChangeText={(val) =>
                    setCreateBinderState((prev) => ({ ...prev, name: val }))
                  }
                  placeholder="Ex: 'Treinadores SWSH9'"
                  placeholderTextColor="#999"
                />

                <Text style={styles.label}>Categoria:</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {(["all","item","supporter","energy"] as const).map((cat) => {
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.trainerCatButton,
                          createBinderState.trainerCategory === cat && styles.trainerCatButtonActive,
                        ]}
                        onPress={() => handleSelectTrainerCategory(cat)}
                      >
                        <Ionicons
                          name={cat === "energy" ? "flash" : (cat === "supporter" ? "people" : (cat==="item"?"briefcase":"apps"))}
                          size={16}
                          color="#FFF"
                          style={{ marginRight: 4 }}
                        />
                        <Text style={{ color: "#FFF", fontWeight: "bold" }}>{cat.toUpperCase()}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Selecionar coleção ou "todas" */}
                <Text style={styles.label}>Coleção (opcional)</Text>
                <TouchableOpacity
                  style={styles.selectCollectionButton}
                  onPress={() => {
                    openCollectionModal();
                  }}
                >
                  <Ionicons name="albums" size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={{ color: "#FFF", fontWeight: "bold" }}>
                    {createBinderState.trainerCollectionId
                      ? `Selecionada: ${createBinderState.trainerCollectionId}`
                      : "Todas as Coleções"}
                  </Text>
                </TouchableOpacity>

                {/* Botão fetch */}
                <TouchableOpacity
                  style={[styles.button, { marginTop: 12 }]}
                  onPress={fetchCardsForBinder}
                >
                  <Ionicons name="cloud-download" size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.buttonText}>Buscar Cartas</Text>
                </TouchableOpacity>
                {createBinderState.loadingCards && (
                  <ActivityIndicator size="large" color="#E3350D" style={{ marginTop: 10 }} />
                )}
                {!!createBinderState.fetchedCards.length && (
                  <Text style={{ color: "#FFF", marginTop: 10 }}>
                    {createBinderState.fetchedCards.length} cartas encontradas!
                  </Text>
                )}

                {/* Botões */}
                <View style={{ flexDirection: "row", justifyContent: "space-evenly", marginTop: 20 }}>
                  <TouchableOpacity
                    style={[styles.button, { backgroundColor: "#999" }]}
                    onPress={() => setCreateBinderState((prev) => ({ ...prev, step: 1 }))}
                  >
                    <Ionicons name="arrow-back" size={16} color="#FFF" style={{ marginRight: 4 }} />
                    <Text style={styles.buttonText}>Voltar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.button]} onPress={handleCreateBinder}>
                    <Ionicons name="checkmark-circle" size={16} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={styles.buttonText}>Criar</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </Animatable.View>
        </SafeAreaView>
      </Modal>

      {/* MODAL Coleções (Master / Trainer) */}
      <Modal
        visible={collectionModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeCollectionModal}
      >
        <View style={styles.overlay}>
          <View style={styles.collectionModalContainer}>
            <Text style={styles.modalTitle}>Selecionar Coleção</Text>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#999" style={{ marginRight: 6 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar coleção..."
                placeholderTextColor="#999"
                value={collectionSearchQuery}
                onChangeText={setCollectionSearchQuery}
              />
            </View>

            <ScrollView style={{ maxHeight: 300, width: "100%", marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.collectionItem, { backgroundColor: "#444" }]}
                onPress={() => {
                  // "Nenhuma" => define ""
                  selectCollection("");
                }}
              >
                <Text style={styles.collectionItemText}>Todas as Coleções</Text>
              </TouchableOpacity>

              {filteredCollectionList.map((col) => (
                <TouchableOpacity
                  key={col.id}
                  style={styles.collectionItem}
                  onPress={() => {
                    selectCollection(col.id);
                  }}
                >
                  <Text style={styles.collectionItemText}>{col.name}</Text>
                  {col.series && (
                    <Text style={{ color: "#ccc", fontSize: 10 }}>{col.series}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: "#999", marginTop: 10 }]}
              onPress={closeCollectionModal}
            >
              <Ionicons name="close-circle" size={16} color="#FFF" style={{ marginRight: 4 }} />
              <Text style={styles.buttonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL Ordenacao (engrenagem) */}
      <Modal
        visible={sortModalVisible}
        animationType="fade"
        transparent
        onRequestClose={closeSortModal}
      >
        <View style={styles.overlay}>
          <View style={styles.sortModalContainer}>
            <Text style={styles.modalTitle}>Ordenar por</Text>
            {(["number","name","rarity","quantity","release"] as BinderSortOption[]).map((opt) => (
              <TouchableOpacity
                key={opt}
                style={styles.sortOptionButton}
                onPress={() => selectSortOption(opt)}
              >
                <Text style={styles.sortOptionText}>
                  {binderSort === opt ? "✓ " : ""}
                  {labelForSort(opt)}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: "#999", marginTop: 20 }]}
              onPress={closeSortModal}
            >
              <Ionicons name="close-circle" size={16} color="#FFF" style={{ marginRight: 4 }} />
              <Text style={styles.buttonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/** Label p/ cada sortOption */
function labelForSort(opt: BinderSortOption): string {
  switch(opt) {
    case "number": return "Número (Padrão)";
    case "name": return "Nome";
    case "rarity": return "Raridade";
    case "quantity": return "Quantidade";
    case "release": return "Lançamento";
    default: return opt;
  }
}

/** ESTILOS */
const DARK = "#1E1E1E";
const PRIMARY = "#E3350D";
const GRAY = "#2A2A2A";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK,
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  title: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 18,
  },
  createButton: {
    flexDirection: "row",
    backgroundColor: "#444",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
  },

  /** HOME - GRID BINDERS */
  gridContainer: {
    paddingHorizontal: 8,
    paddingBottom: 60,
    alignItems: "center",
  },
  gridWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  binderCard: {
    backgroundColor: "#333",
    borderRadius: 8,
    margin: 6,
    padding: 10,
    width: (Dimensions.get("window").width - 48) / 3,
    position: "relative",
  },
  binderInner: {
    alignItems: "center",
  },
  binderName: {
    color: "#FFF",
    fontWeight: "bold",
    textAlign: "center",
  },
  binderType: {
    color: "#BBB",
    fontSize: 12,
    marginVertical: 2,
  },
  binderReference: {
    color: "#CCC",
    fontSize: 12,
    marginBottom: 4,
  },
  binderProgress: {
    color: "#66BB6A",
    fontSize: 12,
  },
  deleteButton: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#900",
    borderRadius: 4,
    padding: 4,
  },

  /** DETALHE - BINDER */
  binderDetailHeader: {
    flexDirection: "row",
    backgroundColor: "#000",
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },
  binderDetailTitle: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  sortIconButton: {
    padding: 4,
  },

  /** FLATLIST 3 colunas */
  columnWrapper: {
    justifyContent: "flex-start",
    marginHorizontal: 4,
    marginVertical: 4,
  },
  cardItemContainer: {
    backgroundColor: "#222",
    borderRadius: 8,
    padding: 4,
    alignItems: "center",
  },
  cardImageWrapper: {
    position: "relative",
  },
  grayOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 4,
  },
  cardNameGrid: {
    color: "#FFF",
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  cardRarityGrid: {
    color: "#CCC",
    fontSize: 11,
    textAlign: "center",
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  qtyButton: {
    backgroundColor: "#333",
    borderRadius: 6,
    padding: 4,
  },
  cardQuantityText: {
    color: "#66BB6A",
    fontSize: 12,
    fontWeight: "bold",
    marginHorizontal: 6,
  },

  /** MODAL CRIAÇÃO BONITA */
  modalStepContainer: {
    padding: 16,
    alignItems: "center",
  },
  modalTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  label: {
    color: "#FFF",
    fontSize: 14,
    marginBottom: 6,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  modalInput: {
    width: "100%",
    backgroundColor: "#444",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: "#FFF",
    marginBottom: 6,
  },
  typeIconsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    marginTop: 12,
  },
  typeIconOption: {
    width: 80,
    backgroundColor: "#444",
    borderRadius: 6,
    padding: 8,
    margin: 8,
    alignItems: "center",
  },
  typeIconText: {
    color: "#FFF",
    fontSize: 12,
    textAlign: "center",
    fontWeight: "bold",
  },

  /** Botão p/ Collection */
  selectCollectionButton: {
    flexDirection: "row",
    backgroundColor: "#555",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    marginBottom: 6,
    width: "100%",
  },
  button: {
    flexDirection: "row",
    backgroundColor: PRIMARY,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFF",
    fontWeight: "bold",
  },

  /** Trainer Category */
  trainerCatButton: {
    flexDirection: "row",
    backgroundColor: "#444",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 6,
    marginBottom: 6,
    alignItems: "center",
  },
  trainerCatButtonActive: {
    backgroundColor: "#666",
  },

  /** MODAL Overlay (Collections + Sort) */
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  collectionModalContainer: {
    backgroundColor: DARK,
    width: "80%",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  sortModalContainer: {
    backgroundColor: DARK,
    width: "80%",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    backgroundColor: GRAY,
    borderRadius: 8,
    alignItems: "center",
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    color: "#FFF",
    paddingVertical: 6,
  },
  collectionItem: {
    paddingVertical: 6,
    borderBottomColor: "#444",
    borderBottomWidth: 1,
  },
  collectionItemText: {
    color: "#FFF",
    fontSize: 14,
  },
  sortOptionButton: {
    paddingVertical: 6,
    width: "100%",
    marginTop: 8,
  },
  sortOptionText: {
    color: "#FFF",
    fontSize: 14,
  },
});
