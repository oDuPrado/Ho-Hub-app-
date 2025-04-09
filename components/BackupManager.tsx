import React, { useState, useEffect, useRef } from "react";
import { Platform, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Para mobile (Android e iOS) usamos expo-file-system, expo-sharing e expo-document-picker
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import type { MinimalCardData } from "../app/(tabs)/Colecao"; // ajusta o caminho se estiver em outro lugar

// Precisamos de alguma forma de gerar UUID. Se estiver usando "uuid" no seu projeto, importe assim:
//   1) Instale: npm install uuid
//   2) Importe:
import { v4 as uuidv4 } from "uuid";

// Nome da chave de backup
const BACKUP_KEY = "@myAppBackup";

// Interface para cada Binder (coloque os campos que seu app realmente usa)
export interface BackupBinder {
  id: string;
  name: string;
  binderType: string; // ← adiciona aqui
  createdAt: number;
  reference?: string;
  allCards: MinimalCardData[];
  quantityMap: Record<string, number>;
  lastUpdatedAt: string;
}

// Interface com os dados que você quer salvar em backup.
export interface BackupData {
  userId: string;
  binders: BackupBinder[];
  // ... outros dados que deseje incluir no backup.
}

/**
 * Este hook gerencia o backup local (AsyncStorage ou localStorage) e export/import (arquivo JSON).
 * Agora também gera IDs únicos e armazena lastUpdatedAt para cada Binder, e faz merge inteligente.
 */
export default function useBackupManager(dataParaBackup: BackupData) {
  const [restoredData, setRestoredData] = useState<BackupData | null>(null);
  const firstLoadRef = useRef(true);

  /**
   * Lê o backup local (AsyncStorage mobile ou localStorage Web).
   */
  async function readBackup(): Promise<BackupData | null> {
    try {
      if (Platform.OS === "web") {
        const str = window.localStorage.getItem(BACKUP_KEY);
        return str ? JSON.parse(str) : null;
      } else {
        const str = await AsyncStorage.getItem(BACKUP_KEY);
        return str ? JSON.parse(str) : null;
      }
    } catch (err) {
      console.log("Erro no readBackup:", err);
      return null;
    }
  }

  /**
   * Garantir que cada binder possua um ID e lastUpdatedAt.
   * - Se não tiver ID, gera um.
   * - Atualiza o lastUpdatedAt sempre que mexer.
   */
  function ensureBinderIdsAndTimestamps(
    binders: BackupBinder[]
  ): BackupBinder[] {
    return binders.map((binder) => {
      const updatedBinder = { ...binder };

      // Se o binder não possuir um id, gera um novo UUID
      if (!updatedBinder.id) {
        updatedBinder.id = uuidv4();
      }

      // Atualiza o campo lastUpdatedAt para refletir a data/hora atual
      updatedBinder.lastUpdatedAt = new Date().toISOString();

      return updatedBinder;
    });
  }

  /**
   * Grava (salva) os dados de backup no localStorage ou AsyncStorage.
   * Antes de salvar, garante que cada binder tenha ID único e lastUpdatedAt atual.
   */
  async function writeBackup(data: BackupData): Promise<void> {
    try {
      // Garante ID + timestamp para cada binder
      const bindersWithIds = ensureBinderIdsAndTimestamps(data.binders);
      const dataToSave: BackupData = {
        ...data,
        binders: bindersWithIds,
      };

      const str = JSON.stringify(dataToSave);
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

  /**
   * Exporta o backup para um arquivo JSON.
   * - No Web, simula um "download" do arquivo.
   * - No Mobile, grava no diretório de documentos e usa Sharing para exportar.
   */
  async function exportBackup() {
    try {
      const backupData = await readBackup();
      if (!backupData) {
        Alert.alert("Backup", "Nenhum backup encontrado para exportar.");
        return;
      }
      const backupStr = JSON.stringify(backupData, null, 2);

      if (Platform.OS === "web") {
        // Web: cria Blob e simula download
        const blob = new Blob([backupStr], { type: "application/json" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "backup.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        // Mobile: salva arquivo e usa Sharing
        const fileUri = FileSystem.documentDirectory + "backup.json";
        await FileSystem.writeAsStringAsync(fileUri, backupStr, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert(
            "Compartilhamento",
            "O compartilhamento não está disponível neste dispositivo."
          );
        }
      }
    } catch (err) {
      console.log("Erro ao exportar backup:", err);
      Alert.alert("Erro", "Não foi possível exportar o backup.");
    }
  }

  /**
   * Merge inteligente dos binders, unindo dados do local e do importado.
   * Critério:
   * - Se algum binder tiver mesmo ID, compara lastUpdatedAt:
   *   - Se o importado for mais recente, substitui o local.
   *   - Senão, mantém o local.
   * - Se o binder importado não tiver ID ou for novo, gera ID e adiciona.
   */
  function mergeBinders(
    localBinders: BackupBinder[],
    importedBinders: BackupBinder[]
  ): BackupBinder[] {
    // Cria um dicionário local por ID para facilitar comparação
    const localMap = new Map<string, BackupBinder>();
    for (const binder of localBinders) {
      localMap.set(binder.id, binder);
    }

    for (const imported of importedBinders) {
      let importedId = imported.id;
      // Se não tiver ID, gera (outra forma seria gerar antes, mas deixamos aqui pra garantir)
      if (!importedId) {
        importedId = uuidv4();
        imported.id = importedId;
      }

      // Se a ID existe local, comparar lastUpdatedAt
      if (localMap.has(importedId)) {
        const localBinder = localMap.get(importedId);
        if (!localBinder) continue;

        // Verifica qual é mais recente
        const localUpdated = new Date(localBinder.lastUpdatedAt).getTime();
        const importedUpdated = new Date(imported.lastUpdatedAt).getTime();

        // Se o importado for mais recente, substitui
        if (importedUpdated > localUpdated) {
          localMap.set(importedId, { ...imported });
        }
      } else {
        // Se não existe no local, adiciona
        localMap.set(importedId, { ...imported });
      }
    }

    // Retorna lista unificada
    return Array.from(localMap.values());
  }

  /**
   * Importa backup de um arquivo JSON (selecionado via DocumentPicker), faz merge e salva local.
   */
  async function importBackup() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const fileUri = file.uri;

        let backupStr = "";

        if (Platform.OS === "web") {
          backupStr = await (await fetch(fileUri)).text();
        } else {
          backupStr = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.UTF8,
          });
        }

        const importedData: BackupData = JSON.parse(backupStr);

        // Lê o backup local
        const localBackup: BackupData = dataParaBackup;

        // Se não existir backup local, salva diretamente o importado (com ID e timestamp assegurados)
        if (!localBackup) {
          await writeBackup(importedData);
          setRestoredData(importedData);
          Alert.alert("Sucesso", "Backup importado com sucesso!");
          return;
        }

        // Faz merge dos binders
        const mergedBinders = mergeBinders(
          localBackup.binders,
          importedData.binders
        );

        // Monta o objeto final
        const mergedData: BackupData = {
          // Pega o userId local ou do importado, escolha de design. Aqui priorizo local, se existir
          userId: localBackup.userId || importedData.userId,
          binders: mergedBinders,
        };

        // Salva no storage
        await writeBackup(mergedData);
        setRestoredData(mergedData);

        Alert.alert("Sucesso", "Backup mesclado e importado com sucesso!");
      }
    } catch (err) {
      console.log("Erro ao importar backup:", err);
      Alert.alert("Erro", "Não foi possível importar o backup.");
    }
  }

  // Carrega o backup na primeira montagem do componente
  useEffect(() => {
    (async () => {
      try {
        const localBackup = await readBackup();
        if (localBackup) {
          console.log("Backup existente encontrado:", localBackup);
          setRestoredData(localBackup);
        } else {
          console.log("Nenhum backup local encontrado.");
        }
      } catch (err) {
        console.log("Erro ao tentar ler backup inicial:", err);
      }
    })();
  }, []);

  // Sempre que dataParaBackup mudar, atualiza automaticamente (exceto no primeiro load)
  useEffect(() => {
    if (!firstLoadRef.current) {
      console.log("Atualizando backup...");
      writeBackup(dataParaBackup);
    } else {
      firstLoadRef.current = false;
    }
  }, [dataParaBackup]);

  /**
   * Gera um arquivo JSON de backup no sistema de arquivos, sem compartilhar.
   * Retorna o caminho do arquivo.
   */
  async function generateBackupFile(): Promise<string | null> {
    try {
      const backupData = await readBackup();
      if (!backupData) {
        Alert.alert("Backup", "Nenhum backup encontrado.");
        return null;
      }

      const backupStr = JSON.stringify(backupData, null, 2);
      const fileUri = FileSystem.documentDirectory + "backup-sync.json";

      await FileSystem.writeAsStringAsync(fileUri, backupStr, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      console.log("Arquivo de backup salvo em:", fileUri);
      //Alert.alert("Backup", `Arquivo salvo em:\n${fileUri}`);
      return fileUri;
    } catch (err) {
      console.log("Erro ao gerar backup:", err);
      //Alert.alert("Erro", "Falha ao gerar o arquivo de backup.");
      return null;
    }
  }

  /**
   * Lê um arquivo fixo de backup (backup-sync.json), faz merge e salva local.
   */
  async function readBackupFromFile(): Promise<void> {
    try {
      const fileUri = FileSystem.documentDirectory + "backup-sync.json";

      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        console.log("Arquivo de backup-sync.json não encontrado.");
        return;
      }

      const backupStr = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const importedData: BackupData = JSON.parse(backupStr);

      const localBackup: BackupData = dataParaBackup;

      if (!localBackup) {
        await writeBackup(importedData);
        setRestoredData(importedData);
        Alert.alert("Backup", "Backup lido do arquivo e salvo com sucesso.");
        return;
      }

      const mergedBinders = mergeBinders(
        localBackup.binders,
        importedData.binders
      );

      const mergedData: BackupData = {
        userId: localBackup.userId || importedData.userId,
        binders: mergedBinders,
      };

      await writeBackup(mergedData);
      setRestoredData(mergedData);

      Alert.alert("Backup", "Sincronização com arquivo concluída!");
    } catch (err) {
      console.log("Erro ao ler arquivo de backup:", err);
      Alert.alert("Erro", "Falha ao ler o arquivo de backup.");
    }
  }
  async function syncBackup(): Promise<BackupBinder[] | null> {
    try {
      const fileUri = FileSystem.documentDirectory + "backup-sync.json";

      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        console.log("Arquivo de backup-sync.json não encontrado.");
        Alert.alert(
          "Backup",
          "Nenhum arquivo de backup encontrado para sincronizar."
        );
        return null;
      }

      const backupStr = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const fileData: BackupData = JSON.parse(backupStr);

      const asyncStr = await AsyncStorage.getItem(BACKUP_KEY);
      const asyncData: BackupData = asyncStr
        ? JSON.parse(asyncStr)
        : { userId: "localUser", binders: [] };

      // FORÇA os binders do app com um lastUpdatedAt novo (agora)
      const bindersWithNow = asyncData.binders.map((b) => ({
        ...b,
        lastUpdatedAt: new Date().toISOString(),
      }));

      const mergedBinders = mergeBinders(bindersWithNow, fileData.binders);

      const mergedData: BackupData = {
        userId: asyncData.userId || fileData.userId || "localUser",
        binders: mergedBinders,
      };

      // Salva no AsyncStorage
      await writeBackup(mergedData);

      // Atualiza o arquivo físico
      const newBackupStr = JSON.stringify(mergedData, null, 2);
      await FileSystem.writeAsStringAsync(fileUri, newBackupStr, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      setRestoredData(mergedData);
      Alert.alert("Backup", "Sincronização concluída com sucesso!");
      console.log("Sincronização concluída com sucesso!");

      return mergedBinders; // ← agora sim!
    } catch (err) {
      console.log("Erro durante syncBackup:", err);
      Alert.alert("Erro", "Falha ao sincronizar o backup.");
      return null; // em caso de erro
    }
  }

  async function getBindersFromBackupFile(): Promise<BackupBinder[] | null> {
    try {
      const fileUri = FileSystem.documentDirectory + "backup-sync.json";
      const fileInfo = await FileSystem.getInfoAsync(fileUri);

      if (!fileInfo.exists) {
        console.log("Arquivo não encontrado.");
        return null;
      }

      const str = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const data: BackupData = JSON.parse(str);
      return data.binders || [];
    } catch (err) {
      console.log("Erro ao ler binders do backup:", err);
      return null;
    }
  }

  return {
    restoredData, // Dados restaurados do local ou do import
    readBackup, // Função para ler manualmente (se necessário)
    writeBackup, // Função para salvar/atualizar manualmente (se quiser)
    exportBackup, // Função para exportar arquivo JSON
    importBackup, // Função para importar arquivo JSON + merge
    generateBackupFile, // Função para gerar arquivo JSON de backup sem compartilhar
    readBackupFromFile, // Função para ler arquivo fixo de backup e fazer merge
    syncBackup, // Função para sincronizar backup entre AsyncStorage e arquivo fixo
    getBindersFromBackupFile, // Função para obter binders do arquivo fixo de backup
  };
}
