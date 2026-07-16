import { request } from "../request";
import type { ImportSummary } from "./backup";

export interface ICloudSyncStatus {
  available: boolean;
  enabled: boolean;
  path?: string | null;
  state: "unavailable" | "disabled" | "empty" | "synced" | "local_ahead" | "cloud_ahead" | "conflict" | string;
  localHash: string;
  cloudHash?: string | null;
  cloudUpdatedAt?: string | null;
  message: string;
}

export const icloudApi = {
  getStatus: () => request<ICloudSyncStatus>("get_icloud_sync_status"),
  setEnabled: (enabled: boolean) =>
    request<ICloudSyncStatus>("set_icloud_sync_enabled", { enabled }),
  push: () => request<ICloudSyncStatus>("icloud_push_endpoints"),
  pull: () =>
    request<[ImportSummary, ICloudSyncStatus]>("icloud_pull_endpoints"),
  autoBackup: () => request<ICloudSyncStatus>("icloud_auto_backup_endpoints"),
};
