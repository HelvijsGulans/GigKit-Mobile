import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { Event, Preset, UserProfile } from "@/src/types/dataTypes";

import {
  createFirebaseEmailUser,
  getCurrentFirebaseUser,
  onFirebaseAuthStateChanged,
  signInWithFirebaseEmail,
  signOutFromFirebase,
} from "./firebaseAuthService";
import { getFirebaseServices } from "./firebaseConfig";
import { CloudSyncService } from "../types";

const getDb = () => getFirebaseServices().db;

const getUserEventsCollectionRef = (userId: string) =>
  collection(getDb(), "users", userId, "events");

const getUserPresetsCollectionRef = (userId: string) =>
  collection(getDb(), "users", userId, "presets");

const getUserProfilesCollectionRef = (userId: string) =>
  collection(getDb(), "users", userId, "profiles");

const parseStoredValue = <T>(value: string | null): T | null => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const loadProfiles = async (userId: string): Promise<UserProfile[]> => {
  try {
    const profilesRef = getUserProfilesCollectionRef(userId);
    const querySnapshot = await getDocs(query(profilesRef));

    const profiles: UserProfile[] = [];
    querySnapshot.forEach((profileDoc) => {
      profiles.push({ id: profileDoc.id, ...profileDoc.data() } as UserProfile);
    });

    return profiles;
  } catch (error) {
    console.error("Error loading profiles from Firebase:", error);
    return [];
  }
};

const saveProfile = async (
  profile: UserProfile,
  userId: string,
): Promise<void> => {
  try {
    const profileRef = doc(getUserProfilesCollectionRef(userId), profile.name);
    await setDoc(profileRef, profile, { merge: true });
  } catch (error) {
    console.error("Error saving profile to Firebase:", error);
  }
};

const deleteProfile = async (
  userId: string,
  profileName: string,
): Promise<void> => {
  try {
    await deleteDoc(doc(getUserProfilesCollectionRef(userId), profileName));
  } catch (error) {
    console.error("Error deleting profile from Firebase:", error);
  }
};

const syncLocalProfiles = async (userId: string): Promise<void> => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const profileKeys = allKeys.filter((key) => key.startsWith("@profile:"));

    if (profileKeys.length === 0) {
      return;
    }

    const localData = await AsyncStorage.multiGet(profileKeys);
    const localProfiles = localData
      .map(([, value]) => parseStoredValue<UserProfile>(value))
      .filter((profile): profile is UserProfile => !!profile);

    const unsyncedProfiles = localProfiles.filter(
      (profile) => !profile.authUserId || profile.authUserId !== userId,
    );

    await Promise.all(
      unsyncedProfiles.map((profile) =>
        saveProfile({ ...profile, authUserId: userId }, userId),
      ),
    );
  } catch (error) {
    console.error("Error syncing local profiles to Firebase:", error);
  }
};

const deleteEventsByProfileName = async (
  userId: string,
  profileName: string,
): Promise<void> => {
  try {
    const eventsRef = getUserEventsCollectionRef(userId);
    const querySnapshot = await getDocs(
      query(eventsRef, where("profileId", "==", profileName)),
    );

    if (querySnapshot.docs.length === 0) {
      return;
    }

    const batch = writeBatch(getDb());
    querySnapshot.docs.forEach((eventDoc) => {
      batch.delete(eventDoc.ref);
    });
    await batch.commit();
  } catch (error) {
    console.error("Error deleting cloud events by profile name:", error);
  }
};

const loadEvents = async (userId: string): Promise<Event[]> => {
  try {
    const eventsRef = getUserEventsCollectionRef(userId);
    const querySnapshot = await getDocs(query(eventsRef));

    const events: Event[] = [];
    querySnapshot.forEach((eventDoc) => {
      events.push({ id: eventDoc.id, ...eventDoc.data() } as Event);
    });

    return events;
  } catch (error) {
    console.error("Error loading events from Firebase:", error);
    return [];
  }
};

const saveEvent = async (event: Event, userId: string): Promise<void> => {
  try {
    if (!event.id) {
      console.error("Cannot save event without an ID to Firebase.");
      return;
    }

    await setDoc(doc(getUserEventsCollectionRef(userId), event.id), event, {
      merge: true,
    });
  } catch (error) {
    console.error("Error saving event to Firebase:", error);
  }
};

const deleteEvent = async (userId: string, eventId: string): Promise<void> => {
  try {
    await deleteDoc(doc(getUserEventsCollectionRef(userId), eventId));
  } catch (error) {
    console.error("Error deleting event from Firebase:", error);
  }
};

