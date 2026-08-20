import { eventsContext } from "@/src/context/eventsContext";
import { useProfile } from "@/src/context/profileContext";
import {
  cloudSyncService,
  getCloudAuthErrorCode,
} from "@/src/features/cloudSync";
import { useUser } from "@/src/context/UserContext";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PROFILE_COLORS } from "../../src/constants/profileColors";
import SettingsMenuModal from "@/src/utils/SettingsMenuModal";
import React, { useCallback, useContext, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { usePreset } from "../../src/context/presetContext";
import { useTheme } from "../../src/context/themeContext";

interface ColorPickerProps {
  selectedColor: string;
  onSelectColor: (color: string) => void;
  colors: {
    border_color: string;
  };
}

function ColorPicker({
  selectedColor,
  onSelectColor,
  colors,
}: ColorPickerProps) {
  return (
    <View style={profileStyles.colorPickerContainer}>
      <FlatList
        data={PROFILE_COLORS}
        keyExtractor={(item) => item}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              profileStyles.colorOption,
              { backgroundColor: item },
              selectedColor === item && {
                borderColor: colors.border_color,
                borderWidth: 3,
              },
            ]}
            onPress={() => onSelectColor(item)}
          />
        )}
      />
    </View>
  );
}

type CloudAuthHandler = (
  email: string,
  password: string,
  isLogin: boolean,
) => Promise<boolean>;

interface AuthModalProps {
  isVisible: boolean;
  onClose: () => void;
  cloudAuthHandler: CloudAuthHandler;
}

