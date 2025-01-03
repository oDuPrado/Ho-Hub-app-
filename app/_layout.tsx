// app/_layout.tsx
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
import { useColorScheme, View, Text, StyleSheet } from "react-native";
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
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setUpdateMessage("Baixando atualização...");
        console.log("Atualização disponível. Baixando...");
        const downloadProgress = Updates.fetchUpdateAsync();

        // Simula progresso
        simulateProgress();

        downloadProgress.then(() => {
          console.log("Atualização baixada com sucesso!");
          setUpdateMessage("Atualização baixada! Reiniciando...");
          Updates.reloadAsync();
        });
      } else {
        console.log("Nenhuma atualização disponível.");
      }
    } catch (error) {
      console.error("Erro ao verificar atualizações: ", error);
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

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1 }}>
        {updateMessage && (
          <View style={styles.updateContainer}>
            <Text style={styles.updateText}>{updateMessage}</Text>
            <View style={styles.progressBar}>
              <View
                style={{
                  height: "100%",
                  width: `${progress * 100}%`,
                  backgroundColor: "#E3350D",
                }}
              />
            </View>
          </View>
        )}

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
});
