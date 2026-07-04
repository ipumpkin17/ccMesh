import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useEndpointHealthEvents } from "@/hooks/useEndpointHealth";

const mockedListen = vi.mocked(listen);
// 捕获各事件订阅回调，供测试手动触发
const handlers = new Map<string, (e: { payload: unknown }) => void>();

function wrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe("useEndpointHealthEvents 精确化失效", () => {
  beforeEach(() => {
    handlers.clear();
    mockedListen.mockImplementation((event, cb) => {
      handlers.set(event, cb as (e: { payload: unknown }) => void);
      return Promise.resolve(() => {}) as unknown as ReturnType<typeof listen>;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("endpoints-changed 仅失效 ['endpoints']", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { unmount } = renderHook(() => useEndpointHealthEvents(), { wrapper: wrapper(qc) });
    await Promise.resolve(); // 等待订阅 Promise 微任务落地

    handlers.get("endpoints-changed")!({ payload: null });

    expect(spy).toHaveBeenCalledWith({ queryKey: ["endpoints"] });
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ["endpoint-health"] });
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ["health"] });
    unmount();
  });

  it("endpoint-health-changed 仅失效 ['endpoint-health']", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const { unmount } = renderHook(() => useEndpointHealthEvents(), { wrapper: wrapper(qc) });
    await Promise.resolve();

    handlers.get("endpoint-health-changed")!({ payload: null });

    expect(spy).toHaveBeenCalledWith({ queryKey: ["endpoint-health"] });
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ["endpoints"] });
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ["health"] });
    unmount();
  });
});
