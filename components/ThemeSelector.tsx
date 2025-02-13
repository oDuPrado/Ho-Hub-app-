// ThemeSelector.tsx

import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeName } from "./themes";
import { useTheme } from "./ThemeContext";

export function ThemeSelector() {
  const { themeName, setTheme, colors } = useTheme();

  return (
    <View style={styles.container}>
      {/* Botão para tema Claro */}
      <TouchableOpacity
        style={[styles.button, themeName === "claro" && styles.buttonSelected]}
        onPress={() => setTheme("claro")}
      >
        <Ionicons name="sunny" size={20} color="#FFF" />
      </TouchableOpacity>

      {/* Botão para tema Escuro */}
      <TouchableOpacity
        style={[styles.button, themeName === "escuro" && styles.buttonSelected]}
        onPress={() => setTheme("escuro")}
      >
        <Ionicons name="moon" size={20} color="#FFF" />
      </TouchableOpacity>

      {/* Botão para tema Padrão */}
      <TouchableOpacity
        style={[styles.button, themeName === "padrao" && styles.buttonSelected]}
        onPress={() => setTheme("padrao")}
      >
        <Ionicons name="color-palette" size={20} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginLeft: 10,
  },
  button: {
    backgroundColor: "#555",
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },
  buttonSelected: {
    backgroundColor: "#E3350D",
  },
});
