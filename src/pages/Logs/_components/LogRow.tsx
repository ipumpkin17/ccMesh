import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import type { LogLine } from '@/services/modules/logs'
import { cn } from '@/lib/utils'
import { levelBadgeClass, levelDotClass } from './logLevels'

/** 关键字命中高亮（大小写不敏感）。 */
function highlight(text: string, kw: string): ReactNode {
  if (!kw) return text
  const lower = text.toLowerCase()
  const k = kw.toLowerCase()
  let idx = lower.indexOf(k)
  if (idx === -1) return text
  const parts: ReactNode[] = []
  let i = 0
  let n = 0
  while (idx !== -1) {
    if (idx > i) parts.push(text.slice(i, idx))
    parts.push(
      <mark key={n++} className="bg-warning/30 text-foreground rounded-sm">
        {text.slice(idx, idx + kw.length)}
      </mark>,
    )
    i = idx + kw.length
    idx = lower.indexOf(k, i)
  }
  if (i < text.length) parts.push(text.slice(i))
  return parts
}

function formatTooltip(line: LogLine): string {
  const fields = line.fields.map((f) => `${f.key}=${f.value}`).join(' ')
  return [line.time, line.level, line.target, line.message, fields].filter(Boolean).join(' ')
}

const MESSAGE_TONE: Record<string, string> = {
  ERROR: 'text-destructive',
  WARN: 'text-warning',
}

/** inline 流式展示完整日志：meta · target · message · fields。 */
export function LogRow({ line, keyword }: { line: LogLine; keyword: string }) {
  const tone = MESSAGE_TONE[line.level]
  const body = highlight(line.message, keyword)

  return (
    <article title={formatTooltip(line)} className="hover:bg-accent/40 px-2 py-1.5">
      <div className="text-xs leading-5 break-all">
        <span className="mr-1 inline-flex items-center gap-1 align-baseline whitespace-nowrap">
          <span aria-hidden className={cn('inline-block size-1.5 shrink-0 rounded-full', levelDotClass(line.level))} />
          <Badge size="xs" className={cn('w-12', levelBadgeClass(line.level))}>
            {line.level}
          </Badge>
          <span className="text-muted-foreground">{line.time}</span>
        </span>

        {line.target ? (
          <>
            <span className="text-muted-foreground">· </span>
            <span className="text-foreground">{line.target}</span>
            <span className="text-muted-foreground"> · </span>
          </>
        ) : null}

        <span className={cn('text-foreground', tone)}>{body}</span>

        {line.fields.map((f) => (
          <span key={f.key} className="text-muted-foreground before:content-['\00a0']">
            {f.key}=<span className="text-foreground">{f.value}</span>
          </span>
        ))}
      </div>
    </article>
  )
}
