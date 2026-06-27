import type { RefObject } from "react";
import { Globe } from "lucide-react";

import { SettingCard, SettingRow } from "@/components/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { AppConfig } from "@/services/modules/config";

export function ProxyCard({
  cfg,
  save,
  proxyRef,
  testProxy,
  testingProxy,
}: {
  cfg: AppConfig;
  save: (patch: Record<string, string>) => Promise<void>;
  proxyRef: RefObject<HTMLInputElement | null>;
  testProxy: () => Promise<void>;
  testingProxy: boolean;
}) {
  return (
    <SettingCard icon={Globe} title="代理">
      <SettingRow label="启用代理">
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-mute">通过代理路由所有网络请求</span>
          <Switch
            checked={cfg.proxyEnabled}
            onCheckedChange={(v) => save({ proxyEnabled: String(v) })}
            aria-label="启用代理"
          />
        </div>
      </SettingRow>
      <SettingRow label="代理服务器">
        <div className="flex items-center gap-2">
          <Input
            ref={proxyRef}
            className="w-56"
            placeholder="http://127.0.0.1:7890"
            defaultValue={cfg.proxyUrl}
            onBlur={(e) => save({ proxyUrl: e.target.value })}
          />
          <Button variant="outline" size="sm" onClick={testProxy} disabled={testingProxy}>
            测试
          </Button>
        </div>
      </SettingRow>
      <SettingRow label="代理更新">
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-mute">通过代理检查和下载应用更新</span>
          <Switch
            checked={cfg.proxyForUpdate}
            disabled={!cfg.proxyEnabled}
            onCheckedChange={(v) => save({ proxyForUpdate: String(v) })}
            aria-label="代理更新"
          />
        </div>
      </SettingRow>
      <p className="text-xs text-ink-mute">例如 127.0.0.1:7890 或 http://proxy:8080</p>
    </SettingCard>
  );
}
