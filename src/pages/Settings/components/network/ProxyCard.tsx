import type { RefObject } from "react";

import { SettingsControl, SettingsControls, SettingsRow, SettingsSection } from "@/components/settings";
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
    <SettingsSection title="网络代理">
      <SettingsRow title="启用代理" description="通过代理路由所有网络请求" control={
        <Switch
          checked={cfg.proxyEnabled}
          onCheckedChange={(v) => save({ proxyEnabled: String(v) })}
          aria-label="启用代理"
        />
      } />
      <SettingsRow title="代理服务器" control={
        <SettingsControls>
          <SettingsControl width="lg">
          <Input
            ref={proxyRef}
            placeholder="http://127.0.0.1:7890"
            defaultValue={cfg.proxyUrl}
            onBlur={(e) => save({ proxyUrl: e.target.value })}
          />
          </SettingsControl>
          <Button variant="outline" size="sm" onClick={testProxy} disabled={testingProxy}>
            测试
          </Button>
        </SettingsControls>
      } />
      <SettingsRow title="代理更新" description="通过代理检查和下载应用更新" control={
        <Switch
          checked={cfg.proxyForUpdate}
          disabled={!cfg.proxyEnabled}
          onCheckedChange={(v) => save({ proxyForUpdate: String(v) })}
          aria-label="代理更新"
        />
      } />
    </SettingsSection>
  );
}
