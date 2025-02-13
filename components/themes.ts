// theme.ts

export type ThemeName = "padrao" | "claro" | "escuro";

interface ThemeColors {
  background: string;
  primary: string;
  secondary: string;
  accent: string;
  inputBackground: string;
  inputBorder: string;
}

export const Themes: Record<ThemeName, ThemeColors> = {
  padrao: {
    background: "#1E1E1E",
    primary: "#E3350D",
    secondary: "#FFFFFF",
    accent: "#FF6F61",
    inputBackground: "#292929",
    inputBorder: "#4D4D4D",
  },
  claro: {
    background: "#F7F7F7",
    primary: "#D32F2F",
    secondary: "#333333",
    accent: "#FF5C5C",
    inputBackground: "#FFFFFF",
    inputBorder: "#CCCCCC",
  },
  escuro: {
    background: "#121212",
    primary: "#B71C1C",
    secondary: "#E0E0E0",
    accent: "#FF4444",
    inputBackground: "#1A1A1A",
    inputBorder: "#333333",
  },
};
