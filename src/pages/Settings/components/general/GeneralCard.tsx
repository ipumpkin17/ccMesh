import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from 'next-themes'

import { SettingsControl, SettingsControls, SettingsRow, SettingsSection } from '@/components/settings'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { AppConfig } from '@/services/modules/config'
import { logsApi } from '@/services/modules/logs'
import { windowApi } from '@/services/modules/window'
import type { NavMode } from '@/stores'

export function GeneralCard({
  cfg,
  save,
  navMode,
  setNavMode,
}: {
  cfg: AppConfig
  save: (patch: Record<string, string>) => Promise<void>
  navMode: NavMode
  setNavMode: (mode: NavMode) => void
}) {
  const qc = useQueryClient()
  const { setTheme } = useTheme()

  return (
    <SettingsSection title="常规设置">
      <SettingsRow
        title="主题"
        description="选择应用界面的配色方案"
        control={
          <SettingsControl width="md">
            <Select
              value={cfg.theme}
              onValueChange={(v) => {
                setTheme(v)
                save({ theme: v })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">跟随系统</SelectItem>
                <SelectItem value="light">浅色</SelectItem>
                <SelectItem value="dark">深色</SelectItem>
              </SelectContent>
            </Select>
          </SettingsControl>
        }
      />

      <SettingsRow
        title="定时自动切换主题"
        description="按设定时间自动切换浅色与深色主题"
        control={<Switch checked={cfg.themeAuto} onCheckedChange={(v) => save({ themeAuto: String(v) })} />}
      />

      {cfg.themeAuto && (
        <SettingsRow
          title="浅色 / 深色起始时间"
          description="设置两种主题的自动切换时间"
          control={
            <SettingsControls>
              <SettingsControl width="xs">
                <Input type="time" defaultValue={cfg.autoLightStart} onBlur={(e) => save({ autoLightStart: e.target.value })} />
              </SettingsControl>
              <SettingsControl width="xs">
                <Input type="time" defaultValue={cfg.autoDarkStart} onBlur={(e) => save({ autoDarkStart: e.target.value })} />
              </SettingsControl>
            </SettingsControls>
          }
        />
      )}

      <SettingsRow
        title="语言"
        description="设置应用的显示语言"
        control={
          <SettingsControl width="md">
            <Select
              value={cfg.language}
              onValueChange={(v) => {
                windowApi.setLanguage(v).catch(() => undefined)
                save({ language: v })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh">中文</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </SettingsControl>
        }
      />

      <SettingsRow
        title="关闭窗口行为"
        description="选择关闭窗口后的默认处理方式"
        control={
          <SettingsControl width="md">
            <Select value={cfg.closeWindowBehavior} onValueChange={(v) => save({ closeWindowBehavior: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ask">每次询问</SelectItem>
                <SelectItem value="minimize">最小化到托盘</SelectItem>
                <SelectItem value="quit">直接退出</SelectItem>
              </SelectContent>
            </Select>
          </SettingsControl>
        }
      />

      <SettingsRow
        title="导航布局"
        description="选择侧边或顶部导航布局"
        control={
          <SettingsControl width="md">
            <Select value={navMode} onValueChange={(v) => setNavMode(v as NavMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vertical">侧边导航</SelectItem>
                <SelectItem value="horizontal">顶部导航</SelectItem>
              </SelectContent>
            </Select>
          </SettingsControl>
        }
      />

      <SettingsRow
        title="日志级别"
        description="控制运行日志的详细程度"
        control={
          <SettingsControl width="md">
            <Select
              value={cfg.logLevel}
              onValueChange={(v) => {
                logsApi.setLevel(v).catch(() => undefined)
                qc.invalidateQueries({ queryKey: ['config'] })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['trace', 'debug', 'info', 'warn', 'error'].map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsControl>
        }
      />
    </SettingsSection>
  )
}
