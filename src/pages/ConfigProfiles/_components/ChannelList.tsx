import { PlusIcon, Trash2Icon } from 'lucide-react'

import { EmptyState } from '@/components/common'
import { IconButton } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { ChannelMeta } from '@/services/modules/tool_config'
import { panelTitleClass } from '@/lib/typography'

interface Props {
  channels: ChannelMeta[]
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (channel: ChannelMeta) => void
}

/** 左栏：已保存渠道列表 + 顶部新增按钮。行内删除按钮与右键菜单都触发 onDelete。 */
export function ChannelList({ channels, loading, selectedId, onSelect, onNew, onDelete }: Props) {
  return (
    <div className="flex h-full min-h-0 w-56 shrink-0 flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className={panelTitleClass}>渠道</span>
        <IconButton type="button" variant="ghost" size="default" onClick={onNew} aria-label="新增渠道" title="新增渠道">
          <PlusIcon className="size-4" />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <EmptyState align="center" padded>
            加载中…
          </EmptyState>
        ) : channels.length === 0 ? (
          <EmptyState align="center" padded>
            暂无渠道，点击右上角 + 新增
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-1">
            {channels.map((ch) => (
              <li key={ch.id}>
                <div
                  className={cn(
                    'group flex cursor-pointer items-center justify-between rounded-md px-2.5 py-2 text-sm transition-colors',
                    selectedId === ch.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                  onClick={() => onSelect(ch.id)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    onDelete(ch)
                  }}
                >
                  <span className="truncate" title={ch.name}>
                    {ch.name}
                  </span>
                  <button
                    type="button"
                    aria-label={`删除 ${ch.name}`}
                    className="text-muted-foreground hover:text-destructive ml-2 hidden shrink-0 group-hover:block"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(ch)
                    }}
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
