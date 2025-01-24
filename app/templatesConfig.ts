import { TitleItem } from "./titlesConfig";

export interface TemplateItem {
  id: number;
  name: string;
  description: string;
  isFree: boolean;
  requiredTitleId?: number;

  containerStyle: {
    backgroundColor: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    shadowColor?: string;
    shadowOffset?: { width: number; height: number };
    shadowOpacity?: number;
    shadowRadius?: number;
    elevation?: number;
  };

  textStyle: {
    color: string;
    fontStyle?: "normal" | "italic";
    fontWeight?: "normal" | "bold" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
    fontFamily?: string;
    fontSize?: number;
    textShadowColor?: string;
    textShadowOffset?: { width: number; height: number };
    textShadowRadius?: number;
  };

  titleStyle?: {
    color: string;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: "normal" | "bold" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
    textTransform?: "uppercase" | "lowercase" | "capitalize";
  };

  iconName: string;
  iconColor: string;
  iconSize?: number;
  hasEpicAnimation?: boolean;
  emblemImage?: string;
  backgroundPattern?: string;
}

const templates: TemplateItem[] = [
  // ===== 5 GRÁTIS =====
  {
    id: 1,
    name: "Fogo",
    description: "Tema quente e ardente.",
    isFree: true,
    containerStyle: {
      backgroundColor: "#FFF1F0",
      borderColor: "#FF6B6B",
      borderWidth: 2,
      borderRadius: 10,
      shadowColor: "#FF6B6B",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    textStyle: {
      color: "#B71C1C",
      fontWeight: "600",
    },
    titleStyle: {
      color: "#FF3D00",
      fontWeight: "800",
      textTransform: "uppercase",
    },
    iconName: "fire",
    iconColor: "#FF6B6B",
    iconSize: 24,
  },
  {
    id: 2,
    name: "Água",
    description: "Tema refrescante e suave.",
    isFree: true,
    containerStyle: {
      backgroundColor: "#EBF8FF",
      borderColor: "#38BDF8",
      borderWidth: 2,
      borderRadius: 12,
      shadowColor: "#38BDF8",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    textStyle: {
      color: "#0C4A6E",
      fontWeight: "500",
    },
    titleStyle: {
      color: "#0284C7",
      fontWeight: "700",
      textTransform: "capitalize",
    },
    iconName: "water",
    iconColor: "#38BDF8",
    iconSize: 24,
  },
  {
    id: 3,
    name: "Grama",
    description: "Tema verde, ligado à natureza.",
    isFree: true,
    containerStyle: {
      backgroundColor: "#E6F4EA",
      borderColor: "#81C784",
      borderWidth: 2,
      borderRadius: 8,
      shadowColor: "#81C784",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    textStyle: {
      color: "#1B5E20",
      fontWeight: "500",
    },
    titleStyle: {
      color: "#2E7D32",
      fontWeight: "700",
      textTransform: "capitalize",
    },
    iconName: "leaf",
    iconColor: "#81C784",
    iconSize: 24,
  },
  {
    id: 4,
    name: "Elétrico",
    description: "Tema cheio de energia, amarelo vibrante.",
    isFree: true,
    containerStyle: {
      backgroundColor: "#FFFBEB",
      borderColor: "#FACC15",
      borderWidth: 2,
      borderRadius: 15,
      shadowColor: "#FACC15",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    textStyle: {
      color: "#8A6C00",
      fontWeight: "600",
    },
    titleStyle: {
      color: "#D97706",
      fontWeight: "800",
      textTransform: "uppercase",
    },
    iconName: "bolt",
    iconColor: "#FACC15",
    iconSize: 24,
  },
  {
    id: 5,
    name: "Pedra",
    description: "Tema rochoso e robusto.",
    isFree: true,
    containerStyle: {
      backgroundColor: "#F5F5F5",
      borderColor: "#BDBDBD",
      borderWidth: 3,
      borderRadius: 6,
      shadowColor: "#757575",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.4,
      shadowRadius: 5,
      elevation: 6,
    },
    textStyle: {
      color: "#424242",
      fontWeight: "700",
    },
    titleStyle: {
      color: "#616161",
      fontWeight: "900",
      textTransform: "uppercase",
    },
    iconName: "mountain",
    iconColor: "#757575",
    iconSize: 24,
  },

  // ===== 3 PREMIUM (não épicos) =====
  {
    id: 401,
    name: "Dragão",
    description: "Desbloqueado com o título Guardião do Dragão.",
    isFree: false,
    requiredTitleId: 401,
    containerStyle: {
      backgroundColor: "#F3E5F5",
      borderColor: "#9C27B0",
      borderWidth: 3,
      borderRadius: 20,
      shadowColor: "#9C27B0",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 6,
      elevation: 8,
    },
    textStyle: {
      color: "#4A0072",
      fontStyle: "italic",
      fontWeight: "bold",
      fontFamily: "Palatino",
      fontSize: 16,
      textShadowColor: "rgba(156, 39, 176, 0.3)",
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
    },
    titleStyle: {
      color: "#7B1FA2",
      fontFamily: "Trajan Pro",
      fontSize: 22,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    iconName: "dragon",
    iconColor: "#9C27B0",
    iconSize: 28,
    backgroundPattern: "dragon-scales.png",
  },
  {
    id: 402,
    name: "Lendário",
    description: "Desbloqueado com o título Domador Lendário.",
    isFree: false,
    requiredTitleId: 402,
    containerStyle: {
      backgroundColor: "#FFF7E0",
      borderColor: "#FFC107",
      borderWidth: 3,
      borderRadius: 15,
      shadowColor: "#FFC107",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 6,
      elevation: 8,
    },
    textStyle: {
      color: "#935E00",
      fontStyle: "italic",
      fontWeight: "bold",
      fontFamily: "Optima",
      fontSize: 16,
      textShadowColor: "rgba(255, 193, 7, 0.3)",
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
    },
    titleStyle: {
      color: "#F57F17",
      fontFamily: "Cinzel",
      fontSize: 22,
      fontWeight: "700",
      textTransform: "capitalize",
    },
    iconName: "crown",
    iconColor: "#FFC107",
    iconSize: 28,
    backgroundPattern: "legendary-pattern.png",
  },
  {
    id: 404,
    name: "Sombras",
    description: "Desbloqueado com Mestre das Sombras.",
    isFree: false,
    requiredTitleId: 404,
    containerStyle: {
      backgroundColor: "#2F2F2F",
      borderColor: "#000000",
      borderWidth: 3,
      borderRadius: 12,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.7,
      shadowRadius: 8,
      elevation: 10,
    },
    textStyle: {
      color: "#AAAAAA",
      fontStyle: "italic",
      fontWeight: "bold",
      fontFamily: "Didot",
      fontSize: 16,
      textShadowColor: "rgba(170, 170, 170, 0.5)",
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 3,
    },
    titleStyle: {
      color: "#E0E0E0",
      fontFamily: "Friz Quadrata",
      fontSize: 22,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    iconName: "moon",
    iconColor: "#6E6E6E",
    iconSize: 28,
    backgroundPattern: "shadow-texture.png",
  },

  // ===== 2 ÉPICOS =====
  {
    id: 403,
    name: "Campeão Épico",
    description: "Tema com animação e emblema épico.",
    isFree: false,
    requiredTitleId: 403,
    containerStyle: {
      backgroundColor: "#EEE8E1",
      borderColor: "#FFD700",
      borderWidth: 4,
      borderRadius: 25,
      shadowColor: "#FFD700",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.6,
      shadowRadius: 10,
      elevation: 12,
    },
    textStyle: {
      color: "#8B4513",
      fontWeight: "800",
      fontStyle: "italic",
      fontFamily: "Copperplate",
      fontSize: 18,
      textShadowColor: "rgba(139, 69, 19, 0.4)",
      textShadowOffset: { width: 2, height: 2 },
      textShadowRadius: 4,
    },
    titleStyle: {
      color: "#B8860B",
      fontFamily: "Luminari",
      fontSize: 26,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    iconName: "medal",
    iconColor: "#FFD700",
    iconSize: 32,
    hasEpicAnimation: true,
    emblemImage: "epic-emblem.png",
    backgroundPattern: "epic-pattern.png",
  },
  {
    id: 405,
    name: "Glória Eterna",
    description: "Tema supremo com efeitos especiais.",
    isFree: false,
    requiredTitleId: 405,
    containerStyle: {
      backgroundColor: "#F8EDFF",
      borderColor: "#FFD700",
      borderWidth: 5,
      borderRadius: 30,
      shadowColor: "#4B0082",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.8,
      shadowRadius: 12,
      elevation: 15,
    },
    textStyle: {
      color: "#4B0082",
      fontWeight: "900",
      fontStyle: "italic",
      fontFamily: "Herculanum",
      fontSize: 20,
      textShadowColor: "rgba(75, 0, 130, 0.6)",
      textShadowOffset: { width: 2, height: 2 },
      textShadowRadius: 5,
    },
    titleStyle: {
      color: "#8A2BE2",
      fontFamily: "Papyrus",
      fontSize: 28,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    iconName: "trophy",
    iconColor: "#FFD700",
    iconSize: 36,
    hasEpicAnimation: true,
    emblemImage: "eternal-glory-emblem.png",
    backgroundPattern: "glory-pattern.png",
  },
];

export default templates;
