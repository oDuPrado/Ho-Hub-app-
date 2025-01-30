import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage"; // ✅ Importando o AsyncStorage
import { auth } from "../lib/firebaseConfig"; // ✅ Importando o Firebase auth

export default function IndexScreen() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stay = await AsyncStorage.getItem("@stayLogged");
        
        if (stay === "true" && auth.currentUser) {
          // ✅ Se o usuário está logado e optou por "manter conectado", vai direto pro home
          router.push("/(tabs)/home");
        } else {
          // ✅ Se não, redireciona para a tela de login
          router.push("/(auth)/login");
        }
      } catch (error) {
        console.error("Erro ao verificar autenticação:", error);
        router.push("/(auth)/login"); // ✅ Caso ocorra erro, manda pro login para evitar loop
      } finally {
        setIsChecking(false);
      }
    })();
  }, []);

  if (isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return null; // ✅ Como já redirecionamos, não precisa retornar nada
}
