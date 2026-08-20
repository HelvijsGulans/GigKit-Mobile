import { RiderItem } from "@/app/screens/rider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";

import { IconAssetId, IconSource } from "./iconAssets";
export interface Icon {
  id: string;
  assetId?: IconAssetId;
  source?: IconSource;
  x: number;
  y: number;
    width?: number;
  height?: number;
  rotation?: number;
  label?: string;
  isText?: boolean;
  scale?: number;
  isLocked?: boolean;
  isEditing?: boolean;
}

export interface StageLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Event {
  id: string;
  eventName: string;
  venue?: string;
  date: Date;
  requirements?: RiderItem[];
  stageIcons?: Icon[];
  stageLayout?: StageLayout;
  profileId?: string;
  riderPresetId?: string;
  stagePlanPresetId?: string;
}

const EVENT_KEY_PREFIX = "@event:";

export const saveEvent = async ({
  id,
  eventName,
  venue,
  date,
  requirements,
  stageIcons,
  stageLayout,
  profileId,
}: Partial<Event> & { eventName: string; date: Date }): Promise<Event> => {
  if (!eventName.trim()) {
    Alert.alert("Missing Event Name", "Please enter a name for your event!");
    throw new Error("Event name is required.");
  }
  if (!date || isNaN(date.getTime())) {
    Alert.alert("Missing Date", "Please select a valid date for your event!");
    throw new Error("Event date is required.");
  }

  const eventToSave: Event = {
    id: id || Date.now().toString(),
    eventName,
    venue: venue || "",
    date,
    requirements: requirements || [],
    stageIcons: stageIcons || [],
    stageLayout: stageLayout || { x: 0, y: 0, width: 1000, height: 1000 },
    profileId: profileId || "Default Profile",
  };

  await AsyncStorage.setItem(
    `${EVENT_KEY_PREFIX}${eventToSave.id}`,
    JSON.stringify({ ...eventToSave, date: eventToSave.date.toISOString() }),
  );

  return eventToSave;
};

export const getAllEvents = async (): Promise<Event[]> => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const eventKeys = allKeys.filter((key) => key.startsWith(EVENT_KEY_PREFIX));
    const eventJsons = await AsyncStorage.multiGet(eventKeys);

    return eventJsons
      .map(([_, value]) => {
        if (!value) return null;
        const parsed = JSON.parse(value);
        return {
          ...parsed,
          date: new Date(parsed.date),
          requirements: parsed.requirements || [],
        };
      })
      .filter(Boolean) as Event[];
  } catch (e) {
    console.error("Failed to get all events", e);
    return [];
  }
};

export const deleteEventFromStorage = async (id: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(`${EVENT_KEY_PREFIX}${id}`);
  } catch (e) {
    console.error("Error deleting event", e);
    throw new Error("Failed to delete event from storage.");
  }
};

export default getAllEvents;
