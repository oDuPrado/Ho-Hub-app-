import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
  Pressable,
  Image,
} from "react-native";
import { createDrawerNavigator, DrawerContentComponentProps } from "@react-navigation/drawer";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  FadeOutUp,
  Layout,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

// Importar telas reais do app
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
import ChatsListScreen from "./chats";
import PlayerScreen from "./Cadastros";
import ClassicosScreen from "./classicos";

// Criação do Drawer
const Drawer = createDrawerNavigator();

// Definição dos status disponíveis
const STATUS_OPTIONS = [
  { label: "Online", color: "#4CAF50" },
  { label: "Ocupado", color: "#FF9800" },
  { label: "Ausente", color: "#F44336" },
];

// -------------------- CUSTOM DRAWER CONTENT -------------------- //
function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { t } = useTranslation();
  const [selectedStatus, setSelectedStatus] = useState(STATUS_OPTIONS[0]); // Padrão: Online
  const [statusModalVisible, setStatusModalVisible] = useState(false);

  // Função para navegar e fechar o drawer
  const handleNavigate = (routeName: string) => {
    props.navigation.navigate(routeName);
    props.navigation.closeDrawer();
  };

  return (
    <Animated.View
      style={styles.drawerContainer}
      entering={FadeInDown.duration(400)}
      exiting={FadeOutUp.duration(300)}
      layout={Layout}
    >
      {/* Cabeçalho com Logo */}
      <View style={styles.drawerHeader}>
        <Image
          source={require("../../assets/images/logo.jpg")}
          style={styles.logo}
          resizeMode="contain"
        />
        {/* Badge de Status */}
        <TouchableOpacity
          style={[styles.statusBadge, { backgroundColor: selectedStatus.color }]}
          onPress={() => setStatusModalVisible(true)}
        >
          <Text style={styles.statusBadgeText}>{selectedStatus.label}</Text>
        </TouchableOpacity>
      </View>

      {/* Itens do Menu */}
      <ScrollView style={{ flex: 1 }}>
        <DrawerItem
          label={t("drawer.home")}
          iconName="home-outline"
          onPress={() => handleNavigate("Home")}
        />
        <DrawerItem
          label={t("drawer.jogador")}
          iconName="person-outline"
          onPress={() => handleNavigate("Jogador")}
        />
        <DrawerItem
          label={t("drawer.classico")}
          iconName="flame-outline"
          onPress={() => handleNavigate("Classicos")}
        />
        <DrawerItem
          label={t("drawer.calendario")}
          iconName="calendar-outline"
          onPress={() => handleNavigate("Calendario")}
        />
        <DrawerItem
          label={t("drawer.torneio")}
          iconName="trophy-outline"
          onPress={() => handleNavigate("Torneio")}
        />
        <DrawerItem
          label={t("drawer.noticias")}
          iconName="newspaper-outline"
          onPress={() => handleNavigate("Noticias")}
        />
        <DrawerItem
          label={t("drawer.iapikachu")}
          iconName="flash-outline"
          onPress={() => handleNavigate("ScauterIA")}
        />
        <DrawerItem
          label={t("drawer.cartas")}
          iconName="card-outline"
          onPress={() => handleNavigate("Cartas")}
        />
        <DrawerItem
          label={t("drawer.trocas")}
          iconName="swap-horizontal-outline"
          onPress={() => handleNavigate("Trocas")}
        />
        <DrawerItem
          label={t("drawer.decks")}
          iconName="albums-outline"
          onPress={() => handleNavigate("Decks")}
        />
        <DrawerItem
          label={t("drawer.cadastros")}
          iconName="create-outline"
          onPress={() => handleNavigate("Cadastros")}
        />
        <DrawerItem
          label={t("drawer.sugestao")}
          iconName="chatbubbles-outline"
          onPress={() => handleNavigate("Sugestao")}
        />
      </ScrollView>

      {/* Rodapé */}
      <View style={styles.drawerFooter}>
        <Text style={styles.drawerFooterText}>Versão 1.3.21</Text>
      </View>

      {/* Modal para alterar Status */}
      <Modal
        visible={statusModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={styles.modalContent}
            entering={ZoomIn.duration(250)}
            exiting={ZoomOut.duration(200)}
          >
            <Text style={styles.modalTitle}>Alterar Status</Text>
            {STATUS_OPTIONS.map((statusItem, index) => (
              <Pressable
                key={index}
                onPress={() => {
                  setSelectedStatus(statusItem);
                  setStatusModalVisible(false);
                }}
                style={[styles.statusOption, { backgroundColor: statusItem.color }]}
              >
                <Text style={styles.statusOptionText}>{statusItem.label}</Text>
              </Pressable>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setStatusModalVisible(false)}
            >
              <Text style={{ color: "#fff" }}>Cancelar</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </Animated.View>
  );
}

// -------------------- COMPONENTE DE ITEM DO DRAWER -------------------- //
function DrawerItem({
  label,
  iconName,
  onPress,
}: {
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      layout={Layout.delay(100)}
      style={styles.drawerItemContainer}
    >
      <TouchableOpacity style={styles.drawerItemButton} onPress={onPress}>
        <Ionicons
          name={iconName}
          size={20}
          color="#FFF"
          style={{ marginRight: 12 }}
        />
        <Text style={styles.drawerItemLabel}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// -------------------- NAVEGADOR PRINCIPAL -------------------- //
// Este componente deve ser renderizado dentro do NavigationContainer principal
export default function DrawerLayout() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          width: 280,
        },
        drawerPosition: "right",
      }}
    >
      <Drawer.Screen name="Home" component={HomeScreen} />
      <Drawer.Screen name="Jogador" component={JogadorScreen} />
      <Drawer.Screen name="Classicos" component={ClassicosScreen} />
      <Drawer.Screen name="Calendario" component={CalendarioScreen} />
      <Drawer.Screen name="Torneio" component={TorneioScreen} />
      <Drawer.Screen name="Noticias" component={NoticiasScreen} />
      <Drawer.Screen name="ScauterIA" component={AnalyticsScreen} />
      <Drawer.Screen name="Cartas" component={CartasScreen} />
      <Drawer.Screen name="Trocas" component={TrocasScreen} />
      <Drawer.Screen name="Decks" component={EstatisticasScreen} />
      <Drawer.Screen name="Cadastros" component={PlayerScreen} />
      <Drawer.Screen name="Sugestao" component={SugestaoScreen} />
      <Drawer.Screen name="Chats" component={ChatsListScreen} />
    </Drawer.Navigator>
  );
}