function AuthModalContent({
  isVisible,
  onClose,
  cloudAuthHandler,
}: AuthModalProps) {
  const { colors } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!email || !password) {
      return Alert.alert(
        "Input Required",
        "Please enter both email and password.",
      );
    }
    setLoading(true);
    const success = await cloudAuthHandler(email, password, isLogin);
    setLoading(false);

    if (success) {
      onClose();
      setEmail("");
      setPassword("");
    }
  }, [email, password, isLogin, cloudAuthHandler, onClose]);

  return (
    <Modal
      animationType="slide"
      transparent
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={modalStyles.centeredView}>
        <View
          style={[
            modalStyles.modalView,
            {
              backgroundColor: colors.background_main,
              borderColor: colors.border_color,
            },
          ]}
        >
          <Text
            style={[modalStyles.modalTitle, { color: colors.text_primary }]}
          >
            {isLogin ? "Sign In" : "Sign Up"} with Email
          </Text>

          <TextInput
            style={[
              modalStyles.input,
              {
                borderColor: colors.border_color,
                color: colors.text_primary,
                backgroundColor: colors.background_main,
              },
            ]}
            placeholder="Email Address"
            placeholderTextColor={colors.placeholder_gray}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={[
              modalStyles.input,
              {
                borderColor: colors.border_color,
                color: colors.text_primary,
                backgroundColor: colors.background_main,
              },
            ]}
            placeholder="Password (6+ characters)"
            placeholderTextColor={colors.placeholder_gray}
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={[
              modalStyles.submitButton,
              { backgroundColor: colors.primary },
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text
              style={[
                modalStyles.submitButtonText,
                { color: colors.text_on_color },
              ]}
            >
              {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={modalStyles.toggleButton}
            onPress={() => setIsLogin(!isLogin)}
            disabled={loading}
          >
            <Text
              style={[
                modalStyles.toggleText,
                { color: colors.placeholder_gray },
              ]}
            >
              {isLogin
                ? "Need an account? Sign Up"
                : "Have an account? Sign In"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              modalStyles.closeButton,
              {
                borderColor: colors.border_color,
                backgroundColor: colors.background_main,
                borderWidth: 1,
              },
            ]}
            onPress={onClose}
          >
            <Text
              style={[
                modalStyles.closeButtonText,
                { color: colors.text_primary },
              ]}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

interface LogoutModalProps {
  isVisible: boolean;
  onClose: () => void;
  handleLogout: (wipeAllLocalData: boolean) => Promise<void>;
}

function LogoutModal({ isVisible, onClose, handleLogout }: LogoutModalProps) {
  const { colors } = useTheme();
  return (
    <Modal
      animationType="slide"
      transparent
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={modalStyles.centeredView}>
        <View
          style={[
            modalStyles.modalView,
            {
              width: "90%",
              backgroundColor: colors.background_main,
              borderColor: colors.border_color,
            },
          ]}
        >
          <Text
            style={[
              modalStyles.modalTitle,
              { color: colors.text_primary, marginBottom: 15 },
            ]}
          >
            Account Options
          </Text>

          <Text
            style={{
              color: colors.text_primary,
              fontSize: 14,
              marginBottom: 20,
              textAlign: "center",
            }}
          >
            Wipe all local data (profiles, events) if you are connecting to
            another email account. This prevents unwanted data merges.
          </Text>

          <TouchableOpacity
            style={[
              modalStyles.submitButton,
              {
                backgroundColor: colors.background_main,
                borderColor: colors.border_color,
                borderWidth: 1,
              },
            ]}
            onPress={() => {
              onClose();
              handleLogout(true);
            }}
          >
            <Text
              style={[
                modalStyles.submitButtonText,
                { color: "red" },
              ]}
            >
              Wipe All Local Data & Log Out
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              modalStyles.submitButton,
              { backgroundColor: colors.primary },
            ]}
            onPress={() => {
              onClose();
              handleLogout(false);
            }}
          >
            <Text
              style={[
                modalStyles.submitButtonText,
                { color: colors.text_on_color },
              ]}
            >
              Just Log Out
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              modalStyles.closeButton,
              {
                backgroundColor: colors.background_main,
                borderWidth: 1,
                borderColor: colors.border_color,
                marginTop: 15,
              },
            ]}
            onPress={onClose}
          >
            <Text
              style={[
                modalStyles.closeButtonText,
                { color: colors.text_primary, fontWeight: "bold" },
              ]}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function Profile() {
  const {
    profiles,
    selectedProfile,
    setSelectedProfile,
    addProfile: contextAddProfile,
    deleteProfile: contextDeleteProfile,
    renameProfile: contextRenameProfile,
    setProfiles,
    getProfileColor,
  } = useProfile();
  const { setPresets } = usePreset();
  const {
    user: currentUser,
    cloudSyncEnabled,
    signIn,
    signUp,
    logOut,
  } = useUser();
  const { loadEvents, setAllEvents } = useContext(eventsContext);
  const { colors } = useTheme();
  const [color, setColor] = useState(PROFILE_COLORS[0]);

  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [isAuthModalVisible, setIsAuthModalVisible] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const handleEditProfileName = useCallback((oldName: string) => {
    if (oldName === "Default Profile") {
      return Alert.alert(
        "Cannot Rename",
        "The Default Profile cannot be renamed.",
      );
    }
    setEditingProfile(oldName);
    setNewName(oldName);
  }, []);
  const handleSaveProfileName = useCallback(async () => {
    if (!editingProfile) return;

    if (!newName || newName.trim().length === 0 || newName.length > 20) {
      return Alert.alert(
        "Invalid Name",
        "Profile name must be between 1 and 20 characters.",
      );
    }

    const nameExists =
      profiles.map((p) => p.toLowerCase()).includes(newName.toLowerCase()) &&
      newName.toLowerCase() !== editingProfile.toLowerCase();

    if (nameExists) {
      return Alert.alert(
        "Invalid Name",
        "A profile with this name already exists.",
      );
    }

    try {
      await contextRenameProfile(editingProfile, newName);
      Alert.alert("Success", `Renamed "${editingProfile}" to "${newName}".`);
      setEditingProfile(null);
      setNewName("");
    } catch (error) {
      console.error("Error renaming profile:", error);
      Alert.alert("Error", "Failed to rename profile.");
    }
  }, [editingProfile, newName, profiles, contextRenameProfile]);

  const handleAddProfile = useCallback(async () => {
    const success = await contextAddProfile(name, color);

    if (success) {
      setName("");
      setColor(PROFILE_COLORS[0]);
      setAdding(false);
    }
  }, [contextAddProfile, name, color]);

  const confirmDelete = useCallback(
    (item: string) => {
      if (item === "Default Profile") {
        return Alert.alert(
          "Cannot Delete",
          "The Default Profile cannot be deleted.",
        );
      }
      if (profiles.length === 1) {
        return Alert.alert(
          "Cannot Delete",
          "You must keep at least one profile.",
        );
      }

      Alert.alert("Delete Profile", `Delete ${item} and its events?`, [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => contextDeleteProfile(item),
        },
      ]);
    },
    [profiles, contextDeleteProfile],
  );

  const handleSelectProfile = useCallback(
    (item: string) => {
      setSelectedProfile(item);
      loadEvents?.();
    },
    [setSelectedProfile, loadEvents],
  );

  const wipeAllData = useCallback(async () => {
    Alert.alert(
      "Wipe All Data (Local & Cloud)",
      "This will delete all events and profiles and presets stored locally. Are you sure you want to proceed?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            try {
              const keys = await AsyncStorage.getAllKeys();
              const presetKeys = keys.filter((k) => k.startsWith("@preset:"));
              const eventKeys = keys.filter((k) => k.startsWith("@event:"));
              const profileKeys = keys.filter(
                (k) =>
                  k === "@gigkit_profiles" || k === "@gigkit_selected_profile",
              );
              const localKeys = [...eventKeys, ...profileKeys, ...presetKeys];

              const userId = currentUser?.uid;
              if (userId && cloudSyncService.isEnabled()) {
                await cloudSyncService.deleteAllUserData(userId);
              }

              if (localKeys.length > 0)
                await AsyncStorage.multiRemove(localKeys);

              setAllEvents([]);
              setProfiles(["Default Profile"]);
              setSelectedProfile("Default Profile");
              setPresets([]);
              Alert.alert(
                "Success",
                "All local(events & profiles & presets) have been deleted.",
              );
            } catch (error) {
              console.error("Error wiping all data:", error);
              Alert.alert("Error", "Failed to wipe data.");
            }
            AsyncStorage.clear();
          },
        },
      ],
    );
  }, [
    currentUser?.uid,
    setAllEvents,
    setProfiles,
    setSelectedProfile,
    setPresets,
  ]);
  const handleCloudAuth: CloudAuthHandler = useCallback(
    async (email, password, isLogin) => {
      if (!cloudSyncEnabled) {
        Alert.alert(
          "Cloud Sync Disabled",
          "Account sign-in is currently disabled in this local-first version.",
        );
        return false;
      }

      try {
        const cloudUser = isLogin
          ? await signIn(email, password)
          : await signUp(email, password);

        if (!cloudUser) {
          return false;
        }

        Alert.alert("Success", isLogin ? "Signed in!" : "Account created!");
        await cloudSyncService.syncLocalEvents(cloudUser.uid);
        loadEvents();
        return true;
      } catch (error: unknown) {
        const errorMessages: Record<string, string> = {
          "auth/invalid-email": "Invalid email address format.",
          "auth/wrong-password": "Incorrect email or password.",
          "auth/user-not-found": "User not found.",
          "auth/email-already-in-use": "Email already in use.",
          "auth/weak-password": "Password should be at least 6 characters.",
        };
        const errorCode = getCloudAuthErrorCode(error);
        Alert.alert(
          "Authentication Error",
          errorCode
            ? errorMessages[errorCode] || "Wrong Email/password"
            : "Wrong Email/password",
        );
        return false;
      }
    },
    [cloudSyncEnabled, loadEvents, signIn, signUp],
  );

  const handleConnect = useCallback(() => {
    if (!cloudSyncEnabled) {
      Alert.alert(
        "Cloud Sync Disabled",
        "Account sign-in is currently disabled in this local-first version.",
      );
      return;
    }

    if (currentUser) {
      setIsLogoutModalVisible(true);
    } else {
      Alert.alert("Connect Account", "Choose a sign-in method:", [
        {
          text: "Email / Password",
          onPress: () => setIsAuthModalVisible(true),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]);
    }
  }, [cloudSyncEnabled, currentUser]);

  const handleLogout = useCallback(
    async (wipeAllLocalData: boolean) => {
      try {
        if (wipeAllLocalData) {
          const keys = await AsyncStorage.getAllKeys();
          const localKeys = keys.filter(
            (k) =>
              k.startsWith("@event:") ||
              k.startsWith("@preset:") ||
              k === "@gigkit_profiles" ||
              k === "@gigkit_selected_profile",
          );
          if (localKeys.length > 0) await AsyncStorage.multiRemove(localKeys);

          setAllEvents([]);
          setProfiles(["Default Profile"]);
          setSelectedProfile("Default Profile");
          setPresets([]);
        }

        await logOut();
        loadEvents();
      } catch (err) {
        console.error("Logout failed", err);
        Alert.alert("Error", "Failed to log out");
      } finally {
        setIsLogoutModalVisible(false);
      }
    },
    [
      setAllEvents,
      setProfiles,
      setSelectedProfile,
      loadEvents,
      setPresets,
      logOut,
    ],
  );
  return (
    <SafeAreaView
      style={[
        profileStyles.container,
        { backgroundColor: colors.background_main },
      ]}
    >
      <View style={profileStyles.headerContainer}>
        <Text
          style={[profileStyles.logoText, { color: colors.text_primary }]}
        ></Text>
        <View style={profileStyles.headerIcons}>
          <Ionicons
            name="settings-outline"
            size={24}
            color={colors.text_primary}
            style={profileStyles.iconSpacing}
            onPress={() => setIsSettingsModalVisible(true)}
          />
        </View>
      </View>
      <AuthModalContent
        isVisible={isAuthModalVisible}
        onClose={() => setIsAuthModalVisible(false)}
        cloudAuthHandler={handleCloudAuth}
      />

      <SettingsMenuModal
        isVisible={isSettingsModalVisible}
        onClose={() => setIsSettingsModalVisible(false)}
        onWipeEvents={wipeAllData}
      />

      <LogoutModal
        isVisible={isLogoutModalVisible}
        onClose={() => setIsLogoutModalVisible(false)}
        handleLogout={handleLogout}
      />
      <Text style={[profileStyles.titleText, { color: colors.text_primary }]}>
        Profiles
      </Text>

      {adding ? (
        <View style={profileStyles.addProfileContainer}>
          <View style={profileStyles.inputRow}>
            <TextInput
              style={[
                profileStyles.profileInput,
                {
                  borderColor: colors.border_color,
                  color: colors.text_primary,
                  backgroundColor: colors.background_main,
                },
              ]}
              placeholder="Name (max 12)"
              placeholderTextColor={colors.placeholder_gray}
              value={name}
              onChangeText={(t) => t.length <= 12 && setName(t)}
            />
            <TouchableOpacity
              style={[
                profileStyles.acceptButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={handleAddProfile}
              disabled={!name}
            >
              <Text
                style={[
                  profileStyles.acceptButtonText,
                  { color: colors.text_on_color },
                ]}
              >
                Accept
              </Text>
            </TouchableOpacity>
          </View>
          <ColorPicker
            selectedColor={color}
            onSelectColor={setColor}
            colors={colors}
          />
        </View>
      ) : (
        <TouchableOpacity
          style={[
            profileStyles.createButton,
            { backgroundColor: colors.primary },
          ]}
          onPress={() => setAdding(true)}
        >
          <Text
            style={[
              profileStyles.createButtonText,
              { color: colors.text_on_color },
            ]}
          >
            Create New Profile
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={profiles}
        keyExtractor={(item) => item}
        renderItem={({ item }) => {
          const profileColor = getProfileColor(item);

          const isEditing = editingProfile === item;

          if (isEditing) {
            return (
              <View
                style={[
                  profileStyles.profileRow,
                  { borderBottomColor: colors.border_color },
                ]}
              >
                <TextInput
                  style={[
                    profileStyles.profileInput,
                    {
                      flex: 1,
                      borderColor: colors.border_color,
                      color: colors.text_primary,
                      backgroundColor: colors.primary,
                      marginRight: 8,
                      height: 45,
                    },
                  ]}
                  placeholder="New Name (max 12)"
                  placeholderTextColor={colors.placeholder_gray}
                  value={newName}
                  onChangeText={(t) => t.length <= 12 && setNewName(t)}
                />
                <TouchableOpacity
                  style={[
                    profileStyles.acceptButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={handleSaveProfileName}
                  disabled={!newName || newName === item}
                >
                  <Text
                    style={[
                      profileStyles.acceptButtonText,
                      { color: colors.text_on_color },
                    ]}
                  >
                    Save
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    profileStyles.acceptButton,
                    { backgroundColor: colors.placeholder_gray, marginLeft: 8 },
                  ]}
                  onPress={() => setEditingProfile(null)}
                >
                  <Text
                    style={[
                      profileStyles.acceptButtonText,
                      { color: colors.text_on_color },
                    ]}
                  >
                    X
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }
          return (
            <View
              style={[
                profileStyles.profileRow,
                { borderBottomColor: colors.border_color },
              ]}
            >
              <TouchableOpacity
                onPress={() => handleSelectProfile(item)}
                style={profileStyles.profileNameContainer}
                disabled={isEditing}
              >
                {selectedProfile === item && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.primary}
                    style={{ marginRight: 8 }}
                  />
                )}
                <Text
                  style={[
                    profileStyles.profileNameText,
                    selectedProfile === item && {
                      fontWeight: "bold",
                      color: profileColor,
                    },
                    { color: profileColor },
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
              <View style={profileStyles.profileIcons}>
                {item !== "Default Profile" && (
                  <Ionicons
                    name="pencil-outline"
                    size={20}
                    color={colors.placeholder_gray}
                    style={profileStyles.iconSpacing}
                    onPress={() => handleEditProfileName(item)}
                  />
                )}

                {item !== "Default Profile" && (
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={colors.placeholder_gray}
                    style={profileStyles.iconSpacing}
                    onPress={() => confirmDelete(item)}
                  />
                )}
              </View>
            </View>
          );
        }}
        contentContainerStyle={profileStyles.listContent}
        ListEmptyComponent={
          <Text
            style={[
              profileStyles.emptyText,
              { color: colors.placeholder_gray },
            ]}
          >
            No profiles yet!
          </Text>
        }
      />
    </SafeAreaView>
  );
}
const modalStyles = StyleSheet.create({
  closeButtonText: {
    fontWeight: "bold",
    fontSize: 16,
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalView: {
    width: "85%",
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 15,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
  },
  dangerText: {
    color: "red",
    fontSize: 16,
    marginLeft: 10,
    fontWeight: "600",
  },
  closeButton: {
    marginTop: 20,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  input: {
    width: "100%",
    height: 45,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  submitButton: {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
    backgroundColor: "transparent",
  },
  submitButtonText: {
    fontWeight: "bold",
    fontSize: 16,
  },
  toggleButton: { padding: 10, marginBottom: 10 },
  toggleText: { fontSize: 14, textDecorationLine: "underline" },
});

const profileStyles = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === "android" ? 40 : 0 },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  logoText: { fontSize: 20, fontWeight: "bold" },
  headerIcons: { flexDirection: "row", alignItems: "center" },
  iconSpacing: { marginLeft: 15 },
  connectButton: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5 },
  connectButtonText: { fontSize: 12, fontWeight: "bold" },
  titleText: {
    fontSize: 24,
    fontWeight: "bold",
    paddingHorizontal: 15,
    marginVertical: 15,
  },
  addProfileContainer: {
    marginBottom: 20,
    paddingHorizontal: 15,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  profileInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    height: 45,
    marginRight: 8,
  },
  acceptButton: { paddingVertical: 14, paddingHorizontal: 15, borderRadius: 8 },
  acceptButtonText: { fontWeight: "bold" },
  createButton: {
    paddingVertical: 12,
    marginHorizontal: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  createButtonText: { fontWeight: "bold", fontSize: 16 },
  profileRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  profileNameContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  profileNameText: { fontSize: 18 },
  profileIcons: { flexDirection: "row", alignItems: "center" },
  listContent: { paddingHorizontal: 15, paddingBottom: 20 },
  emptyText: { textAlign: "center", marginTop: 20 },
  colorPickerContainer: {
    marginBottom: 10,
  },
  colorOption: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
});
