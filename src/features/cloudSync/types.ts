import { Event, Preset, UserProfile } from "@/src/types/dataTypes";

export interface CloudUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export type AuthStateUnsubscribe = () => void;
export type AuthStateHandler = (user: CloudUser | null) => void;
export type AuthErrorHandler = (error: unknown) => void;

export interface CloudSyncService {
  isEnabled: () => boolean;
  getCurrentUser: () => CloudUser | null;
  subscribeToAuthState: (
    onUser: AuthStateHandler,
    onError?: AuthErrorHandler,
  ) => AuthStateUnsubscribe;
  signInWithEmail: (email: string, password: string) => Promise<CloudUser>;
  signUpWithEmail: (email: string, password: string) => Promise<CloudUser>;
  signOut: () => Promise<void>;
  loadProfiles: (userId: string) => Promise<UserProfile[]>;
  saveProfile: (profile: UserProfile, userId: string) => Promise<void>;
  deleteProfile: (userId: string, profileName: string) => Promise<void>;
  syncLocalProfiles: (userId: string) => Promise<void>;
  deleteEventsByProfileName: (
    userId: string,
    profileName: string,
  ) => Promise<void>;
  loadEvents: (userId: string) => Promise<Event[]>;
  saveEvent: (event: Event, userId: string) => Promise<void>;
  deleteEvent: (userId: string, eventId: string) => Promise<void>;
  deleteAllEvents: (userId: string) => Promise<void>;
  syncLocalEvents: (userId: string) => Promise<void>;
  savePreset: (preset: Preset, userId: string) => Promise<void>;
  loadPresets: (userId: string) => Promise<Preset[]>;
  deletePreset: (userId: string, presetId: string) => Promise<void>;
  syncLocalPresets: (userId: string) => Promise<void>;
  deleteAllUserData: (userId: string) => Promise<void>;
}
