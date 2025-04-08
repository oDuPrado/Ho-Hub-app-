import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import useBackupManager from "../../components/BackupManager";

/** Tipos */
type BinderType = "master" | "pokemon" | "trainer" | "general";
type TrainerCategory = "energy" | "all"; // agora SÓ "energy" e "all"
type BinderSortOption = "number" | "name" | "rarity" | "quantity" | "release";

interface MinimalCardData {
  id: string;
  name: string;
  images?: {
    small: string;
  };
  rarity?: string;
  number?: string;
  releaseDate?: string;
  setId?: string;
  setSeries?: string;
}

interface Binder {
  id: string;
  name: string;
  binderType: BinderType;
  reference?: string;
  createdAt: number;
  allCards: MinimalCardData[];
  quantityMap: Record<string, number>;
}

/** Lista “oficial” de raridades (ficou, mas não será usada em Pokémon) */
const ALL_RARITIES = [
  "Common",
  "Uncommon",
  "Rare",
  "Holo Rare",
  "Ultra Rare",
  "Secret Rare",
  "Promo",
  "Rare Holo",
  "Rare ACE",
  "Amazing Rare",
  "Radiant",
];

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

/** Estado do modal de criação */
interface CreatingBinderState {
  visible: boolean;
  step: number;
  name: string;
  binderType: BinderType | null;

  // multi sets + multi series
  selectedSets: string[];
  selectedSeries: string[];

  // para Pokémon
  pokemonName: string;

  // trainer
  trainerCategory: TrainerCategory;

  // raridades
  selectedRarities: string[];

  // Loading
  loadingCards: boolean;
  fetchedCards: MinimalCardData[];
}

function getBinderColor(type: BinderType) {
  switch (type) {
    case "master": return "#3E3A1F";     // dourado escuro (Master)
    case "pokemon": return "#1E3A5F";    // azul escuro (Pokémon)
    case "trainer": return "#4A1C1C";    // vermelho escuro (Trainer)
    case "general": return "#3B2945";    // roxo escuro (Geral)
    default: return "#2A2A2A";           // fallback neutro escuro
  }
}

