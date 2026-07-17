import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { disable, enable } from '@tauri-apps/plugin-autostart'
import { ArrowRightLeftIcon, CpuIcon, FolderSyncIcon, GlobeIcon, InfoIcon, SlidersHorizontalIcon } from 'lucide-react'
import { toast } from 'sonner'

import { EmptyState, PageShell } from '@/components/common'
import { SettingsPageContent, SettingsWorkspace, type SettingsWorkspaceItem } from '@/components/settings'
import { useAutostartEnabled } from '@/hooks/useAutostartEnabled'
import { configApi } from '@/services/modules/config'
import { AppInfoSection, StartupCard } from './components/application'
import { AdvancedCard, LocalEnvCheck } from './components/advanced'
import { GeneralCard, NavVisibilityCard } from './components/general'
import { ExternalMigrationPanel } from './components/migration'
import { ProxyCard } from './components/network'
import { ICloudSync, LocalBackup, RemoteBackupPanel } from './components/sync'
import { IS_MAC } from '@/lib/platform'
import { useLayoutStore } from '@/stores'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

type SettingsPageId = 'about' | 'general' | 'network' | 'sync' | 'advanced' | 'external'

export function Settings() {
  const qc = useQueryClient()
  const navMode = useLayoutStore((s) => s.navMode)
  const setNavMode = useLayoutStore((s) => s.setNavMode)
  const { data: cfg } = useQuery({ queryKey: ['config'], queryFn: configApi.getConfig })

  const save = async (patch: Record<string, string>) => {
    try {
      await configApi.setConfig(patch)
      qc.invalidateQueries({ queryKey: ['config'] })
    } catch (e) {
      toast.error(`保存失败：${errMsg(e)}`)
    }
  }

  const autostartQ = useAutostartEnabled()
  const toggleAutostart = async (on: boolean) => {
    try {
      if (on) await enable()
      else await disable()
      qc.invalidateQueries({ queryKey: ['autostart-enabled'] })
    } catch (e) {
      toast.error(`设置开机自启失败：${errMsg(e)}`)
      qc.invalidateQueries({ queryKey: ['autostart-enabled'] })
    }
  }

  const [testingProxy, setTestingProxy] = useState(false)
  const proxyRef = useRef<HTMLInputElement>(null)
  const testProxy = async () => {
    const url = (proxyRef.current?.value ?? '').trim() || cfg?.proxyUrl || ''
    setTestingProxy(true)
    try {
      const r = await configApi.testProxy(url)
      if (r.success) toast.success(`${r.message}（${r.latencyMs}ms）`)
      else toast.error(r.message)
    } catch (e) {
      toast.error(`测试失败：${errMsg(e)}`)
    } finally {
      setTestingProxy(false)
    }
  }

  if (!cfg) {
    return (
      <PageShell title="设置">
        <EmptyState>加载中…</EmptyState>
      </PageShell>
    )
  }

  const pages: SettingsWorkspaceItem<SettingsPageId>[] = [
    {
      id: 'about',
      label: '应用设置',
      icon: InfoIcon,
      content: (
        <SettingsPageContent>
          <AppInfoSection />
          <StartupCard cfg={cfg} save={save} autostartQ={autostartQ} toggleAutostart={toggleAutostart} />
        </SettingsPageContent>
      ),
    },
    {
      id: 'general',
      label: '常规设置',
      icon: SlidersHorizontalIcon,
      content: (
        <SettingsPageContent>
          <GeneralCard cfg={cfg} save={save} navMode={navMode} setNavMode={setNavMode} />
          <NavVisibilityCard />
        </SettingsPageContent>
      ),
    },
    {
      id: 'sync',
      label: '数据同步',
      icon: FolderSyncIcon,
      content: (
        <SettingsPageContent>
          {IS_MAC ? <ICloudSync /> : null}
          <LocalBackup />
          <RemoteBackupPanel />
        </SettingsPageContent>
      ),
    },
    {
      id: 'network',
      label: '网络代理',
      icon: GlobeIcon,
      content: <ProxyCard cfg={cfg} save={save} proxyRef={proxyRef} testProxy={testProxy} testingProxy={testingProxy} />,
    },
    {
      id: 'advanced',
      label: '高级设置',
      icon: CpuIcon,
      content: (
        <SettingsPageContent>
          <AdvancedCard cfg={cfg} save={save} />
          <LocalEnvCheck />
        </SettingsPageContent>
      ),
    },
    {
      id: 'external',
      label: '外部迁移',
      icon: ArrowRightLeftIcon,
      content: <ExternalMigrationPanel />,
    },
  ]

  return (
    <PageShell title="设置" contentScrollable={false} contentClassName="min-h-0">
      <SettingsWorkspace items={pages} defaultItemId="about" ariaLabel="设置功能" />
    </PageShell>
  )
}
