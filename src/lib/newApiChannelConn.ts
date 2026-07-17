/** NewAPI 渠道连接信息（newapi_channel_conn）解析。 */

export type NewApiChannelConn = {
  name: string;
  apiUrl: string;
  apiKey: string;
};

const CONN_TYPE = "newapi_channel_conn";

const PLACEHOLDER_EXAMPLE =
  '{"_type":"newapi_channel_conn","key":"sk-...","url":"https://www.example.com"}';

export const NEW_API_CONN_PLACEHOLDER = PLACEHOLDER_EXAMPLE;

/** 从上游 URL 推导端点名称：去掉 www/api 前缀后取主域名标签。 */
export function nameFromUpstreamUrl(rawUrl: string): string {
  const host = extractHostname(rawUrl.trim());
  if (!host) return "";

  const labels = host.split(".").filter(Boolean);
  if (labels.length === 0) return host;

  const withoutCommonPrefix =
    labels[0] === "www" || labels[0] === "api" ? labels.slice(1) : labels;
  return withoutCommonPrefix[0] || host;
}

/**
 * 解析单条 NewAPI 连接信息。
 * 支持单个对象，或仅含 1 项的数组；多条 NDJSON/多元素数组会抛错。
 * 不涉及 transformer。
 */
export function parseNewApiChannelConn(text: string): NewApiChannelConn {
  const raw = text.trim();
  if (!raw) {
    throw new Error("请粘贴 NewAPI 连接信息");
  }
  if (hasMultipleJsonObjects(raw)) {
    throw new Error("当前仅支持一次导入一条连接信息");
  }

  const parsed = parseJsonOrThrow(raw);
  const obj = requireSingleObject(parsed);
  requireConnType(obj);

  const apiKey = readRequiredString(obj, "key");
  const apiUrl = readRequiredString(obj, "url").replace(/\/+$/, "");
  const name = nameFromUpstreamUrl(apiUrl);
  if (!name) {
    throw new Error("无法从 url 推导名称");
  }

  return { name, apiUrl, apiKey };
}

function extractHostname(rawUrl: string): string {
  if (!rawUrl) return "";
  try {
    const withScheme = /^https?:\/\//i.test(rawUrl)
      ? rawUrl
      : `https://${rawUrl}`;
    return new URL(withScheme).hostname;
  } catch {
    return (
      rawUrl
        .replace(/^https?:\/\//i, "")
        .split("/")[0]
        ?.split(":")[0]
        ?.trim() ?? ""
    );
  }
}

function parseJsonOrThrow(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("不是合法 JSON");
  }
}

/** 粗略检测多段 NDJSON（多行均以 { 开头）。 */
function hasMultipleJsonObjects(text: string): boolean {
  if (!text.includes("\n")) return false;
  const objectLines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{"));
  return objectLines.length > 1;
}

function requireSingleObject(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    if (value.length === 0) throw new Error("连接信息为空");
    if (value.length > 1) {
      throw new Error("当前仅支持一次导入一条连接信息");
    }
    const first = value[0];
    if (!isPlainObject(first)) {
      throw new Error("连接信息格式无效");
    }
    return first;
  }
  if (!isPlainObject(value)) {
    throw new Error("连接信息必须是 JSON 对象");
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireConnType(obj: Record<string, unknown>): void {
  if (obj._type !== CONN_TYPE) {
    throw new Error(`_type 必须为 ${CONN_TYPE}`);
  }
}

function readRequiredString(
  obj: Record<string, unknown>,
  field: "key" | "url",
): string {
  const value = typeof obj[field] === "string" ? obj[field].trim() : "";
  if (!value) {
    throw new Error(`缺少 ${field}`);
  }
  return value;
}
