import React from "react";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { withLayoutContext } from "expo-router";

// Importar telas
import HomeScreen from "./home";
import CalendarioScreen from "./calendario";
import TorneioScreen from "./torneio";
import TrocasScreen from "./trocas";
import EstatisticasScreen from "./Decks";
import JogadorScreen from "./jogador";

const Drawer = createDrawerNavigator();

function DrawerLayout() {
  return (
    <Drawer.Navigator>
      <Drawer.Screen
        name="home"
        component={HomeScreen}
        options={{ title: "Home" }}
      />
      <Drawer.Screen
        name="calendario"
        component={CalendarioScreen}
        options={{ title: "Calendário" }}
      />
      <Drawer.Screen
        name="torneio"
        component={TorneioScreen}
        options={{ title: "Torneio" }}
      />
      <Drawer.Screen
        name="trocas"
        component={TrocasScreen}
        options={{ title: "Trocas" }}
      />
      <Drawer.Screen
        name="Decks"
        component={EstatisticasScreen}
        options={{ title: "Decks" }}
      />
      <Drawer.Screen
        name="jogador"
        component={JogadorScreen}
        options={{ title: "Jogador" }}
      />
    </Drawer.Navigator>
  );
}

export default withLayoutContext(DrawerLayout);
