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
 * Agora busca também os nomes dos jogadores da mesa
 * e mostra esses nomes nos botões de voto.
 */
export default function HostVoteModal({ visible, onClose }: HostVoteModalProps) {
  const [mesas, setMesas] = useState<string[]>([]);
  const [selectedMesa, setSelectedMesa] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingTables, setFetchingTables] = useState(false);

  // States para nomes dos jogadores
  const [player1Name, setPlayer1Name] = useState("Jogador 1");
  const [player2Name, setPlayer2Name] = useState("Jogador 2");

  // Carrega os estados quando o modal abre
  useEffect(() => {
    if (visible) {
      setSelectedMesa("");
      setPin("");
      setLoading(false);

      // Reseta os nomes para os defaults
      setPlayer1Name("Jogador 1");
      setPlayer2Name("Jogador 2");

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

      // Pega a maior round (a round atual)
      const allRounds = jsonTorneio.round;
      const roundKeys = Object.keys(allRounds).map((rk) => parseInt(rk, 10));
      const maxRound = Math.max(...roundKeys);
      const divisions = allRounds[maxRound];
      // Seleciona a primeira divisão (pode ser ajustado se houver mais de uma)
      const divKeys = Object.keys(divisions);
      const currentDiv = divKeys[0];
      const tables = divisions[currentDiv].table;

      // Pega as chaves de mesa
      const tableKeys = Object.keys(tables);
      if (tableKeys.length === 0) {
        Alert.alert("Atenção", "Nenhuma mesa encontrada nesta rodada.");
      }
      setMesas(tableKeys);
    } catch (error) {
      console.log("Erro ao buscar mesas:", error);
      Alert.alert("Erro", "Falha ao obter mesas do torneio.");
    } finally {
      setFetchingTables(false);
    }
  }

  /**
   * Quando o host escolher uma mesa, buscamos os nomes dos jogadores
   * no mesmo JSON da API, usando a `selectedMesa`.
   */
  async function fetchPlayersForMesa(mesaId: string) {
    try {
      const storedLeagueId = await AsyncStorage.getItem("@leagueId");
      const firebaseToken = await AsyncStorage.getItem("@firebaseToken");
  
      if (!storedLeagueId || !firebaseToken) return;
  
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
      const allRounds = jsonTorneio.round;
      const roundKeys = Object.keys(allRounds).map((rk) => parseInt(rk, 10));
      const maxRound = Math.max(...roundKeys);
      const divisions = allRounds[maxRound];
  
      const divKey = Object.keys(divisions)[0];
      const tables = divisions[divKey].table;
  
      const tableData = tables[mesaId.toString()]; // 🔁 força string
  
      console.log("🎮 Dados da mesa selecionada:", tableData);
  
      setPlayer1Name(tableData?.player1 || "Jogador 1");
      setPlayer2Name(tableData?.player2 || "Jogador 2");

    } catch (error) {
      console.log("Erro ao buscar nomes dos jogadores:", error);
      setPlayer1Name("Jogador 1");
      setPlayer2Name("Jogador 2");
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
        resultado: result, // Ex: "Vitória Jogador 1", "Empate", "Vitória Jogador 2"
        pin: pin.trim(),
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
        onClose();
      }
    } catch (error) {
      console.error("Erro no HostVoteModal:", error);
      Alert.alert("Erro", "Falha ao conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CustomModal
      visible={visible}
      onClose={onClose}
      title="Votar como Host"
      // Conteúdo principal agora envolvido num container estilizado
      message={
        <View style={styles.modalContent}>
          {fetchingTables ? (
            <ActivityIndicator size="large" color={RED} style={{ marginVertical: 20 }} />
          ) : (
            <>
              <Text style={styles.label}>Selecione a Mesa:</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={selectedMesa}
                  onValueChange={(itemValue) => {
                    setSelectedMesa(itemValue);
                    if (itemValue) {
                      fetchPlayersForMesa(itemValue);
                    }
                  }}
                  style={styles.picker}
                >
                  <Picker.Item label="Escolher mesa..." value="" />
                  {mesas.map((m) => (
                    <Picker.Item key={m} label={`Mesa ${m}`} value={m} />
                  ))}
                </Picker>
              </View>

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

              {/* Botões de voto com os nomes dos jogadores */}
              <View style={styles.voteContainer}>
                <TouchableOpacity
                  style={styles.voteButton}
                  onPress={() => handleVote(`Vitória ${player1Name}`)}
                >
                  <MaterialCommunityIcons name="trophy" size={22} color="#4CAF50" />
                  <Text style={styles.voteText}>Vitória {player1Name}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.voteButton}
                  onPress={() => handleVote("Empate")}
                >
                  <Ionicons name="hand-left" size={22} color="#FFC107" />
                  <Text style={styles.voteText}>Empate</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.voteButton}
                  onPress={() => handleVote(`Vitória ${player2Name}`)}
                >
                  <MaterialCommunityIcons name="trophy" size={22} color="#F44336" />
                  <Text style={styles.voteText}>Vitória {player2Name}</Text>
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
  modalContent: {
    width: "95%",
    backgroundColor: "#1E1E1E", // mais escuro = mais destaque
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 15,
    marginTop: 40, // solta da parte superior
    marginBottom: 40, // solta da parte inferior
  },
  
  label: {
    color: WHITE,
    fontSize: 16,
    marginVertical: 10,
    textAlign: "center",
  },
  pickerContainer: {
    width: "100%",
    backgroundColor: "#292929",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#555",
    marginBottom: 16,
  },
  input: {
    width: "100%",
    backgroundColor: "#292929",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#555",
    color: WHITE,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    textAlign: "center",
    fontSize: 16,
  },
  picker: {
    color: WHITE,
    fontSize: 16,
  },  
  voteContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginVertical: 12,
  },
  voteButton: {
    flex: 1,
    marginHorizontal: 6,
    alignItems: "center",
    backgroundColor: "#222",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#555",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  voteText: {
    color: WHITE,
    marginTop: 6,
    fontWeight: "bold",
    fontSize: 14,
    textAlign: "center",
  },  
});
