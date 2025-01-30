import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { auth } from "../lib/firebaseConfig"; // 🔥 Importando auth
import { onAuthStateChanged } from "firebase/auth"; 

export default function IndexScreen() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push("/(tabs)/home"); // 🔥 Se tiver user, manda direto pra home
      } else {
        router.push("/(auth)/login"); // 🔥 Se não tiver user, vai pro login
      }
      setIsChecking(false);
    });

    return () => unsubscribe(); // Cleanup do listener
  }, []);

  if (isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return null;
}
