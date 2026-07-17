import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { InfoIcon, TriangleAlertIcon, Trash2Icon } from 'lucide-react'

import { EmptyState, SurfaceCard } from '@/components/common'
import { Control, IconButton, StatusDot, TabularText } from '@/components/ui'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Pagination } from '@/components/ui/Pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRequestLogs } from '@/hooks/useRequestLogs'
import { EndpointLabel } from '@/components/business/EndpointLabel'
import { RequestLogsCleanupDialog } from '@/components/business/RequestLogsCleanupDialog'
import { RANGE_OPTIONS, rangeMs, startOfTodayMs, type RangeKey } from '@/lib/range'
import { formatDuration, formatTokenK } from '@/lib/format'
import { statsApi, type RequestLog } from '@/services/modules/stats'
import { sectionTitleClass, tableHeadClass } from '@/lib/typography'

type Mode = 'live' | 'ranged'

interface Props {
  /** live：事件驱动实时刷新；ranged：时间段 + 分页查询。 */
  mode: Mode
  /** 可选端点过滤。 */
  endpointFilter?: string
  pageSize?: number
  /** 标题（默认按模式取）。 */
  title?: string
}

/**
 * 端点请求实时监控（统计页 ranged / 仪表盘 live 复用）。
 * 数据统一走 `get_request_logs` 分页查询；live 模式在第 1 页时由 `request-logged` 事件触发刷新。
 */
export function RequestMonitor({ mode, endpointFilter, pageSize = 20, title }: Props) {
  const [page, setPage] = useState(1)
  const [rangeKey, setRangeKey] = useState<RangeKey>('today')
  const [cleanupOpen, setCleanupOpen] = useState(false)
  // 按天对齐的稳定锚点：同一天内多次渲染得到相同区间，避免 queryKey 逐帧漂移导致无限重取。
  const todayStart = startOfTodayMs()
  const range = useMemo(() => (mode === 'ranged' ? rangeMs(rangeKey, todayStart) : {}), [mode, rangeKey, todayStart])

  const { data, isLoading } = useRequestLogs({
    mode,
    startMs: range.startMs,
    endMs: range.endMs,
    endpointFilter,
    page,
    pageSize,
  })
  const { data: retentionDays } = useQuery({
    queryKey: ['request-log-retention-days'],
    queryFn: statsApi.getRetentionDays,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className={sectionTitleClass}>{title ?? (mode === 'live' ? '实时请求监控' : '端点请求记录')}</h2>
        <div className="flex shrink-0 items-center gap-2">
          {mode === 'ranged' && (
            <Control width="sm">
              <Select
                value={rangeKey}
                onValueChange={(v) => {
                  setRangeKey(v as RangeKey)
                  setPage(1)
                }}
              >
                <SelectTrigger block>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANGE_OPTIONS.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Control>
          )}
          <IconButton size="sm" variant="ghost" onClick={() => setCleanupOpen(true)} className="hover:text-destructive" aria-label="清理请求明细">
            <Trash2Icon className="size-4" />
          </IconButton>
        </div>
      </div>

      <RequestLogsCleanupDialog open={cleanupOpen} onOpenChange={setCleanupOpen} retentionDays={retentionDays} onCleaned={() => setPage(1)} />

      {isLoading ? <EmptyState>加载中…</EmptyState> : <RequestLogTable items={items} />}

      {total > pageSize && <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />}
    </section>
  )
}

/** 纯展示：请求明细表（空态自处理），便于复用与单测。 */
export function RequestLogTable({ items }: { items: RequestLog[] }) {
  if (items.length === 0) {
    return <EmptyState>暂无请求记录</EmptyState>
  }
  return (
    <SurfaceCard as="div" padding="none" className="overflow-hidden">
      <table className="text-ink-secondary w-full table-fixed text-xs">
        <thead>
          <tr className="border-edge-subtle border-b">
            <th className={`w-[9.5rem] p-2 text-left whitespace-nowrap ${tableHeadClass}`}>时间</th>
            <th className={`min-w-0 p-2 text-left whitespace-nowrap ${tableHeadClass}`}>端点</th>
            <th className={`min-w-0 p-2 text-left whitespace-nowrap ${tableHeadClass}`}>模型</th>
            <th className={`min-w-0 p-2 text-left whitespace-nowrap ${tableHeadClass}`}>入站</th>
            <th className={`min-w-0 p-2 text-left whitespace-nowrap ${tableHeadClass}`}>出站</th>
            <th className={`w-[4.25rem] px-1.5 py-2 text-left whitespace-nowrap ${tableHeadClass}`}>状态</th>
            <th className={`w-14 p-2 text-right whitespace-nowrap ${tableHeadClass}`}>用时</th>
            <th className={`w-14 p-2 text-right whitespace-nowrap ${tableHeadClass}`}>首字</th>
            <th className={`w-[5.5rem] p-2 text-right whitespace-nowrap ${tableHeadClass}`}>Token</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <RequestRow key={r.id || r.ts} log={r} />
          ))}
        </tbody>
      </table>
    </SurfaceCard>
  )
}