export default function CollectionsScreen() {
  const [binders, setBinders] = useState<Binder[]>([])
  const { restoredData } = useBackupManager({
    userId: "localUser",
    binders,
  });
  const [selectedBinder, setSelectedBinder] = useState<Binder | null>(null);

  const [collections, setCollections] = useState<CollectionData[]>([]);
  const [collectionsModalVisible, setCollectionsModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [searchBinderQuery, setSearchBinderQuery] = useState("");
  const [showSearchBar, setShowSearchBar] = useState(false);

  const [binderSort, setBinderSort] = useState<BinderSortOption>("number"); // default
  const [createBinderState, setCreateBinderState] = useState<CreatingBinderState>({
    visible: false,
    step: 1,
    name: "",
    binderType: null,
    selectedSets: [],
    selectedSeries: [],
    pokemonName: "",
    trainerCategory: "all", // só all e energy agora
    selectedRarities: [],
    loadingCards: false,
    fetchedCards: [],
  });

  const [editBinderState, setEditBinderState] = useState<{
    visible: boolean;
    binder: Binder | null;
    name: string;
    type: BinderType;
  }>({
    visible: false,
    binder: null,
    name: "",
    type: "general",
  });  

  /**
   * Recarregar binders sempre que a tela estiver em foco.
   */
  useFocusEffect(
    useCallback(() => {
      loadBindersFromStorage();
    }, [])
  );

  useEffect(() => {
    // Carrega coleções (API pokemontcg) 1x
    loadCollections();
  }, []);

  async function loadBindersFromStorage() {
    try {
      const raw = await AsyncStorage.getItem("@userBinders");
      if (raw) {
        setBinders(JSON.parse(raw));
      } else if (restoredData?.binders?.length) {
        setBinders(restoredData.binders);
        await AsyncStorage.setItem("@userBinders", JSON.stringify(restoredData.binders));
        console.log("Restaurado via backup local.");
      }
    } catch (err) {
      console.log("Erro loadBinders:", err);
    }
  }  

  async function saveBindersToStorage(updated: Binder[]) {
    setBinders(updated);
    try {
      await AsyncStorage.setItem("@userBinders", JSON.stringify(updated));
    } catch (err) {
      console.log("Erro saveBinders:", err);
    }
  }

  async function loadCollections() {
    try {
      const resp = await fetch("https://api.pokemontcg.io/v2/sets");
      const data = await resp.json();
      if (data && data.data) {
        const arr: CollectionData[] = data.data.map((col: any) => ({
          id: col.id,
          name: col.name,
          ptcgoCode: col.ptcgoCode,
          printedTotal: col.printedTotal,
          series: col.series,
          releaseDate: col.releaseDate,
          images: col.images,
        }));
        setCollections(arr);
      }
    } catch (err) {
      console.log("Erro loadCollections:", err);
    }
  }

  /** HOME - criar binder */
  function openCreateBinderModal() {
    setCreateBinderState({
      visible: true,
      step: 1,
      name: "",
      binderType: null,
      selectedSets: [],
      selectedSeries: [],
      pokemonName: "",
      trainerCategory: "all",
      selectedRarities: [],
      loadingCards: false,
      fetchedCards: [],
    });
  }
  function closeCreateBinderModal() {
    setCreateBinderState((p) => ({ ...p, visible: false }));
  }

  function openBinderDetail(binder: Binder) {
    setSelectedBinder(binder);
    setBinderSort("number");
  }
  function closeBinderDetail() {
    setSelectedBinder(null);
  }

  function handleDeleteBinder(binder: Binder) {
    Alert.alert("Excluir Binder", `Deseja excluir "${binder.name}"?`, [
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

  function openEditBinderModal(binder: Binder) {
    setEditBinderState({
      visible: true,
      binder,
      name: binder.name,
      type: binder.binderType,
    });
  }
  
  function closeEditBinderModal() {
    setEditBinderState({
      visible: false,
      binder: null,
      name: "",
      type: "general",
    });
  }
  
  async function handleSaveBinderEdits() {
    if (!editBinderState.binder) return;
  
    const updated = binders.map((b) =>
      b.id === editBinderState.binder!.id
        ? { ...b, name: editBinderState.name.trim(), binderType: editBinderState.type }
        : b
    );
  
    await AsyncStorage.setItem("@userBinders", JSON.stringify(updated));
    setBinders(updated);
    closeEditBinderModal();
    Alert.alert("Sucesso", "Binder atualizado com sucesso!");
  }
  

  // ========= CRIAÇÃO DE BINDER =========
  function selectBinderType(tp: BinderType) {
    if (tp === "trainer") {
      // Passa direto pro step 3
      setCreateBinderState((p) => ({ ...p, binderType: "trainer", step: 3 }));
    } else {
      setCreateBinderState((p) => ({ ...p, binderType: tp, step: 2 }));
    }
  }

  function goToStep(s: number) {
    setCreateBinderState((p) => ({ ...p, step: s }));
  }

  /** Rarities toggle (exceto se for binderType=pokemon, não vamos mostrar no UI) */
  function toggleRarity(r: string) {
    setCreateBinderState((p) => {
      const has = p.selectedRarities.includes(r);
      if (has) {
        return {
          ...p,
          selectedRarities: p.selectedRarities.filter((x) => x !== r),
        };
      } else {
        return {
          ...p,
          selectedRarities: [...p.selectedRarities, r],
        };
      }
    });
  }

  /** Múltiplo sets e series */
  function openCollectionsModal() {
    setCollectionsModalVisible(true);
  }
  function closeCollectionsModal() {
    setCollectionsModalVisible(false);
  }

  async function fetchCardsForBinder() {
    setCreateBinderState((p) => ({ ...p, loadingCards: true, fetchedCards: [] }));
    try {
      const data = await doFetchWithMultiOptions(createBinderState, collections);
      setCreateBinderState((p) => ({ ...p, fetchedCards: data, loadingCards: false }));
    } catch (err) {
      console.log("fetchCardsForBinder erro:", err);
      setCreateBinderState((p) => ({ ...p, loadingCards: false, fetchedCards: [] }));
    }
  }

  function handleCreateBinder() {
    const { binderType, name, fetchedCards } = createBinderState;
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
      reference: buildReference(createBinderState),
    };

    const updated = [...binders, newBinder];
    saveBindersToStorage(updated);
    Alert.alert("Sucesso", `Blinder "${newBinder.name}" criado!`);
    closeCreateBinderModal();
  }

  /** Monta reference (exibida no card) */
  function buildReference(st: CreatingBinderState) {
    let ref = st.binderType || "Binder";

    if (st.binderType === "master") {
      ref += ` S=${st.selectedSets.length} Se=${st.selectedSeries.length}`;
    } else if (st.binderType === "pokemon") {
      ref += `(${st.pokemonName}), S=${st.selectedSets.length}, Se=${st.selectedSeries.length}`;
    } else if (st.binderType === "trainer") {
      ref += `(${st.trainerCategory}), S=${st.selectedSets.length} Se=${st.selectedSeries.length}`;
    }

    // Se binderType for "pokemon", não mostramos raridades
    // mas se for outro, ainda podemos exibir se existirem
    if (st.binderType !== "pokemon" && st.selectedRarities.length > 0) {
      ref += ` R:${st.selectedRarities.join(",")}`;
    }
    return ref;
  }

  // ========== DETALHE BINDER ==========

  function incrementCardQuantity(cardId: string) {
    if (!selectedBinder) return;
    const old = selectedBinder.quantityMap[cardId] || 0;
    const updated = { ...selectedBinder.quantityMap, [cardId]: old + 1 };
    const newBinder: Binder = { ...selectedBinder, quantityMap: updated };
    const newList = binders.map((b) => (b.id === newBinder.id ? newBinder : b));
    saveBindersToStorage(newList);
    setSelectedBinder(newBinder);
  }

  function decrementCardQuantity(cardId: string) {
    if (!selectedBinder) return;
    const old = selectedBinder.quantityMap[cardId] || 0;
    if (old === 0) return;

    const updatedQty = old - 1;
    const updatedMap = { ...selectedBinder.quantityMap, [cardId]: updatedQty };

    // Se chegou em 0, fica 0 ou removemos do array? — A ideia é não remover do array, só ficar “(Falta)”
    const newBinder: Binder = { ...selectedBinder, quantityMap: updatedMap };
    const newList = binders.map((b) => (b.id === newBinder.id ? newBinder : b));
    saveBindersToStorage(newList);
    setSelectedBinder(newBinder);
  }

  /** NOVO: remover completamente a carta do binder (allCards e quantityMap) */
  function removeCardFromBinder(cardId: string) {
    if (!selectedBinder) return;

    Alert.alert("Remover Carta", "Deseja remover essa carta do binder?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: () => {
          const newAllCards = selectedBinder.allCards.filter((c) => c.id !== cardId);
          const newMap = { ...selectedBinder.quantityMap };
          delete newMap[cardId];

          const newBinder = {
            ...selectedBinder,
            allCards: newAllCards,
            quantityMap: newMap,
          };
          const newList = binders.map((b) => (b.id === newBinder.id ? newBinder : b));
          saveBindersToStorage(newList);
          setSelectedBinder(newBinder);

          Alert.alert("Removida", "A carta foi removida do binder!");
        },
      },
    ]);
  }

  const binderDisplayCards = useMemo(() => {
    if (!selectedBinder) return [];
  
    const query = searchBinderQuery.toLowerCase().trim();
    let arr = [...selectedBinder.allCards];
  
    if (query) {
      arr = arr.filter((card) => {
        const name = card.name?.toLowerCase() || "";
        const number = card.number?.toLowerCase() || "";
        const set = card.setId?.toLowerCase() || "";
        return (
          name.includes(query) ||
          number.includes(query) ||
          set.includes(query)
        );
      });
    }

    function parseCardNumber(numStr?: string): number {
      if (!numStr) return 9999;
      const match = numStr.match(/^(\d+)/);
      if (!match) return 9999;
      return parseInt(match[1], 10);
    }
    
  
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
        arr.sort((a, b) =>
          (a.releaseDate || "9999/99/99").localeCompare(b.releaseDate || "9999/99/99")
        );
        break;
    }
  
    return arr;
  }, [selectedBinder, binderSort, searchBinderQuery]);
  

  function renderCardItem({ item }: { item: MinimalCardData }) {
    if (!selectedBinder) return null;
    const q = selectedBinder.quantityMap[item.id] || 0;
    const hasIt = q > 0;
    const cardWidth = (Dimensions.get("window").width - 42) / 3;

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

          <TouchableOpacity
            style={styles.qtyButton}
            onPress={() => decrementCardQuantity(item.id)}
          >
            <Ionicons name="remove-circle" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Botão EXTRA para remover completamente do binder */}
        <TouchableOpacity
          style={styles.removeCardButton}
          onPress={() => removeCardFromBinder(item.id)}
        >
          <Ionicons name="trash" size={16} color="#FFF" />
        </TouchableOpacity>
      </Animatable.View>
    );
  }

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

  return (
    <SafeAreaView style={styles.container}>
      {/* HOME */}
      {!selectedBinder && (
        <View style={styles.headerRow}>
          <Text style={styles.title}>Minhas Coleções (Blinders)</Text>
          <TouchableOpacity style={styles.createButton} onPress={openCreateBinderModal}>
            <Ionicons name="add-circle" size={20} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={{ color: "#FFF", fontWeight: "bold" }}>Criar Blinder</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* GRID DE BINDERS */}
      {!selectedBinder && (
        <ScrollView contentContainerStyle={styles.gridContainer}>
          {binders.length === 0 && (
            <Text style={{ color: "#999", marginTop: 20 }}>
              Você ainda não criou nenhum Blinder.
            </Text>
          )}
          <View style={styles.gridWrapper}>
            {binders.map((binder) => {
              const total = binder.allCards.length;
              const hasCount = binder.allCards.filter(c => binder.quantityMap[c.id] > 0).length;
              const perc = total > 0 ? Math.round((hasCount / total) * 100) : 0;

              return (
                <Animatable.View
                    key={binder.id}
                    style={[
                      styles.binderCard,
                      { backgroundColor: getBinderColor(binder.binderType) }
                    ]}
                    animation="fadeInUp"
                    duration={600}
                  >
                  <TouchableOpacity style={styles.binderInner} onPress={() => openBinderDetail(binder)}>
                  {binder.allCards.length > 0 ? (
                  <Image
                    source={{ uri: binder.allCards[0].images?.small }}
                    style={{ width: 60, height: 85, marginBottom: 8, borderRadius: 4 }}
                    resizeMode="contain"
                  />
                ) : (
                  <Ionicons name="albums" size={40} color="#FFF" style={{ marginBottom: 8 }} />
                )}

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

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteBinder(binder)}
                  >
                    <Ionicons name="trash" size={16} color="#FFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                  style={[styles.deleteButton, { top: 36, backgroundColor: "#2980b9" }]}
                  onPress={() => openEditBinderModal(binder)}
                >
                  <Ionicons name="create" size={16} color="#FFF" />
                </TouchableOpacity>
                </Animatable.View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* DETALHE DO BINDER */}
      {selectedBinder && (
      <View style={{ flex: 1, backgroundColor: "#111" }}>
        {/* HEADER do detalhe */}
        <View style={styles.binderDetailHeader}>
          {/* Voltar */}
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center" }}
            onPress={closeBinderDetail}
          >
            <Ionicons name="arrow-back" size={22} color="#FFF" />
            <Text style={{ color: "#FFF", marginLeft: 6 }}>Voltar</Text>
          </TouchableOpacity>

          {/* Nome do binder (centralizado) */}
          <Text style={[styles.binderDetailTitle, { flex: 1, textAlign: "center" }]}>
            {selectedBinder.name}
          </Text>

          {/* Botões do canto direito */}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              style={{ paddingHorizontal: 6 }}
              onPress={() => setShowSearchBar((prev) => !prev)}
            >
              <Ionicons name="search" size={20} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.sortIconButton} onPress={openSortModal}>
              <Ionicons name="settings" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* BARRA DE BUSCA */}
        {showSearchBar && (
          <Animatable.View animation="fadeInDown" style={[styles.searchContainer, { marginHorizontal: 10, marginBottom: 6 }]}>
            <Ionicons name="search" size={20} color="#999" style={{ marginRight: 6 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar pelo nome do Pokemon..."
              placeholderTextColor="#999"
              value={searchBinderQuery}
              onChangeText={setSearchBinderQuery}
            />
          </Animatable.View>
        )}

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

      {/* MODAL CRIAÇÃO PASSO A PASSO */}
      <Modal
        visible={createBinderState.visible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeCreateBinderModal}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#222" }}>
          <Animatable.View animation="fadeInUp" style={{ flex: 1 }}>
            {/* Step 1: Tipo */}
            {createBinderState.step === 1 && (
              <ScrollView contentContainerStyle={styles.modalStepContainer}>
                <Animatable.Text
                  style={styles.modalTitle}
                  animation="pulse"
                  iterationCount="infinite"
                  duration={5000}
                >
                  Criar Novo Blinder
                </Animatable.Text>

                <Text style={styles.label}>Escolha o Tipo:</Text>

                <View style={styles.typeIconsRow}>
                  <TouchableOpacity
                    style={[styles.typeIconOption, { borderColor: "#FDD835", borderWidth: 1 }]}
                    onPress={() => selectBinderType("master")}
                  >
                    <Ionicons name="ribbon" size={40} color="#FDD835" style={{ marginBottom: 6 }} />
                    <Text style={styles.typeIconText}>Master Set</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.typeIconOption, { borderColor: "#42A5F5", borderWidth: 1 }]}
                    onPress={() => selectBinderType("pokemon")}
                  >
                    <Ionicons
                      name="logo-octocat"
                      size={40}
                      color="#42A5F5"
                      style={{ marginBottom: 6 }}
                    />
                    <Text style={styles.typeIconText}>Pokémon</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.typeIconOption, { borderColor: "#EF5350", borderWidth: 1 }]}
                    onPress={() => selectBinderType("trainer")}
                  >
                    <Ionicons name="school" size={40} color="#EF5350" style={{ marginBottom: 6 }} />
                    <Text style={styles.typeIconText}>Trainer</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.typeIconOption, { borderColor: "#AB47BC", borderWidth: 1 }]}
                    onPress={() => selectBinderType("general")}
                  >
                    <Ionicons name="globe" size={40} color="#AB47BC" style={{ marginBottom: 6 }} />
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

            {/* Step 2: Master/Pokemon/Geral => multi sets, multi series, e rarities (mas se binderType=“pokemon”, não exibe raridades) */}
            {createBinderState.step === 2 && (
              <ScrollView contentContainerStyle={styles.modalStepContainer}>
                <Animatable.Text
                  style={styles.modalTitle}
                  animation="fadeInLeft"
                  duration={1500}
                >
                  Detalhes do Blinder
                </Animatable.Text>

                <Text style={styles.label}>Nome do Blinder</Text>
                <TextInput
                  style={styles.modalInput}
                  value={createBinderState.name}
                  onChangeText={(val) => setCreateBinderState((p) => ({ ...p, name: val }))}
                  placeholder="Ex: 'Meu Master Set SWSH9'"
                  placeholderTextColor="#999"
                />

                <Text style={[styles.label, { marginTop: 12 }]}>Coleções / Séries</Text>
                <TouchableOpacity style={styles.selectCollectionButton} onPress={() => setCollectionsModalVisible(true)}>
                  <Ionicons name="albums" size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={{ color: "#FFF", fontWeight: "bold" }}>
                    {createBinderState.selectedSets.length === 0 &&
                    createBinderState.selectedSeries.length === 0
                      ? "Todas"
                      : `Sets:${createBinderState.selectedSets.length}, Series:${createBinderState.selectedSeries.length}`}
                  </Text>
                </TouchableOpacity>

                {/* Se for Pokémon => nome do Pokémon */}
                {createBinderState.binderType === "pokemon" && (
                  <>
                    <Text style={styles.label}>Nome do Pokémon</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={createBinderState.pokemonName}
                      onChangeText={(val) => setCreateBinderState((p) => ({ ...p, pokemonName: val }))}
                      placeholder="Ex: 'Charizard'"
                      placeholderTextColor="#999"
                    />
                  </>
                )}

                {/* Filtrar Raridades (não exibe se for pokemon) */}
                {createBinderState.binderType !== "pokemon" && (
                  <>
                    <Text style={[styles.label, { marginTop: 12 }]}>
                      Filtrar Raridades (opcional)
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                      {ALL_RARITIES.map((r) => {
                        const isSel = createBinderState.selectedRarities.includes(r);
                        return (
                          <TouchableOpacity
                            key={r}
                            style={[styles.rarityButton, isSel && styles.rarityButtonActive]}
                            onPress={() => toggleRarity(r)}
                          >
                            <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 10 }}>
                              {r}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}

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

                <View style={{ flexDirection: "row", justifyContent: "space-evenly", marginTop: 20 }}>
                  <TouchableOpacity
                    style={[styles.button, { backgroundColor: "#999" }]}
                    onPress={() => goToStep(1)}
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

            {/* Step 3: Trainer => multi sets, multi series, mas SÓ “all” e “energy” */}
            {createBinderState.step === 3 && (
              <ScrollView contentContainerStyle={styles.modalStepContainer}>
                <Animatable.Text style={styles.modalTitle} animation="fadeInRight" duration={1500}>
                  Treinadores
                </Animatable.Text>

                <Text style={styles.label}>Nome do Blinder</Text>
                <TextInput
                  style={styles.modalInput}
                  value={createBinderState.name}
                  onChangeText={(val) => setCreateBinderState((p) => ({ ...p, name: val }))}
                  placeholder="Ex: 'Treinadores SWSH9'"
                  placeholderTextColor="#999"
                />

                <Text style={styles.label}>Categoria:</Text>
                {/* Agora só ‘all’ e ‘energy’ */}
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {(["all", "energy"] as TrainerCategory[]).map((cat) => {
                    const isActive = createBinderState.trainerCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.trainerCatButton,
                          isActive && styles.trainerCatButtonActive,
                        ]}
                        onPress={() => setCreateBinderState((p) => ({ ...p, trainerCategory: cat }))}
                      >
                        <Ionicons
                          name={cat === "energy" ? "flash" : "apps"}
                          size={16}
                          color="#FFF"
                          style={{ marginRight: 4 }}
                        />
                        <Text style={{ color: "#FFF", fontWeight: "bold" }}>
                          {cat.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.label, { marginTop: 12 }]}>Coleções / Séries</Text>
                <TouchableOpacity
                  style={styles.selectCollectionButton}
                  onPress={() => setCollectionsModalVisible(true)}
                >
                  <Ionicons name="albums" size={16} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={{ color: "#FFF", fontWeight: "bold" }}>
                    {createBinderState.selectedSets.length === 0 &&
                    createBinderState.selectedSeries.length === 0
                      ? "Todas"
                      : `Sets:${createBinderState.selectedSets.length}, Series:${createBinderState.selectedSeries.length}`}
                  </Text>
                </TouchableOpacity>

                {/* Se quiser remover a parte de raridades, mas no trainer poderia deixar OPCIONAL. Vou manter se quiser! 
                    Se você quer remover, é só ocultar o chunk abaixo. */}
                <Text style={[styles.label, { marginTop: 12 }]}>Filtrar Raridades (opcional)</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {ALL_RARITIES.map((r) => {
                    const isSel = createBinderState.selectedRarities.includes(r);
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[styles.rarityButton, isSel && styles.rarityButtonActive]}
                        onPress={() => toggleRarity(r)}
                      >
                        <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 10 }}>{r}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

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

                <View style={{ flexDirection: "row", justifyContent: "space-evenly", marginTop: 20 }}>
                  <TouchableOpacity
                    style={[styles.button, { backgroundColor: "#999" }]}
                    onPress={() => goToStep(1)}
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

      {/* MODAL de Ordenação (engrenagem) */}
      <Modal
        visible={sortModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setSortModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sortModalContainer}>
            <Text style={styles.modalTitle}>Ordenar por</Text>

            {(["number", "name", "rarity", "quantity", "release"] as BinderSortOption[]).map(
              (opt) => (
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
              )
            )}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: "#999", marginTop: 20 }]}
              onPress={() => setSortModalVisible(false)}
            >
              <Ionicons name="close-circle" size={16} color="#FFF" style={{ marginRight: 4 }} />
              <Text style={styles.buttonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL de Edição de Binder */}
      <Modal
        visible={editBinderState.visible}
        animationType="slide"
        transparent
        onRequestClose={closeEditBinderModal}
      >
        <View style={styles.overlay}>
          <View style={styles.collectionModalContainer}>
            <Text style={styles.modalTitle}>Editar Binder</Text>

            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.modalInput}
              value={editBinderState.name}
              onChangeText={(txt) =>
                setEditBinderState((prev) => ({ ...prev, name: txt }))
              }
            />

            <Text style={styles.label}>Tipo</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {(["master", "pokemon", "trainer", "general"] as BinderType[]).map((tp) => {
                const selected = editBinderState.type === tp;
                return (
                  <TouchableOpacity
                    key={tp}
                    onPress={() => setEditBinderState((prev) => ({ ...prev, type: tp }))}
                    style={[
                      styles.trainerCatButton,
                      selected && styles.trainerCatButtonActive,
                    ]}
                  >
                    <Text style={{ color: "#FFF", fontWeight: "bold" }}>
                      {tp.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.button, { marginTop: 14 }]}
              onPress={handleSaveBinderEdits}
            >
              <Ionicons name="checkmark-circle" size={16} color="#FFF" style={{ marginRight: 4 }} />
              <Text style={styles.buttonText}>Salvar Alterações</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: "#999", marginTop: 10 }]}
              onPress={closeEditBinderModal}
            >
              <Ionicons name="close-circle" size={16} color="#FFF" style={{ marginRight: 4 }} />
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>


      {/* MODAL multi-coleções e multi-séries */}
      {collectionsModalVisible && (
        <MultiCollectionsModal
          visible={collectionsModalVisible}
          onClose={() => setCollectionsModalVisible(false)}
          collections={collections}
          createBinderState={createBinderState}
          setCreateBinderState={setCreateBinderState}
        />
      )}
    </SafeAreaView>
  );
}

/** Modal para multi-selecionar sets e series */
function MultiCollectionsModal({
  visible,
  onClose,
  collections,
  createBinderState,
  setCreateBinderState,
}: {
  visible: boolean;
  onClose: () => void;
  collections: CollectionData[];
  createBinderState: CreatingBinderState;
  setCreateBinderState: React.Dispatch<React.SetStateAction<CreatingBinderState>>;
}) {
  const [searchTxt, setSearchTxt] = useState("");

  const allSeries = useMemo(() => {
    const sset = new Set<string>();
    for (const col of collections) {
      if (col.series) sset.add(col.series);
    }
    return Array.from(sset).sort();
  }, [collections]);

  // Filtra coleções pelo nome
  const filteredCollections = useMemo(() => {
    if (!searchTxt.trim()) return collections;
    return collections.filter((col) =>
      col.name.toLowerCase().includes(searchTxt.toLowerCase())
    );
  }, [searchTxt, collections]);

  /** Toggle set */
  function toggleSet(colId: string) {
    setCreateBinderState((prev) => {
      const already = prev.selectedSets.includes(colId);
      if (already) {
        return {
          ...prev,
          selectedSets: prev.selectedSets.filter((x) => x !== colId),
        };
      } else {
        return {
          ...prev,
          selectedSets: [...prev.selectedSets, colId],
        };
      }
    });
  }

  /** Toggle series */
  function toggleSeries(series: string) {
    setCreateBinderState((prev) => {
      const already = prev.selectedSeries.includes(series);
      if (already) {
        return {
          ...prev,
          selectedSeries: prev.selectedSeries.filter((x) => x !== series),
        };
      } else {
        return {
          ...prev,
          selectedSeries: [...prev.selectedSeries, series],
        };
      }
    });
  }

  return (
    <Modal visible={visible} transparent onRequestClose={onClose} animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.collectionModalContainer}>
          <Text style={styles.modalTitle}>Coleções / Séries</Text>

          <Text style={[styles.label, { alignSelf: "center" }]}>Filtrar Coleções</Text>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#999" style={{ marginRight: 6 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar coleção..."
              placeholderTextColor="#999"
              value={searchTxt}
              onChangeText={setSearchTxt}
            />
          </View>

          <ScrollView style={{ maxHeight: 160, width: "100%", marginVertical: 8 }}>
            {filteredCollections.map((col) => {
              const isSel = createBinderState.selectedSets.includes(col.id);
              return (
                <TouchableOpacity
                  key={col.id}
                  style={styles.collectionItem}
                  onPress={() => toggleSet(col.id)}
                >
                  <Text style={[styles.collectionItemText, isSel && { color: "#66BB6A" }]}>
                    {col.name}
                  </Text>

                  {col.series && (
                    <Text style={[{ color: "#ccc", fontSize: 10 }, isSel && { color: "#66BB6A" }]}>
                      {col.series}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[styles.label, { alignSelf: "center", marginTop: 6 }]}>Séries</Text>

          <ScrollView style={{ maxHeight: 130, width: "100%", marginVertical: 6 }}>
            {allSeries.map((sr) => {
              const isSel = createBinderState.selectedSeries.includes(sr);
              return (
                <TouchableOpacity
                  key={sr}
                  style={styles.collectionItem}
                  onPress={() => toggleSeries(sr)}
                >
                  <Text style={[styles.collectionItemText, isSel && { color: "#66BB6A" }]}>
                    {sr}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: "#999", marginTop: 14, alignSelf: "center" }]}
            onPress={onClose}
          >
            <Ionicons name="close-circle" size={16} color="#FFF" style={{ marginRight: 4 }} />
            <Text style={styles.buttonText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/** ============= Funções para buscar cartas (mesmo do original) ============= */
async function doFetchWithMultiOptions(
  st: CreatingBinderState,
  allCollections: CollectionData[]
): Promise<MinimalCardData[]> {
  // Monta array final de results
  let finalArr: MinimalCardData[] = [];

  if (st.binderType === "general") {
    // sem fetch
    return [];
  }

  if (st.binderType === "master") {
    // Precisamos de sets e series => combos
    if (st.selectedSets.length === 0 && st.selectedSeries.length === 0) {
      Alert.alert("Aviso", "Nenhuma coleção ou série selecionada => sem busca");
      return [];
    }
    // Monta combos
    const combos = buildSetSeriesCombos(st.selectedSets, st.selectedSeries);
    let combined: MinimalCardData[] = [];
    for (const c of combos) {
      const partial = await fetchApi(c);
      combined.push(...partial);
    }
    // Filtra rarities (se existirem)
    if (st.selectedRarities.length > 0) {
      combined = combined.filter(
        (card) => card.rarity && st.selectedRarities.includes(card.rarity)
      );
    }
    finalArr = unifyResults(combined);
  } else if (st.binderType === "pokemon") {
    // Nome do Pokémon é obrigatório
    if (!st.pokemonName.trim()) {
      throw new Error("Digite o nome do Pokémon.");
    }
    const baseQ = encodeURIComponent(`name:"${st.pokemonName}" supertype:pokemon`);
    const combos = buildSetSeriesCombos(st.selectedSets, st.selectedSeries, baseQ);

    let combined: MinimalCardData[] = [];
    if (combos.length === 0) {
      const globalUrl = `https://api.pokemontcg.io/v2/cards?q=${baseQ}&pageSize=500`;
      const dataAll = await fetchApi(globalUrl);
      combined.push(...dataAll);
    } else {
      for (const c of combos) {
        const partial = await fetchApi(c);
        combined.push(...partial);
      }
    }
    finalArr = unifyResults(combined);
  } else if (st.binderType === "trainer") {
    let finalTrainers: MinimalCardData[] = [];
    if (st.trainerCategory === "all") {
      // combos p/ supertype:trainer e combos p/ supertype:energy
      const combos1 = buildSetSeriesCombos(st.selectedSets, st.selectedSeries, "supertype:Trainer");
      const combos2 = buildSetSeriesCombos(st.selectedSets, st.selectedSeries, "supertype:energy");

      if (combos1.length === 0) {
        const allTrainer = await fetchApi(
          `https://api.pokemontcg.io/v2/cards?q=supertype:Trainer&pageSize=500`
        );
        finalTrainers.push(...allTrainer);
      } else {
        for (const cUrl of combos1) {
          const partial = await fetchApi(cUrl);
          finalTrainers.push(...partial);
        }
      }

      if (combos2.length === 0) {
        const allEnergy = await fetchApi(
          `https://api.pokemontcg.io/v2/cards?q=supertype:energy&pageSize=500`
        );
        finalTrainers.push(...allEnergy);
      } else {
        for (const cUrl of combos2) {
          const partial2 = await fetchApi(cUrl);
          finalTrainers.push(...partial2);
        }
      }
    } else {
      // "energy" => supertype:energy
      const catQuery = "supertype:energy";
      const combos = buildSetSeriesCombos(st.selectedSets, st.selectedSeries, catQuery);

      if (combos.length === 0) {
        const allUrl = `https://api.pokemontcg.io/v2/cards?q=${catQuery}&pageSize=500`;
        const allData = await fetchApi(allUrl);
        finalTrainers.push(...allData);
      } else {
        for (const cUrl of combos) {
          const partial = await fetchApi(cUrl);
          finalTrainers.push(...partial);
        }
      }
    }
    // Rarities
    if (st.selectedRarities.length > 0) {
      finalTrainers = finalTrainers.filter(
        (card) => card.rarity && st.selectedRarities.includes(card.rarity)
      );
    }
    finalArr = unifyResults(finalTrainers);
  }

  return finalArr;
}

function buildSetSeriesCombos(
  sets: string[],
  series: string[],
  baseQuery?: string
): string[] {
  let result: string[] = [];
  if (sets.length === 0 && series.length === 0) {
    return [];
  }

  if (sets.length > 0 && series.length > 0) {
    for (const stId of sets) {
      for (const sr of series) {
        let q = "";
        if (baseQuery) {
          q = `https://api.pokemontcg.io/v2/cards?q=${baseQuery} set.id:"${stId}" set.series:"${encodeURIComponent(
            sr
          )}"&pageSize=500`;
        } else {
          q = `https://api.pokemontcg.io/v2/cards?q=set.id:"${stId}" set.series:"${encodeURIComponent(
            sr
          )}"&pageSize=500`;
        }
        result.push(q);
      }
    }
  } else if (sets.length > 0) {
    for (const stId of sets) {
      let q = "";
      if (baseQuery) {
        q = `https://api.pokemontcg.io/v2/cards?q=${baseQuery} set.id:"${stId}"&pageSize=500`;
      } else {
        q = `https://api.pokemontcg.io/v2/cards?q=set.id:"${stId}"&pageSize=500`;
      }
      result.push(q);
    }
  } else if (series.length > 0) {
    for (const sr of series) {
      let q = "";
      if (baseQuery) {
        q = `https://api.pokemontcg.io/v2/cards?q=${baseQuery} set.series:"${encodeURIComponent(
          sr
        )}"&pageSize=500`;
      } else {
        q = `https://api.pokemontcg.io/v2/cards?q=set.series:"${encodeURIComponent(
          sr
        )}"&pageSize=500`;
      }
      result.push(q);
    }
  }
  return result;
}

async function fetchApi(url: string): Promise<MinimalCardData[]> {
  console.log("(NOBRIDGE) LOG  Fetching => ", url);
  const resp = await fetch(url);
  const json = await resp.json();
  if (json && json.data) {
    const arr: MinimalCardData[] = json.data.map((c: any) => ({
      id: c.id,
      name: c.name,
      images: c.images,
      rarity: c.rarity || "",
      number: c.number,
      releaseDate: c.set?.releaseDate,
      setId: c.set?.id,
      setSeries: c.set?.series,
    }));
    return arr;
  }
  return [];
}

function unifyResults(cards: MinimalCardData[]): MinimalCardData[] {
  const seen = new Set<string>();
  const result: MinimalCardData[] = [];
  for (const c of cards) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      result.push(c);
    }
  }
  return result;
}

function labelForSort(opt: BinderSortOption) {
  switch (opt) {
    case "number":
      return "Número (Padrão)";
    case "name":
      return "Nome";
    case "rarity":
      return "Raridade";
    case "quantity":
      return "Quantidade";
    case "release":
      return "Lançamento";
    default:
      return opt;
  }
}

/** ====== ESTILOS ====== */
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
  /** HOME - Grid Binders */
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
  binderProgress:{
    color:"#66BB6A",
    fontSize:12,
  },
  deleteButton:{
    position:"absolute",
    top:6,
    right:6,
    backgroundColor:"#900",
    borderRadius:4,
    padding:4,
  },

  /** DETALHE BINDER */
  binderDetailHeader:{
    flexDirection:"row",
    backgroundColor:"#000",
    paddingHorizontal:10,
    paddingVertical:10,
    alignItems:"center",
    justifyContent:"space-between",
  },
  binderDetailTitle:{
    color:"#FFF",
    fontWeight:"bold",
    fontSize:16,
  },
  sortIconButton:{
    padding:4,
  },

  /** FLATLIST 3 colunas */
  columnWrapper:{
    justifyContent:"flex-start",
    marginHorizontal:4,
    marginVertical:4,
  },
  cardItemContainer:{
    backgroundColor:"#222",
    borderRadius:8,
    padding:4,
    alignItems:"center",
  },
  cardImageWrapper:{
    position:"relative",
  },
  grayOverlay:{
    position:"absolute",
    top:0,
    left:0,
    width:"100%",
    height:"100%",
    backgroundColor:"rgba(0,0,0,0.5)",
    borderRadius:4,
  },
  cardNameGrid:{
    color:"#FFF",
    fontSize:13,
    textAlign:"center",
    marginTop:4,
  },
  cardRarityGrid:{
    color:"#CCC",
    fontSize:11,
    textAlign:"center",
  },
  qtyRow:{
    flexDirection:"row",
    alignItems:"center",
    marginTop:4,
  },
  qtyButton:{
    backgroundColor:"#333",
    borderRadius:6,
    padding:4,
  },
  cardQuantityText:{
    color:"#66BB6A",
    fontSize:12,
    fontWeight:"bold",
    marginHorizontal:6,
  },

  /** MODAL CRIAÇÃO PASSO A PASSO */
  modalStepContainer:{
    padding:16,
    alignItems:"center",
  },
  modalTitle:{
    color:"#FFF",
    fontSize:20,
    fontWeight:"bold",
    marginBottom:16,
    textAlign:"center",
  },
  label:{
    color:"#FFF",
    fontSize:14,
    marginBottom:6,
    marginTop:8,
    alignSelf:"flex-start",
  },
  modalInput:{
    width:"100%",
    backgroundColor:"#444",
    borderRadius:6,
    paddingHorizontal:8,
    paddingVertical:6,
    color:"#FFF",
    marginBottom:6,
  },
  typeIconsRow:{
    flexDirection:"row",
    flexWrap:"wrap",
    justifyContent:"space-around",
    marginTop:12,
  },
  typeIconOption:{
    width:80,
    backgroundColor:"#444",
    borderRadius:6,
    padding:8,
    margin:8,
    alignItems:"center",
  },
  typeIconText:{
    color:"#FFF",
    fontSize:12,
    textAlign:"center",
    fontWeight:"bold",
  },
  selectCollectionButton:{
    flexDirection:"row",
    backgroundColor:"#555",
    borderRadius:6,
    paddingHorizontal:10,
    paddingVertical:8,
    alignItems:"center",
    marginBottom:6,
    width:"100%",
  },
  button:{
    flexDirection:"row",
    backgroundColor:PRIMARY,
    borderRadius:6,
    paddingHorizontal:12,
    paddingVertical:8,
    alignItems:"center",
  },
  buttonText:{
    color:"#FFF",
    fontWeight:"bold",
  },
  rarityButton:{
    backgroundColor:"#444",
    borderRadius:6,
    paddingHorizontal:10,
    paddingVertical:4,
    marginRight:6,
    marginBottom:6,
  },
  rarityButtonActive:{
    backgroundColor:"#666",
  },
  trainerCatButton:{
    flexDirection:"row",
    backgroundColor:"#444",
    borderRadius:6,
    paddingHorizontal:10,
    paddingVertical:8,
    marginRight:6,
    marginBottom:6,
    alignItems:"center",
  },
  trainerCatButtonActive:{
    backgroundColor:"#666",
  },

  /** Overlays */
  overlay:{
    flex:1,
    backgroundColor:"rgba(0,0,0,0.7)",
    justifyContent:"center",
    alignItems:"center",
  },
  sortModalContainer:{
    backgroundColor:DARK,
    width:"80%",
    borderRadius:8,
    padding:16,
    alignItems:"center",
  },
  removeCardButton: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#900",
    borderRadius: 4,
    padding: 4,
    zIndex: 10,
  },  
  sortOptionButton:{
    paddingVertical:6,
    width:"100%",
    marginTop:8,
  },
  sortOptionText:{
    color:"#FFF",
    fontSize:14,
  },

  /** MultiCollectionsModal */
  collectionModalContainer:{
    backgroundColor:DARK,
    width:"90%",
    borderRadius:8,
    padding:16,
  },
  searchContainer:{
    flexDirection:"row",
    backgroundColor:GRAY,
    borderRadius:8,
    alignItems:"center",
    paddingHorizontal:10,
  },
  searchInput:{
    flex:1,
    color:"#FFF",
    paddingVertical:6,
  },
  collectionItem:{
    paddingVertical:6,
    borderBottomColor:"#444",
    borderBottomWidth:1,
  },
  collectionItemText:{
    color:"#FFF",
    fontSize:14,
  },
});

/** 
 * FIM 
 * Esse código evita duplicar logs/fetches e unifica localmente,
 * permitindo multi-coleção, multi-série, multi-raridade e sem
 * duplicar queries.
 */
