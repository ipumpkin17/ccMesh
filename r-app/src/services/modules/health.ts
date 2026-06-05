import { request } from "../request";

export interface MaskedEndpoint {
  name: string;
  apiUrl: string;
  maskedKey: string;
  enabled: boolean;
  testStatus: string;
}

export interface HealthInfo {
  status: string;
  deviceId: string;
  proxyRunning: boolean;
  enabledEndpoints: number;
  endpoints: MaskedEndpoint[];
}

export const healthApi = {
  getHealth: () => request<HealthInfo>("get_health"),
};
