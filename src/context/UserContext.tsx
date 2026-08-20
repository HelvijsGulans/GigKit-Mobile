import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import { cloudSyncService, CloudUser } from "../features/cloudSync";

interface UserContextType {
  user: CloudUser | null;
  loading: boolean;
  hasSeenTutorial: boolean;
  cloudSyncEnabled: boolean;
  signIn: (email: string, pass: string) => Promise<CloudUser | null>;
  signUp: (email: string, pass: string) => Promise<CloudUser | null>;
  logOut: () => Promise<void>;
  completeTutorial: () => Promise<void>;
}

export const UserContext = createContext<UserContextType | undefined>(
  undefined,
);

const STORAGE_KEY = "@has_launched_before";

export const UserProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<CloudUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(true);
  const cloudSyncEnabled = cloudSyncService.isEnabled();

  useEffect(() => {
    const checkFirstLaunch = async () => {
      try {
        const hasLaunched = await AsyncStorage.getItem(STORAGE_KEY);
        if (hasLaunched === null) {
          setHasSeenTutorial(false);
        }
      } catch (error) {
        console.error("Error checking launch status", error);
      }
    };

    checkFirstLaunch();

    if (!cloudSyncEnabled) {
      setUser(null);
      setLoading(false);
      return;
    }

    const unsubscribe = cloudSyncService.subscribeToAuthState(
      (cloudUser) => {
        setUser(cloudUser);
        setLoading(false);
      },
      (error) => {
        console.warn("Cloud auth state error:", error);
        setLoading(false);
      },
    );

    const timer = setTimeout(() => setLoading(false), 3000);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [cloudSyncEnabled]);

  const signIn = async (email: string, pass: string) => {
    const cloudUser = await cloudSyncService.signInWithEmail(email, pass);
    setUser(cloudUser);
    return cloudUser;
  };

  const signUp = async (email: string, pass: string) => {
    const cloudUser = await cloudSyncService.signUpWithEmail(email, pass);
    setUser(cloudUser);
    return cloudUser;
  };

  const logOut = async () => {
    await cloudSyncService.signOut();
    setUser(null);
  };

  const completeTutorial = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, "true");
      setHasSeenTutorial(true);
    } catch (error) {
      console.error("Failed to save tutorial status", error);
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        hasSeenTutorial,
        cloudSyncEnabled,
        signIn,
        signUp,
        logOut,
        completeTutorial,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
