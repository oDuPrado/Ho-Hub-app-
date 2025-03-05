// CustomModal.tsx
import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ImageBackground,
  StyleSheet,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { Ionicons } from "@expo/vector-icons";

type CustomModalButton = {
  text: string;
  onPress: () => void;
  style?: "default" | "cancel";
};

type CustomModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string | JSX.Element;
  /**
   * Se não for informado o array `buttons`, 
   * o modal exibe apenas um botão "OK" que chama `onClose`.
   */
  buttons?: CustomModalButton[];
};

/**
 * Modal customizado com fundo de imagem e animações.
 * Agora suporta múltiplos botões via props.buttons.
 * Se nenhum botão for passado, exibe um "OK" padrão.
 */
const CustomModal: React.FC<CustomModalProps> = ({
  visible,
  onClose,
  title,
  message,
  buttons,
}) => {
  // Se não houver botões, exibimos um padrão "OK".
  const finalButtons: CustomModalButton[] = buttons?.length
    ? buttons
    : [
        {
          text: "OK",
          onPress: onClose,
        },
      ];

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Animação do container de fundo */}
        <Animatable.View
          animation="fadeIn"
          duration={800}
          style={styles.backgroundContainer}
        >
          <ImageBackground
            source={require("../assets/images/fundos/welcome_bg.jpg")}
            style={styles.backgroundImage}
            imageStyle={styles.imageStyle}
          >
            <Animatable.View
              animation="fadeInUp"
              duration={800}
              style={styles.textContainer}
            >
              {/* Cabeçalho: ícone + título */}
              <View style={styles.titleContainer}>
                <Ionicons
                  name="information-circle-outline"
                  size={30}
                  color="#FFF"
                  style={styles.titleIcon}
                />
                {title ? <Text style={styles.title}>{title}</Text> : null}
              </View>

              {/* Mensagem principal */}
              <Text style={styles.message}>{message}</Text>

              {/* Renderiza os botões (um ou vários) */}
              <View style={styles.buttonContainer}>
                {finalButtons.map((btn, index) => {
                  const isCancel = btn.style === "cancel";
                  const iconName = isCancel
                    ? "close-circle-outline"
                    : "checkmark-circle-outline";

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.button,
                        isCancel ? styles.cancelButton : null,
                      ]}
                      onPress={btn.onPress}
                    >
                      <Ionicons
                        name={iconName}
                        size={20}
                        color="#FFF"
                        style={styles.buttonIcon}
                      />
                      <Text style={styles.buttonText}>{btn.text}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animatable.View>
          </ImageBackground>
        </Animatable.View>
      </View>
    </Modal>
  );
};

export default CustomModal;

// ====================== ESTILOS ======================
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)", // Fundo semi-transparente para destacar o modal
    justifyContent: "center",
    alignItems: "center",
  },
  backgroundContainer: {
    width: "110%",
    borderRadius: 20,
    overflow: "hidden",
  },
  backgroundImage: {
    width: "100%",
    height: 420, // Altura da imagem de fundo
    justifyContent: "center",
    alignItems: "center",
  },
  imageStyle: {
    borderRadius: 20,
  },
  textContainer: {
    width: "100%",
    padding: 20,
    backgroundColor: "rgba(0, 0, 0, 0.0)", // Sem fundo para deixar a imagem visível
    alignItems: "center",
    marginTop: 20, // Desloca o conteúdo para baixo na imagem
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  titleIcon: {
    marginRight: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: "600",
    color: "#FFF",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  message: {
    fontSize: 18,
    color: "#FFF",
    textAlign: "center",
    marginBottom: 25,
    paddingHorizontal: 20,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "center",
  },
  button: {
    flexDirection: "row",
    backgroundColor: "#E3350D",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 20,
    alignItems: "center",
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: "#666", // Cinza para botão de cancelamento
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: 18,
    color: "#FFF",
    fontWeight: "bold",
  },
});
