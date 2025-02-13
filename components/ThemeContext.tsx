// ThemeContext.tsx

import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemeName, Themes } from "./themes";

// Interface do contexto
interface ThemeContextProps {
  themeName: ThemeName;
  colors: typeof Themes["padrao"]; // Ex.: para ler o shape do "padrao"
  setTheme: (themeName: ThemeName) => void;
}

// Contexto inicial
const ThemeContext = createContext<ThemeContextProps>({
  themeName: "padrao",
  colors: Themes["padrao"],
  setTheme: () => {},
});

// Hook customizado para usar o contexto
export function useTheme() {
  return useContext(ThemeContext);
}

// Provider que englobará o App
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>("padrao");

  // Ao montar, carrega o tema do AsyncStorage
  useEffect(() => {
    (async () => {
      const storedTheme = await AsyncStorage.getItem("@appTheme");
      if (
        storedTheme === "padrao" ||
        storedTheme === "claro" ||
        storedTheme === "escuro"
      ) {
        setThemeName(storedTheme);
      } else {
        setThemeName("padrao"); // default
      }
    })();
  }, []);

  // Função para alterar tema e salvar no AsyncStorage
  const setTheme = async (newTheme: ThemeName) => {
    setThemeName(newTheme);
    await AsyncStorage.setItem("@appTheme", newTheme);
  };

  const value: ThemeContextProps = {
    themeName,
    colors: Themes[themeName], // Carrega as cores do tema atual
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
