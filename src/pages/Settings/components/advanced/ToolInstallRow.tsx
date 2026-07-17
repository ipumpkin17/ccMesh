import type { ToolInstallation } from '@/services/modules/toolEnv'

export function ToolInstallRow({ inst }: { inst: ToolInstallation }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="bg-surface-raised text-ink-mute shrink-0 rounded px-1 py-0.5 font-mono">{inst.source}</span>
      <span className="text-ink-mute min-w-0 flex-1 truncate font-mono" title={inst.path}>
        {inst.path}
      </span>
      <span className={inst.runnable ? 'text-ink-primary shrink-0 font-mono tabular-nums' : 'text-warning shrink-0'}>{inst.runnable ? inst.version : '无法运行'}</span>
      {inst.is_path_default && <span className="border-primary/30 bg-primary/10 text-primary-soft shrink-0 rounded-full border px-1 py-0.5 text-[9px]">默认</span>}
    </div>
  )
}
