import { useState } from 'react'
import { open as openFileDialog } from '@tauri-apps/plugin-dialog'
import { toast } from 'sonner'

import { SettingsRow, SettingsSection } from '@/components/settings'
import { Button } from '@/components/ui/button'
import { ccSwitchSourceApi, cpaSourceApi, type ExternalMigrationSourceApi } from '@/services/modules/externalMigration'

import { MigrationImportDialog, type CategoryFilterOption } from './MigrationImportDialog'

type SourceId = 'cc-switch' | 'cpa'

type SourceItemConfig = {
  id: SourceId
  title: string
  description: string
  dialogTitle: string
  queryKey: string
  api: ExternalMigrationSourceApi
  defaultLoadingText: string
  emptyText: string
  errorText: (message: string, hasCustomPath: boolean) => string
  categoryFilters: CategoryFilterOption[]
  categoryOrder: Record<string, number>
  fileFilter: { name: string; extensions: string[] }[]
}

const SOURCES: SourceItemConfig[] = [
  {
    id: 'cc-switch',
    title: 'CC Switch',
    description: '自动探测本机 CC Switch 数据库，或手动选择 cc-switch.db',
    dialogTitle: 'CC Switch 配置迁移',
    queryKey: 'external-migration-cc-switch',
    api: ccSwitchSourceApi,
    defaultLoadingText: '正在自动探测 CC Switch 配置…',
    emptyText: '未在 CC Switch 中找到可识别的 Claude / Codex 供应商。',
    errorText: (message, hasCustomPath) => (hasCustomPath ? `读取失败：${message}。请确认所选文件是有效的 CC Switch 数据库。` : `自动探测失败：${message}。可尝试「选择文件」。`),
    categoryFilters: [
      {
        id: 'claude',
        label: 'Claude',
        badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      },
      {
        id: 'codex',
        label: 'Codex',
        badgeClass: 'bg-info/12 text-info',
      },
    ],
    categoryOrder: { claude: 0, codex: 1 },
    fileFilter: [{ name: 'CC Switch 数据库', extensions: ['db'] }],
  },
  {
    id: 'cpa',
    title: 'CLI Proxy API',
    description: '自动探测本机 CLI Proxy API 配置，或手动选择 cliproxyapi.conf',
    dialogTitle: 'CLI Proxy API 配置迁移',
    queryKey: 'external-migration-cpa',
    api: cpaSourceApi,
    defaultLoadingText: '正在自动探测 CLI Proxy API 配置…',
    emptyText: '未在 CLI Proxy API 配置中找到 openai-compatibility / codex-api-key / claude-api-key 上游凭证。',
    errorText: (message, hasCustomPath) =>
      hasCustomPath ? `读取失败：${message}。请确认所选文件是有效的 CLI Proxy API YAML 配置。` : `自动探测失败：${message}。可尝试「选择文件」。`,
    categoryFilters: [
      {
        id: 'openai-compat',
        label: 'OpenAI 兼容',
        badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      },
      {
        id: 'codex',
        label: 'Codex',
        badgeClass: 'bg-info/12 text-info',
      },
      {
        id: 'claude',
        label: 'Claude',
        badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      },
    ],
    categoryOrder: { 'openai-compat': 0, codex: 1, claude: 2 },
    fileFilter: [{ name: 'CLI Proxy API 配置', extensions: ['yaml', 'yml', 'conf'] }],
  },
]

async function pickSourceFile(filters: { name: string; extensions: string[] }[]): Promise<string | null> {
  const selected = await openFileDialog({
    multiple: false,
    directory: false,
    filters,
  })
  return typeof selected === 'string' ? selected : null
}

/** 外部迁移：单卡片内两行（CC Switch / CLI Proxy API），交互一致。 */
export function ExternalMigrationPanel() {
  const [activeSourceId, setActiveSourceId] = useState<SourceId | null>(null)
  /** 当前对话框自定义路径；`undefined` 表示自动探测。 */
  const [activePath, setActivePath] = useState<string | undefined>(undefined)

  const activeSource = SOURCES.find((s) => s.id === activeSourceId) ?? null

  const openWithAutoDetect = (sourceId: SourceId) => {
    setActivePath(undefined)
    setActiveSourceId(sourceId)
  }

  const openWithPickedFile = async (source: SourceItemConfig) => {
    try {
      const path = await pickSourceFile(source.fileFilter)
      if (!path) return
      setActivePath(path)
      setActiveSourceId(source.id)
    } catch (e) {
      toast.error(`选择文件失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const closeDialog = (next: boolean) => {
    if (next) return
    setActiveSourceId(null)
    setActivePath(undefined)
  }

  return (
    <>
      {/* 默认 layout=rows：一张分组卡片 + 组内多行 item */}
      <SettingsSection title="外部迁移">
        {SOURCES.map((source) => (
          <SettingsRow
            key={source.id}
            title={source.title}
            description={source.description}
            control={
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => openWithPickedFile(source)}>
                  选择文件
                </Button>
                <Button size="sm" onClick={() => openWithAutoDetect(source.id)}>
                  自动探测
                </Button>
              </div>
            }
          />
        ))}
      </SettingsSection>

      {activeSource ? (
        <MigrationImportDialog
          open
          onOpenChange={closeDialog}
          title={activeSource.dialogTitle}
          queryKey={activeSource.queryKey}
          api={activeSource.api}
          path={activePath}
          loadingText={activePath ? `正在读取所选 ${activeSource.title} 配置…` : activeSource.defaultLoadingText}
          errorText={(message) => activeSource.errorText(message, Boolean(activePath))}
          emptyText={activeSource.emptyText}
          categoryFilters={activeSource.categoryFilters}
          categoryOrder={activeSource.categoryOrder}
        />
      ) : null}
    </>
  )
}
