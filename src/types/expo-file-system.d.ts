import "expo-file-system";

declare module "expo-file-system" {
  /** Paths that are always present at runtime but missing from the SDK 54 types */
  export const cacheDirectory: string | null;
  export const documentDirectory: string | null;
}
