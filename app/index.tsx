// app/index.tsx
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";

export default function IndexScreen() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Exemplo: ver se user está logado c/ AsyncStorage, etc.
    // Se NÃO logado, push("/(auth)/login"). Se logado, push("/(tabs)/home").
    setTimeout(() => {
      router.push("/(auth)/login");
      setIsChecking(false);
    }, 800);
  }, []);

  if (isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return null; // Ja redirecionou
}
