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

import { useUser } from "../context/UserContext";
import { cloudSyncService } from "../features/cloudSync";
import { savePresetLocally } from "../services/localDataService";
import { Preset } from "../types/dataTypes";

const ALL_PRESETS_VIEW = "Default Preset";
const SELECTED_PRESET_KEY = "@gigkit_selected_preset";

export type PresetContextType = {
  presets: Preset[];
  setPresets: React.Dispatch<React.SetStateAction<Preset[]>>;
  selectedPresetName: string;
  setSelectedPresetName: (name: string) => void;
  addPreset: (name: string, type: "riders" | "stageplans") => Promise<boolean>;
  deletePreset: (id: string) => Promise<void>;
  updatePreset: (updatedPreset: Preset) => Promise<void>;
};

const PresetContext = createContext<PresetContextType | undefined>(undefined);
export { PresetContext };

export const usePreset = () => {
  const ctx = useContext(PresetContext);
  if (!ctx) throw new Error("usePreset must be used within a PresetProvider");
  return ctx;
};

export const PresetProvider: FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useUser();

  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetName, setSelectedPresetNameState] =
    useState<string>(ALL_PRESETS_VIEW);
  const [isLoaded, setIsLoaded] = useState(false);

  const updatePreset = useCallback(
    async (updatedPreset: Preset) => {
      const userId = user?.uid;
      const presetToSave = { ...updatedPreset, authUserId: userId };

      try {
        setPresets((prev) =>
          prev.some((p) => p.id === updatedPreset.id)
            ? prev.map((p) => (p.id === updatedPreset.id ? presetToSave : p))
            : [presetToSave, ...prev],
        );

        await savePresetLocally(presetToSave);

        if (userId && cloudSyncService.isEnabled()) {
          await cloudSyncService.savePreset(presetToSave, userId).catch((err) =>
            console.error("Failed to sync preset to cloud storage:", err),
          );
        }
      } catch (error) {
        console.error("Failed to save/update preset:", error);
        Alert.alert("Error", "Failed to save preset locally or to the cloud.");
      }
    },
    [user?.uid],
  );

  useEffect(() => {
    const loadAndMergePresets = async () => {
      const userId = user?.uid;

      const localKeys = (await AsyncStorage.getAllKeys()).filter((key) =>
        key.startsWith("@preset:"),
      );
      const localItems = await AsyncStorage.multiGet(localKeys);

      const localPresetsMap = new Map<string, Preset>();
      localItems.forEach(([, value]) => {
        if (value) {
          const preset = JSON.parse(value) as Preset;
          preset.config = preset.config || {};
          preset.stageIcons = preset.stageIcons || [];
          localPresetsMap.set(preset.id, preset);
        }
      });

      if (userId && cloudSyncService.isEnabled()) {
        try {
          await cloudSyncService.syncLocalPresets(userId);

          const cloudPresets = await cloudSyncService.loadPresets(userId);
          cloudPresets.forEach((preset) =>
            localPresetsMap.set(preset.id, preset),
          );

          await Promise.all(cloudPresets.map((preset) => savePresetLocally(preset)));
        } catch (error) {
          console.error("Failed to load/sync cloud presets:", error);
        }
      }

      setPresets(Array.from(localPresetsMap.values()));

      const storedSelected = await AsyncStorage.getItem(SELECTED_PRESET_KEY);
      setSelectedPresetNameState(storedSelected || ALL_PRESETS_VIEW);

      setIsLoaded(true);
    };

    loadAndMergePresets();
  }, [user?.uid]);

  const setSelectedPresetName = useCallback(
    (name: string) => {
      if (!presets.some((p) => p.name === name) && name !== ALL_PRESETS_VIEW)
        return;

      setSelectedPresetNameState(name);
      AsyncStorage.setItem(SELECTED_PRESET_KEY, name).catch((err) =>
        console.error("Failed to save selected preset:", err),
      );
    },
    [presets],
  );

  const addPreset = useCallback(
    async (name: string, type: "riders" | "stageplans"): Promise<boolean> => {
      const trimmed = name.trim();

      if (!trimmed) {
        Alert.alert("Error", "Preset name cannot be empty.");
        return false;
      }

      if (presets.some((p) => p.name === trimmed)) {
        Alert.alert("Error", "Preset name must be unique.");
        return false;
      }

      const newPreset: Preset = {
        id: Date.now().toString(),
        name: trimmed,
        details:
          type === "riders" ? "New Rider Preset" : "New Stage Plan Preset",
        type,
        config: {},
        stageIcons: [],
        authUserId: user?.uid,
      };

      await updatePreset(newPreset);
      setSelectedPresetNameState(trimmed);

      return true;
    },
    [presets, user?.uid, updatePreset],
  );

  const deletePreset = useCallback(
    async (id: string) => {
      const presetToDelete = presets.find((preset) => preset.id === id);
      if (!presetToDelete) return;

      if (presetToDelete.name === ALL_PRESETS_VIEW) {
        Alert.alert("Error", "Default preset cannot be deleted.");
        return;
      }

      Alert.alert(
        "Delete Preset",
        `Are you sure you want to delete "${
          presetToDelete.name || "Unnamed Preset"
        }"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                if (user?.uid && cloudSyncService.isEnabled()) {
                  await cloudSyncService.deletePreset(user.uid, id);
                }

                await AsyncStorage.removeItem(`@preset:${id}`);

                const filtered = presets.filter((preset) => preset.id !== id);
                setPresets(filtered);

                if (selectedPresetName === presetToDelete.name) {
                  setSelectedPresetNameState(ALL_PRESETS_VIEW);
                  await AsyncStorage.setItem(
                    SELECTED_PRESET_KEY,
                    ALL_PRESETS_VIEW,
                  );
                }
              } catch (error) {
                console.error("Failed to delete preset:", error);
                Alert.alert(
                  "Error",
                  "Failed to delete preset locally or from the cloud.",
                );
              }
            },
          },
        ],
      );
    },
    [presets, user?.uid, selectedPresetName],
  );

  if (!isLoaded) return <View style={{ flex: 1, backgroundColor: "black" }} />;

  return (
    <PresetContext.Provider
      value={{
        presets,
        setPresets,
        selectedPresetName,
        setSelectedPresetName,
        addPreset,
        deletePreset,
        updatePreset,
      }}
    >
      {children}
    </PresetContext.Provider>
  );
};
