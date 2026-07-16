import type { UnlistenFn } from "@tauri-apps/api/event";

import { Events, request, subscribe } from "../request";

export interface ProxyStatus {
  running: boolean;
  port: number;
  currentEndpointId: string | null;
  currentEndpoint: string | null;
  enabledEndpointCount: number;
}

export const proxyApi = {
  start: () => request<ProxyStatus>("start_proxy"),
  stop: () => request<ProxyStatus>("stop_proxy"),
  status: () => request<ProxyStatus>("get_proxy_status"),
  switchEndpoint: (endpointId: string) =>
    request<ProxyStatus>("switch_endpoint", { endpointId }),
  /** 订阅代理状态变更事件，返回取消订阅函数。 */
  onStatusChanged: (cb: (status: ProxyStatus) => void): Promise<UnlistenFn> =>
    subscribe<ProxyStatus>(Events.proxyStatusChanged, (e) => cb(e.payload)),
};
