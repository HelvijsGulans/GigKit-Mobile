import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import { v4 as uuidv4 } from "uuid";

export interface Person {
  id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  selected: boolean;
}

export interface ExportSettings {
  showContacts: boolean;
  contactPosition: "top-left" | "under-title" | "bottom";
  showTechnicalHeader: boolean;
  showBrand: boolean;
  showDate: boolean;
}

const EXPORT_SETTINGS_KEY = "@gigkit_export_settings_v1";
const EXPORT_PEOPLE_KEY = "@gigkit_export_people_v1";

const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  showContacts: true,
  contactPosition: "top-left",
  showTechnicalHeader: true,
  showBrand: true,
  showDate: true,
};

interface ExportSettingsContextValue {
  exportSettings: ExportSettings;
  setExportSettings: (s: Partial<ExportSettings>) => Promise<void>;
  people: Person[];
  addPerson: (p: Omit<Person, "id" | "selected">) => Promise<Person | null>;
  updatePerson: (id: string, p: Partial<Person>) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

const ExportSettingsContext = createContext<
  ExportSettingsContextValue | undefined
>(undefined);

export const ExportSettingsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [exportSettings, setExportSettingsState] = useState<ExportSettings>(
    DEFAULT_EXPORT_SETTINGS
  );
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const rawSettings = await AsyncStorage.getItem(EXPORT_SETTINGS_KEY);
        if (rawSettings) setExportSettingsState(JSON.parse(rawSettings));

        const rawPeople = await AsyncStorage.getItem(EXPORT_PEOPLE_KEY);
        if (rawPeople) {
          const parsed: Person[] = JSON.parse(rawPeople);

          // Preserve selection defaults for older stored contact records.
          const migrated = parsed.map((p) => ({
            ...p,
            selected: typeof p.selected === "boolean" ? p.selected : false,
          }));

          setPeople(migrated);
          await AsyncStorage.setItem(
            EXPORT_PEOPLE_KEY,
            JSON.stringify(migrated)
          );
        }
      } catch (err) {
        console.error("Failed to load export settings/people", err);
      }
    })();
  }, []);

  const persistSettings = async (next: ExportSettings) => {
    try {
      await AsyncStorage.setItem(EXPORT_SETTINGS_KEY, JSON.stringify(next));
      setExportSettingsState(next);
    } catch (err) {
      console.error("Failed to persist export settings", err);
    }
  };

  const persistPeople = async (next: Person[]) => {
    try {
      await AsyncStorage.setItem(EXPORT_PEOPLE_KEY, JSON.stringify(next));
      setPeople(next);
    } catch (err) {
      console.error("Failed to persist export people", err);
    }
  };

  const setExportSettings = async (partial: Partial<ExportSettings>) => {
    const next = { ...exportSettings, ...partial };
    await persistSettings(next);
  };

  const addPerson = async (p: Omit<Person, "id" | "selected">) => {
    if (!p.name || p.name.trim().length === 0) {
      Alert.alert("Validation", "Name is required");
      return null;
    }

    const newPerson: Person = {
      id: uuidv4 ? uuidv4() : Date.now().toString(),
      selected: true,
      ...p,
    };

    const next = [...people, newPerson];
    await persistPeople(next);
    return newPerson;
  };

  const updatePerson = async (id: string, p: Partial<Person>) => {
    const next = people.map((x) => (x.id === id ? { ...x, ...p } : x));
    await persistPeople(next);
  };

  const deletePerson = async (id: string) => {
    const next = people.filter((x) => x.id !== id);
    await persistPeople(next);
  };

  const reload = async () => {
    try {
      const rawSettings = await AsyncStorage.getItem(EXPORT_SETTINGS_KEY);
      if (rawSettings) setExportSettingsState(JSON.parse(rawSettings));
      const rawPeople = await AsyncStorage.getItem(EXPORT_PEOPLE_KEY);
      if (rawPeople) setPeople(JSON.parse(rawPeople));
    } catch (err) {
      console.error("Failed to reload export settings/people", err);
    }
  };

  const value = useMemo(
    () => ({
      exportSettings,
      setExportSettings,
      people,
      addPerson,
      updatePerson,
      deletePerson,
      reload,
    }),
    [exportSettings, people]
  );

  return (
    <ExportSettingsContext.Provider value={value}>
      {children}
    </ExportSettingsContext.Provider>
  );
};

export const useExportSettings = (): ExportSettingsContextValue => {
  const ctx = useContext(ExportSettingsContext);
  if (!ctx)
    throw new Error(
      "useExportSettings must be used inside ExportSettingsProvider"
    );
  return ctx;
};
