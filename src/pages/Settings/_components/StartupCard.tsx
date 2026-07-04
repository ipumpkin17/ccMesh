import type { UseQueryResult } from "@tanstack/react-query";
import { Rocket } from "lucide-react";

import { SettingCard, SettingDescRow } from "@/components/settings";
import { Switch } from "@/components/ui/switch";
import type { AppConfig } from "@/services/modules/config";

export function StartupCard({
  cfg,
  save,
  autostartQ,
  toggleAutostart,
}: {
  cfg: AppConfig;
  save: (patch: Record<string, string>) => Promise<void>;
  autostartQ: UseQueryResult<boolean>;
  toggleAutostart: (on: boolean) => Promise<void>;
}) {
  return (
    <SettingCard icon={Rocket} title="启动行为">
      <SettingDescRow title="自启动" desc="跟随系统自启动">
        <Switch
          checked={autostartQ.data ?? false}
          disabled={autostartQ.isLoading}
          onCheckedChange={toggleAutostart}
          aria-label="自启动"
        />
      </SettingDescRow>
      <SettingDescRow title="静默启动" desc="后台启动，启动时不展示窗口，常驻托盘运行">
        <Switch
          checked={cfg.silentStart}
          onCheckedChange={(v) => save({ silentStart: String(v) })}
          aria-label="静默启动"
        />
      </SettingDescRow>
      <SettingDescRow title="自动运行" desc="应用打开时自动启动代理服务">
        <Switch
          checked={cfg.autoRun}
          onCheckedChange={(v) => save({ autoRun: String(v) })}
          aria-label="自动运行"
        />
      </SettingDescRow>
    </SettingCard>
  );
}
