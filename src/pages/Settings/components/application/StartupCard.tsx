import type { UseQueryResult } from '@tanstack/react-query'

import { SettingsControl, SettingsRow, SettingsSection } from '@/components/settings'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { AppConfig } from '@/services/modules/config'

export function StartupCard({
  cfg,
  save,
  autostartQ,
  toggleAutostart,
}: {
  cfg: AppConfig
  save: (patch: Record<string, string>) => Promise<void>
  autostartQ: UseQueryResult<boolean>
  toggleAutostart: (on: boolean) => Promise<void>
}) {
  return (
    <SettingsSection title="启动行为">
      <SettingsRow
        title="代理端口"
        description="本地代理服务监听端口"
        control={
          <SettingsControl width="sm">
            <Input defaultValue={String(cfg.port)} onBlur={(e) => save({ port: e.target.value })} />
          </SettingsControl>
        }
      />
      <SettingsRow
        title="自启动"
        description="跟随系统自启动"
        control={<Switch checked={autostartQ.data ?? false} disabled={autostartQ.isLoading} onCheckedChange={toggleAutostart} aria-label="自启动" />}
      />
      <SettingsRow
        title="静默启动"
        description="后台启动，启动时不展示窗口，常驻托盘运行"
        control={<Switch checked={cfg.silentStart} onCheckedChange={(v) => save({ silentStart: String(v) })} aria-label="静默启动" />}
      />
      <SettingsRow
        title="自动运行"
        description="应用打开时自动启动代理服务"
        control={<Switch checked={cfg.autoRun} onCheckedChange={(v) => save({ autoRun: String(v) })} aria-label="自动运行" />}
      />
    </SettingsSection>
  )
}
