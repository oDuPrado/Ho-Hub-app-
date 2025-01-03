import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { Stack, useRouter } from "expo-router";

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: "Pagina Não Encontrada" }} />
      <View style={styles.container}>
        <Image
          source={require("../assets/images/manut.jpg")} // Certifique-se de que o caminho para a imagem está correto
          style={styles.logo}
        />
        <Text style={styles.title}>Oops! Página em Construção</Text>
        <Text style={styles.message}>
          Estamos trabalhando nessa página no momento, mas logo ela estará
          funcionando!
        </Text>
        <Text style={styles.reference}>
          “Desafie seu rival enquanto exploramos novos territórios!” 🐾
        </Text>
        <View style={styles.buttonContainer}>
          <Text
            onPress={() => router.push("./home")} // Certifique-se de que "/home" é a rota da sua tela principal
            style={styles.button}
          >
            Voltar para a Home
          </Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  logo: {
    width: 275,
    height: 150,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    color: "#AAAAAA",
    textAlign: "center",
    marginBottom: 20,
  },
  reference: {
    fontSize: 14,
    color: "#E1E1E1",
    textAlign: "center",
    fontStyle: "italic",
    marginBottom: 30,
  },
  buttonContainer: {
    alignItems: "center",
    marginTop: 10,
  },
  button: {
    backgroundColor: "#E3350D",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
});
