import { Logo } from '@/components/common'
import { Button } from '@/components/ui/button'
import { emptyClass } from '@/lib/typography'

export interface SettingsAppInfoLink {
  label: string
  onClick: () => void
}

/** 设置首页的应用身份和更新状态展示。 */
export function SettingsAppInfo({
  version,
  checking,
  onCheck,
  links,
  update,
}: {
  version: string
  checking: boolean
  onCheck: () => void
  links: readonly SettingsAppInfoLink[]
  update?: {
    version: string
    notes?: string
    progress: number | null
    onInstall: () => void
    onSkip: () => void
  } | null
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Logo
            imageClassName="size-12 rounded-lg"
            nameClassName="text-xl"
            extra={
              version ? (
                <span className="border-edge bg-surface-raised text-ink-secondary inline-flex rounded-full border px-2 py-0.5 font-mono text-xs tabular-nums">v{version}</span>
              ) : undefined
            }
          />
          <Button size="sm" variant="outline" onClick={onCheck} disabled={checking}>
            {checking ? '检查中…' : '检查更新'}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <Button key={link.label} size="sm" variant="outline" onClick={link.onClick}>
              {link.label}
            </Button>
          ))}
        </div>
      </div>

      {update ? (
        <div className="border-primary/20 bg-primary/5 mt-4 rounded-lg border p-4 text-sm">
          <p className="text-ink-primary">
            检测到新版本 <span className="font-mono tabular-nums">{update.version}</span>
          </p>
          {update.notes ? <p className="text-ink-mute mt-2 max-h-32 overflow-y-auto text-xs whitespace-pre-wrap">{update.notes}</p> : null}
          {update.progress !== null ? (
            <div className="bg-surface-hover mt-3 h-1.5 w-full overflow-hidden rounded-full">
              <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${update.progress}%` }} />
            </div>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={update.onInstall}>
              下载并安装
            </Button>
            <Button size="sm" variant="ghost" onClick={update.onSkip}>
              跳过此版本
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export function SettingsAppInfoStatus({ checked }: { checked: boolean }) {
  return checked ? <p className={`mt-4 ${emptyClass}`}>已是最新版本</p> : null
}
