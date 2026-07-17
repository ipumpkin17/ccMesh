import { CopyIcon, Trash2Icon } from 'lucide-react'

import { SearchField } from '@/components/common'
import { Control, TabularText } from '@/components/ui'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { metaClass } from '@/lib/typography'
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
          <Control width="sm">
            <Select value={captureLevel} onValueChange={onCaptureLevel}>
              <SelectTrigger size="sm" block title="捕获等级（低于此级别的日志不记录）">
                <span className={metaClass}>捕获</span>
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
          </Control>
          <Button variant="outline" size="sm" onClick={onCopy}>
            <CopyIcon className="size-4" /> 复制
          </Button>
          <Button variant="outline" size="sm" onClick={onClear}>
            <Trash2Icon className="size-4" /> 清空
          </Button>
        </div>
      </div>

      <SearchField value={keyword} onChange={onKeyword} placeholder="搜索 message / 来源 / 字段…" />
    </div>
  )
}
