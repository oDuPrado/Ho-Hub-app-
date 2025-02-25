import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Animatable from "react-native-animatable";

interface ChallengesModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ChallengesModal({
  visible,
  onClose,
}: ChallengesModalProps) {
  // Três desafios estáticos de exemplo
  const challenges = [
    {
      id: 1,
      title: "Conquiste 3 Vitórias na Semana",
      description: "Jogue partidas e vença 3 vezes nesta semana para ganhar XP bônus!",
    },
    {
      id: 2,
      title: "Participe de 1 Torneio",
      description: "Entre em qualquer torneio e registre suas partidas para completar este desafio.",
    },
    {
      id: 3,
      title: "Derrote um Rival",
      description: "Vença uma partida contra seu rival atual e mostre que está evoluindo!",
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animatable.View
          style={styles.modalContainer}
          animation="zoomIn"
          duration={400}
        >
          <Text style={styles.modalTitle}>Desafios Semanais</Text>
          <ScrollView style={{ flex: 1 }}>
            {challenges.map((ch) => (
              <Animatable.View
                key={ch.id}
                style={styles.challengeCard}
                animation="fadeInUp"
                delay={ch.id * 200}
              >
                <Ionicons name="flag" size={22} color="#E3350D" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.challengeTitle}>{ch.title}</Text>
                  <Text style={styles.challengeDescription}>{ch.description}</Text>
                </View>
              </Animatable.View>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons
              name="arrow-back"
              size={20}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.closeButtonText}>Voltar</Text>
          </TouchableOpacity>
        </Animatable.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
  },
  modalContainer: {
    backgroundColor: "#000",
    margin: 20,
    borderRadius: 10,
    padding: 16,
    flex: 1,
    borderWidth: 1,
    borderColor: "#444",
  },
  modalTitle: {
    color: "#E3350D",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
  },
  challengeCard: {
    flexDirection: "row",
    backgroundColor: "#222",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    alignItems: "center",
  },
  challengeTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  challengeDescription: {
    color: "#ccc",
    fontSize: 13,
    marginTop: 2,
  },
  closeButton: {
    backgroundColor: "#555",
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  closeButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
