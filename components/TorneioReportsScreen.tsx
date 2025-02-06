// TorneioReportsScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Animatable from "react-native-animatable";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

// Importa função de verificação de roles (host)
import { fetchRoleMembers } from "../app/hosts"; // ajuste o caminho conforme necessário

const RED = "#E3350D";
const BLACK = "#1E1E1E";
const DARK_GRAY = "#292929";
const WHITE = "#FFFFFF";

interface ReportData {
  final: Record<string, any>;
  partial: Record<string, any>;
}

interface TorneioReportsScreenProps {
  visible: boolean;
  onClose: () => void;
}

export default function TorneioReportsScreen({ visible, onClose }: TorneioReportsScreenProps) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportData>({ final: {}, partial: {} });
  const [isHost, setIsHost] = useState(false);
  const [leagueName, setLeagueName] = useState("Torneio");
  const [userName, setUserName] = useState("Jogador");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (visible) {
      loadReports();
    }
  }, [visible]);

  async function loadReports() {
    try {
      setLoading(true);
      const leagueId = await AsyncStorage.getItem("@leagueId");
      const firebaseToken = await AsyncStorage.getItem("@firebaseToken");
      const storedName = await AsyncStorage.getItem("@userName");
      setUserName(storedName || "Jogador");

      if (!leagueId) {
        setErrorMsg("Nenhuma liga selecionada no app.");
        setLoading(false);
        return;
      }

      // Verifica se o usuário é host (para exibir o botão de limpar resultados)
      await checkIfHost(leagueId);

      // Busca os resultados via API
      const res = await fetch(`https://Doprado.pythonanywhere.com/get-resultados?league_id=${leagueId}`, {
        method: "GET",
        headers: {
          Authorization: firebaseToken ? `Bearer ${firebaseToken}` : "",
        },
      });
      if (!res.ok) {
        const errText = await res.text();
        setErrorMsg(`Erro ao buscar resultados: ${res.status} - ${errText}`);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.error) {
        setErrorMsg(data.error);
        setLoading(false);
        return;
      }

      setReports({
        final: data.final || {},
        partial: data.partial || {},
      });

      // Busca informações adicionais da liga (nome, etc.)
      const infoRes = await fetch(`https://Doprado.pythonanywhere.com/get-league-info`, {
        method: "GET",
        headers: { Authorization: firebaseToken ? `Bearer ${firebaseToken}` : "" },
      });
      if (infoRes.ok) {
        const infoData = await infoRes.json();
        setLeagueName(infoData.leagueName || "Torneio");
      }
      setLoading(false);
    } catch (error: any) {
      console.error("Erro loadReports:", error);
      setErrorMsg("Falha ao carregar resultados do torneio.");
      setLoading(false);
    }
  }

  async function checkIfHost(leagueId: string) {
    try {
      const userId = await AsyncStorage.getItem("@userId");
      if (!userId) return setIsHost(false);

      const hostMembers = await fetchRoleMembers(leagueId, "host");
      const found = hostMembers.find((h) => h.userId === userId);
      setIsHost(!!found);
    } catch (err) {
      console.log("Erro em checkIfHost:", err);
      setIsHost(false);
    }
  }

  async function handleLimparResultados() {
    try {
      const firebaseToken = await AsyncStorage.getItem("@firebaseToken");
      const res = await fetch("https://Doprado.pythonanywhere.com/limpar-resultados", {
        method: "POST",
        headers: {
          Authorization: firebaseToken ? `Bearer ${firebaseToken}` : "",
        },
      });
      const json = await res.json();
      Alert.alert("Info", json.message || "Resultados limpos!");
      await loadReports();
    } catch (error) {
      Alert.alert("Erro", "Falha ao limpar resultados.");
    }
  }

  function renderResultRow(mesa: string, info: any) {
    return (
      <Animatable.View
        key={mesa}
        style={styles.resultCard}
        animation="fadeInUp"
        duration={600}
      >
        <Text style={styles.resultTitle}>Mesa {mesa}</Text>
        <Text style={styles.resultDesc}>{info.desc}</Text>
        <View style={styles.resultVotes}>
          <Text style={styles.resultSmall}>{info.p1Name}: {info.p1Vote}</Text>
          <Text style={styles.resultSmall}>{info.p2Name}: {info.p2Vote}</Text>
        </View>
      </Animatable.View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animatable.View style={styles.overlay} animation="fadeIn" duration={300}>
        <Animatable.View style={styles.modalContainer} animation="zoomIn" duration={300}>
          <Text style={styles.modalHeader}>{`${userName}, bem-vindo à ${leagueName}`}</Text>
          <Text style={styles.modalTitle}>Resultados do Torneio</Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={RED} />
              <Text style={styles.loadingText}>Carregando resultados...</Text>
            </View>
          ) : errorMsg ? (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#FFF" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : (
            <ScrollView style={styles.resultsContainer}>
              {Object.keys(reports.final).length === 0 && Object.keys(reports.partial).length === 0 ? (
                <Text style={styles.infoText}>Nenhum resultado disponível.</Text>
              ) : (
                <>
                  <Text style={styles.sectionTitle}>Finalizados</Text>
                  {Object.entries(reports.final).map(([mesa, info]) => renderResultRow(mesa, info))}
                  <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Parciais</Text>
                  {Object.entries(reports.partial).map(([mesa, info]) => renderResultRow(mesa, info))}
                </>
              )}
            </ScrollView>
          )}
          {isHost && !loading && (
            <TouchableOpacity style={styles.clearButton} onPress={handleLimparResultados}>
              <MaterialCommunityIcons name="delete" size={20} color="#FFF" style={{ marginRight: 6 }}/>
              <Text style={styles.clearButtonText}>Limpar Resultados</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Voltar</Text>
          </TouchableOpacity>
        </Animatable.View>
      </Animatable.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "90%",
    backgroundColor: DARK_GRAY,
    borderRadius: 10,
    padding: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  modalTitle: {
    color: RED,
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
  },
  loadingContainer: {
    alignItems: "center",
    marginVertical: 20,
  },
  loadingText: {
    color: WHITE,
    marginTop: 10,
  },
  resultsContainer: {
    flex: 1,
    marginVertical: 8,
  },
  sectionTitle: {
    color: WHITE,
    fontSize: 20,
    fontWeight: "bold",
    marginVertical: 10,
    textAlign: "center",
  },
  infoText: {
    color: "#ccc",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 10,
  },
  resultCard: {
    backgroundColor: DARK_GRAY,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  resultTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "bold",
  },
  resultDesc: {
    color: "#EEE",
    marginTop: 4,
    fontSize: 14,
  },
  resultVotes: {
    marginTop: 6,
  },
  resultSmall: {
    color: "#AAA",
    fontSize: 13,
  },
  clearButton: {
    backgroundColor: RED,
    padding: 12,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    alignSelf: "center",
  },
  clearButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "bold",
  },
  closeButton: {
    backgroundColor: RED,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: "center",
    marginTop: 20,
  },
  closeButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "bold",
  },
  errorContainer: {
    alignItems: "center",
    marginVertical: 20,
  },
  errorText: {
    color: WHITE,
    fontSize: 16,
    textAlign: "center",
    marginTop: 10,
  },
});
