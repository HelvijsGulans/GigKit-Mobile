import Constants from "expo-constants";

type CloudSyncExtraConfig = {
  ENABLE_CLOUD_SYNC?: boolean | string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as CloudSyncExtraConfig;

const isTruthyFlag = (value: boolean | string | undefined): boolean =>
  value === true || value === "true";

export const CLOUD_SYNC_ENABLED = isTruthyFlag(extra.ENABLE_CLOUD_SYNC);
