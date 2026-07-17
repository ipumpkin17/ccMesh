import { request } from "../request";

/** 预览项：外部迁移识别到的端点候选（不写库、不探测）。 */
export interface PreviewItem {
  /** 来源内唯一键，用于勾选与导入。 */
  sourceId: string;
  /** 筛选维度（由各来源定义，如 claude/codex）。 */
  category: string;
  name: string;
  /** 规整前原始地址；skipped 项为空。 */
  apiUrl: string;
  /** 脱敏密钥：sk-***xxxx（仅展示）。 */
  apiKeyMasked: string;
  transformer: string;
  modelsHint: string[];
  status: "ok" | "skipped";
  skipReason?: string;
}

export interface ImportItem {
  name: string;
  status: "imported" | "skipped";
  modelCount: number;
  enabled: boolean;
  skipReason?: string;
}

export interface ImportSummary {
  total: number;
  imported: number;
  enabledCount: number;
  disabledNoModels: number;
  skipped: number;
  items: ImportItem[];
}

/** 某一外部源的预览 / 导入 API 绑定。 */
export interface ExternalMigrationSourceApi {
  preview: (path?: string) => Promise<PreviewItem[]>;
  import: (ids: string[], path?: string) => Promise<ImportSummary>;
}

/** cc-switch 源：命令名保留兼容，payload 字段已通用化。 */
export const ccSwitchSourceApi: ExternalMigrationSourceApi = {
  preview: (dbPath) =>
    request<PreviewItem[]>("preview_cc_switch_import", { dbPath }),
  import: (ids, dbPath) =>
    request<ImportSummary>("import_cc_switch_providers", { ids, dbPath }),
};

/** CPA 源：默认路径或上传文件路径。 */
export const cpaSourceApi: ExternalMigrationSourceApi = {
  preview: (path) => request<PreviewItem[]>("preview_cpa_import", { path }),
  import: (ids, path) =>
    request<ImportSummary>("import_cpa_providers", { ids, path }),
};
