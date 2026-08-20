import {
  createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from "firebase/auth";

import {
  AuthErrorHandler,
  AuthStateHandler,
  AuthStateUnsubscribe,
  CloudUser,
} from "../types";
import { getFirebaseServices } from "./firebaseConfig";

export const toCloudUser = (user: FirebaseUser | null): CloudUser | null => {
  if (!user) {
    return null;
  }

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
  };
};

export const getCurrentFirebaseUser = (): CloudUser | null =>
  toCloudUser(getFirebaseServices().auth.currentUser);

export const onFirebaseAuthStateChanged = (
  onUser: AuthStateHandler,
  onError?: AuthErrorHandler,
): AuthStateUnsubscribe =>
  firebaseOnAuthStateChanged(
    getFirebaseServices().auth,
    (user) => onUser(toCloudUser(user)),
    onError,
  );

export const signInWithFirebaseEmail = async (
  email: string,
  password: string,
): Promise<CloudUser> => {
  const userCredential = await firebaseSignInWithEmailAndPassword(
    getFirebaseServices().auth,
    email,
    password,
  );
  const user = toCloudUser(userCredential.user);

  if (!user) {
    throw new Error("Firebase sign-in did not return a user.");
  }

  return user;
};

export const createFirebaseEmailUser = async (
  email: string,
  password: string,
): Promise<CloudUser> => {
  const userCredential = await firebaseCreateUserWithEmailAndPassword(
    getFirebaseServices().auth,
    email,
    password,
  );
  const user = toCloudUser(userCredential.user);

  if (!user) {
    throw new Error("Firebase sign-up did not return a user.");
  }

  return user;
};

export const signOutFromFirebase = async (): Promise<void> => {
  await firebaseSignOut(getFirebaseServices().auth);
};
