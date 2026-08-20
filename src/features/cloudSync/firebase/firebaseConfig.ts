import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { getApp, getApps, initializeApp } from "firebase/app";
import type { FirebaseApp, FirebaseOptions } from "firebase/app";
import { getAuth, initializeAuth } from "firebase/auth";
import type { Auth, Persistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

import { CLOUD_SYNC_ENABLED } from "../config";

type FirebaseExtraConfig = Record<string, unknown>;

type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const firebaseAuthModule = require("firebase/auth") as {
  getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
};

let firebaseServices: FirebaseServices | null = null;

const getExtra = (): FirebaseExtraConfig =>
  (Constants.expoConfig?.extra ?? {}) as FirebaseExtraConfig;

const getExtraString = (key: string): string | undefined => {
  const value = getExtra()[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const getFirebaseOptions = (): FirebaseOptions => ({
  apiKey: getExtraString("FIREBASE_API_KEY"),
  authDomain: getExtraString("FIREBASE_AUTH_DOMAIN"),
  projectId: getExtraString("FIREBASE_PROJECT_ID"),
  storageBucket: getExtraString("FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getExtraString("FIREBASE_MESSAGING_SENDER_ID"),
  appId: getExtraString("FIREBASE_APP_ID"),
  measurementId: getExtraString("FIREBASE_MEASUREMENT_ID"),
});

const assertFirebaseConfig = (options: FirebaseOptions): void => {
  const requiredKeys: (keyof FirebaseOptions)[] = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId",
  ];

  const missingKeys = requiredKeys.filter((key) => !options[key]);

  if (missingKeys.length > 0) {
    throw new Error(
      `Cloud sync is enabled, but Firebase config is missing: ${missingKeys.join(
        ", ",
      )}`,
    );
  }
};

export const getFirebaseServices = (): FirebaseServices => {
  if (!CLOUD_SYNC_ENABLED) {
    throw new Error("Cloud sync is disabled.");
  }

  if (firebaseServices) {
    return firebaseServices;
  }

  const firebaseOptions = getFirebaseOptions();
  assertFirebaseConfig(firebaseOptions);

  const hadExistingApp = getApps().length > 0;
  const app = hadExistingApp ? getApp() : initializeApp(firebaseOptions);

  let auth: Auth;
  const persistence =
    firebaseAuthModule.getReactNativePersistence?.(AsyncStorage);

  if (!hadExistingApp && persistence) {
    try {
      auth = initializeAuth(app, { persistence });
    } catch {
      auth = getAuth(app);
    }
  } else {
    auth = getAuth(app);
  }

  firebaseServices = {
    app,
    auth,
    db: getFirestore(app),
  };

  return firebaseServices;
};

export const hasInitializedFirebaseServices = (): boolean =>
  firebaseServices !== null;
