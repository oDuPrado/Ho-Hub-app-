import React from "react";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerContentComponentProps,
  DrawerItemList,
} from "@react-navigation/drawer";
import { withLayoutContext } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { View, Text, StyleSheet } from "react-native";

// (Opcional) Para usar gradiente como fundo
import { LinearGradient } from "expo-linear-gradient";

// Importar telas
import HomeScreen from "./home";
import CalendarioScreen from "./calendario";
import TorneioScreen from "./torneio";
import TrocasScreen from "./trocas";
import EstatisticasScreen from "./Decks";
import JogadorScreen from "./jogador";
import CartasScreen from "./Cartas";
import AnalyticsScreen from "./Analise";
import NoticiasScreen from "./Noticias";
import SugestaoScreen from "./Sugestao";
import PlayerScreen from "./Cadastros";
import ClassicosScreen from "./classicos";
import ColecaoScreen from "./Colecao";

// CORES PADRÃO
const DARK_BG = "#1E1E1E";
const RED = "#E3350D";
const WHITE = "#FFFFFF";

const Drawer = createDrawerNavigator();

// Exemplo de conteúdo customizado do Drawer (cabeçalho + lista)
function CustomDrawerContent(props: DrawerContentComponentProps) { 
  const { t } = useTranslation();

  return (
    // LinearGradient para dar um fundinho gradiente
    <LinearGradient
      colors={[DARK_BG, "#292929"]} 
      style={{ flex: 1 }}
    >
      <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>

        {/* Lista de itens do Drawer */}
        <DrawerItemList {...props} />
      </DrawerContentScrollView>
    </LinearGradient>
  );
}

function DrawerLayout() {
  const { t } = useTranslation();

  return (
    <Drawer.Navigator
      // Define que vamos renderizar um conteúdo customizado
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        // Desativa o swipe
        swipeEnabled: false,
        // Header (barra superior) com fundo escuro e texto branco
        headerStyle: {
          backgroundColor: DARK_BG,
          elevation: 0, // remove sombra do Android
          shadowOpacity: 0, // remove sombra do iOS
        },
        headerTintColor: WHITE,
        // Estilos do drawer
        drawerStyle: {
          backgroundColor: "transparent", // Usamos 'transparent' pois tem gradiente atrás
          width: 260,
        },
        drawerLabelStyle: {
          color: WHITE,
          fontSize: 16,
          marginLeft: -5,
        },
        drawerActiveTintColor: RED, // Cor texto aba ativa
        drawerInactiveTintColor: WHITE, // Cor texto abas inativas
        // Fundo da aba ativa (pode ser mais claro para destacar)
        drawerActiveBackgroundColor: "rgba(227, 53, 13, 0.2)",
      }}
    >
      <Drawer.Screen
        name="home"
        component={HomeScreen}
        options={{
          title: t("drawer.home"),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="jogador"
        component={JogadorScreen}
        options={{
          title: t("drawer.jogador"),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="classicos"
        component={ClassicosScreen}
        options={{
          title: t("drawer.classico"),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="flame-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="calendario"
        component={CalendarioScreen}
        options={{
          title: t("drawer.calendario"),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="torneio"
        component={TorneioScreen}
        options={{
          title: t("drawer.torneio"),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="trophy-outline" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="Noticias"
        component={NoticiasScreen}
        options={{
          title: t("drawer.noticias"),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="newspaper-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="ScauterIA"
        component={AnalyticsScreen}
        options={{
          title: t("drawer.iapikachu"),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="flash-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Cartas"
        component={CartasScreen}
        options={{
          title: t("drawer.cartas"),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="card-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="trocas"
        component={TrocasScreen}
        options={{
          title: t("drawer.trocas"),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="swap-horizontal-outline" size={size} color={color} />
          ),
        }}
        />
      <Drawer.Screen
        name="Coleção"
        component={ColecaoScreen}
        options={{
          title: t("drawer.colecao"),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="albums" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Decks"
        component={EstatisticasScreen}
        options={{
          title: t("drawer.decks"),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="albums-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Cadastros"
        component={PlayerScreen}
        options={{
          title: t("drawer.cadastros"),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="create-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Sugestão"
        component={SugestaoScreen}
        options={{
          title: t("drawer.sugestao"),
          drawerIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
}

export default withLayoutContext(DrawerLayout);

// Estilos
const styles = StyleSheet.create({
  headerContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  headerText: {
    color: WHITE,
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 10,
  },
});
