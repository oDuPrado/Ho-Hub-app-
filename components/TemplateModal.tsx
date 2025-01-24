//////////////////////////////////////
// ARQUIVO: TemplateModal.tsx
//////////////////////////////////////
import React from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import templates, { TemplateItem } from "../app/templatesConfig"; // Ajuste o caminho
import { TitleItem } from "../app/titlesConfig";

type TemplateModalProps = {
  visible: boolean;
  onClose: () => void;
  unlockedTitles: TitleItem[]; // lista de títulos que o player tem (com .unlocked = true)
  onSelectTemplate: (templateId: number) => void; // callback de seleção
  currentTemplateId: number; // id do template atual
};

export default function TemplateModal({
  visible,
  onClose,
  unlockedTitles,
  onSelectTemplate,
  currentTemplateId,
}: TemplateModalProps) {
  // Função pra checar se o template é “liberado”
  const isTemplateUnlocked = (t: TemplateItem) => {
    if (t.isFree) return true; // se for free, já liberado
    if (!t.requiredTitleId) return false; // se não tem titleId, mas não é free => sem lock (raro)
    // se for premium, precisa ver se o user tem o título
    const hasTitle = unlockedTitles.some((title) => title.id === t.requiredTitleId && title.unlocked);
    return hasTitle;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Botão fechar */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close-circle" size={32} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.modalTitle}>Selecionar Template</Text>

          <ScrollView contentContainerStyle={styles.listContainer}>
            {templates.map((template) => {
              const unlocked = isTemplateUnlocked(template);
              const isSelected = template.id === currentTemplateId;
              return (
                <TouchableOpacity
                  key={template.id}
                  style={[
                    styles.templateCard,
                    { opacity: unlocked ? 1 : 0.5 },
                    isSelected && styles.templateSelected,
                  ]}
                  onPress={() => {
                    if (unlocked) {
                      onSelectTemplate(template.id);
                      onClose();
                    }
                  }}
                  disabled={!unlocked}
                >
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateDesc}>{template.description}</Text>
                  {!unlocked && (
                    <View style={styles.lockOverlay}>
                      <Ionicons name="lock-closed" size={24} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

//////////////////////
// ESTILOS
//////////////////////
const DARK_BG = "#1E1E1E";
const CARD_BG = "#292929";
const BORDER_COLOR = "#4D4D4D";
const WHITE = "#FFFFFF";

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    padding: 16,
    maxHeight: "85%",
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: WHITE,
    textAlign: "center",
    marginBottom: 16,
  },
  listContainer: {
    paddingVertical: 8,
  },
  templateCard: {
    backgroundColor: DARK_BG,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  templateSelected: {
    borderColor: "#00fa9a",
    borderWidth: 2,
  },
  templateName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  templateDesc: {
    color: "#ccc",
    fontSize: 14,
    marginBottom: 4,
  },
  lockOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
  },
});
