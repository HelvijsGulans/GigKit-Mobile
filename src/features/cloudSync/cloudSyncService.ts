import { CLOUD_SYNC_ENABLED } from "./config";
import { firebaseCloudSyncService } from "./firebase/firebaseSyncService";
import { CloudSyncService } from "./types";

const createDisabledCloudSyncError = () => {
  const error = new Error("Cloud sync is disabled.");
  return Object.assign(error, { code: "cloud-sync/disabled" });
};

const disabledCloudSyncService: CloudSyncService = {
  isEnabled: () => false,
  getCurrentUser: () => null,
  subscribeToAuthState: (onUser) => {
    onUser(null);
    return () => {};
  },
  signInWithEmail: async () => {
    throw createDisabledCloudSyncError();
  },
  signUpWithEmail: async () => {
    throw createDisabledCloudSyncError();
  },
  signOut: async () => {},
  loadProfiles: async () => [],
  saveProfile: async () => {},
  deleteProfile: async () => {},
  syncLocalProfiles: async () => {},
  deleteEventsByProfileName: async () => {},
  loadEvents: async () => [],
  saveEvent: async () => {},
  deleteEvent: async () => {},
  deleteAllEvents: async () => {},
  syncLocalEvents: async () => {},
  savePreset: async () => {},
  loadPresets: async () => [],
  deletePreset: async () => {},
  syncLocalPresets: async () => {},
  deleteAllUserData: async () => {},
};

export const cloudSyncService: CloudSyncService = CLOUD_SYNC_ENABLED
  ? firebaseCloudSyncService
  : disabledCloudSyncService;

export const getCloudAuthErrorCode = (error: unknown): string | null => {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return null;
};
