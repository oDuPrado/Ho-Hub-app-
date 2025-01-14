// ChatsScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { auth, db } from "../../lib/firebaseConfig";
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  deleteDoc,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

// Interfaces
interface UserData {
  uid: string;
  name: string;
}

interface ChatItem {
  chatId: string;      // identificador da conversa
  otherUid: string;    // uid do outro
  otherName: string;
  lastMessage: string;
  updatedAt: number;
}

interface Message {
  id: string;          // local ID
  senderUid: string;   // uid de quem enviou
  text: string;
  timestamp: number;
}

// Armazenamos localmente a lista de chats e as mensagens
// @chatsList => ChatItem[]
// @chat_<chatId> => Message[]  (para cada chatId)

export default function ChatsScreen() {
  const { t } = useTranslation();

  const [myUid, setMyUid] = useState("");
  const [myName, setMyName] = useState("Eu");
  const [chats, setChats] = useState<ChatItem[]>([]);

  // Modal para criar/iniciar chat
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [foundUser, setFoundUser] = useState<UserData | null>(null);

  // Modal do chat
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [currentChat, setCurrentChat] = useState<ChatItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) {
      Alert.alert("Erro", "Não logado.");
      return;
    }
    setMyUid(u.uid);

    (async () => {
      // Se tiver "minhaName" local:
      const myStoredName = await AsyncStorage.getItem("@userName");
      if (myStoredName) setMyName(myStoredName);

      await loadChatsFromStorage();
    })();
  }, []);

  // Carrega do local a lista de chats
  async function loadChatsFromStorage() {
    try {
      const str = await AsyncStorage.getItem("@chatsList");
      if (!str) {
        setChats([]);
        return;
      }
      const arr: ChatItem[] = JSON.parse(str);
      setChats(arr);
    } catch (err) {
      console.log("Erro ao ler @chatsList:", err);
    }
  }

  // Salva local
  async function saveChatsToStorage(newChats: ChatItem[]) {
    setChats(newChats);
    await AsyncStorage.setItem("@chatsList", JSON.stringify(newChats));
  }

  // Dado um chatId, carrega mensagens locais
  async function loadMessagesLocal(chatId: string) {
    const key = `@chat_${chatId}`;
    const str = await AsyncStorage.getItem(key);
    if (!str) return [];
    return JSON.parse(str) as Message[];
  }
  async function saveMessagesLocal(chatId: string, newMsgs: Message[]) {
    const key = `@chat_${chatId}`;
    await AsyncStorage.setItem(key, JSON.stringify(newMsgs));
  }

  // Iniciar chat, definindo chatId (ex: uid1 < uid2)
  function generateChatId(uidA: string, uidB: string) {
    return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
  }

  // ================== BUSCAR USUÁRIO NO FIRESTORE POR E-MAIL ==================
  async function handleSearchUser() {
    if (!searchEmail.trim()) {
      Alert.alert("Erro", "Digite um e-mail");
      return;
    }
    try {
      // Exemplo: Se você tem uma coleção "players" ou "users" com campo "email"
      // no Firestore, faça a query:
      // const colRef = collection(db, "users");
      // const q = query(colRef, where("email", "==", searchEmail.trim()));
      // const snap = await getDocs(q);

      // MAS como está sem info, simule que "achou" um user
      if (searchEmail.trim() === "teste@user.com") {
        setFoundUser({
          uid: "uidDeTeste",
          name: "Usuário Teste",
        });
      } else {
        Alert.alert("Não encontrado", "Nenhum usuário com esse email.");
        setFoundUser(null);
      }
    } catch (err) {
      console.log("Erro ao buscar user por email:", err);
      Alert.alert("Erro", "Falha ao buscar usuário.");
    }
  }

  // Criar/iniciar chat (local + sem snapshot nesse momento)
  async function handleCreateChatWithUser() {
    if (!foundUser) return;
    if (foundUser.uid === myUid) {
      Alert.alert("Atenção", "Você não pode conversar consigo mesmo.");
      return;
    }
    const chatId = generateChatId(myUid, foundUser.uid);
    // Verifica se chat já existe
    let existing = chats.find((c) => c.chatId === chatId);
    if (!existing) {
      existing = {
        chatId,
        otherUid: foundUser.uid,
        otherName: foundUser.name,
        lastMessage: "",
        updatedAt: Date.now(),
      };
      const newChats = [...chats, existing];
      await saveChatsToStorage(newChats);
    }
    Alert.alert("Sucesso", "Conversa iniciada!");
    setSearchEmail("");
    setFoundUser(null);
    setCreateModalVisible(false);
    // poderia abrir o chat em seguida se quiser
  }

  // ================== ABRIR CHAT (carrega msgs + snapshot real-time) ==================
  let unsubscribe: any;
  async function openChat(item: ChatItem) {
    setCurrentChat(item);
    // Carrega msgs do local
    const localMsgs = await loadMessagesLocal(item.chatId);
    setMessages(localMsgs);

    setChatModalVisible(true);
    // Ativa snapshot do Firestore
    const colRef = collection(db, "chats", item.chatId, "messages");
    const q = query(colRef, orderBy("timestamp", "asc"));

    unsubscribe = onSnapshot(q, async (snap) => {
      if (snap.empty) return;
      let changed: boolean = false;
      // Para cada doc, adicionamos local e deletamos do Firestore
      for (const docChange of snap.docChanges()) {
        if (docChange.type === "added") {
          const data = docChange.doc.data();
          const newMsg: Message = {
            id: docChange.doc.id,
            senderUid: data.senderUid,
            text: data.text,
            timestamp: data.timestamp,
          };
          // Salva local
          localMsgs.push(newMsg);
          changed = true;
          // Apaga do Firestore
          await deleteDoc(docChange.doc.ref);
        }
      }
      if (changed) {
        localMsgs.sort((a, b) => a.timestamp - b.timestamp);
        setMessages([...localMsgs]);
        await saveMessagesLocal(item.chatId, localMsgs);
      }
    });
  }

  function closeChatModal() {
    setChatModalVisible(false);
    setCurrentChat(null);
    setMessages([]);
    setInputText("");
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  // ================== handleSend (envia pro Firestore) ==================
  async function handleSend() {
    if (!currentChat) return;
    const text = inputText.trim();
    if (!text) return;
    setInputText("");

    // Cria doc no Firestore: /chats/chatId/messages
    const chatId = currentChat.chatId;
    try {
      const colRef = collection(db, "chats", chatId, "messages");
      await addDoc(colRef, {
        senderUid: myUid,
        text,
        timestamp: Date.now(),
      });
      // Atualiza lastMessage local
      const updatedAt = Date.now();
      const newChats = chats.map((c) => {
        if (c.chatId === chatId) {
          return {
            ...c,
            lastMessage: text,
            updatedAt,
          };
        }
        return c;
      });
      newChats.sort((a, b) => b.updatedAt - a.updatedAt);
      await saveChatsToStorage(newChats);
      setChats(newChats);
    } catch (err) {
      console.log("Erro ao enviar msg:", err);
    }
  }

  // ================== Excluir Chat (local + sem firebase) ==================
  async function handleDeleteChat(item: ChatItem) {
    Alert.alert(
      "Excluir Conversa",
      `Deseja excluir a conversa com ${item.otherName}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            // remove do local
            const newList = chats.filter((c) => c.chatId !== item.chatId);
            await saveChatsToStorage(newList);
            // remove msgs local
            await AsyncStorage.removeItem(`@chat_${item.chatId}`);
            Alert.alert("Sucesso", "Conversa excluída localmente.");
            // Fechar modal se é a conversa atual
            if (currentChat && currentChat.chatId === item.chatId) {
              closeChatModal();
            }
          },
        },
      ]
    );
  }

  // ================== Render ==================
  function renderChatItem({ item }: { item: ChatItem }) {
    return (
      <View style={styles.chatItem}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => openChat(item)}>
          <Text style={styles.chatName}>{item.otherName}</Text>
          <Text style={styles.chatLastMsg}>Última: {item.lastMessage || "..."}</Text>
        </TouchableOpacity>
        {/* Botão excluir */}
        <TouchableOpacity onPress={() => handleDeleteChat(item)}>
          <Text style={styles.deleteChatText}>X</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Chats</Text>

      {/* Botão criar/iniciar chat */}
      <TouchableOpacity
        style={styles.startChatButton}
        onPress={() => setCreateModalVisible(true)}
      >
        <Text style={styles.startChatButtonText}>Iniciar Chat</Text>
      </TouchableOpacity>

      <FlatList
        data={chats}
        keyExtractor={(item) => item.chatId}
        renderItem={renderChatItem}
        style={{ flex: 1 }}
      />

      {/* Modal de criar chat */}
      <Modal visible={createModalVisible} animationType="slide" transparent>
        <View style={styles.createChatModalContainer}>
          <View style={styles.createChatModalInner}>
            <Text style={styles.modalTitle}>Novo Chat</Text>

            <TextInput
              style={styles.createChatInput}
              placeholder="Digite o email do usuário..."
              placeholderTextColor="#999"
              value={searchEmail}
              onChangeText={setSearchEmail}
            />
            {/* Botão buscar */}
            <TouchableOpacity
              style={[styles.modalBtn, { marginBottom: 10 }]}
              onPress={handleSearchUser}
            >
              <Text style={styles.modalBtnText}>Buscar</Text>
            </TouchableOpacity>

            {foundUser && (
              <Text style={{ color: "#fff", marginBottom: 10 }}>
                Usuário encontrado: {foundUser.name}
              </Text>
            )}

            {/* Botão criar chat */}
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={handleCreateChatWithUser}
            >
              <Text style={styles.modalBtnText}>Iniciar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtn, { marginTop: 10, backgroundColor: "#444" }]}
              onPress={() => {
                setCreateModalVisible(false);
                setSearchEmail("");
                setFoundUser(null);
              }}
            >
              <Text style={styles.modalBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal do chat */}
      <Modal visible={chatModalVisible} animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {currentChat && (
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderTitle}>
                  Conversa com {currentChat.otherName}
                </Text>
                <TouchableOpacity onPress={closeChatModal}>
                  <Text style={styles.closeBtn}>Fechar</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.messagesArea}>
                {messages.length === 0 ? (
                  <Text style={styles.noMessages}>
                    Nenhuma mensagem por aqui...
                  </Text>
                ) : (
                  messages.map((msg) => (
                    <View
                      key={msg.id}
                      style={[
                        styles.msgContainer,
                        msg.senderUid === myUid
                          ? styles.msgRight
                          : styles.msgLeft,
                      ]}
                    >
                      <Text style={styles.msgText}>{msg.text}</Text>
                    </View>
                  ))
                )}
              </ScrollView>

              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="Digite sua mensagem..."
                  placeholderTextColor="#999"
                  value={inputText}
                  onChangeText={setInputText}
                />
                <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
                  <Text style={styles.sendBtnText}>Enviar</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/** Estilos */
const DARK = "#1E1E1E";
const PRIMARY = "#E3350D";
const SECONDARY = "#FFFFFF";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK,
    padding: 16,
  },
  header: {
    color: PRIMARY,
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 10,
  },
  startChatButton: {
    backgroundColor: PRIMARY,
    padding: 10,
    borderRadius: 6,
    alignItems: "center",
    marginBottom: 12,
  },
  startChatButtonText: {
    color: SECONDARY,
    fontWeight: "bold",
  },
  chatItem: {
    backgroundColor: "#292929",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatName: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  chatLastMsg: {
    color: "#CCC",
    marginTop: 4,
  },
  deleteChatText: {
    color: "#E3350D",
    fontWeight: "bold",
    fontSize: 16,
  },
  createChatModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  createChatModalInner: {
    width: "80%",
    backgroundColor: DARK,
    padding: 16,
    borderRadius: 10,
  },
  modalTitle: {
    color: PRIMARY,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  createChatInput: {
    backgroundColor: "#444",
    color: "#FFF",
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
  modalBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 6,
    padding: 10,
    alignItems: "center",
  },
  modalBtnText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: DARK,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#292929",
    padding: 12,
  },
  modalHeaderTitle: {
    color: PRIMARY,
    fontSize: 18,
    fontWeight: "bold",
  },
  closeBtn: {
    color: "#FFF",
    fontSize: 16,
  },
  messagesArea: {
    flex: 1,
    padding: 12,
  },
  noMessages: {
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 20,
  },
  msgContainer: {
    padding: 8,
    borderRadius: 6,
    marginVertical: 4,
    maxWidth: "75%",
  },
  msgRight: {
    backgroundColor: "#444",
    alignSelf: "flex-end",
  },
  msgLeft: {
    backgroundColor: "#333",
    alignSelf: "flex-start",
  },
  msgText: {
    color: "#FFF",
  },
  inputRow: {
    flexDirection: "row",
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  input: {
    flex: 1,
    backgroundColor: "#444",
    color: "#FFF",
    padding: 10,
    borderRadius: 6,
    marginRight: 8,
  },
  sendBtn: {
    backgroundColor: PRIMARY,
    padding: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  sendBtnText: {
    color: "#FFF",
    fontWeight: "bold",
  },
});
