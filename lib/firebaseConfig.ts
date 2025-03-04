// lib/firebaseConfig.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA7uZ4Xv8eUobgC7utWv96Xl8xlBbMhDT8",
  authDomain: "ho-hub-sistemas.firebaseapp.com",
  projectId: "ho-hub-sistemas",
  storageBucket: "ho-hub-sistemas.firebasestorage.app",
  messagingSenderId: "693678213161",
  appId: "1:693678213161:web:b530ae644012c5e12b7438",
  measurementId: "G-291DFCHGMB"
};

// Inicializa o Firebase App
let firebaseApp;
if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApp();
}

// Configura Auth (sem React Native Persistence)
export const auth = getAuth(firebaseApp);

// Configura Firestore
export const db = getFirestore(firebaseApp);
