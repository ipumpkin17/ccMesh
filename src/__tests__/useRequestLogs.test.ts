import { describe, expect, it } from "vitest";

import { requestLogsKey, type RequestLogsParams } from "@/hooks/useRequestLogs";

const base: RequestLogsParams = {
  mode: "live",
  page: 1,
  pageSize: 20,
};

describe("requestLogsKey", () => {
  it("可选段缺失时用 null 占位，保持 key 稳定", () => {
    expect(requestLogsKey(base)).toEqual([
      "request-logs",
      "live",
      null,
      null,
      null,
      1,
      20,
    ]);
  });

  it("区间/端点过滤/分页变化都改变 key", () => {
    const a = requestLogsKey({ ...base, mode: "ranged", startMs: 100, endMs: 200, endpointFilter: "ep-a", page: 2, pageSize: 50 });
    expect(a).toEqual(["request-logs", "ranged", 100, 200, "ep-a", 2, 50]);
    expect(a).not.toEqual(requestLogsKey(base));
  });

  it("mode 不同则 key 不同（live vs ranged 不共享缓存）", () => {
    const live = requestLogsKey({ ...base, mode: "live" });
    const ranged = requestLogsKey({ ...base, mode: "ranged" });
    expect(live).not.toEqual(ranged);
  });
});
