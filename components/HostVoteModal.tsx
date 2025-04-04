////////////////////////////////////////
// ARQUIVO: HostVoteModal.tsx
////////////////////////////////////////
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

// IMPORTA SEU CUSTOM MODAL PERSONALIZADO
import CustomModal from "./CustomModal";

const RED = "#E3350D";
const WHITE = "#FFFFFF";

interface HostVoteModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Modal para Hosts escolherem qualquer mesa e enviarem voto
 * usando o PIN do jogador que teve problema.
 */
export default function HostVoteModal({ visible, onClose }: HostVoteModalProps) {
  const [mesas, setMesas] = useState<string[]>([]);
  const [selectedMesa, setSelectedMesa] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingTables, setFetchingTables] = useState(false);

  // Carregar lista real de mesas sempre que o modal abrir
  useEffect(() => {
    if (visible) {
      // Reseta estado ao abrir o modal
      setSelectedMesa("");
      setPin("");
      setLoading(false);

      // Busca as mesas reais na API
      fetchTables();
    }
  }, [visible]);

  /**
   * Faz o fetch das mesas reais do torneio,
   * pegando a round atual e listando as tables que existirem.
   */
  async function fetchTables() {
    try {
      setFetchingTables(true);
      setMesas([]);

      const storedLeagueId = await AsyncStorage.getItem("@leagueId");
      const firebaseToken = await AsyncStorage.getItem("@firebaseToken");

      if (!storedLeagueId || !firebaseToken) {
        Alert.alert("Erro", "Informações do torneio incompletas (leagueId ou token).");
        return;
      }

      const url = `https://doprado.pythonanywhere.com/get-data/${storedLeagueId}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${firebaseToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Falha ao obter dados do torneio: ${res.status}`);
      }

      const jsonTorneio = await res.json();

      // Se não existir round ativo, não há mesas
      if (!jsonTorneio.round || Object.keys(jsonTorneio.round).length === 0) {
        Alert.alert("Atenção", "Nenhum torneio ativo foi encontrado.");
        return;
      }

      // Pega a maior round (round atual)
      const allRounds = jsonTorneio.round;
      const roundKeys = Object.keys(allRounds).map((rk) => parseInt(rk, 10));
      const maxRound = Math.max(...roundKeys);
      const divisions = allRounds[maxRound];
      // Pega a primeira chave de divisão (caso tenha mais de uma)
      const divKeys = Object.keys(divisions);
      const currentDiv = divKeys[0];
      const tables = divisions[currentDiv].table;

      // Pega as chaves de mesa do objeto
      const tableKeys = Object.keys(tables);
      if (tableKeys.length === 0) {
        Alert.alert("Atenção", "Nenhuma mesa encontrada nesta rodada.");
      }

      // Salva no estado
      setMesas(tableKeys);
    } catch (error) {
      console.log("Erro ao buscar mesas:", error);
      Alert.alert("Erro", "Falha ao obter mesas do torneio.");
    } finally {
      setFetchingTables(false);
    }
  }

  /**
   * Função que envia o reporte de voto:
   * - Usa o PIN digitado pelo host
   * - Usa o ID da mesa selecionada
   * - Dá um ALERT de sucesso ou erro
   */
  async function handleVote(result: string) {
    try {
      if (!selectedMesa) {
        Alert.alert("Atenção", "Selecione a mesa antes de votar.");
        return;
      }
      if (!pin.trim()) {
        Alert.alert("Atenção", "Insira o PIN do jogador com problema.");
        return;
      }

      setLoading(true);

      const storedLeagueId = await AsyncStorage.getItem("@leagueId");
      const firebaseToken = await AsyncStorage.getItem("@firebaseToken");

      if (!storedLeagueId || !firebaseToken) {
        Alert.alert("Erro", "Informações do torneio incompletas.");
        return;
      }

      // Monta o corpo da requisição
      const body = {
        league_id: storedLeagueId,
        mesa_id: selectedMesa,
        resultado: result, // "Vitória Jogador 1", "Empate", "Vitória Jogador 2"
        pin: pin.trim(),   // PIN do jogador
      };

      console.log("[HOST] Enviando voto: ", body);

      const resp = await fetch("https://doprado.pythonanywhere.com/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firebaseToken}`,
        },
        body: JSON.stringify(body),
      });

      const json = await resp.json();
      if (!resp.ok) {
        Alert.alert("Erro ao votar", json.message || "Não foi possível registrar o voto.");
      } else {
        Alert.alert("Sucesso", "Voto registrado com sucesso!");
        // Fecha o modal após votar
        onClose();
      }
    } catch (error) {
      console.error("Erro no HostVoteModal:", error);
      Alert.alert("Erro", "Falha ao conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  // Montamos o conteúdo do modal usando seu <CustomModal>
  return (
    <CustomModal
      visible={visible}
      onClose={onClose}
      title="Votar como Host"
      message={
        <View style={styles.content}>
          {fetchingTables ? (
            <ActivityIndicator size="large" color={RED} style={{ marginVertical: 20 }} />
          ) : (
            <>
              {/* PICKER de Mesas */}
              <Text style={styles.label}>Selecione a Mesa:</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedMesa}
                  onValueChange={(itemValue) => setSelectedMesa(itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item label="Escolher mesa..." value="" />
                  {mesas.map((m) => (
                    <Picker.Item key={m} label={`Mesa ${m}`} value={m} />
                  ))}
                </Picker>
              </View>

              {/* PIN do jogador */}
              <Text style={styles.label}>PIN do jogador:</Text>
              <TextInput
                style={styles.input}
                value={pin}
                onChangeText={(txt) => setPin(txt.replace(/[^0-9]/g, ""))}
                placeholder="Ex: 1234"
                placeholderTextColor="#aaa"
                keyboardType="numeric"
                secureTextEntry
              />

              {/* Botões de voto */}
              <View style={styles.voteContainer}>
                <TouchableOpacity style={styles.voteButton} onPress={() => handleVote("Vitória Jogador 1")}>
                  <MaterialCommunityIcons name="trophy" size={22} color="#4CAF50" />
                  <Text style={styles.voteText}>P1</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.voteButton} onPress={() => handleVote("Empate")}>
                  <Ionicons name="hand-left" size={22} color="#FFC107" />
                  <Text style={styles.voteText}>Empate</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.voteButton} onPress={() => handleVote("Vitória Jogador 2")}>
                  <MaterialCommunityIcons name="trophy" size={22} color="#F44336" />
                  <Text style={styles.voteText}>P2</Text>
                </TouchableOpacity>
              </View>

              {/* Loading ao enviar voto */}
              {loading && (
                <ActivityIndicator size="large" color={RED} style={{ marginTop: 16 }} />
              )}
            </>
          )}
        </View>
      }
      buttons={[
        {
          text: "Fechar",
          onPress: onClose,
          style: "cancel",
        },
      ]}
    />
  );
}

// ====================== ESTILOS ======================
const styles = StyleSheet.create({
  content: {
    width: "100%",
    alignItems: "center",
  },
  label: {
    color: WHITE,
    fontSize: 16,
    marginVertical: 8,
    textAlign: "center",
  },
  pickerContainer: {
    width: "80%",
    backgroundColor: "#444",
    borderRadius: 8,
    marginBottom: 10,
  },
  picker: {
    color: WHITE,
  },
  input: {
    width: "80%",
    backgroundColor: "#444",
    borderRadius: 8,
    color: WHITE,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    textAlign: "center",
  },
  voteContainer: {
    flexDirection: "row",
    marginTop: 8,
    justifyContent: "space-evenly",
    width: "80%",
  },
  voteButton: {
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: "#333",
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 4,
  },
  voteText: {
    color: WHITE,
    marginTop: 4,
    fontWeight: "700",
  },
});
