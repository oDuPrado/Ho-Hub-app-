import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ImageBackground,
} from "react-native";
import * as Animatable from "react-native-animatable";
// Substituímos MaterialCommunityIcons por FontAwesome5, que tem o ícone "dragon"
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import ChallengesModal from "./ChallengesModal";

// Tipagem de props (inalterada)
interface SeasonModalProps {
  visible: boolean;
  onClose: () => void;
  currentLevel: number;
  currentXp: number;
  xpForNextLevel: number;
  seasonName?: string;
}

/**
 * Novo design para o modal de temporada,
 * usando FontAwesome5 para o ícone de dragão.
 */
export default function SeasonModal({
  visible,
  onClose,
  currentLevel,
  currentXp,
  xpForNextLevel,
  seasonName = "Temporada dos Dragões",
}: SeasonModalProps) {
  const [challengesVisible, setChallengesVisible] = useState(false);

  // Exemplo: níveis 1 a 50
  const levelsArray = Array.from({ length: 50 }, (_, i) => i + 1);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Fundo com imagem + overlay */}
        <ImageBackground
          source={require("../assets/images/back_fenix2_resized.png")}
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <Animatable.View
            style={styles.modalContainer}
            animation="fadeInUp"
            duration={600}
          >
            {/* Cabeçalho */}
            <View style={styles.headerContainer}>
              <Animatable.View
                animation="pulse"
                iterationCount="infinite"
                style={styles.dragonIconBox}
              >
                {/* Ícone do dragão do FontAwesome5 */}
                <FontAwesome5
                  name="dragon"
                  size={40}
                  color="#FFD700"
                />
              </Animatable.View>
              <Text style={styles.titleText}>{seasonName}</Text>
            </View>

            <Text style={styles.subtitleText}>
              Avance pelos níveis e conquiste a glória dracônica!
            </Text>

            {/* Seção de Progresso */}
            <View style={styles.progressSection}>
              <Text style={styles.levelLabel}>Seu Nível: {currentLevel}</Text>
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                  <Animatable.View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${(currentXp / xpForNextLevel) * 100}%`,
                      },
                    ]}
                    animation="fadeInLeft"
                    duration={600}
                  />
                </View>
              </View>
              <Text style={styles.xpText}>
                XP: {currentXp}/{xpForNextLevel}
              </Text>
            </View>

            {/* Lista de níveis */}
            <Text style={styles.levelListLabel}>Metas de Nível</Text>
            <ScrollView style={styles.levelsScroll}>
              {levelsArray.map((lvl) => {
                const xpNeeded = lvl * lvl * 50;
                const reached = lvl <= currentLevel;
                return (
                  <Animatable.View
                    key={lvl}
                    style={[
                      styles.levelItem,
                      reached && styles.levelItemReached,
                    ]}
                    animation="bounceIn"
                    delay={lvl * 15}
                  >
                    <View style={styles.levelIcon}>
                      <Ionicons
                        name={reached ? "flame" : "flame-outline"}
                        size={20}
                        color={reached ? "#FFD700" : "#CCC"}
                      />
                    </View>
                    <View>
                      <Text style={styles.levelItemTitle}>Nível {lvl}</Text>
                      <Text style={styles.levelItemXp}>
                        {xpNeeded} XP
                      </Text>
                      {reached && (
                        <Text style={styles.reachedTag}>Completo</Text>
                      )}
                    </View>
                  </Animatable.View>
                );
              })}
            </ScrollView>

            {/* Botões do rodapé */}
            <View style={styles.footerActions}>
              <TouchableOpacity
                style={styles.challengesButton}
                onPress={() => setChallengesVisible(true)}
              >
                <Ionicons
                  name="flag-outline"
                  size={20}
                  color="#FFF"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.challengesText}>Desafios</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons
                  name="arrow-back"
                  size={20}
                  color="#FFF"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.closeButtonText}>Voltar</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Desafios */}
            <ChallengesModal
              visible={challengesVisible}
              onClose={() => setChallengesVisible(false)}
            />
          </Animatable.View>
        </ImageBackground>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  backgroundImage: {
    flex: 1,
    justifyContent: "center",
  },
  modalContainer: {
    backgroundColor: "rgba(0,0,0,0.85)",
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
    padding: 16,
    flex: 1,
  },

  // Cabeçalho
  headerContainer: {
    alignItems: "center",
    marginBottom: 10,
  },
  dragonIconBox: {
    backgroundColor: "#444",
    borderRadius: 50,
    padding: 12,
    marginBottom: 6,
  },
  titleText: {
    color: "#E3350D",
    fontSize: 22,
    fontWeight: "bold",
    letterSpacing: 1.2,
    textAlign: "center",
  },
  subtitleText: {
    color: "#FFF",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 14,
  },

  // Progresso do jogador
  progressSection: {
    alignItems: "center",
    marginVertical: 8,
  },
  levelLabel: {
    color: "#FFD700",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  progressBarContainer: {
    width: "80%",
    marginVertical: 4,
  },
  progressBarBackground: {
    backgroundColor: "#444",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  progressBarFill: {
    backgroundColor: "#E3350D",
    height: "100%",
    borderRadius: 5,
  },
  xpText: {
    color: "#FFF",
    marginTop: 2,
    fontSize: 13,
  },

  // Lista de níveis
  levelListLabel: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 10,
  },
  levelsScroll: {
    flex: 1,
    marginVertical: 8,
  },
  levelItem: {
    backgroundColor: "#292929",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#444",
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    marginBottom: 6,
  },
  levelItemReached: {
    backgroundColor: "#3A3A3A",
    borderColor: "#FFD700",
  },
  levelIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  levelItemTitle: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  levelItemXp: {
    color: "#bbb",
    fontSize: 12,
  },
  reachedTag: {
    color: "#FFD700",
    fontSize: 12,
    marginTop: 2,
  },

  // Rodapé
  footerActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
  },
  challengesButton: {
    flexDirection: "row",
    backgroundColor: "#555",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  challengesText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  closeButton: {
    flexDirection: "row",
    backgroundColor: "#333",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#FFF",
    fontWeight: "bold",
  },
});
