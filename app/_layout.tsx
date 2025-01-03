import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import {
  useColorScheme,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
} from "react-native";
import * as Updates from "expo-updates";

// Prevenção da splash screen
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    checkForUpdates();
  }, []);

  async function checkForUpdates() {
    try {
      console.log("Verificando atualizações...");
      setUpdateMessage("Verificando atualizações...");
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setUpdateMessage("Atualização disponível!");
        console.log("Atualização disponível. Baixando...");
        setUpdateAvailable(true); // Indica que há uma atualização disponível

        const downloadProgress = Updates.fetchUpdateAsync();

        // Simula progresso
        simulateProgress();

        downloadProgress.then(() => {
          console.log("Atualização baixada com sucesso!");
          setUpdateMessage(null); // Esconde a mensagem de progresso
          setShowModal(true); // Mostra o modal
        });
      } else {
        console.log("Nenhuma atualização disponível.");
        setUpdateMessage(null); // Remove mensagem se não há atualização
      }
    } catch (error) {
      console.error("Erro ao verificar atualizações: ", error);
      setUpdateMessage("Erro ao verificar atualizações.");
    }
  }

  function simulateProgress() {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 1) {
          clearInterval(interval);
          return 1;
        }
        return prev + 0.1;
      });
    }, 500);
  }

  const handleApplyUpdate = async () => {
    setShowModal(false); // Fecha o modal antes de reiniciar
    await Updates.reloadAsync();
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1 }}>
        {updateMessage && (
          <View style={styles.updateContainer}>
            <Text style={styles.updateText}>{updateMessage}</Text>

            {updateAvailable && (
              <View style={styles.progressBar}>
                <View
                  style={{
                    height: "100%",
                    width: `${progress * 100}%`,
                    backgroundColor: "#E3350D",
                  }}
                />
              </View>
            )}
          </View>
        )}

        {/* Modal para a mensagem de atualização */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={showModal}
          onRequestClose={() => setShowModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Image
                source={require("../assets/images/pikachu_happy.png")}
                style={styles.modalImage}
              />
              <Text style={styles.modalTitle}>Atualização Completa!</Text>
              <Text style={styles.modalText}>
                Tudo pronto! Reinicie para aplicar as mudanças.
              </Text>
              <TouchableOpacity
                onPress={handleApplyUpdate}
                style={styles.modalButton}
              >
                <Text style={styles.modalButtonText}>Reiniciar Agora</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Stack initialRouteName="index">
          {/* Rota raiz */}
          <Stack.Screen name="index" options={{ headerShown: false }} />

          {/* Tela de login */}
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />

          {/* Abas */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

          {/* Not found */}
          <Stack.Screen name="+not-found" />
        </Stack>
      </View>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  updateContainer: {
    position: "absolute",
    top: 0,
    width: "100%",
    backgroundColor: "#292929",
    zIndex: 1000,
    paddingVertical: 10,
    alignItems: "center",
  },
  updateText: {
    color: "#FFFFFF",
    fontSize: 14,
    marginBottom: 5,
  },
  progressBar: {
    width: "90%",
    height: 5,
    borderRadius: 3,
    backgroundColor: "#444",
    overflow: "hidden",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContainer: {
    width: "80%",
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    alignItems: "center",
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  modalImage: {
    width: 80,
    height: 80,
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 10,
  },
  modalText: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: "#E3350D",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
});
