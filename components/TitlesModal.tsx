//////////////////////////////////////
// ARQUIVO: TitlesModal.tsx
//////////////////////////////////////
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  ScrollView,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { TitleItem, TITLE_COLORS } from "../app/titlesConfig";
import * as Animatable from "react-native-animatable";


/**
 * Tipos de Parâmetros do Modal
 */
type TitlesModalProps = {
  visible: boolean;
  onClose: () => void;
  /**
   * Lista de títulos.
   * Se estiver vazia, exibirá a mensagem "Escolha uma liga no Filtro para ver Títulos."
   */
  titles: TitleItem[];
  userId: string;
};

/**
 * Dimensões da tela, para eventuais cálculos de layout.
 */
const { width, height } = Dimensions.get("window");

/**
 * Este componente exibe os Títulos desbloqueados ou não, agrupados por categoria.
 */
export default function TitlesModal({ visible, onClose, titles }: TitlesModalProps) {
  // Título clicado (para exibir em detalhe).
  const [selectedTitle, setSelectedTitle] = useState<TitleItem | null>(null);

  // Animação de fade para o modal principal.
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.ease,
      }).start();
    } else {
      fadeAnim.setValue(0);
      setSelectedTitle(null);
    }
  }, [visible]);

  // Se a lista estiver vazia, pedimos ao usuário para escolher uma liga no filtro.
  const isEmptyList = !titles || titles.length === 0;

  /**
   * Componente interno que representa o cartão de cada título.
   * Utiliza animação de flip. Se o título for da categoria EXCLUSIVO,
   * também possui um efeito de rotação contínua do ícone.
   */
  const TitleCard = ({
    item,
    onPress,
  }: {
    item: TitleItem;
    onPress: (t: TitleItem) => void;
  }) => {
    // Animação básica de flip
    const [flipAnim] = useState(new Animated.Value(0));

    // 🔥 Se for EXCLUSIVO, faremos uma rotação contínua do ícone.
    const [exclusiveAnim] = useState(new Animated.Value(0));

    // Definimos o ícone base, dependendo da categoria
    let iconName = "star";
    if (item.category === "SÉRIA") iconName = "trophy";
    if (item.category === "ÚNICA") iconName = "ribbon";
    if (item.category === "ENGRAÇADA") iconName = "emoticon-happy-outline";
    if (item.category === "EXCLUSIVO") iconName = "fire";

    const borderColor = TITLE_COLORS[item.category];

    // Interpolação do flip
    const frontInterpolate = flipAnim.interpolate({
      inputRange: [0, 180],
      outputRange: ["0deg", "180deg"],
    });
    const backInterpolate = flipAnim.interpolate({
      inputRange: [0, 180],
      outputRange: ["180deg", "360deg"],
    });

    // 🔥 Se o título for EXCLUSIVO, iniciamos a rotação contínua
    useEffect(() => {
      if (item.category === "EXCLUSIVO") {
        Animated.loop(
          Animated.timing(exclusiveAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
            easing: Easing.linear,
          })
        ).start();
      }
    }, [item.category]);

    /* Interpolamos a rotação do ícone exclusivo
    const exclusiveRotate = exclusiveAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });

    /**
     * Handler de flip do cartão (mesmo para títulos bloqueados).
     */
    const handleFlip = () => {
      Animated.sequence([
        Animated.timing(flipAnim, {
          toValue: 180,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(flipAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
          easing: Easing.in(Easing.ease),
        }),
      ]).start(() => {
        onPress(item);
      });
    };

    // Estilos que aplicam o flip
    const frontStyle = {
      transform: [{ rotateY: frontInterpolate }],
    };
    const backStyle = {
      transform: [{ rotateY: backInterpolate }],
    };

    // Mesmo bloqueado, ainda é clicável ( lockOpacity = 1 ).
    const lockOpacity = 1;
    const isTitleUnlocked = !!item.unlocked;

    return (
      <TouchableWithoutFeedback onPress={handleFlip}>
        <View style={styles.cardContainer}>
          {/* Frente do cartão */}
          <Animated.View
            style={[
              styles.card,
              {
                borderColor,
                opacity: lockOpacity,
                position: "absolute",
                backfaceVisibility: "hidden",
              },
              frontStyle,
            ]}
          >
            {item.category === "EXCLUSIVO" ? (
              <Animatable.View animation="pulse" iterationCount="infinite">
                <MaterialCommunityIcons
                  name={isTitleUnlocked ? (iconName as any) : "lock-outline"}
                  size={50}
                  color={isTitleUnlocked ? "#fff" : "#999"}
                />
              </Animatable.View>
            ) : (
              <MaterialCommunityIcons
                name={isTitleUnlocked ? (iconName as any) : "lock-outline"}
                size={50}
                color={isTitleUnlocked ? "#fff" : "#999"}
              />
            )}
          </Animated.View>
    
          {/* Verso do cartão */}
          <Animated.View
            style={[
              styles.card,
              {
                borderColor,
                position: "absolute",
                backfaceVisibility: "hidden",
              },
              backStyle,
            ]}
          >
            {item.category === "EXCLUSIVO" ? (
              <Animatable.View animation="pulse" iterationCount="infinite">
                <MaterialCommunityIcons
                  name={isTitleUnlocked ? (iconName as any) : "lock-outline"}
                  size={50}
                  color={isTitleUnlocked ? "#fff" : "#999"}
                />
              </Animatable.View>
            ) : (
              <MaterialCommunityIcons
                name={isTitleUnlocked ? (iconName as any) : "lock-outline"}
                size={50}
                color={isTitleUnlocked ? "#fff" : "#999"}
              />
            )}
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    );    
  };

  /**
   * Renderiza a lista de títulos, agrupados por categoria.
   * Vamos exibir primeiro a categoria EXCLUSIVO (chamada de "Lenda" para o usuário),
   * depois as demais.
   */
  const renderTitlesList = () => {
    return (
      <ScrollView style={{ marginTop: 20 }}>
        {renderCategory("Lenda", titles.filter((t) => t.category === "EXCLUSIVO"))}
        {renderCategory("Tier 0 - Únicas", titles.filter((t) => t.category === "ÚNICA"))}
        {renderCategory("Tier 1 - Épicas", titles.filter((t) => t.category === "SÉRIA"))}
        {renderCategory("Tier 2 - 4FUN", titles.filter((t) => t.category === "ENGRAÇADA"))}
      </ScrollView>
    );
  };

  /**
   * Renderiza cada grupo de títulos (categoria).
   */
  const renderCategory = (catLabel: string, list: TitleItem[]) => {
    if (list.length === 0) return null;
    return (
      <View style={{ marginBottom: 20 }}>
        <Text style={styles.categoryTitle}>{catLabel}</Text>
        {list.map((item) => (
          <View key={item.id} style={styles.titleRow}>
            <TitleCard item={item} onPress={setSelectedTitle} />
            <View style={styles.titleInfo}>
              <Text style={styles.titleName}>{item.title}</Text>
              <Text style={styles.titleDesc}>{item.description}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  /**
   * Retorno principal do componente.
   */
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.modalBody, { opacity: fadeAnim }]}>
          {/* Botão de Fechar o Modal Principal */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close-circle" size={32} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.modalHeader}>Seus Títulos</Text>

          {isEmptyList ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                Escolha uma liga no Filtro para ver Títulos.
              </Text>
            </View>
          ) : (
            renderTitlesList()
          )}
        </Animated.View>

        {/* Modal de Detalhe do Título (aparece ao clicar/flip) */}
        {selectedTitle && (
          <Modal
            visible={!!selectedTitle}
            transparent
            animationType="fade"
            onRequestClose={() => setSelectedTitle(null)}
          >
            <View style={styles.detailOverlay}>
              <TouchableOpacity
                style={styles.detailBg}
                onPress={() => setSelectedTitle(null)}
              />
              <View style={styles.detailModal}>
                <Text style={styles.detailTitle}>{selectedTitle.title}</Text>
                <Text style={styles.detailDesc}>{selectedTitle.description}</Text>

                <TouchableOpacity
                  style={styles.detailClose}
                  onPress={() => setSelectedTitle(null)}
                >
                  <Text style={{ color: "#fff" }}>Fechar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Fundo escuro do modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
  },
  modalBody: {
    flex: 1,
    margin: 0,
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#3C3C3C",
    padding: 16,
  },
  modalHeader: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginTop: 10,
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 40,
  },
  emptyText: {
    color: "#fff",
    fontSize: 16,
    fontStyle: "italic",
    textAlign: "center",
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
    marginTop: 8,
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#444",
    paddingBottom: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
    paddingHorizontal: 8,
  },
  cardContainer: {
    width: 60,
    height: 60,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: 60,
    height: 60,
    backgroundColor: "#2E2E2E",
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  titleInfo: {
    flex: 1,
  },
  titleName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  titleDesc: {
    fontSize: 12,
    color: "#ccc",
  },

  // Detalhe do título
  detailOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
  },
  detailBg: {
    ...StyleSheet.absoluteFillObject,
  },
  detailModal: {
    backgroundColor: "#1E1E1E",
    marginHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3C3C3C",
    padding: 16,
  },
  detailTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  detailDesc: {
    color: "#ccc",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
  },
  detailClose: {
    alignSelf: "center",
    backgroundColor: "#e33",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
});
