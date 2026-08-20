import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import React, { createContext, ReactNode, useContext } from "react";

import { eventsContext } from "./eventsContext";
import { usePreset } from "./presetContext";
import { useProfile } from "./profileContext";

const useEvents = () => {
  const context = useContext(eventsContext);
  if (context === undefined) {
    throw new Error("useEvents must be used within an EventsProvider");
  }
  return context;
};

interface BackupData {
  events: any;
  profiles: any;
  presets: any;
  version: string;
}

interface ExportContextType {
  handleExport: () => Promise<void>;
  handleImport: () => Promise<void>;
}

const ExportContext = createContext<ExportContextType | undefined>(undefined);

export const ExportProvider = ({ children }: { children: ReactNode }) => {
  const { events, setAllEvents: setEvents } = useEvents();

  const { profiles, setProfiles } = useProfile();
  const { presets, setPresets } = usePreset();

  const handleExport = async () => {
    try {
      const dataToBackup: BackupData = {
        events: events,
        profiles: profiles,
        presets: presets,
        version: "1.0.0",
      };

      const jsonString = JSON.stringify(dataToBackup);

      let backupIndex = 1;
      const indexString = await AsyncStorage.getItem("backupIndex");
      if (indexString) {
        backupIndex = parseInt(indexString) + 1;
      }

      const fileName = `GigKit backup ${backupIndex}.json`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, jsonString);

      if (!(await Sharing.isAvailableAsync())) {
        alert("Sharing is not available on your device.");
        return;
      }
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/json",
        dialogTitle: "Save your GigKit Backup",
      });

      await AsyncStorage.setItem("backupIndex", backupIndex.toString());

      alert(`Backup successful: ${fileName}`);
    } catch (error) {
      console.error("Export Error:", error);
      alert("Failed to export data. See console for details.");
    }
  };

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];

      const contents = await FileSystem.readAsStringAsync(file.uri);
      const importedData: BackupData = JSON.parse(contents);

      if (
        !importedData.events ||
        !importedData.profiles ||
        !importedData.presets
      ) {
        alert("Import failed: File format is invalid.");
        return;
      }

      setEvents(importedData.events);
      setProfiles(importedData.profiles);
      setPresets(importedData.presets);

      await Promise.all(
        importedData.events.map(async (event: any) => {
          const dateString =
            event.date instanceof Date
              ? event.date.toISOString()
              : new Date(event.date).toISOString();
          const toStore = { ...event, date: dateString };

          await AsyncStorage.setItem(
            `@event:${event.id}`,
            JSON.stringify(toStore),
          );
        }),
      );

      alert(`Import successful! Data merged from ${file.name}.`);
    } catch (error) {
      console.error("Import Error:", error);
      alert(
        "Import failed. Please ensure the file is a valid GigKit backup JSON.",
      );
    }
  };

  return (
    <ExportContext.Provider value={{ handleExport, handleImport }}>
      {children}
    </ExportContext.Provider>
  );
};

export const useExport = () => {
  const context = useContext(ExportContext);
  if (context === undefined) {
    throw new Error("useExport must be used within an ExportProvider");
  }
  return context;
};
