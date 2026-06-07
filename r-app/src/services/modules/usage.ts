import { request } from "../request";

export type UsageAppFilter = "all" | "claude" | "codex";

export interface UsageSummary {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
}

export interface ModelUsage {
  appType: string;
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface DailyUsage {
  date: string;
  appType: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface UsageSyncResult {
  imported: number;
  filesScanned: number;
  errors: number;
}

interface UsageFilter {
  start?: string;
  end?: string;
  appType?: string;
}

export const usageApi = {
  /** 触发本机用量增量同步。 */
  sync: () => request<UsageSyncResult>("sync_session_usage"),
  getSummary: (f: UsageFilter = {}) =>
    request<UsageSummary>("get_usage_summary", {
      start: f.start,
      end: f.end,
      appType: f.appType,
    }),
  getByModel: (f: UsageFilter = {}) =>
    request<ModelUsage[]>("get_usage_by_model", {
      start: f.start,
      end: f.end,
      appType: f.appType,
    }),
  getByDay: (f: UsageFilter = {}) =>
    request<DailyUsage[]>("get_usage_by_day", {
      start: f.start,
      end: f.end,
      appType: f.appType,
    }),
};