/** 请求时间按 24 小时制 时：分：秒（零填充）展示，避免地区设置带来的上午/下午前缀。 */
export function fmtTime(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 请求日期 年 - 月 - 日（零填充，本地时区）。 */
export function fmtDate(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 请求时间完整展示：年 - 月 - 日 时：分：秒（24 小时制）。 */
export function fmtDateTime(ts: number): string {
  return `${fmtDate(ts)} ${fmtTime(ts)}`
}

function statusDot(code: number | null): 'success' | 'warning' | 'danger' {
  if (code == null) return 'danger'
  if (code < 300) return 'success'
  if (code < 400) return 'warning'
  return 'danger'
}

export function formatErrorBody(errorBody: string): string {
  try {
    return JSON.stringify(JSON.parse(errorBody), null, 2)
  } catch {
    return errorBody
  }
}

export function ErrorDetail({ errorBody }: { errorBody: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-medium">错误详情</div>
      <pre className="text-ink-secondary font-mono text-xs break-words whitespace-pre-wrap">{formatErrorBody(errorBody)}</pre>
    </div>
  )
}

/** 旧行无真实路径时，按入站协议推断兜底路由。 */
function inferPath(format: string): string {
  if (format === 'openai') return '/v1/chat/completions'
  if (format === 'responses') return '/v1/responses'
  if (format === 'claude') return '/v1/messages'
  return '—'
}

/** 表格正文：统一字号与次要色；路径类技术字段才用等宽。 */
const CELL = 'p-2 text-xs text-ink-secondary'
const CELL_PATH = `${CELL} font-mono`
const NUM = 'text-xs text-ink-secondary tabular-nums tracking-tight'

/**
 * 合并入站/出站模型展示：
 * - 透传或同名 → 只显示一个
 * - 改写 → `入站 -> 出站`
 */
export function formatRequestModel(model: string | null, actualModel: string | null): { display: string; title?: string } {
  const inbound = model?.trim() || ''
  const outbound = actualModel?.trim() || inbound
  if (!inbound && !outbound) return { display: '—' }

  const rewritten = Boolean(actualModel?.trim()) && inbound !== outbound
  if (rewritten) {
    return {
      display: `${inbound || '—'} -> ${outbound || '—'}`,
      title: `入站 ${inbound || '—'} → 出站 ${outbound || '—'}`,
    }
  }

  const display = inbound || outbound || '—'
  return { display, title: display === '—' ? undefined : display }
}

function RequestRow({ log }: { log: RequestLog }) {
  const { display: modelDisplay, title: modelTitle } = formatRequestModel(log.model, log.actualModel)
  const total = log.inputTokens + log.outputTokens + log.cacheCreationTokens + log.cacheReadTokens
  return (
    <tr className="border-edge-subtle border-b last:border-0">
      <td className={`w-[9.5rem] ${CELL} whitespace-nowrap ${NUM}`} title={fmtDateTime(log.ts)}>
        {fmtDateTime(log.ts)}
      </td>
      <td className={`min-w-0 ${CELL}`}>
        <EndpointLabel name={log.endpointName} type={log.transformer ?? log.inboundFormat} endpointId={log.endpointId} />
      </td>
      <td className={`min-w-0 truncate ${CELL}`} title={modelTitle}>
        {modelDisplay}
      </td>
      <td className={`min-w-0 truncate ${CELL_PATH}`} title={`入站协议：${log.inboundFormat}`}>
        {log.inboundPath || inferPath(log.inboundFormat)}
      </td>
      <td className={`min-w-0 truncate ${CELL_PATH}`} title={log.upstreamUrl ? `${log.upstreamUrl}${log.upstreamPath}` : undefined}>
        {log.upstreamPath || inferPath(log.inboundFormat)}
      </td>
      <td className={`text-ink-secondary w-[4.25rem] px-1.5 py-2 text-xs`}>
        <div className="inline-flex items-center gap-1">
          <StatusDot status={statusDot(log.statusCode)} />
          <span className={NUM}>{log.statusCode ?? 'ERR'}</span>
          {log.isError && log.errorBody ? (
            <HoverCard openDelay={100} closeDelay={50}>
              <HoverCardTrigger asChild>
                <button
                  type="button"
                  aria-label="查看错误详情"
                  title="查看错误详情"
                  className="text-warning/60 hover:text-warning inline-flex shrink-0 items-center transition-colors"
                >
                  <TriangleAlertIcon className="size-3" />
                </button>
              </HoverCardTrigger>
              <HoverCardContent align="center" className="max-h-72 w-96 overflow-auto">
                <ErrorDetail errorBody={log.errorBody} />
              </HoverCardContent>
            </HoverCard>
          ) : null}
        </div>
      </td>
      <td className={`${CELL} text-right ${NUM}`}>{!log.isError && log.durationMs != null ? formatDuration(log.durationMs) : '—'}</td>
      <td className={`${CELL} text-right ${NUM}`}>{!log.isError && log.firstByteMs != null ? formatDuration(log.firstByteMs) : '—'}</td>
      <td className={`w-[5.5rem] ${CELL} text-right`}>
        <HoverCard openDelay={100} closeDelay={50}>
          <HoverCardTrigger asChild>
            <button type="button" className="text-ink-secondary hover:text-foreground inline-flex items-center justify-end gap-1 text-xs whitespace-nowrap transition-colors">
              <span className={NUM}>{total}</span>
              <InfoIcon className="size-3 shrink-0" />
            </button>
          </HoverCardTrigger>
          <HoverCardContent align="end" className="w-56">
            <TokenDetail log={log} total={total} />
          </HoverCardContent>
        </HoverCard>
      </td>
    </tr>
  )
}

export function TokenDetail({ log, total }: { log: RequestLog; total: number }) {
  const rows: [string, number][] = [
    ['输入', log.inputTokens],
    ['输出', log.outputTokens],
    ['缓存创建', log.cacheCreationTokens],
    ['缓存读取', log.cacheReadTokens],
  ]
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      {log.model && (
        <div className="text-ink-secondary truncate" title={log.model}>
          入站模型：{log.model}
        </div>
      )}
      {(log.actualModel || log.model) && (
        <div title={log.actualModel || log.model || undefined} className="text-ink-secondary">
          出站模型：
          <span className="text-info truncate">{log.actualModel || log.model}</span>
        </div>
      )}
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-4">
          <span className="text-ink-secondary">{k}</span>
          <span title={v.toLocaleString()}>
            <TabularText>{formatTokenK(v)}</TabularText>
          </span>
        </div>
      ))}
      <div className="border-edge-subtle mt-1 flex items-center justify-between gap-4 border-t pt-1.5 font-medium">
        <span>合计</span>
        <span title={total.toLocaleString()}>
          <TabularText>{formatTokenK(total)}</TabularText>
        </span>
      </div>
      {!log.isError && log.firstByteMs != null && (
        <div className="text-ink-secondary flex items-center justify-between gap-4">
          <span>首字</span>
          <TabularText>{formatDuration(log.firstByteMs)}</TabularText>
        </div>
      )}
      {!log.isError && log.durationMs != null && (
        <div className="text-ink-secondary flex items-center justify-between gap-4">
          <span>耗时</span>
          <TabularText>{formatDuration(log.durationMs)}</TabularText>
        </div>
      )}
    </div>
  )
}
