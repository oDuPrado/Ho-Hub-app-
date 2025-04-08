import React, { useEffect, useState, useRef } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// (Opcional) se quiser conferir se roda no Expo web ou RN web
// import { Platform } from "react-native";
// import { isWeb } from "../lib/utils"; // se tiver um helper

// Nome da chave no Storage
const BACKUP_KEY = "@myAppBackup";

// Aqui você define a interface do que será salvo (por ex. binders, user, etc)
interface BackupData {
  userId: string;
  binders: any[];
  // ...outros dados que queira salvar...
}

/**
 * Este hook/componente cuida de fazer backup local (AsyncStorage no mobile e localStorage no web).
 * Você pode usá-lo no RootLayout ou em um Provider global.
 */
export default function useBackupManager(dataParaBackup: BackupData) {
  // Estados para controle
  const [restoredData, setRestoredData] = useState<BackupData | null>(null);
  const firstLoadRef = useRef(true);

  /**
   * Carrega backup na primeira vez que o componente monta.
   * Se houver dados no backup e seu estado local estiver "vazio",
   * você pode decidir restaurar.
   */
  useEffect(() => {
    (async () => {
      try {
        const localBackup = await readBackup();
        if (localBackup) {
          console.log("Backup existente encontrado:", localBackup);
          setRestoredData(localBackup);
          // Se quiser, você pode disparar alguma função do seu app 
          // para mesclar ou restaurar esse localBackup nos states.
        } else {
          console.log("Nenhum backup local encontrado.");
        }
      } catch (err) {
        console.log("Erro ao tentar ler backup inicial:", err);
      }
    })();
  }, []);

  /**
   * Sempre que `dataParaBackup` mudar, executamos um backup novo.
   * (depende do que você quiser: Se preferir interval, basta trocar.)
   */
  useEffect(() => {
    if (!firstLoadRef.current) {
      console.log("Atualizando backup...");
      writeBackup(dataParaBackup);
    } else {
      firstLoadRef.current = false;
    }
  }, [dataParaBackup]);

  /**
   * Lê backup (AsyncStorage ou localStorage).
   */
  async function readBackup(): Promise<BackupData | null> {
    try {
      if (Platform.OS === "web") {
        // WEB => localStorage
        const str = window.localStorage.getItem(BACKUP_KEY);
        return str ? JSON.parse(str) : null;
      } else {
        // MOBILE => AsyncStorage
        const str = await AsyncStorage.getItem(BACKUP_KEY);
        return str ? JSON.parse(str) : null;
      }
    } catch (err) {
      console.log("Erro no readBackup:", err);
      return null;
    }
  }

  /**
   * Escreve backup (AsyncStorage ou localStorage).
   */
  async function writeBackup(data: BackupData): Promise<void> {
    try {
      const str = JSON.stringify(data);
      if (Platform.OS === "web") {
        window.localStorage.setItem(BACKUP_KEY, str);
      } else {
        await AsyncStorage.setItem(BACKUP_KEY, str);
      }
      console.log("Backup atualizado com sucesso!");
    } catch (err) {
      console.log("Erro no writeBackup:", err);
    }
  }

  // Retorna dados e funções, caso queira usar fora
  return {
    restoredData,
    writeBackup,
    readBackup,
  };
}
