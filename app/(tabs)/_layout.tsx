import React from "react";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { withLayoutContext } from "expo-router";
import { Ionicons } from "@expo/vector-icons"; // Biblioteca de ícones

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

const Drawer = createDrawerNavigator();

function DrawerLayout() {
  return (
    <Drawer.Navigator
      screenOptions={{
        drawerStyle: {
          backgroundColor: "#1E1E1E", // Fundo do menu
          paddingVertical: 20, // Espaçamento interno
        },
        drawerLabelStyle: {
          color: "#FFFFFF", // Cor do texto
          fontSize: 16, // Tamanho do texto
          marginLeft: -10, // Ajuste de alinhamento com o ícone
        },
        drawerActiveTintColor: "#E3350D", // Cor do texto da aba ativa
        drawerInactiveTintColor: "#FFFFFF", // Cor do texto das abas inativas
        drawerActiveBackgroundColor: "#292929", // Fundo da aba ativa
      }}
    >
      <Drawer.Screen
        name="home"
        component={HomeScreen}
        options={{
          title: "Home",
          drawerIcon: ({ color }) => (
            <Ionicons name="home-outline" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="calendario"
        component={CalendarioScreen}
        options={{
          title: "Calendário",
          drawerIcon: ({ color }) => (
            <Ionicons name="calendar-outline" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="torneio"
        component={TorneioScreen}
        options={{
          title: "Torneio",
          drawerIcon: ({ color }) => (
            <Ionicons name="trophy-outline" size={20} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="Noticias"
        component={NoticiasScreen}
        options={{
          title: "Noticias",
          drawerIcon: ({ color }) => (
            <Ionicons name="newspaper-outline" size={20} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="IApikachu"
        component={AnalyticsScreen}
        options={{
          title: "IApikachu",
          drawerIcon: ({ color }) => (
            <Ionicons name="bulb-outline" size={20} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="Cartas"
        component={CartasScreen}
        options={{
          title: "Cartas",
          drawerIcon: ({ color }) => (
            <Ionicons name="pricetag-outline" size={20} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="trocas"
        component={TrocasScreen}
        options={{
          title: "Trocas",
          drawerIcon: ({ color }) => (
            <Ionicons name="swap-horizontal-outline" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Decks"
        component={EstatisticasScreen}
        options={{
          title: "Decks",
          drawerIcon: ({ color }) => (
            <Ionicons name="layers-outline" size={20} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="jogador"
        component={JogadorScreen}
        options={{
          title: "Jogador",
          drawerIcon: ({ color }) => (
            <Ionicons name="person-outline" size={20} color={color} />
          ),
        }}
      />

      <Drawer.Screen
              name="Sugestão"
              component={SugestaoScreen}
              options={{
                title: "Sugestão",
                drawerIcon: ({ color }) => (
                  <Ionicons name="bulb-outline" size={20} color={color} />
                ),
              }}
            />
    </Drawer.Navigator>
  );
}

export default withLayoutContext(DrawerLayout);
