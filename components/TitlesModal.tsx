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

type TitlesModalProps = {
  visible: boolean;
  onClose: () => void;
  titles: TitleItem[];
};

const { width, height } = Dimensions.get("window");

export default function TitlesModal({ visible, onClose, titles }: TitlesModalProps) {
  const [selectedTitle, setSelectedTitle] = useState<TitleItem | null>(null);

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
    }
  }, [visible]);

  const getTitlesByCategory = (cat: string) => {
    return titles.filter((t) => t.category === cat);
  };

  const TitleCard = ({
    item,
    onPress,
  }: {
    item: TitleItem;
    onPress: (t: TitleItem) => void;
  }) => {
    const [flipAnim] = useState(new Animated.Value(0));
    const isUnlocked = !!item.unlocked;

    let iconName = "star";
    if (item.category === "SÉRIA") iconName = "trophy";
    if (item.category === "ÚNICA") iconName = "md-ribbon";

    const borderColor = TITLE_COLORS[item.category];

    const frontInterpolate = flipAnim.interpolate({
      inputRange: [0, 180],
      outputRange: ["0deg", "180deg"],
    });
    const backInterpolate = flipAnim.interpolate({
      inputRange: [0, 180],
      outputRange: ["180deg", "360deg"],
    });

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

    const frontStyle = {
      transform: [{ rotateY: frontInterpolate }],
    };
    const backStyle = {
      transform: [{ rotateY: backInterpolate }],
    };

    const lockOpacity = isUnlocked ? 1 : 0.4;

    return (
      <TouchableWithoutFeedback onPress={handleFlip}>
        <View style={styles.cardContainer}>
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
            <MaterialCommunityIcons
              name={isUnlocked ? (iconName as any) : "lock-outline"}
              size={50}
              color={isUnlocked ? "#fff" : "#999"}
            />
          </Animated.View>

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
            <MaterialCommunityIcons
              name={isUnlocked ? (iconName as any) : "lock-outline"}
              size={50}
              color={isUnlocked ? "#fff" : "#999"}
            />
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    );
  };

  const renderCategory = (catLabel: string, list: TitleItem[]) => {
    if (list.length === 0) return null;

    return (
      <View style={{ marginBottom: 20 }}>
        <Text style={styles.categoryTitle}>{catLabel}</Text>
        <View style={styles.gridContainer}>
          {list.map((item) => (
            <TitleCard key={item.id} item={item} onPress={setSelectedTitle} />
          ))}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.modalBody, { opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close-circle" size={32} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.modalHeader}>Seus Títulos</Text>

          <ScrollView style={{ marginTop: 20 }}>
            {renderCategory("Tier 0 - Únicas", getTitlesByCategory("ÚNICA"))}
            {renderCategory("Tier 1 - Sérias", getTitlesByCategory("SÉRIA"))}
            {renderCategory("Tier 2 - Engraçadas", getTitlesByCategory("ENGRAÇADA"))}
          </ScrollView>
        </Animated.View>

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

const DARK_BG = "#1E1E1E";
const CARD_BG = "#2E2E2E";
const BORDER_COLOR = "#3C3C3C";

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
  },
  modalBody: {
    flex: 1,
    margin: 0,
    backgroundColor: DARK_BG,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
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
  categoryTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 16,
    marginTop: 16,
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#444",
    paddingBottom: 4,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-evenly",
    alignItems: "flex-start",
    marginTop: 10,
    paddingHorizontal: 10,
  },
  cardContainer: {
    width: "40%",
    aspectRatio: 0.75,
    marginBottom: 20,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  detailOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
  },
  detailBg: {
    ...StyleSheet.absoluteFillObject,
  },
  detailModal: {
    backgroundColor: DARK_BG,
    marginHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
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