// -------------------------- ESTILOS -------------------------- //
const styles = StyleSheet.create({
  // Tela placeholder (usada nas telas de exemplo)
  screenContainer: {
    flex: 1,
    backgroundColor: "#2A2A2A",
    justifyContent: "center",
    alignItems: "center",
  },
  // Container do Drawer customizado
  drawerContainer: {
    flex: 1,
    backgroundColor: "#1E1E1E",
    paddingTop: 40,
  },
  drawerHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  // Logo do app (substitui o texto "Ho Hub")
  logo: {
    width: 120,
    height: 50,
    marginBottom: 10,
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  statusBadgeText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  // Itens do Drawer
  drawerItemContainer: {
    marginVertical: 4,
    marginHorizontal: 10,
  },
  drawerItemButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 6,
    backgroundColor: "#2A2A2A",
  },
  drawerItemLabel: {
    fontSize: 15,
    color: "#FFF",
    fontWeight: "500",
  },
  // Rodapé do Drawer
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: "#333",
    paddingVertical: 12,
    alignItems: "center",
  },
  drawerFooterText: {
    color: "#888",
    fontSize: 13,
  },
  // Modal de status
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: 260,
    backgroundColor: "#1E1E1E",
    borderRadius: 8,
    padding: 16,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  statusOption: {
    marginVertical: 5,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
  },
  statusOptionText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  modalCloseButton: {
    marginTop: 10,
    backgroundColor: "#444",
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
});
