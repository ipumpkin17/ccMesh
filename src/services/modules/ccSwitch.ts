import { request } from "../request";

/** 预览项：cc-switch 识别到的单个端点（不写库、不探测）。 */
export interface PreviewItem {
  /** 复合键 `{appType}:{id}`，与 cc-switch 主键一致。 */
  ccSwitchId: string;
  appType: string; // "claude" | "codex"
  name: string;
  /** 规整前原始地址；skipped 项为空。 */
  apiUrl: string;
  /** 脱敏密钥：sk-***xxxx（仅展示）。 */
  apiKeyMasked: string;
  transformer: string; // "claude" | "openai"
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

export const ccSwitchApi = {
  /** 只读识别 cc-switch 供应商，不写库、不探测。dbPath 省略用默认候选。 */
  preview: (dbPath?: string) =>
    request<PreviewItem[]>("preview_cc_switch_import", { dbPath }),
  /** 对勾选项探测模型并写入 endpoints；同名加 (cc-switch) 后缀。 */
  import: (ids: string[], dbPath?: string) =>
    request<ImportSummary>("import_cc_switch_providers", { ids, dbPath }),
};
