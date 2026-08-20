import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cloudSyncService } from "../features/cloudSync";
import { Event, Preset } from "../types/dataTypes";
import { useProfile } from "./profileContext";
import { useUser } from "./UserContext";

export interface EventsContextType {
  events: Event[];
  loadEvents: () => Promise<void>;
  addEvent: (event: Event) => Promise<void>;
  updateEvent: (event: Event) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  deleteAllEvents: () => Promise<void>;
  setAllEvents: React.Dispatch<React.SetStateAction<Event[]>>;
  attachPresetToEvent: (
    eventId: string,
    presetId: string,
    type: "riders" | "stageplans",
  ) => Promise<void>;
}

export const eventsContext = createContext<EventsContextType>({
  events: [],
  loadEvents: async () => {},
  addEvent: async () => {},
  updateEvent: async () => {},
  deleteEvent: async () => {},
  deleteAllEvents: async () => {},
  setAllEvents: () => {},
  attachPresetToEvent: async () => {},
});

export const EventsProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const { selectedProfile } = useProfile();
  const { user } = useUser();

  const loadEvents = useCallback(async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const eventKeys = allKeys.filter((key) => key.startsWith("@event:"));
      const localData = await AsyncStorage.multiGet(eventKeys);

      const localEvents: Event[] = localData
        .map(([_, value]) => (value ? JSON.parse(value) : null))
        .filter((e): e is Event => {
          return (
            !!e &&
            typeof e.id === "string" &&
            typeof e.eventName === "string" &&
            typeof e.date === "string"
          );
        })
        .map((e) => ({ ...e, date: new Date(e.date) }));

      const userId = user?.uid;

      if (cloudSyncService.isEnabled() && userId) {
        await cloudSyncService.syncLocalEvents(userId);

        const cloudEvents = (await cloudSyncService.loadEvents(userId)).map(
          (e) => ({
            ...e,
            date: new Date(e.date),
          }),
        );

        const merged = [
          ...localEvents,
          ...cloudEvents.filter(
            (fe) => !localEvents.some((le) => le.id === fe.id),
          ),
        ];

        setAllEvents(merged);
      } else {
        setAllEvents(localEvents);
      }
    } catch (error) {
      console.error("Error loading events:", error);
      setAllEvents([]);
    }
  }, [selectedProfile, setAllEvents, user?.uid]);
  useEffect(() => {
    loadEvents();
  }, [selectedProfile, loadEvents]);

  const addEvent = useCallback(
    async (newEvent: Event) => {
      try {
        let safeDate: Date;
        if (!newEvent.date) {
          safeDate = new Date();
        } else if (newEvent.date instanceof Date) {
          safeDate = newEvent.date;
        } else {
          safeDate = new Date(newEvent.date);
        }

        const toStore = {
          ...newEvent,
          date: safeDate.toISOString(),
        };

        await loadEvents();
      } catch (error) {
        console.error("Error adding event:", error);
      }
    },
    [loadEvents],
  );

  const updateEvent = useCallback(
    async (updatedEvent: Event) => {
      try {
        let safeDate: Date;
        if (!updatedEvent.date) {
          safeDate = new Date();
        } else if (updatedEvent.date instanceof Date) {
          safeDate = updatedEvent.date;
        } else {
          safeDate = new Date(updatedEvent.date);
        }

        const toStore = {
          ...updatedEvent,
          date: safeDate.toISOString(),
        };

        await AsyncStorage.setItem(
          `@event:${updatedEvent.id}`,
          JSON.stringify(toStore),
        );

        await loadEvents();
      } catch (error) {
        console.error("Error updating event:", error);
      }
    },
    [setAllEvents, loadEvents],
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      try {
        await AsyncStorage.removeItem(`@event:${id}`);

        const userId = user?.uid;
        if (cloudSyncService.isEnabled() && userId) {
          await cloudSyncService.deleteEvent(userId, id);
        }

        setAllEvents((prev) => prev.filter((e) => e.id !== id));
      } catch (error) {
        console.error("Error deleting event:", error);
      }
    },
    [user?.uid],
  );

  const deleteAllEvents = useCallback(async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const eventKeys = keys.filter((k) => k.startsWith("@event:"));
      if (eventKeys.length > 0) await AsyncStorage.multiRemove(eventKeys);

      const userId = user?.uid;
      if (cloudSyncService.isEnabled() && userId) {
        await cloudSyncService.deleteAllEvents(userId);
      }

      setAllEvents([]);
    } catch (error) {
      console.error("Error deleting all events:", error);
    }
  }, [user?.uid]);

  const attachPresetToEvent = useCallback(
    async (
      eventId: string,
      presetId: string,
      type: "riders" | "stageplans",
    ) => {
      const event = allEvents.find((e) => e.id === eventId);
      if (!event) return;

      let updatedEvent: Event = { ...event };

      const presetJson = await AsyncStorage.getItem(`@preset:${presetId}`);
      if (!presetJson) {
        console.warn(`Preset ${presetId} not found in local storage.`);
        return;
      }

      const preset: Preset = JSON.parse(presetJson);

      if (type === "riders") {
        updatedEvent.riderPresetId = presetId;

        const riderItems = Array.isArray(preset.config?.riderItems)
          ? JSON.parse(JSON.stringify(preset.config.riderItems))
          : [];

        const expandAll = (items: any[]): any[] =>
          items.map((i) => ({
            ...i,
            expanded: true,
            children: i.children ? expandAll(i.children) : [],
          }));

        updatedEvent.requirements = expandAll(riderItems);
      } else if (type === "stageplans") {
        updatedEvent.stagePlanPresetId = presetId;
        updatedEvent.stageIcons = preset.stageIcons || [];
        updatedEvent.stageLayout = preset.config?.stageLayout || {
          x: 0,
          y: 0,
          width: 595,
          height: 842,
        };
      }

      try {
        await AsyncStorage.setItem(
          `@event:${updatedEvent.id}`,
          JSON.stringify({
            ...updatedEvent,
            date:
              updatedEvent.date instanceof Date
                ? updatedEvent.date.toISOString()
                : updatedEvent.date,
          }),
        );

        setAllEvents((prev) =>
          prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)),
        );

        await loadEvents();
      } catch (error) {
        console.error("Failed to attach preset:", error);
      }
    },
    [allEvents, loadEvents, setAllEvents],
  );

  const ALL_PROFILES_VIEW = "Default Profile";

  const filteredEvents = useMemo(() => {
    if (!selectedProfile || selectedProfile === ALL_PROFILES_VIEW) {
      return allEvents;
    }
    return allEvents.filter((e) => e.profileId === selectedProfile);
  }, [allEvents, selectedProfile]);
  return (
    <eventsContext.Provider
      value={{
        events: filteredEvents,
        loadEvents,
        addEvent,
        updateEvent,
        deleteEvent,
        deleteAllEvents,
        setAllEvents,
        attachPresetToEvent,
      }}
    >
      {children}
    </eventsContext.Provider>
  );
};

export default EventsProvider;
