//////////////////////////////////////
// ARQUIVO: Cadastros.tsx
//////////////////////////////////////
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Keyboard,
  TouchableWithoutFeedback,
  FlatList,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../lib/firebaseConfig";

import {
  Authuser,
  fetchRoleMembers,
  addRoleMember,
  removeRoleMember,
} from "../hosts";

////////////////////////////////////////////////////////////////////////////////
// PALETA DE CORES
////////////////////////////////////////////////////////////////////////////////
const RED = "#E3350D";
const BLACK = "#1E1E1E";
const DARK_GRAY = "#292929";
const WHITE = "#FFFFFF";

////////////////////////////////////////////////////////////////////////////////
// INTERFACES
////////////////////////////////////////////////////////////////////////////////
interface PlayerData {
  userid: string;
  fullname?: string;
  birthdate?: string;
  pin?: string;
}

interface LoginData {
  loginId: string;
  name?: string;
  email?: string;
  pin?: string;
  playerId?: string;
  createdAt?: string;
}

interface LeagueData {
  leagueId: string;
  leagueName: string;
  city: string;
  playersCount: number;
  tournamentsCount: number;
}

// === 3) Roles => sub-roles com players
interface RoleMember {
  userId: string;
  fullname: string;
}

////////////////////////////////////////////////////////////////////////////////
// COMPONENTE PRINCIPAL
////////////////////////////////////////////////////////////////////////////////
export default function CadastrosScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  // ABAS: "players" | "logins" | "roles"
  const [currentTab, setCurrentTab] = useState<"players"|"logins"|"roles">("players");

  // Permissão de ver logins/roles
  const [canSeeLogins, setCanSeeLogins] = useState(false);

  // =========== PESQUISA (para cada aba) ===========
  const [searchTerm, setSearchTerm] = useState("");

  // =========== PLAYERS ===========
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);

  // Modal player
  const [playerModalVisible, setPlayerModalVisible] = useState(false);
  const [isEditingPlayer, setIsEditingPlayer] = useState(false);
  const [formUserid, setFormUserid] = useState("");
  const [formFullname, setFormFullname] = useState("");
  const [formBirthdate, setFormBirthdate] = useState("");
  const [formPin, setFormPin] = useState("");

  // =========== LOGINS ===========
  const [logins, setLogins] = useState<LoginData[]>([]);
  const [loginsLoading, setLoginsLoading] = useState(false);

  // Modal login
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [isEditingLogin, setIsEditingLogin] = useState(false);
  const [formLoginId, setFormLoginId] = useState("");
  const [formLoginName, setFormLoginName] = useState("");
  const [formLoginEmail, setFormLoginEmail] = useState("");
  const [formLoginPin, setFormLoginPin] = useState("");
  const [formLoginPlayerId, setFormLoginPlayerId] = useState("");
  const [formLoginCreatedAt, setFormLoginCreatedAt] = useState("");

  // =========== ROLES (3ª Aba) ===========
  const [leagues, setLeagues] = useState<LeagueData[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesSearch, setRolesSearch] = useState("");

  // Modal FULLSCREEN p/ gerenciar roles de 1 Liga
  const [rolesModalVisible, setRolesModalVisible] = useState(false);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [selectedLeagueName, setSelectedLeagueName] = useState("");

  // Sub-aba: "host", "judge", "head", "ban", "vip"
  const [currentRoleTab, setCurrentRoleTab] = useState<"host"|"judge"|"head"|"ban"|"vip">("host");

  // Cada lista
  const [hostList, setHostList] = useState<RoleMember[]>([]);
  const [judgeList, setJudgeList] = useState<RoleMember[]>([]);
  const [headList, setHeadList] = useState<RoleMember[]>([]);
  const [banList, setBanList] = useState<RoleMember[]>([]);
  const [vipList, setVipList] = useState<RoleMember[]>([]);

  // =========== MODAL DE SELEÇÃO DE JOGADORES PARA ADICIONAR ===========
  const [selectModalVisible, setSelectModalVisible] = useState(false);
  const [selectPlayers, setSelectPlayers] = useState<PlayerData[]>([]);
  const [selectSearch, setSelectSearch] = useState("");
  const [selectLoading, setSelectLoading] = useState(false);

  // Qual role estamos adicionando?
  const [addingRole, setAddingRole] = useState<"host"|"judge"|"head"|"ban"|"vip">("host");

  // ================ useEffect inicial =================
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const storedId = await AsyncStorage.getItem("@userId");
        if (!storedId) {
          router.replace("/(auth)/login");
          return;
        }
        setUserId(storedId);
        const canLogins = Authuser.includes(storedId);
        setCanSeeLogins(canLogins);

        await loadTabData();
      } catch (error) {
        Alert.alert("Erro", "Falha ao carregar cadastros.");
      } finally {
        setLoading(false);
      }
    })();
  }, [currentTab, router]);

  // ================ Carregar ao trocar de aba =================
  async function loadTabData() {
    if (currentTab === "players") {
      await fetchPlayers();
    } else if (currentTab === "logins" && canSeeLogins) {
      await fetchLogins();
    } else if (currentTab === "roles" && canSeeLogins) {
      await fetchLeagues();
    }
  }

  // =================== FUNÇÃO TROCAR ABA =====================
  function switchTab(tab: "players"|"logins"|"roles") {
    setCurrentTab(tab);
    setSearchTerm("");
    setRolesSearch("");
  }

  // ================ PLAYERS ================
  async function fetchPlayers() {
    try {
      setPlayersLoading(true);
      const filterType = await AsyncStorage.getItem("@filterType");
      const cityStored = await AsyncStorage.getItem("@selectedCity");
      const leagueStored = await AsyncStorage.getItem("@leagueId");

      let leagueIds: string[] = [];

      if (!filterType || filterType === "all") {
        const leaguesSnap = await getDocs(collection(db, "leagues"));
        leaguesSnap.forEach((ds) => leagueIds.push(ds.id));
      } else if (filterType === "city" && cityStored) {
        const qCity = query(collection(db, "leagues"), where("city", "==", cityStored));
        const snapC = await getDocs(qCity);
        snapC.forEach((ds) => leagueIds.push(ds.id));
      } else if (filterType === "league" && leagueStored) {
        leagueIds.push(leagueStored);
      }

      let allPlayers: PlayerData[] = [];
      const term = searchTerm.toLowerCase();

      for (const lid of leagueIds) {
        const pRef = collection(db, `leagues/${lid}/players`);
        const pSnap = await getDocs(pRef);
        pSnap.forEach((docSnap) => {
          const pd = docSnap.data() as PlayerData;
          if (
            !term ||
            pd.fullname?.toLowerCase().includes(term) ||
            pd.userid?.toLowerCase().includes(term)
          ) {
            allPlayers.push(pd);
          }
        });
      }

      // Remove duplicados
      const seen = new Set();
      const unique = allPlayers.filter((p) => {
        if (seen.has(p.userid)) return false;
        seen.add(p.userid);
        return true;
      });
      setPlayers(unique);
    } catch (error) {
      console.log("Erro fetchPlayers:", error);
      Alert.alert("Erro", "Não foi possível carregar jogadores.");
    } finally {
      setPlayersLoading(false);
    }
  }

  function openCreatePlayerModal() {
    setIsEditingPlayer(false);
    setFormUserid("");
    setFormFullname("");
    setFormBirthdate("");
    setFormPin("");
    setPlayerModalVisible(true);
  }

  function openEditPlayerModal(item: PlayerData) {
    setIsEditingPlayer(true);
    setFormUserid(item.userid || "");
    setFormFullname(item.fullname || "");
    setFormBirthdate(item.birthdate || "");
    setFormPin(item.pin || "");
    setPlayerModalVisible(true);
  }

  async function handleSavePlayer() {
    try {
      if (!formUserid) {
        Alert.alert("Atenção", "UserID é obrigatório!");
        return;
      }
      const filterType = await AsyncStorage.getItem("@filterType");
      const leagueStored = await AsyncStorage.getItem("@leagueId");
      if (filterType === "league" && leagueStored) {
        const docRef = doc(db, `leagues/${leagueStored}/players`, formUserid);
        await setDoc(
          docRef,
          {
            userid: formUserid,
            fullname: formFullname,
            birthdate: formBirthdate,
            pin: formPin,
          },
          { merge: true }
        );
        Alert.alert("Sucesso", isEditingPlayer ? "Jogador atualizado!" : "Jogador criado!");
        setPlayerModalVisible(false);
        await fetchPlayers();
      } else {
        Alert.alert("Filtro inválido", "Crie jogador apenas com liga específica selecionada.");
      }
    } catch (error) {
      console.log("Erro handleSavePlayer:", error);
      Alert.alert("Erro", "Não foi possível salvar jogador.");
    }
  }

  async function handleDeletePlayer(item: PlayerData) {
    Alert.alert(
      "Confirmação",
      `Excluir jogador ${item.fullname || item.userid}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              const leagueId = await AsyncStorage.getItem("@leagueId");
              if (!leagueId) {
                Alert.alert("Erro", "Nenhuma liga selecionada.");
                return;
              }
              const docRef = doc(db, `leagues/${leagueId}/players`, item.userid);
              await deleteDoc(docRef);
              Alert.alert("Sucesso", "Jogador excluído!");
              await fetchPlayers();
            } catch (error) {
              console.log("Erro ao excluir:", error);
              Alert.alert("Erro", "Não foi possível excluir jogador.");
            }
          },
        },
      ]
    );
  }

  // ================ LOGINS ================
  async function fetchLogins() {
    try {
      setLoginsLoading(true);
      const snap = await getDocs(collection(db, "login"));
      const arr: LoginData[] = [];
      const term = searchTerm.toLowerCase();
      snap.forEach((ds) => {
        const ld = ds.data() as LoginData;
        if (
          !term ||
          ld.name?.toLowerCase().includes(term) ||
          ld.email?.toLowerCase().includes(term) ||
          ld.playerId?.toLowerCase().includes(term)
        ) {
          arr.push({
            ...ld,
            loginId: ds.id,
          });
        }
      });
      setLogins(arr);
    } catch (error) {
      console.log("Erro fetchLogins:", error);
      Alert.alert("Erro", "Não foi possível carregar logins.");
    } finally {
      setLoginsLoading(false);
    }
  }

  function openCreateLoginModal() {
    setIsEditingLogin(false);
    setFormLoginId("");
    setFormLoginName("");
    setFormLoginEmail("");
    setFormLoginPin("");
    setFormLoginPlayerId("");
    setFormLoginCreatedAt("");
    setLoginModalVisible(true);
  }

  function openEditLoginModal(item: LoginData) {
    setIsEditingLogin(true);
    setFormLoginId(item.loginId);
    setFormLoginName(item.name || "");
    setFormLoginEmail(item.email || "");
    setFormLoginPin(item.pin || "");
    setFormLoginPlayerId(item.playerId || "");
    if (item.createdAt) {
      try {
        const d = new Date(item.createdAt);
        const dia = String(d.getDate()).padStart(2, "0");
        const mes = String(d.getMonth() + 1).padStart(2, "0");
        const ano = d.getFullYear();
        setFormLoginCreatedAt(`${dia}/${mes}/${ano}`);
      } catch {
        setFormLoginCreatedAt("");
      }
    } else {
      setFormLoginCreatedAt("");
    }
    setLoginModalVisible(true);
  }

  async function handleSaveLogin() {
    try {
      if (!formLoginId) {
        Alert.alert("Atenção", "LoginID é obrigatório!");
        return;
      }
      let rawDate = "";
      if (formLoginCreatedAt) {
        const [dd, mm, yyyy] = formLoginCreatedAt.split("/");
        if (dd && mm && yyyy) {
          const ddDate = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
          rawDate = ddDate.toISOString();
        }
      }
      const docRef = doc(db, "login", formLoginId);
      await setDoc(
        docRef,
        {
          name: formLoginName,
          email: formLoginEmail,
          pin: formLoginPin,
          playerId: formLoginPlayerId,
          createdAt: rawDate || new Date().toISOString(),
        },
        { merge: true }
      );
      Alert.alert("Sucesso", isEditingLogin ? "Login atualizado!" : "Novo login criado!");
      setLoginModalVisible(false);
      await fetchLogins();
    } catch (error) {
      console.log("Erro handleSaveLogin:", error);
      Alert.alert("Erro", "Não foi possível salvar login.");
    }
  }

  async function handleDeleteLogin(item: LoginData) {
    Alert.alert(
      "Confirmação",
      `Excluir login ${item.name || item.loginId}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              const docRef = doc(db, "login", item.loginId);
              await deleteDoc(docRef);
              Alert.alert("Sucesso", "Login excluído!");
              await fetchLogins();
            } catch (err) {
              console.log("Erro delete login:", err);
              Alert.alert("Erro", "Não foi possível excluir login.");
            }
          },
        },
      ]
    );
  }

  // ================ ROLES ================
  const [leagueList, setLeagueList] = useState<LeagueData[]>([]);
  async function fetchLeagues() {
    try {
      setRolesLoading(true);
      const leaguesSnap = await getDocs(collection(db, "leagues"));
      let arr: LeagueData[] = [];
      const term = rolesSearch.toLowerCase();
  
      console.log("Total de ligas encontradas:", leaguesSnap.size);
  
      leaguesSnap.forEach((docSnap) => {
        const ld = docSnap.data();
        const leagueId = docSnap.id;
        const city = ld.city || "SemCidade";
        const leagueName = ld.leagueName || leagueId;
        const playersCount = ld.players_count || 0;
        const tournamentsCount = ld.tournaments_count || 0;
  
        // Log para depuração
        console.log(`Liga ${leagueId}: ${leagueName} - ${city}`);
  
        if (
          !term ||
          city.toLowerCase().includes(term) ||
          leagueName.toLowerCase().includes(term)
        ) {
          arr.push({
            leagueId,
            leagueName,
            city,
            playersCount,
            tournamentsCount,
          });
        }
      });
  
      console.log("Ligas filtradas:", arr);
      setLeagues(arr);
    } catch (error) {
      console.log("Erro fetchLeagues:", error);
      Alert.alert("Erro", "Não foi possível carregar ligas.");
    } finally {
      setRolesLoading(false);
    }
  }

  function openRolesModal(item: LeagueData) {
    setSelectedLeagueId(item.leagueId);
    setSelectedLeagueName(item.leagueName);
    setCurrentRoleTab("host");
    setRolesModalVisible(true);

    // Carregar dados
    loadRoleData(item.leagueId);
  }

  function closeRolesModal() {
    setRolesModalVisible(false);
  }

  async function loadRoleData(leagueId: string) {
    try {
      const [h, j, hd, b, v] = await Promise.all([
        fetchRoleMembers(leagueId, "host"),
        fetchRoleMembers(leagueId, "judge"),
        fetchRoleMembers(leagueId, "head"),
        fetchRoleMembers(leagueId, "ban"),
        fetchRoleMembers(leagueId, "vip"),
      ]);
      setHostList(h);
      setJudgeList(j);
      setHeadList(hd);
      setBanList(b);
      setVipList(v);
    } catch (error) {
      console.log("Erro loadRoleData:", error);
    }
  }

  function switchRoleTab(tab: "host"|"judge"|"head"|"ban"|"vip") {
    setCurrentRoleTab(tab);
  }

  async function handleAddRoleMember(roleName: "host"|"judge"|"head"|"ban"|"vip", userId: string, userName: string) {
    try {
      if (!selectedLeagueId) return;
      await addRoleMember(selectedLeagueId, roleName, userId, userName);
      await loadRoleData(selectedLeagueId);
    } catch (err) {
      console.log("Erro addRoleMember:", err);
      Alert.alert("Erro", "Não foi possível adicionar membro.");
    }
  }

  async function handleRemoveRoleMember(roleName: "host"|"judge"|"head"|"ban"|"vip", userId: string) {
    try {
      if (!selectedLeagueId) return;
      await removeRoleMember(selectedLeagueId, roleName, userId);
      await loadRoleData(selectedLeagueId);
    } catch (err) {
      console.log("Erro removeRoleMember:", err);
      Alert.alert("Erro", "Não foi possível remover membro.");
    }
  }

  // ========== MODAL DE SELECIONAR JOGADORES ===========
  function openSelectPlayersModal(role: "host"|"judge"|"head"|"ban"|"vip") {
    setAddingRole(role);
    setSelectSearch("");
    setSelectPlayers([]);
    setSelectModalVisible(true);

    // Carrega jogadores da liga, se 'selectedLeagueId' existe
    if (selectedLeagueId) {
      loadPlayersForLeague(selectedLeagueId, "");
    }
  }

  async function loadPlayersForLeague(leagueId: string, search: string) {
    try {
      setSelectLoading(true);
      const pRef = collection(db, `leagues/${leagueId}/players`);
      const snap = await getDocs(pRef);
      let arr: PlayerData[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data() as PlayerData;
        arr.push(d);
      });

      const term = search.toLowerCase();
      if (term) {
        arr = arr.filter(
          (p) =>
            p.userid.toLowerCase().includes(term) ||
            (p.fullname || "").toLowerCase().includes(term)
        );
      }

      setSelectPlayers(arr);
    } catch (err) {
      console.log("Erro loadPlayersForLeague:", err);
      Alert.alert("Erro", "Não foi possível carregar jogadores para seleção.");
    } finally {
      setSelectLoading(false);
    }
  }

  function handleSelectSearch() {
    if (selectedLeagueId) {
      loadPlayersForLeague(selectedLeagueId, selectSearch);
    }
  }

  function handleSelectPlayer(p: PlayerData) {
    // Ao clicar num jogador, adiciona ele ao role
    const nameUsed = p.fullname || p.userid;
    handleAddRoleMember(addingRole, p.userid, nameUsed);
  }

  // ============ RENDER ==============
  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={RED} />
      </View>
    );
  }

  return (
    <ImageBackground
      source={require("../../assets/images/background_login.jpg")}
      style={styles.background}
    >
      <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
        <View style={{ flex: 1 }}>
          {/* HEADER */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {currentTab === "players"
                ? "Gerenciar Jogadores"
                : currentTab === "logins"
                ? "Gerenciar Logins"
                : "Gerenciar Roles"}
            </Text>
          </View>

          {/* TAB BAR */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                currentTab === "players" && styles.tabButtonActive,
              ]}
              onPress={() => switchTab("players")}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  currentTab === "players" && { color: RED },
                ]}
              >
                Players
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabButton,
                currentTab === "logins" && styles.tabButtonActive,
                !canSeeLogins && { opacity: 0.3 },
              ]}
              onPress={() => {
                if (canSeeLogins) switchTab("logins");
              }}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  currentTab === "logins" && { color: RED },
                ]}
              >
                Logins
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabButton,
                currentTab === "roles" && styles.tabButtonActive,
                !canSeeLogins && { opacity: 0.3 },
              ]}
              onPress={() => {
                if (canSeeLogins) switchTab("roles");
              }}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  currentTab === "roles" && { color: RED },
                ]}
              >
                Roles
              </Text>
            </TouchableOpacity>
          </View>

          {/* CONTENT */}
          {currentTab === "players" && renderPlayersTab()}
          {currentTab === "logins" && canSeeLogins && renderLoginsTab()}
          {currentTab === "roles" && canSeeLogins && renderRolesTab()}

          {/* MODAL PLAYER */}
          {renderPlayerModal()}

          {/* MODAL LOGIN */}
          {renderLoginModal()}

          {/* MODAL ROLES FullScreen */}
          {renderRolesModal()}

          {/* MODAL SELECT PLAYERS */}
          {renderSelectPlayersModal()}
        </View>
      </TouchableWithoutFeedback>
    </ImageBackground>
  );

  // ============= SUB-RENDERS =============

  function renderPlayersTab() {
    return (
      <View style={{ flex: 1 }}>
        {/* PESQUISA */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome/ID..."
            placeholderTextColor="#999"
            value={searchTerm}
            onChangeText={setSearchTerm}
            onSubmitEditing={fetchPlayers}
          />
        </View>

        {/* LISTA DE PLAYERS */}
        {playersLoading ? (
          <ActivityIndicator size="large" color={RED} style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={players}
            keyExtractor={(item) => item.userid}
            contentContainerStyle={[styles.listContainer, { flexGrow: 1 }]}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>
                    {item.fullname || "Sem nome"}
                  </Text>
                  <Text style={styles.cardSubtitle}>ID: {item.userid}</Text>
                  {item.birthdate && (
                    <Text style={styles.cardSubtitle}>Nascimento: {item.birthdate}</Text>
                  )}
                  {item.pin && (
                    <Text style={styles.cardSubtitle}>PIN: {item.pin}</Text>
                  )}
                </View>

                {Authuser.includes(userId) && (
                  <View style={styles.cardButtons}>
                    <TouchableOpacity
                      style={[styles.cardBtn, { backgroundColor: "#4CAF50" }]}
                      onPress={() => openEditPlayerModal(item)}
                    >
                      <Text style={styles.cardBtnText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.cardBtn, { backgroundColor: RED }]}
                      onPress={() => handleDeletePlayer(item)}
                    >
                      <Text style={styles.cardBtnText}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          />
        )}

        {Authuser.includes(userId) && (
          <View style={styles.tabActions}>
            <TouchableOpacity style={styles.addButton} onPress={openCreatePlayerModal}>
              <Text style={styles.addButtonText}>+ Novo Player</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  function renderLoginsTab() {
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome/email/playerId"
            placeholderTextColor="#999"
            value={searchTerm}
            onChangeText={setSearchTerm}
            onSubmitEditing={fetchLogins}
          />
        </View>

        {loginsLoading ? (
          <ActivityIndicator size="large" color={RED} style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={logins}
            keyExtractor={(item) => item.loginId}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => {
              let dateStr = "";
              if (item.createdAt) {
                try {
                  const d = new Date(item.createdAt);
                  const dia = String(d.getDate()).padStart(2, "0");
                  const mes = String(d.getMonth() + 1).padStart(2, "0");
                  const ano = d.getFullYear();
                  dateStr = `${dia}/${mes}/${ano}`;
                } catch {}
              }
              return (
                <View style={styles.card}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{item.name || "Sem nome"}</Text>
                    <Text style={styles.cardSubtitle}>
                      LoginID: {item.loginId}
                    </Text>
                    {item.email && (
                      <Text style={styles.cardSubtitle}>Email: {item.email}</Text>
                    )}
                    {item.pin && (
                      <Text style={styles.cardSubtitle}>PIN: {item.pin}</Text>
                    )}
                    {item.playerId && (
                      <Text style={styles.cardSubtitle}>PlayerID: {item.playerId}</Text>
                    )}
                    {dateStr && (
                      <Text style={styles.cardSubtitle}>Criado em: {dateStr}</Text>
                    )}
                  </View>
                  <View style={styles.cardButtons}>
                    <TouchableOpacity
                      style={[styles.cardBtn, { backgroundColor: "#4CAF50" }]}
                      onPress={() => openEditLoginModal(item)}
                    >
                      <Text style={styles.cardBtnText}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.cardBtn, { backgroundColor: RED }]}
                      onPress={() => handleDeleteLogin(item)}
                    >
                      <Text style={styles.cardBtnText}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        )}

        <View style={styles.tabActions}>
          <TouchableOpacity style={styles.addButton} onPress={openCreateLoginModal}>
            <Text style={styles.addButtonText}>+ Novo Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderRolesTab() {
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar liga ou cidade"
            placeholderTextColor="#999"
            value={rolesSearch}
            onChangeText={setRolesSearch}
            onSubmitEditing={fetchLeagues}
          />
        </View>

        {rolesLoading ? (
          <ActivityIndicator size="large" color={RED} style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={leagues}
            keyExtractor={(item) => item.leagueId}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => openRolesModal(item)}
              >
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{item.leagueName}</Text>
                  <Text style={styles.cardSubtitle}>Cidade: {item.city}</Text>
                  <Text style={styles.cardSubtitle}>Players: {item.playersCount}</Text>
                  <Text style={styles.cardSubtitle}>Torneios: {item.tournamentsCount}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  }

  // ========== RENDER MODALS ==========

  // ~~ Modal de criar/editar Jogador ~~
  function renderPlayerModal() {
    return (
      <Modal visible={playerModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {isEditingPlayer ? "Editar Jogador" : "Novo Jogador"}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="UserID"
              placeholderTextColor="#999"
              value={formUserid}
              onChangeText={setFormUserid}
              editable={!isEditingPlayer}
            />
            <TextInput
              style={styles.input}
              placeholder="Nome completo"
              placeholderTextColor="#999"
              value={formFullname}
              onChangeText={setFormFullname}
            />
            <TextInput
              style={styles.input}
              placeholder="Data de nascimento"
              placeholderTextColor="#999"
              value={formBirthdate}
              onChangeText={setFormBirthdate}
            />
            <TextInput
              style={styles.input}
              placeholder="PIN"
              placeholderTextColor="#999"
              value={formPin}
              onChangeText={setFormPin}
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#999" }]}
                onPress={() => setPlayerModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: RED }]}
                onPress={handleSavePlayer}
              >
                <Text style={styles.modalBtnText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ~~ Modal de criar/editar Login ~~
  function renderLoginModal() {
    return (
      <Modal visible={loginModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {isEditingLogin ? "Editar Login" : "Novo Login"}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="LoginID"
              placeholderTextColor="#999"
              value={formLoginId}
              onChangeText={setFormLoginId}
              editable={!isEditingLogin}
            />
            <TextInput
              style={styles.input}
              placeholder="Nome"
              placeholderTextColor="#999"
              value={formLoginName}
              onChangeText={setFormLoginName}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={formLoginEmail}
              onChangeText={setFormLoginEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="PIN"
              placeholderTextColor="#999"
              value={formLoginPin}
              onChangeText={setFormLoginPin}
            />
            <TextInput
              style={styles.input}
              placeholder="PlayerID"
              placeholderTextColor="#999"
              value={formLoginPlayerId}
              onChangeText={setFormLoginPlayerId}
            />
            <TextInput
              style={styles.input}
              placeholder="Data de Criação (DD/MM/AAAA)"
              placeholderTextColor="#999"
              value={formLoginCreatedAt}
              onChangeText={setFormLoginCreatedAt}
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#999" }]}
                onPress={() => setLoginModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: RED }]}
                onPress={handleSaveLogin}
              >
                <Text style={styles.modalBtnText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ~~ Modal Roles FullScreen ~~
  function renderRolesModal() {
    return (
      <Modal
        visible={rolesModalVisible}
        animationType="slide"
        onRequestClose={() => setRolesModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: BLACK }}>
          {/* Header */}
          <View style={[styles.header, { justifyContent: "center" }]}>
            <Text style={styles.headerTitle}>{selectedLeagueName || "Liga"}</Text>
          </View>

          {/* Sub-ABAS: "host", "judge", "head", "ban", "vip" */}
          <View style={styles.subTabBar}>
            {renderRoleTabButton("host", "Host")}
            {renderRoleTabButton("judge", "Judge")}
            {renderRoleTabButton("head", "Head")}
            {renderRoleTabButton("ban", "Ban")}
            {renderRoleTabButton("vip", "Vip")}
          </View>

          {/* Conteúdo da subaba */}
          <View style={{ flex: 1 }}>
            {currentRoleTab === "host" && renderRoleList(hostList, "host")}
            {currentRoleTab === "judge" && renderRoleList(judgeList, "judge")}
            {currentRoleTab === "head" && renderRoleList(headList, "head")}
            {currentRoleTab === "ban" && renderRoleList(banList, "ban")}
            {currentRoleTab === "vip" && renderRoleList(vipList, "vip")}
          </View>

          {/* Botão Fechar */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 10 }}>
            <TouchableOpacity
              style={[styles.addButton]}
              onPress={() => openSelectPlayersModal(currentRoleTab)}
            >
              <Text style={styles.addButtonText}>+ Adicionar Membro</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#999" }]}
              onPress={() => setRolesModalVisible(false)}
            >
              <Text style={styles.modalBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // ~~ Modal SelectPlayers ~~
  function renderSelectPlayersModal() {
    return (
      <Modal
        visible={selectModalVisible}
        animationType="slide"
        onRequestClose={() => setSelectModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: BLACK }}>
          <View style={[styles.header, { justifyContent: "center" }]}>
            <Text style={styles.headerTitle}>Selecionar Jogadores</Text>
          </View>

          {/* Barra de busca */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nome/ID..."
              placeholderTextColor="#999"
              value={selectSearch}
              onChangeText={setSelectSearch}
              onSubmitEditing={() => {
                if (selectedLeagueId) {
                  loadPlayersForLeague(selectedLeagueId, selectSearch);
                }
              }}
            />
          </View>

          {selectLoading ? (
            <ActivityIndicator size="large" color={RED} style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={selectPlayers}
              keyExtractor={(item) => item.userid}
              contentContainerStyle={styles.listContainer}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => {
                    const nameUsed = item.fullname || item.userid;
                    handleAddRoleMember(addingRole, item.userid, nameUsed);
                  }}
                >
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{item.fullname || "Sem nome"}</Text>
                    <Text style={styles.cardSubtitle}>ID: {item.userid}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}

          <View style={{ padding: 10 }}>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#999" }]}
              onPress={() => setSelectModalVisible(false)}
            >
              <Text style={styles.modalBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // ============= RENDERIZADORES AUXILIARES =============

  function renderRoleTabButton(role: "host"|"judge"|"head"|"ban"|"vip", label: string) {
    return (
      <TouchableOpacity
        style={[
          styles.subTabBtn,
          currentRoleTab === role && styles.subTabBtnActive,
        ]}
        onPress={() => switchRoleTab(role)}
      >
        <Text
          style={[
            styles.subTabBtnText,
            currentRoleTab === role && { color: RED },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  }

  function renderRoleList(list: RoleMember[], role: "host"|"judge"|"head"|"ban"|"vip") {
    return (
      <ScrollView contentContainerStyle={{ padding: 12 }}>
        {list.length === 0 && (
          <Text style={{ color: WHITE, textAlign: "center" }}>
            Nenhum membro encontrado para {role}.
          </Text>
        )}
        {list.map((m) => (
          <View style={styles.card} key={m.userId}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{m.fullname}</Text>
              <Text style={styles.cardSubtitle}>ID: {m.userId}</Text>
            </View>
            <View style={styles.cardButtons}>
              <TouchableOpacity
                style={[styles.cardBtn, { backgroundColor: RED }]}
                onPress={() => handleRemoveRoleMember(role, m.userId)}
              >
                <Text style={styles.cardBtnText}>Remover</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  }
}

////////////////////////////////////////////////////////////////////////////////
// ESTILOS
////////////////////////////////////////////////////////////////////////////////
const styles = StyleSheet.create({
  background: {
    flex: 1,
    resizeMode: "cover",
  },
  header: {
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    color: RED,
    fontSize: 22,
    fontWeight: "bold",
  },
  container: {
    flex: 1,
    backgroundColor: BLACK,
  },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingVertical: 10,
  },
  tabButton: {
    paddingVertical: 6,
  },
  tabButtonActive: {
    borderBottomColor: RED,
    borderBottomWidth: 3,
  },
  tabButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "bold",
  },
  searchContainer: {
    backgroundColor: "rgba(0,0,0,0.4)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: DARK_GRAY,
    color: WHITE,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  listContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: DARK_GRAY,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#444",
  },
  cardInfo: {
    marginBottom: 10,
  },
  cardTitle: {
    color: WHITE,
    fontSize: 18,
    fontWeight: "bold",
  },
  cardSubtitle: {
    color: "#ccc",
    fontSize: 14,
    marginTop: 2,
  },
  cardButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  cardBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  cardBtnText: {
    color: WHITE,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "85%",
    backgroundColor: BLACK,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: "#444",
  },
  modalTitle: {
    color: RED,
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
  },
  input: {
    backgroundColor: DARK_GRAY,
    color: WHITE,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  modalButtonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  subTabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 10,
  },
  subTabBtn: {
    paddingVertical: 5,
  },
  subTabBtnActive: {
    borderBottomColor: RED,
    borderBottomWidth: 3,
  },
  subTabBtnText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: "bold",
  },
  tabActions: {
    backgroundColor: "rgba(0,0,0,0.4)",
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 8,
  },
  addButton: {
    backgroundColor: RED,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addButtonText: {
    color: WHITE,
    fontWeight: "bold",
    fontSize: 16,
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
});
