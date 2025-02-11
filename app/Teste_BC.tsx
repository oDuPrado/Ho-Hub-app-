//////////////////////////////////////
// ARQUIVO: TestIndicesScreen.tsx
//////////////////////////////////////
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { collectionGroup, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from "../lib/firebaseConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function TestIndicesScreen() {
  const [reads, setReads] = useState({
    globalMatches: 0,
    leaguesByCity: 0,
    aggregatedStats: 0,
    rivalStats: 0,
  });

  // Teste 1: Busca global de partidas usando collectionGroup na subcoleção "matches"
  async function testGlobalMatchesIndex() {
    try {
      let readCount = 0;
      const matchesQuery = collectionGroup(db, "matches");
      const snapshot = await getDocs(matchesQuery);
      readCount = snapshot.size;
      
      setReads((prev) => ({ ...prev, globalMatches: readCount }));
      console.log(`🔍 Global Matches: ${snapshot.size} leituras`);
      Alert.alert("Teste Global Matches", `Total de partidas: ${snapshot.size} (Leituras: ${readCount})`);
    } catch (error) {
      console.error("❌ Erro no teste Global Matches:", error);
      Alert.alert("Erro", "Teste Global Matches falhou");
    }
  }

  // Teste 2: Busca de ligas filtradas por cidade (índice para "city")
  async function testLeaguesByCityIndex() {
    try {
      let readCount = 0;
      const city = (await AsyncStorage.getItem("@selectedCity")) || "São Paulo";
      const leaguesRef = collection(db, "leagues");
      const qCity = query(leaguesRef, where("city", "==", city));
      const snapshot = await getDocs(qCity);
      readCount = snapshot.size;
      
      setReads((prev) => ({ ...prev, leaguesByCity: readCount }));
      console.log(`🔍 Ligas na cidade (${city}): ${snapshot.size} leituras`);
      Alert.alert("Teste Ligas por Cidade", `Total de ligas em ${city}: ${snapshot.size} (Leituras: ${readCount})`);
    } catch (error) {
      console.error("❌ Erro no teste Ligas por Cidade:", error);
      Alert.alert("Erro", "Teste Ligas por Cidade falhou");
    }
  }

  // Teste 3: Busca de estatísticas agregadas para um jogador (índice em stats/aggregated)
  async function testAggregatedStatsIndex() {
    try {
      let readCount = 1; // Apenas uma leitura esperada (um único doc)
      const testUserId = (await AsyncStorage.getItem("@userId")) || "testUserId";
      const testLeagueId = (await AsyncStorage.getItem("@leagueId")) || "testLeagueId";
      
      const statsRef = doc(db, `leagues/${testLeagueId}/players/${testUserId}/stats`, "aggregated");
      const snap = await getDoc(statsRef);
      
      if (snap.exists()) {
        console.log(`🔍 Aggregated Stats: 1 leitura`);
        Alert.alert("Teste Stats Agregadas", `Dados encontrados (Leituras: ${readCount}). Confira o console.`);
      } else {
        console.log("🔍 Aggregated Stats: Documento não encontrado.");
        Alert.alert("Teste Stats Agregadas", "Documento não existe.");
      }

      setReads((prev) => ({ ...prev, aggregatedStats: readCount }));
    } catch (error) {
      console.error("❌ Erro no teste Stats Agregadas:", error);
      Alert.alert("Erro", "Teste Stats Agregadas falhou");
    }
  }

  // Teste 4: Busca de dados de Rival (índice em stats/rival)
  async function testRivalIndex() {
    try {
      let readCount = 1; // Apenas uma leitura esperada (um único doc)
      const testUserId = (await AsyncStorage.getItem("@userId")) || "testUserId";
      const testLeagueId = (await AsyncStorage.getItem("@leagueId")) || "testLeagueId";
      
      const rivalRef = doc(db, `leagues/${testLeagueId}/players/${testUserId}/stats`, "rival");
      const snap = await getDoc(rivalRef);
      
      if (snap.exists()) {
        console.log(`🔍 Rival Data: 1 leitura`);
        Alert.alert("Teste Rival", `Dados de rival encontrados (Leituras: ${readCount}). Confira o console.`);
      } else {
        console.log("🔍 Rival Data: Documento não encontrado.");
        Alert.alert("Teste Rival", "Documento de rival não existe.");
      }

      setReads((prev) => ({ ...prev, rivalStats: readCount }));
    } catch (error) {
      console.error("❌ Erro no teste Rival:", error);
      Alert.alert("Erro", "Teste Rival falhou");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Testar Índices</Text>

      <TouchableOpacity style={styles.button} onPress={testGlobalMatchesIndex}>
        <Text style={styles.buttonText}>Teste Global Matches ({reads.globalMatches} leituras)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={testLeaguesByCityIndex}>
        <Text style={styles.buttonText}>Teste Ligas por Cidade ({reads.leaguesByCity} leituras)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={testAggregatedStatsIndex}>
        <Text style={styles.buttonText}>Teste Stats Agregadas ({reads.aggregatedStats} leituras)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={testRivalIndex}>
        <Text style={styles.buttonText}>Teste Rival ({reads.rivalStats} leituras)</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#1E1E1E",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#E3350D",
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    width: "80%",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
  },
});
