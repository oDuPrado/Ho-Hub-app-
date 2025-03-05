import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Animatable from "react-native-animatable";
import { Ionicons } from "@expo/vector-icons";

/**
 * Lista de tutoriais disponíveis
 * ex: 'filtroLigas' ou 'homeTutorial'
 */
const TUTORIALS = {
  filtroLigas: "tutorialFiltroLigas",
};

interface TutorialStep {
  title: string;   // Título do passo
  text: string;    // Descrição do passo
}

interface TutorialProps {
  tutorialKey: keyof typeof TUTORIALS;  // ex: 'filtroLigas'
  visible: boolean;                    // Controla a exibição do tutorial
  onClose: () => void;                // Função chamada ao finalizar ou pular
}

/**
 * Componente de Tutorial Interativo mais compacto e explicativo.
 * - Passos com título e descrição.
 * - Layout menor e mais demonstrativo.
 * - Ao final, “Repetir” ou “Terminar”.
 */
export default function Tutorials({
  tutorialKey,
  visible,
  onClose,
}: TutorialProps) {
  const [step, setStep] = useState<number>(0);
  const steps = tutorialSteps[tutorialKey] || [];

  // Quando abre o tutorial, resetamos o passo
  useEffect(() => {
    if (visible) {
      setStep(0);
    }
  }, [visible]);

  // Botão "Próximo"
  const handleNext = async () => {
    // Se não for o último passo, avança
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      // Se for o último passo, exibe tela final com "Repetir" ou "Terminar"
      setStep(step + 1);
    }
  };

  // Botão "Pular"
  const handleSkip = async () => {
    await AsyncStorage.setItem(TUTORIALS[tutorialKey], "true");
    onClose();
  };

  // Botão "Repetir"
  const handleRepeat = () => {
    setStep(0); // Volta ao passo inicial, sem marcar como concluído
  };

  // Botão "Terminar"
  const handleFinish = async () => {
    await AsyncStorage.setItem(TUTORIALS[tutorialKey], "true");
    onClose();
  };

  const isFinalScreen = step >= steps.length; // Se já passou do último passo

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Animatable.View
          animation="fadeIn"
          duration={300}
          style={styles.modalContainer}
        >
          <ImageBackground
            source={require("../assets/images/fundos/welcome_bg.jpg")}
            style={styles.imageBg}
            imageStyle={styles.imageBgStyle}
          >
            <Animatable.View
              animation="fadeInUp"
              duration={500}
              style={styles.contentContainer}
            >
              {isFinalScreen ? (
                // Tela final
                <View style={styles.finalContainer}>
                  <Ionicons
                    name="checkmark-done-circle-outline"
                    size={50}
                    color="#FFF"
                    style={{ marginBottom: 12 }}
                  />
                  <Text style={styles.finalTitle}>Tutorial concluído!</Text>
                  <Text style={styles.finalMessage}>
                    Agora você sabe como usar o sistema de Ligas na Home.
                  </Text>

                  <View style={styles.finalButtonRow}>
                    <TouchableOpacity
                      onPress={handleRepeat}
                      style={styles.repeatButton}
                    >
                      <Text style={styles.repeatText}>Repetir</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleFinish}
                      style={styles.finishButton}
                    >
                      <Text style={styles.finishText}>Terminar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                // Passos intermediários
                <>
                  <Text style={styles.stepTitle}>{steps[step].title}</Text>
                  <Text style={styles.stepDescription}>{steps[step].text}</Text>

                  <View style={styles.stepButtonRow}>
                    <TouchableOpacity
                      onPress={handleSkip}
                      style={styles.skipButton}
                    >
                      <Text style={styles.skipText}>Pular</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleNext}
                      style={styles.nextButton}
                    >
                      <Text style={styles.nextText}>
                        {step < steps.length - 1 ? "Próximo" : "Concluir"}
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </Animatable.View>
          </ImageBackground>
        </Animatable.View>
      </View>
    </Modal>
  );
}

/**
 * Passos do Tutorial de Ligas
 * - Podemos adicionar mais chaves aqui (ex: 'homeTutorial', etc.)
 */
const tutorialSteps: Record<string, TutorialStep[]> = {
  filtroLigas: [
    {
      title: "Bem-vindo à Home",
      text: "Na tela inicial, você vê seus status de vitórias, derrotas e muito mais.",
    },
    {
      title: "Botão LIGAS",
      text: "Toque no botão LIGAS no topo para abrir o Filtro de Ligas.",
    },
    {
      title: "Selecionar Cidade",
      text: "Escolha 'Todas as Cidades' ou selecione uma cidade específica para filtrar.",
    },
    {
      title: "Selecionar Liga",
      text: "Depois de escolher a cidade, selecione a liga que deseja visualizar.",
    },
    {
      title: "Salvar Filtro",
      text: "Quando terminar, toque em SALVAR para aplicar o filtro de ligas.",
    },
  ],
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  imageBg: {
    width: "90%",
    height: 320,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 15,
    overflow: "hidden",
  },
  imageBgStyle: {
    resizeMode: "cover",
    borderRadius: 15,
  },
  contentContainer: {
    backgroundColor: "rgba(0,0,0,0.7)",
    width: "100%",
    height: "100%",
    borderRadius: 15,
    padding: 16,
    justifyContent: "center",
  },
  // Passos
  stepTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  stepDescription: {
    color: "#FFF",
    fontSize: 16,
    textAlign: "center",
    marginHorizontal: 10,
    marginBottom: 20,
  },
  stepButtonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  skipButton: {
    backgroundColor: "transparent",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    color: "#FFF",
    fontSize: 15,
    textDecorationLine: "underline",
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3350D",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  nextText: {
    color: "#FFF",
    fontSize: 15,
    marginRight: 6,
  },

  // Final
  finalContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  finalTitle: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 8,
  },
  finalMessage: {
    color: "#FFF",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 20,
    marginHorizontal: 10,
  },
  finalButtonRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    width: "100%",
  },
  repeatButton: {
    backgroundColor: "#444",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  repeatText: {
    color: "#FFF",
    fontSize: 15,
  },
  finishButton: {
    backgroundColor: "#E3350D",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  finishText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "bold",
  },
});
