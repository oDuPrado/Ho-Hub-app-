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
    fontWeight?:
      | "normal"
      | "bold"
      | "100"
      | "200"
      | "300"
      | "400"
      | "500"
      | "600"
      | "700"
      | "800"
      | "900";
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
    fontWeight?:
      | "normal"
      | "bold"
      | "100"
      | "200"
      | "300"
      | "400"
      | "500"
      | "600"
      | "700"
      | "800"
      | "900";
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
  {
    id: 1,
    name: "Fogo",
    description: "Tema quente e cheio de chamas.",
    isFree: true,
    containerStyle: {
      backgroundColor: "#FFE6E0",
      borderColor: "#FF4500",
      borderWidth: 3,
      borderRadius: 16,
      shadowColor: "#FF5722",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 6,
    },
    textStyle: {
      color: "#BF360C",
      fontWeight: "600",
      textShadowColor: "rgba(255,87,34,0.3)",
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
    },
    titleStyle: {
      color: "#D84315",
      fontWeight: "800",
      textTransform: "uppercase",
    },
    iconName: "fire",
    iconColor: "#FF5722",
    iconSize: 30,
    backgroundPattern: "fire-background.png",
  },
  {
    id: 2,
    name: "Água",
    description: "Tema refrescante, com ondas suaves.",
    isFree: true,
    containerStyle: {
      backgroundColor: "#E0F7FA",
      borderColor: "#00BCD4",
      borderWidth: 3,
      borderRadius: 16,
      shadowColor: "#00ACC1",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 6,
    },
    textStyle: {
      color: "#006064",
      fontWeight: "500",
      fontFamily: "sans-serif-medium",
      textShadowColor: "rgba(0,188,212,0.2)",
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
    },
    titleStyle: {
      color: "#00838F",
      fontWeight: "700",
      textTransform: "capitalize",
    },
    iconName: "water",
    iconColor: "#00BCD4",
    iconSize: 30,
    backgroundPattern: "water-waves.png",
  },
  {
    id: 3,
    name: "Grama",
    description: "Tema verde, conectado à natureza.",
    isFree: true,
    containerStyle: {
      backgroundColor: "#F0FFE6",
      borderColor: "#4CAF50",
      borderWidth: 3,
      borderRadius: 16,
      shadowColor: "#4CAF50",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 6,
    },
    textStyle: {
      color: "#1B5E20",
      fontWeight: "500",
      textShadowColor: "rgba(76,175,80,0.3)",
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
    },
    titleStyle: {
      color: "#2E7D32",
      fontWeight: "700",
      textTransform: "capitalize",
    },
    iconName: "leaf",
    iconColor: "#66BB6A",
    iconSize: 30,
    backgroundPattern: "grass-pattern.png",
  },
  {
    id: 4,
    name: "Elétrico",
    description: "Tema cheio de faíscas e tensão!",
    isFree: true,
    containerStyle: {
      backgroundColor: "#FFFDE7",
      borderColor: "#FFEB3B",
      borderWidth: 3,
      borderRadius: 16,
      shadowColor: "#FFD600",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 6,
    },
    textStyle: {
      color: "#9E9D24",
      fontWeight: "600",
      textShadowColor: "rgba(255,214,10,0.3)",
      textShadowOffset: { width: 2, height: 2 },
      textShadowRadius: 3,
    },
    titleStyle: {
      color: "#F9A825",
      fontWeight: "800",
      textTransform: "uppercase",
    },
    iconName: "bolt",
    iconColor: "#FDD835",
    iconSize: 30,
    backgroundPattern: "electric-pattern.png",
  },
  {
    id: 5,
    name: "Pedra",
    description: "Tema rochoso e robusto, tons terrosos.",
    isFree: true,
    containerStyle: {
      backgroundColor: "#F3ECE4",
      borderColor: "#8D6E63",
      borderWidth: 3,
      borderRadius: 16,
      shadowColor: "#795548",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 6,
    },
    textStyle: {
      color: "#4E342E",
      fontWeight: "700",
      textShadowColor: "rgba(158,105,82,0.4)",
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 2,
    },
    titleStyle: {
      color: "#6D4C41",
      fontWeight: "900",
      textTransform: "uppercase",
    },
    iconName: "mountain",
    iconColor: "#8D6E63",
    iconSize: 30,
    backgroundPattern: "rocky-pattern.png",
  },
  {
    id: 401,
    name: "Dragão",
    description: "Desbloqueado com o título Guardião do Dragão.",
    isFree: false,
    requiredTitleId: 401,
    containerStyle: {
      backgroundColor: "#FCF4FF",
      borderColor: "#8E24AA",
      borderWidth: 4,
      borderRadius: 16,
      shadowColor: "#8E24AA",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 8,
      elevation: 10,
    },
    textStyle: {
      color: "#4A0072",
      fontStyle: "italic",
      fontWeight: "bold",
      fontFamily: "serif",
      fontSize: 16,
      textShadowColor: "rgba(142,36,170,0.4)",
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 3,
    },
    titleStyle: {
      color: "#7B1FA2",
      fontFamily: "Trajan Pro",
      fontSize: 20,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    iconName: "dragon",
    iconColor: "#8E24AA",
    iconSize: 32,
    backgroundPattern: "dragon-scales.png",
  },
  {
    id: 302,
    name: "Lendário",
    description: "Desbloqueado com o título Alquimista Fullmetal.",
    isFree: false,
    requiredTitleId: 302,
    containerStyle: {
      backgroundColor: "#FFFBE0",
      borderColor: "#FFC107",
      borderWidth: 4,
      borderRadius: 16,
      shadowColor: "#FFC107",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 8,
      elevation: 10,
    },
    textStyle: {
      color: "#6F4E00",
      fontStyle: "italic",
      fontWeight: "bold",
      fontFamily: "Optima",
      fontSize: 16,
      textShadowColor: "rgba(255,193,7,0.4)",
      textShadowOffset: { width: 2, height: 2 },
      textShadowRadius: 3,
    },
    titleStyle: {
      color: "#FFA000",
      fontFamily: "Cinzel",
      fontSize: 22,
      fontWeight: "700",
      textTransform: "capitalize",
    },
    iconName: "crown",
    iconColor: "#FFC107",
    iconSize: 30,
    backgroundPattern: "legendary-pattern.png",
  },
  {
    id: 411,
    name: "Noturno",
    description: "Desbloqueado com o Titulo Elite dos 4.",
    isFree: false,
    requiredTitleId: 404,
    containerStyle: {
      backgroundColor: "#1F1F1F",
      borderColor: "#000000",
      borderWidth: 3,
      borderRadius: 16,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.6,
      shadowRadius: 10,
      elevation: 12,
    },
    textStyle: {
      color: "#AAAAAA",
      fontStyle: "italic",
      fontWeight: "bold",
      fontFamily: "monospace",
      fontSize: 16,
      textShadowColor: "rgba(170,170,170,0.5)",
      textShadowOffset: { width: 2, height: 2 },
      textShadowRadius: 3,
    },
    titleStyle: {
      color: "#CFD8DC",
      fontFamily: "Friz Quadrata",
      fontSize: 22,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    iconName: "moon",
    iconColor: "#757575",
    iconSize: 30,
    backgroundPattern: "shadow-texture.png",
  },
  {
    id: 403,
    name: "Campeão Épico",
    description: "Tema com efeitos e emblema épico.",
    isFree: false,
    requiredTitleId: 403,
    containerStyle: {
      backgroundColor: "#FEF9E7",
      borderColor: "#FFD700",
      borderWidth: 5,
      borderRadius: 24,
      shadowColor: "#FFD700",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.6,
      shadowRadius: 12,
      elevation: 14,
    },
    textStyle: {
      color: "#8B4513",
      fontWeight: "800",
      fontStyle: "italic",
      fontFamily: "Copperplate",
      fontSize: 18,
      textShadowColor: "rgba(139,69,19,0.6)",
      textShadowOffset: { width: 2, height: 2 },
      textShadowRadius: 5,
    },
    titleStyle: {
      color: "#B8860B",
      fontFamily: "Luminari",
      fontSize: 24,
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
    id: 309,
    name: "Glória Eterna",
    description: "Tema supremo: esplendor máximo!",
    isFree: false,
    requiredTitleId: 403,
    containerStyle: {
      backgroundColor: "#FDF5FD",
      borderColor: "#FFD700",
      borderWidth: 6,
      borderRadius: 28,
      shadowColor: "#4B0082",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.7,
      shadowRadius: 14,
      elevation: 18,
    },
    textStyle: {
      color: "#4B0082",
      fontWeight: "900",
      fontStyle: "italic",
      fontFamily: "Herculanum",
      fontSize: 20,
      textShadowColor: "rgba(75,0,130,0.6)",
      textShadowOffset: { width: 3, height: 3 },
      textShadowRadius: 6,
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
