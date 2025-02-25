import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * Vamos assumir que 'userXp' na verdade representa o NÍVEL do jogador,
 * conforme a solicitação, para simplificar a lógica de desbloqueio.
 */
interface AvatarModalProps {
  visible: boolean;
  onClose: () => void;
  currentAvatarId: number;
  onSelectAvatar: (avatarId: number) => void;
  // Lista de avatares com ID, URI
  avatarsList: {
    id: number;
    uri: any;
  }[];
  userXp: number; // Aqui interpretamos userXp como "userLevel"
}

export default function AvatarModal({
  visible,
  onClose,
  currentAvatarId,
  onSelectAvatar,
  avatarsList,
  userXp, // userLevel
}: AvatarModalProps) {
  // Função que define se o avatar está desbloqueado
  // 1) Avatares 1, 2, 3 => nível 1
  // 2) Avatares restantes => cada 15 níveis
  function isAvatarUnlocked(avatarId: number): boolean {
    if (avatarId <= 3) {
      // Desbloqueados no nível 1
      return userXp >= 1;
    }
    // Ex: Avatar 4 => nível >= 15
    //     Avatar 5 => nível >= 30
    const requiredLevel = 15 * (avatarId - 3);
    return userXp >= requiredLevel;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Selecione um Avatar</Text>

          <ScrollView contentContainerStyle={styles.avatarsContainer}>
            {avatarsList.map((av) => {
              const unlocked = isAvatarUnlocked(av.id);
              const isSelected = currentAvatarId === av.id;

              return (
                <TouchableOpacity
                  key={av.id}
                  style={[
                    styles.avatarChoice,
                    isSelected && styles.avatarChoiceSelected,
                  ]}
                  onPress={() => {
                    if (unlocked) {
                      onSelectAvatar(av.id);
                    }
                  }}
                >
                  {/* Se estiver bloqueado, mostra um fundo escuro + ícone de cadeado */}
                  {unlocked ? (
                    <Image source={av.uri} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.lockedAvatar}>
                      <Ionicons name="lock-closed" size={40} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Pressable style={styles.closeModalBtn} onPress={onClose}>
            <Text style={styles.closeModalText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#292929",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4D4D4D",
    width: "85%",
    maxHeight: "85%",
    padding: 16,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    color: "#FFF",
  },
  avatarsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  avatarChoice: {
    width: 80,
    height: 80,
    margin: 8,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#4D4D4D",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarChoiceSelected: {
    borderColor: "#E3350D",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  lockedAvatar: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeModalBtn: {
    backgroundColor: "#E3350D",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignSelf: "center",
    marginTop: 10,
  },
  closeModalText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
});
