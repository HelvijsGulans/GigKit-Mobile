import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  FC,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Alert, View } from "react-native";
import { PROFILE_COLORS } from "@/src/constants/profileColors";
import { useUser } from "../context/UserContext";
import { cloudSyncService } from "../features/cloudSync";
import {
  getProfileObjectLocally,
  saveProfileLocally,
} from "../services/localDataService";
import { UserProfile } from "../types/dataTypes";

const ALL_PROFILES_VIEW = "Default Profile";
const PROFILES_STORAGE_KEY = "@gigkit_profiles";
const SELECTED_PROFILE_KEY = "@gigkit_selected_profile";
const PROFILE_OBJECT_STORAGE_KEY_PREFIX = "@profile:";

export interface ProfileContextType {
  profiles: string[];
  selectedProfile: string;
  setProfiles: (profiles: string[]) => void;
  setSelectedProfile: (name: string) => void;
  getProfileColor: (name: string) => string;
  addProfile: (name: string, color: string) => Promise<boolean>;
  deleteProfile: (name: string) => Promise<void>;
  renameProfile: (oldName: string, newName: string) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);
export const useProfile = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within a ProfileProvider");
  return ctx;
};

export const ProfileProvider: FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useUser();

  const [profiles, setProfiles] = useState<string[]>([ALL_PROFILES_VIEW]);
  const [selectedProfile, setSelectedProfileState] =
    useState<string>(ALL_PROFILES_VIEW);
  const [profileObjects, setProfileObjects] = useState<
    Record<string, UserProfile>
  >({});
  const [isLoaded, setIsLoaded] = useState(false);

  const getProfileColor = useCallback(
    (name: string): string => {
      if (name === ALL_PROFILES_VIEW || name === "Default Profile") {
        return "#8c42c0ff";
      }
      return profileObjects[name]?.color || "#808080";
    },
    [profileObjects],
  );

  const setSelectedProfile = useCallback((name: string) => {
    setSelectedProfileState(name);
    AsyncStorage.setItem(SELECTED_PROFILE_KEY, name).catch((err) =>
      console.error("Failed to save selected profile:", err),
    );
  }, []);

  const syncLocalProfilesToCloud = useCallback(async () => {
    if (!user || !cloudSyncService.isEnabled()) return;

    const localProfilesArray = Object.values(profileObjects);
    const unsyncedProfiles = localProfilesArray.filter(
      (p) => p.name !== ALL_PROFILES_VIEW && p.authUserId !== user.uid,
    );

    if (unsyncedProfiles.length === 0) {
      return;
    }

    for (const profile of unsyncedProfiles) {
      try {
        const syncedProfile: UserProfile = { ...profile, authUserId: user.uid };

        await cloudSyncService.saveProfile(syncedProfile, user.uid);

        await saveProfileLocally(syncedProfile);
        setProfileObjects((prev) => ({
          ...prev,
          [profile.name]: syncedProfile,
        }));
      } catch (error) {
        console.error(`Failed to sync profile ${profile.name}:`, error);
      }
    }
  }, [user, profileObjects]);

  useEffect(() => {
    const loadLocal = async () => {
      try {
        const storedProfiles = await AsyncStorage.getItem(PROFILES_STORAGE_KEY);
        const storedSelected = await AsyncStorage.getItem(SELECTED_PROFILE_KEY);

        let localProfiles: string[] = [ALL_PROFILES_VIEW];
        if (storedProfiles) {
          localProfiles = JSON.parse(storedProfiles);
          if (!localProfiles.includes(ALL_PROFILES_VIEW))
            localProfiles.unshift(ALL_PROFILES_VIEW);
        }

        setProfiles(localProfiles);

        let initialSelected =
          storedSelected && localProfiles.includes(storedSelected)
            ? storedSelected
            : ALL_PROFILES_VIEW;

        setSelectedProfileState(initialSelected);

        const profileObjectsMap: Record<string, UserProfile> = {};

        for (const name of localProfiles) {
          if (name !== ALL_PROFILES_VIEW) {
            const profileObj = await getProfileObjectLocally(name);
            if (profileObj) {
              const loadedColor = profileObj.color || "#808080";

              profileObjectsMap[name] = {
                ...profileObj,
                color: loadedColor,
                id: name,
                name: name,
              };
            }
          }
        }
        setProfileObjects(profileObjectsMap);
      } catch (e) {
        console.error("Failed to load local profiles:", e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadLocal();
  }, []);

  const [hasSynced, setHasSynced] = useState(false);
  useEffect(() => {
    if (!isLoaded || !user || hasSynced || !cloudSyncService.isEnabled()) return;

    const fullSyncAndMerge = async () => {
      try {
        await syncLocalProfilesToCloud();

        const cloudProfiles = await cloudSyncService.loadProfiles(user.uid);

        const newProfileObjectsMap: Record<string, UserProfile> = {};
        let mergedProfileNames = new Set<string>([ALL_PROFILES_VIEW]);

        for (const p of cloudProfiles) {
          if (!p.color) {
            const existingLocalProfile = profileObjects[p.name];
            if (existingLocalProfile?.color) {
              p.color = existingLocalProfile.color;
            } else {
              p.color = PROFILE_COLORS[1] || "#00FF00";
            }
          }

          await saveProfileLocally(p);
          newProfileObjectsMap[p.name] = p;
          mergedProfileNames.add(p.name);
        }

        const localProfilesToPreserve: Record<string, UserProfile> = {};
        profiles
          .filter((p) => p !== ALL_PROFILES_VIEW)
          .forEach((name) => {
            mergedProfileNames.add(name);
            if (profileObjects[name] && !newProfileObjectsMap[name]) {
              localProfilesToPreserve[name] = profileObjects[name];
            }
          });

        const finalProfileNames = Array.from(mergedProfileNames);
        setProfiles(finalProfileNames);

        setProfileObjects((prev) => ({
          ...prev,
          ...localProfilesToPreserve,
          ...newProfileObjectsMap,
        }));
      } catch (err) {
        console.error("Failed to perform full profile sync:", err);
      } finally {
        setHasSynced(true);
      }
    };

    fullSyncAndMerge();
  }, [
    user,
    isLoaded,
    hasSynced,
    profiles,
    profileObjects,
    syncLocalProfilesToCloud,
  ]);

  const addProfile = async (name: string, color: string): Promise<boolean> => {
    const trimmed = name.trim();
    if (!trimmed || profiles.includes(trimmed)) {
      Alert.alert("Error", "Profile name must be unique and non-empty.");
      return false;
    }

    const newProfileObject: UserProfile = {
      id: trimmed,
      name: trimmed,
      bio: "",
      authUserId: user?.uid ?? "",
      color: color,
    };

    try {
      if (user && cloudSyncService.isEnabled()) {
        await cloudSyncService.saveProfile(newProfileObject, user.uid);
      }

      await saveProfileLocally(newProfileObject);

      setProfileObjects((prev) => ({
        ...prev,
        [trimmed]: newProfileObject,
      }));

      setProfiles((prev) => {
        const newProfiles = [...prev, trimmed];
        AsyncStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(newProfiles));
        return newProfiles;
      });

      setSelectedProfile(trimmed);

      return true;
    } catch (error) {
      console.error("Error in addProfile:", error);
      Alert.alert("Error", "Failed to create profile.");
      return false;
    }
  };

  const deleteProfile = async (name: string): Promise<void> => {
    if (name === ALL_PROFILES_VIEW) return;

    try {
      setProfiles((prev) => {
        const filtered = prev.filter((p) => p !== name);
        AsyncStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(filtered));
        return filtered;
      });

      if (selectedProfile === name) {
        setSelectedProfile(ALL_PROFILES_VIEW);
      }

      setProfileObjects((prev) => {
        const newState = { ...prev };
        delete newState[name];
        return newState;
      });

      await AsyncStorage.removeItem(
        `${PROFILE_OBJECT_STORAGE_KEY_PREFIX}${name}`,
      );

      if (user && cloudSyncService.isEnabled()) {
        await cloudSyncService.deleteProfile(user.uid, name);
        await cloudSyncService.deleteEventsByProfileName(user.uid, name);
      }
    } catch (err) {
      console.error("Failed to delete profile:", err);
      Alert.alert("Error", "Failed to delete profile.");
    }
  };

  const renameProfile = useCallback(
    async (oldName: string, newName: string) => {
      try {
        const trimmedNew = newName.trim();
        if (
          !oldName ||
          !trimmedNew ||
          oldName === trimmedNew ||
          profiles.includes(trimmedNew)
        ) {
          return;
        }

        let finalRenamedProfile: UserProfile | undefined = undefined;
        const oldProfileKey = `${PROFILE_OBJECT_STORAGE_KEY_PREFIX}${oldName}`;
        const newProfileKey = `${PROFILE_OBJECT_STORAGE_KEY_PREFIX}${trimmedNew}`;

        setProfiles((prev) => {
          const updated = prev.map((p) => (p === oldName ? trimmedNew : p));
          AsyncStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });

        setProfileObjects((prev) => {
          const updated = { ...prev };
          const oldProfile = updated[oldName];
          if (oldProfile) {
            delete updated[oldName];

            const preservedColor = oldProfile.color ?? getProfileColor(oldName);
            const renamedObj: UserProfile = {
              ...oldProfile,
              id: trimmedNew,
              name: trimmedNew,
              color: preservedColor,
            };

            finalRenamedProfile = renamedObj;

            AsyncStorage.setItem(newProfileKey, JSON.stringify(renamedObj))
              .then(() => AsyncStorage.removeItem(oldProfileKey))
              .catch((err) =>
                console.error("Failed to persist renamed profile:", err),
              );

            return { ...updated, [trimmedNew]: renamedObj };
          }
          return updated;
        });

        try {
          const allKeys = await AsyncStorage.getAllKeys();
          const eventKeys = allKeys.filter((k) => k.startsWith("@event:"));

          if (eventKeys.length > 0) {
            for (const key of eventKeys) {
              const evJson = await AsyncStorage.getItem(key);
              if (!evJson) continue;

              let evObj: { profileId?: string; date?: Date | string } | null =
                null;
              try {
                evObj = JSON.parse(evJson);
              } catch {
                continue;
              }

              if (evObj && evObj.profileId === oldName) {
                evObj.profileId = trimmedNew;
                if (evObj.date instanceof Date)
                  evObj.date = evObj.date.toISOString();
                await AsyncStorage.setItem(key, JSON.stringify(evObj));
              }
            }
          }

          if (user && cloudSyncService.isEnabled()) {
            await cloudSyncService.syncLocalEvents(user.uid).catch((e) =>
              console.error("Failed to sync renamed events to cloud storage:", e),
            );
          }
        } catch (err) {
          console.error("Failed migrating events during profile rename:", err);
        }

        if (selectedProfile === oldName) {
          setSelectedProfile(trimmedNew);
          await AsyncStorage.setItem(SELECTED_PROFILE_KEY, trimmedNew);
        }

        if (user && finalRenamedProfile && cloudSyncService.isEnabled()) {
          await cloudSyncService.saveProfile(finalRenamedProfile, user.uid);
          await cloudSyncService.deleteProfile(user.uid, oldName);
        }
      } catch (error) {
        console.error("Error renaming profile:", error);
        Alert.alert("Error", "Failed to rename profile.");
      }
    },
    [profiles, selectedProfile, user, setSelectedProfile, getProfileColor],
  );

  if (!isLoaded) return <View style={{ flex: 1 }} />;

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        setProfiles,
        selectedProfile,
        setSelectedProfile,
        addProfile,
        deleteProfile,
        getProfileColor,
        renameProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};
