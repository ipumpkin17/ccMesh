import { request } from "@/services/request";

export interface ToolVersion {
  name: string;
  version: string | null;
  latest_version: string | null;
  error: string | null;
  installed_but_broken: boolean;
  env_type: "windows" | "wsl" | "macos" | "linux" | "unknown";
  wsl_distro: string | null;
}

export interface ToolInstallation {
  path: string;
  version: string | null;
  runnable: boolean;
  error: string | null;
  source: string;
  is_path_default: boolean;
}

export interface ToolInstallationReport {
  tool: string;
  installs: ToolInstallation[];
  is_conflict: boolean;
  needs_confirmation: boolean;
  command: string;
  anchored: boolean;
}

export interface LocalCliUserAgents {
  codexUa: string | null;
  claudeUa: string | null;
}

export const toolEnvApi = {
  getToolVersions(tools?: string[]): Promise<ToolVersion[]> {
    return request("get_tool_versions", { tools });
  },

  getLocalCliUserAgents(): Promise<LocalCliUserAgents> {
    return request("get_local_cli_user_agents");
  },

  runToolLifecycleAction(
    tools: string[],
    action: "install" | "update",
  ): Promise<void> {
    return request("run_tool_lifecycle_action", { tools, action });
  },

  probeToolInstallations(
    tools: string[],
  ): Promise<ToolInstallationReport[]> {
    return request("probe_tool_installations", { tools });
  },
};
