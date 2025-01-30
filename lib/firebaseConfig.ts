import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // 🔥 Apenas `getAuth`
import { getFirestore } from "firebase/firestore";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB26G4HeAJDU8-YgnQ7xzu3ieNTgzvmi3U",
  authDomain: "ygo-app-bc.firebaseapp.com",
  projectId: "ygo-app-bc",
  storageBucket: "ygo-app-bc.firebasestorage.app",
  messagingSenderId: "581066450250",
  appId: "1:581066450250:web:8a462cd2627aaa654f4db3",
};

// Inicializa ou pega o app
const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 🔥 Apenas pegue o auth normalmente
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
