import { RiderItem } from "@/app/screens/rider";
import Icon from "react-native-vector-icons/Ionicons";
import { StageLayout } from "../utils/ridersHelpers";

// --- User Profile ---
export interface UserProfile {
  id?: string;
  name: string;
  bio: string;
  avatarUrl?: string;
  authUserId: string;
  color: string;
}

// --- Event/Gig Data ---
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
  authUserId?: string;
}

// --- Preset Data (Reusable Templates) ---
export interface Preset {
  id: string;
  name: string;
  type: "riders" | "stageplans";
  authUserId?: string;
  config: Record<string, any>;
  details?: string;
  stageIcons?: Icon[];
  stageLayout?: StageLayout;
}
