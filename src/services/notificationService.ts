import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import { Event } from "@/src/types/dataTypes";

const NOTIF_KEY_PREFIX = "@notifs:";

// Ensure notifications show while app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function initNotifications() {
  try {
    const settings = await Notifications.requestPermissionsAsync();
    return (
      settings.granted ||
      settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  } catch (e) {
    console.error("Failed to request notification permissions", e);
    return false;
  }
}

async function saveScheduledIds(eventId: string, ids: string[]) {
  try {
    await AsyncStorage.setItem(NOTIF_KEY_PREFIX + eventId, JSON.stringify(ids));
  } catch (e) {
    console.error("Failed to persist scheduled notification ids", e);
  }
}

async function readScheduledIds(eventId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_KEY_PREFIX + eventId);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch (e) {
    console.error("Failed to read scheduled notification ids", e);
    return [];
  }
}

export async function cancelEventNotifications(eventId: string) {
  try {
    const ids = await readScheduledIds(eventId);
    await Promise.all(
      ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
    );
    await AsyncStorage.removeItem(NOTIF_KEY_PREFIX + eventId);
  } catch (e) {
    console.error("Failed to cancel notifications for event", eventId, e);
  }
}

export async function scheduleEventNotifications(event: Event) {
  try {
    if (!event || !event.date) return;

    // Ensure we work with a Date
    const eventDate =
      event.date instanceof Date ? event.date : new Date(event.date);
    const now = new Date();

    const toSchedule: { when: Date; body: string; title?: string }[] = [];

    // 1 week before
    const weekBefore = new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (weekBefore > now) {
      toSchedule.push({
        when: weekBefore,
        title: "Upcoming gig (1 week)",
        body: `${event.eventName} is in 1 week (${eventDate.toDateString()})`,
      });
    }

    // 1 day before
    const dayBefore = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
    if (dayBefore > now) {
      toSchedule.push({
        when: dayBefore,
        title: "Upcoming gig (1 day)",
        body: `${event.eventName} is tomorrow (${eventDate.toDateString()})`,
      });
    }

    // Cancel any existing ones first
    await cancelEventNotifications(event.id);

    const ids: string[] = [];
    for (const s of toSchedule) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: s.title || "Upcoming gig",
          body: s.body,
          data: { eventId: event.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: s.when,
        },
      });
      ids.push(id);
    }

    if (ids.length > 0) await saveScheduledIds(event.id, ids);
  } catch (e) {
    console.error("Failed to schedule notifications for event", event?.id, e);
  }
}

export default {
  initNotifications,
  scheduleEventNotifications,
  cancelEventNotifications,
};
