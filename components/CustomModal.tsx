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

type CustomModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
};

const CustomModal: React.FC<CustomModalProps> = ({
  visible,
  onClose,
  title,
  message,
}) => {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Animando a imagem de fundo */}
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
              {/* Ícone de informação ao lado do título */}
              <View style={styles.titleContainer}>
                <Ionicons
                  name="information-circle-outline"
                  size={30}
                  color="#FFF"
                  style={styles.titleIcon}
                />
                {title ? <Text style={styles.title}>{title}</Text> : null}
              </View>
              <Text style={styles.message}>{message}</Text>
              <TouchableOpacity style={styles.button} onPress={onClose}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>OK</Text>
              </TouchableOpacity>
            </Animatable.View>
          </ImageBackground>
        </Animatable.View>
      </View>
    </Modal>
  );
};

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
  // Container exclusivo para o texto (título, mensagem e botão)
  textContainer: {
    width: "100%",
    padding: 20,
    backgroundColor: "rgba(0, 0, 0, 0.0)", // sem fundo para deixar a imagem visível
    alignItems: "center",
    marginTop: 20, // desloca o conteúdo para baixo na imagem
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
  button: {
    flexDirection: "row",
    backgroundColor: "#E3350D",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 20,
    alignItems: "center",
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

export default CustomModal;
