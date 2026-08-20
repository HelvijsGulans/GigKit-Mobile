import AsyncStorage from "@react-native-async-storage/async-storage";

import { Preset, UserProfile } from "../types/dataTypes";

export const saveProfileLocally = async (
  profile: UserProfile,
): Promise<void> => {
  try {
    await AsyncStorage.setItem(`@profile:${profile.name}`, JSON.stringify(profile));
  } catch (error) {
    console.error("Error saving profile locally:", error);
  }
};

export const getProfileObjectLocally = async (
  profileName: string,
): Promise<UserProfile | null> => {
  try {
    const profileString = await AsyncStorage.getItem(`@profile:${profileName}`);

    if (!profileString) {
      return null;
    }

    return JSON.parse(profileString) as UserProfile;
  } catch (error) {
    console.error("Error retrieving profile object locally:", error);
    return null;
  }
};

export const savePresetLocally = async (preset: Preset): Promise<void> => {
  try {
    await AsyncStorage.setItem(`@preset:${preset.id}`, JSON.stringify(preset));
  } catch (error) {
    console.error("Error saving preset locally:", error);
  }
};