const deleteAllEvents = async (userId: string): Promise<void> => {
  try {
    const eventsSnapshot = await getDocs(getUserEventsCollectionRef(userId));

    if (eventsSnapshot.docs.length === 0) {
      return;
    }

    const batch = writeBatch(getDb());
    eventsSnapshot.docs.forEach((eventDoc) => {
      batch.delete(eventDoc.ref);
    });
    await batch.commit();
  } catch (error) {
    console.error("Error deleting all events from Firebase:", error);
  }
};

const syncLocalEvents = async (userId: string): Promise<void> => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const eventKeys = allKeys.filter((key) => key.startsWith("@event:"));

    if (eventKeys.length === 0) {
      return;
    }

    const localData = await AsyncStorage.multiGet(eventKeys);
    const localEvents = localData
      .map(([, value]) => parseStoredValue<Event>(value))
      .filter((event): event is Event => !!event);

    const unsyncedEvents = localEvents.filter(
      (event) => !event.authUserId || event.authUserId !== userId,
    );

    await Promise.all(
      unsyncedEvents.map((event) =>
        saveEvent({ ...event, authUserId: userId }, userId),
      ),
    );
  } catch (error) {
    console.error("Error syncing local events to Firebase:", error);
  }
};

const savePreset = async (preset: Preset, userId: string): Promise<void> => {
  try {
    await setDoc(doc(getUserPresetsCollectionRef(userId), preset.id), preset, {
      merge: true,
    });
  } catch (error) {
    console.error("Error saving preset to Firebase:", error);
  }
};

const loadPresets = async (userId: string): Promise<Preset[]> => {
  try {
    const presetsRef = getUserPresetsCollectionRef(userId);
    const querySnapshot = await getDocs(query(presetsRef));

    const presets: Preset[] = [];
    querySnapshot.forEach((presetDoc) => {
      presets.push({ id: presetDoc.id, ...presetDoc.data() } as Preset);
    });

    return presets;
  } catch (error) {
    console.error("Error loading presets from Firebase:", error);
    return [];
  }
};

const deletePreset = async (
  userId: string,
  presetId: string,
): Promise<void> => {
  try {
    await deleteDoc(doc(getUserPresetsCollectionRef(userId), presetId));
  } catch (error) {
    console.error("Error deleting preset from Firebase:", error);
  }
};

const syncLocalPresets = async (userId: string): Promise<void> => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const presetKeys = allKeys.filter((key) => key.startsWith("@preset:"));

    if (presetKeys.length === 0) {
      return;
    }

    const localData = await AsyncStorage.multiGet(presetKeys);
    const localPresets = localData
      .map(([, value]) => parseStoredValue<Preset>(value))
      .filter((preset): preset is Preset => !!preset);

    const unsyncedPresets = localPresets.filter(
      (preset) => !preset.authUserId || preset.authUserId !== userId,
    );

    await Promise.all(
      unsyncedPresets.map((preset) =>
        savePreset({ ...preset, authUserId: userId }, userId),
      ),
    );
  } catch (error) {
    console.error("Error syncing local presets to Firebase:", error);
  }
};

const deleteAllUserData = async (userId: string): Promise<void> => {
  try {
    const batch = writeBatch(getDb());

    const profilesSnapshot = await getDocs(getUserProfilesCollectionRef(userId));
    profilesSnapshot.docs.forEach((profileDoc) => {
      batch.delete(profileDoc.ref);
    });

    const eventsSnapshot = await getDocs(getUserEventsCollectionRef(userId));
    eventsSnapshot.docs.forEach((eventDoc) => {
      batch.delete(eventDoc.ref);
    });

    const presetsSnapshot = await getDocs(getUserPresetsCollectionRef(userId));
    presetsSnapshot.docs.forEach((presetDoc) => {
      batch.delete(presetDoc.ref);
    });

    await batch.commit();
  } catch (error) {
    console.error("Error deleting all user data from Firebase:", error);
  }
};

export const firebaseCloudSyncService: CloudSyncService = {
  isEnabled: () => true,
  getCurrentUser: getCurrentFirebaseUser,
  subscribeToAuthState: onFirebaseAuthStateChanged,
  signInWithEmail: signInWithFirebaseEmail,
  signUpWithEmail: createFirebaseEmailUser,
  signOut: signOutFromFirebase,
  loadProfiles,
  saveProfile,
  deleteProfile,
  syncLocalProfiles,
  deleteEventsByProfileName,
  loadEvents,
  saveEvent,
  deleteEvent,
  deleteAllEvents,
  syncLocalEvents,
  savePreset,
  loadPresets,
  deletePreset,
  syncLocalPresets,
  deleteAllUserData,
};
