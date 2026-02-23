import React, { useEffect, useState } from "react";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from "@react-navigation/drawer";
import { withLayoutContext } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import VitrineScreen from "./Vitrine";

// Cores
const DARK_BG = "#1E1E1E";
const RED = "#E3350D";
const WHITE = "#FFFFFF";

const Drawer = createDrawerNavigator();

// Grupos de rotas conforme o tema do menu:
const grupoTorneio = ["classicos", "calendario", "torneio", "jogador", "Noticias", "ScauterIA"];
const grupoColecao = ["Cartas", "Coleção", "trocas", "Decks"];
const grupoInformacoes = ["Cadastros", "Sugestão"];

type CustomDrawerItemProps = {
  route: any;
  isFocused: boolean;
  navigation: any;
  descriptor: any;
};

const CustomDrawerItem: React.FC<CustomDrawerItemProps> = ({
  route,
  isFocused,
  navigation,
  descriptor,
}) => {
  const { options } = descriptor;
  const label = options.title || route.name;
  const icon = options.drawerIcon
    ? options.drawerIcon({ color: isFocused ? RED : WHITE, size: 22 })
    : null;
  const onPress = () => {
    navigation.navigate(route.name);
  };

  return (
    <TouchableOpacity onPress={onPress} style={[styles.drawerItem, isFocused && styles.drawerItemFocused]}>
      {isFocused && <View style={styles.indicator} />}
      <View style={styles.drawerItemContent}>
        {icon}
        <Text style={[styles.drawerItemLabel, { color: isFocused ? RED : WHITE }]}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
};

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { state, navigation, descriptors } = props;
  const [userType, setUserType] = useState<"collection" | "tournament" | "both" | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const storedType = await AsyncStorage.getItem("@userType");
        if (storedType === "collection" || storedType === "tournament" || storedType === "both") {
          setUserType(storedType);
        }
      } catch (err) {
        console.log("Erro ao buscar userType:", err);
      }
    })();
  }, []);

  const renderSection = (sectionTitle: string, routeNames: string[]) => {
    const filteredRoutes = state.routes.filter((r) => routeNames.includes(r.name));
    if (filteredRoutes.length === 0) return null;

    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>{sectionTitle}</Text>
        {filteredRoutes.map((route) => {
          // Verifica se o item está selecionado comparando com o item ativo no estado
          const focused = state.routes[state.index]?.key === route.key;
          return (
            <CustomDrawerItem
              key={route.key}
              route={route}
              navigation={navigation}
              descriptor={descriptors[route.key]}
              isFocused={focused}
            />
          );
        })}
      </View>
    );
  };

  return (
    <LinearGradient colors={[DARK_BG, "#292929"]} style={{ flex: 1 }}>
      <DrawerContentScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: 0 }}>
        {/* Exibe o tipo de usuário */}
        <View style={styles.userTypeBox}>
          <Text style={styles.userTypeLabel}>Você está usando como:</Text>
          <Text style={styles.userTypeValue}>
            {userType === "collection"
              ? "Colecionador"
              : userType === "tournament"
              ? "Torneios"
              : userType === "both"
              ? "Coleçionador e Torneios"
              : "Desconhecido"}
          </Text>
        </View>
        {renderSection("Home", ["home"])}
        {renderSection("Menu de Torneio", grupoTorneio)}
        {renderSection("Menu de Coleção", grupoColecao)}
        {renderSection("Informações", grupoInformacoes)}
      </DrawerContentScrollView>
    </LinearGradient>
  );
}

function DrawerLayout() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        swipeEnabled: false,
        headerStyle: {
          backgroundColor: DARK_BG,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: WHITE,
        drawerStyle: {
          backgroundColor: "transparent",
          width: 260,
        },
        // Como vamos renderizar itens customizados, desabilitamos o background ativo padrão
        drawerActiveBackgroundColor: "transparent",
        drawerLabelStyle: {
          marginLeft: -5,
          fontSize: 16,
        },
      }}
    >
      {/* HOME */}
      <Drawer.Screen
        name="home"
        component={HomeScreen}
        options={{
          title: t("drawer.home"),
          drawerIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />

      {/* TORNEIO */}
      <Drawer.Screen
        name="classicos"
        component={ClassicosScreen}
        options={{
          title: t("drawer.classico"),
          drawerIcon: ({ color, size }) => <Ionicons name="flame-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="calendario"
        component={CalendarioScreen}
        options={{
          title: t("drawer.calendario"),
          drawerIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="torneio"
        component={TorneioScreen}
        options={{
          title: t("drawer.torneio"),
          drawerIcon: ({ color, size }) => <Ionicons name="trophy-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="jogador"
        component={JogadorScreen}
        options={{
          title: t("drawer.jogador"),
          drawerIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Noticias"
        component={NoticiasScreen}
        options={{
          title: t("drawer.noticias"),
          drawerIcon: ({ color, size }) => <Ionicons name="newspaper-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Vitrine"
        component={VitrineScreen}
        options={{
          title: t("drawer.vitrine"),
          drawerIcon: ({ color, size }) => <Ionicons name="star-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="ScauterIA"
        component={AnalyticsScreen}
        options={{
          title: t("drawer.iapikachu"),
          drawerIcon: ({ color, size }) => <Ionicons name="flash-outline" size={size} color={color} />,
        }}
      />

      {/* COLEÇÃO */}
      <Drawer.Screen
        name="Cartas"
        component={CartasScreen}
        options={{
          title: t("drawer.cartas"),
          drawerIcon: ({ color, size }) => <Ionicons name="card-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Coleção"
        component={ColecaoScreen}
        options={{
          title: t("drawer.colecao"),
          drawerIcon: ({ color, size }) => <Ionicons name="albums" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="trocas"
        component={TrocasScreen}
        options={{
          title: t("drawer.trocas"),
          drawerIcon: ({ color, size }) => <Ionicons name="swap-horizontal-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Decks"
        component={EstatisticasScreen}
        options={{
          title: t("drawer.decks"),
          drawerIcon: ({ color, size }) => <Ionicons name="albums-outline" size={size} color={color} />,
        }}
      />

      {/* INFORMAÇÕES */}
      <Drawer.Screen
        name="Cadastros"
        component={PlayerScreen}
        options={{
          title: t("drawer.cadastros"),
          drawerIcon: ({ color, size }) => <Ionicons name="create-outline" size={size} color={color} />,
        }}
      />
      <Drawer.Screen
        name="Sugestão"
        component={SugestaoScreen}
        options={{
          title: t("drawer.sugestao"),
          drawerIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" size={size} color={color} />,
        }}
      />
    </Drawer.Navigator>
  );
}

export default withLayoutContext(DrawerLayout);

const styles = StyleSheet.create({
  userTypeBox: {
    padding: 16,
    borderBottomColor: "#333",
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  userTypeLabel: {
    color: "#aaa",
    fontSize: 14,
  },
  userTypeValue: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 4,
  },
  sectionContainer: {
    marginBottom: 12,
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 16,
    color: RED,
    fontSize: 14,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  drawerItemFocused: {
    backgroundColor: "rgba(227, 53, 13, 0.1)",
  },
  drawerItemContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  drawerItemLabel: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "500",
  },
  indicator: {
    width: 4,
    height: "100%",
    backgroundColor: RED,
    borderRadius: 2,
    marginRight: 8,
  },
});
