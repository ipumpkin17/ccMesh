import { CopyIcon, SearchIcon, Trash2Icon } from 'lucide-react'

import { TabularText } from '@/components/ui'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { allChipClass, CAPTURE_LEVELS, levelChipClass, LOG_LEVELS } from './logLevels'

interface Props {
  selected: Set<string>
  onToggleLevel: (level: string) => void
  onShowAll: () => void
  counts: Record<string, number>
  total: number
  keyword: string
  onKeyword: (s: string) => void
  captureLevel: string
  onCaptureLevel: (level: string) => void
  onCopy: () => void
  onClear: () => void
}

const CHIP_BASE = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors'

/** 日志工具栏：等级过滤 chips(含计数) + 搜索 + 捕获等级开关 + 复制/清空。 */
export function LogToolbar({ selected, onToggleLevel, onShowAll, counts, total, keyword, onKeyword, captureLevel, onCaptureLevel, onCopy, onClear }: Props) {
  const allActive = selected.size === 0

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onShowAll} className={cn(CHIP_BASE, allChipClass(allActive))}>
          ALL <TabularText>{total}</TabularText>
        </button>
        {LOG_LEVELS.map((level) => (
          <button key={level} type="button" onClick={() => onToggleLevel(level)} className={cn(CHIP_BASE, levelChipClass(level, selected.has(level)))}>
            {level} <TabularText>{counts[level] ?? 0}</TabularText>
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <Select value={captureLevel} onValueChange={onCaptureLevel}>
            <SelectTrigger size="sm" className="w-32" title="捕获等级（低于此级别的日志不记录）">
              <span className="text-ink-mute text-xs">捕获</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAPTURE_LEVELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={onCopy}>
            <CopyIcon className="size-4" /> 复制
          </Button>
          <Button variant="outline" size="sm" onClick={onClear}>
            <Trash2Icon className="size-4" /> 清空
          </Button>
        </div>
      </div>

      <div className="relative">
        <SearchIcon className="text-ink-mute absolute top-1/2 left-2 size-4 -translate-y-1/2" />
        <input
          value={keyword}
          onChange={(e) => onKeyword(e.target.value)}
          placeholder="搜索 message / 来源 / 字段…"
          className="border-input bg-surface-raised text-ink-primary placeholder:text-ink-mute focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-sm border pr-2 pl-8 text-sm outline-none focus-visible:ring-[3px]"
        />
      </div>
    </div>
  )
}
