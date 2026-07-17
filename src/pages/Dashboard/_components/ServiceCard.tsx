import { CopyIcon, HelpCircleIcon, XIcon, ZapIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react'
import { useSortable } from '@dnd-kit/react/sortable'
import { move } from '@dnd-kit/helpers'

import { IconButton, StatusDot, TabularText } from '@/components/ui'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useEndpoints } from '@/hooks/useEndpoints'
import { useEndpointHealth, useEndpointHealthEvents } from '@/hooks/useEndpointHealth'
import { useProxyStatus } from '@/hooks/useProxyStatus'
import { cn } from '@/lib/utils'
import { endpointApi, type Endpoint } from '@/services/modules/endpoint'
import { circuitDot, type EndpointHealth } from '@/services/modules/health'
import { proxyApi } from '@/services/modules/proxy'
import { statsApi } from '@/services/modules/stats'
import { useLayoutStore } from '@/stores'
import { ProxyScene } from './ProxyScene'
import { appendFastId, removeFastId, reorderFastIds, splitEndpointQueues } from './fastQueue'
import { EmptyState, HintButton } from '@/components/common'
import { panelTitleClass, metaClass } from '@/lib/typography'

type QueueStatus = 'success' | 'danger' | 'warning' | 'info' | 'idle'

const statusText: Record<QueueStatus, string> = {
  success: 'text-success',
  danger: 'text-destructive',
  warning: 'text-warning',
  info: 'text-info',
  idle: 'text-muted-foreground',
}

function endpointStatus(
  endpoint: Endpoint,
  current: string | null,
  running: boolean,
  healthById: Map<string, EndpointHealth>,
): { status: QueueStatus; active: boolean; title?: string } {
  const active = endpoint.uid === current
  const health = healthById.get(endpoint.uid)
  if (health && health.circuit !== 'closed') {
    return {
      active,
      status: circuitDot(health.circuit),
      title: `${health.circuit === 'open' ? '熔断中' : '恢复中'}${health.lastError ? ` · ${health.lastError}` : ''}`,
    }
  }
  return { active, status: active && running ? 'info' : 'success' }
}

function FastMark({ status, pulse }: { status: QueueStatus; pulse?: boolean }) {
  // 快速队列专属色：成功态用金色（VIP 感），其他状态保持原色
  const fastColor = status === 'success' ? 'text-amber-500' : statusText[status]
  return (
    <span className={cn('inline-flex items-center', fastColor, pulse && 'animate-pulse')} aria-label="快速队列">
      <ZapIcon className="size-3" fill="currentColor" />
    </span>
  )
}

function QueueItem({
  endpoint,
  current,
  running,
  healthById,
  fast,
}: {
  endpoint: Endpoint
  current: string | null
  running: boolean
  healthById: Map<string, EndpointHealth>
  fast?: boolean
}) {
  const { status, active, title } = endpointStatus(endpoint, current, running, healthById)
  return (
    <li title={title} className="inline-flex items-center gap-1.5">
      {fast ? <FastMark status={status} pulse={active && running} /> : <StatusDot status={status} pulse={active && running} />}
      <span className={cn('rounded-md px-2 py-0.5 text-sm transition-colors', active ? 'bg-accent text-accent-foreground font-medium' : 'text-foreground')}>{endpoint.name}</span>
    </li>
  )
}

function QueueSection({
  endpoints,
  empty,
  current,
  running,
  healthById,
}: {
  endpoints: Endpoint[]
  empty: string
  current: string | null
  running: boolean
  healthById: Map<string, EndpointHealth>
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {endpoints.length === 0 ? (
        <EmptyState>{empty}</EmptyState>
      ) : (
        <ul className="flex flex-wrap gap-x-2 gap-y-1.5">
          {endpoints.map((endpoint) => (
            <QueueItem key={endpoint.id} endpoint={endpoint} current={current} running={running} healthById={healthById} fast={endpoint.fast} />
          ))}
        </ul>
      )}
    </div>
  )
}

const FAST_QUEUE_DROP_ID = 'fast-queue-drop'
const ENABLED_QUEUE_DROP_ID = 'enabled-queue-drop'

function DraggableEndpointCard({ endpoint, fast, onDoubleClick, onRemove }: { endpoint: Endpoint; fast?: boolean; onDoubleClick: () => void; onRemove?: () => void }) {
  const { ref, isDragging } = useDraggable({ id: endpoint.id })

  return (
    <div
      ref={ref}
      onDoubleClick={onDoubleClick}
      className={cn(
        'bg-card flex cursor-grab items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors select-none active:cursor-grabbing',
        isDragging ? 'opacity-40' : 'hover:bg-accent',
      )}
      title={fast ? '拖动整个端点卡片移出快速队列；双击移出快速队列' : '拖动整个端点卡片加入快速队列；双击加入快速队列'}
    >
      {fast ? <FastMark status="success" /> : null}
      <span className="min-w-0 flex-1 truncate font-medium">{endpoint.name}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          onDoubleClick={(event) => event.stopPropagation()}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded p-1 transition-colors"
          aria-label={`移出快速队列 ${endpoint.name}`}
        >
          <XIcon className="size-4" />
        </button>
      ) : null}
    </div>
  )
}

function FastSortableEndpointCard({ endpoint, index, onDoubleClick, onRemove }: { endpoint: Endpoint; index: number; onDoubleClick: () => void; onRemove: () => void }) {
  const { ref, isDragging, isDropTarget } = useSortable({ id: endpoint.id, index })

  return (
    <div
      ref={ref}
      onDoubleClick={onDoubleClick}
      className={cn(
        'bg-card flex cursor-grab items-center gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors select-none active:cursor-grabbing',
        isDragging && 'opacity-40',
        isDropTarget && 'ring-primary/50 ring-2',
        !isDragging && 'hover:bg-accent',
      )}
      title="拖动排序或拖到启用队列；双击移出快速队列"
    >
      <FastMark status="success" />
      <span className="min-w-0 flex-1 truncate font-medium">{endpoint.name}</span>
      <button
        type="button"
        onClick={onRemove}
        onDoubleClick={(event) => event.stopPropagation()}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded p-1 transition-colors"
        aria-label={`移出快速队列 ${endpoint.name}`}
      >
        <XIcon className="size-4" />
      </button>
    </div>
  )
}

function FastQueueTransfer({
  fastQueue,
  enabledQueue,
  moveIntoFast,
  remove,
}: {
  fastQueue: Endpoint[]
  enabledQueue: Endpoint[]
  moveIntoFast: (id: number) => void
  remove: (id: number) => void
}) {
  const fastDrop = useDroppable({ id: FAST_QUEUE_DROP_ID })
  const enabledDrop = useDroppable({ id: ENABLED_QUEUE_DROP_ID })

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section
        ref={fastDrop.ref}
        className={cn('bg-card flex h-96 flex-col rounded-lg border transition-colors', fastDrop.isDropTarget && 'border-primary/50 bg-accent ring-primary/30 ring-2')}
      >
        <div className="bg-card sticky top-0 z-10 flex items-center gap-2 rounded-t-lg border-b px-3.5 py-2.5">
          <h3 className={panelTitleClass}>快速队列</h3>
          <Popover>
            <PopoverTrigger asChild>
              <HintButton aria-label="快速队列用法说明">
                <HelpCircleIcon className="size-3.5" />
              </HintButton>
            </PopoverTrigger>
            <PopoverContent side="right" className="w-80">
              <div className="flex flex-col gap-1.5 text-xs">
                <p className="font-medium">快速队列用法</p>
                <p>• 快速队列中的端点会优先轮询</p>
                <p>• 双击端点卡片可快速切换队列</p>
                <p>• 在快速队列内拖动可调整优先级顺序</p>
              </div>
            </PopoverContent>
          </Popover>
          <span className="bg-muted ml-auto rounded-md px-2 py-0.5 text-xs">
            <TabularText>{fastQueue.length}</TabularText>
          </span>
        </div>
        <div className="flex-1 scrollbar-none overflow-y-auto p-4">
          {fastQueue.length === 0 ? (
            <div className="bg-muted/50 flex h-full items-center justify-center rounded-lg border border-dashed p-5">
              <EmptyState align="center">
                从右侧拖入启用端点
                <br />
                或双击右侧端点加入快速队列
              </EmptyState>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {fastQueue.map((endpoint, index) => (
                <FastSortableEndpointCard key={endpoint.id} endpoint={endpoint} index={index} onDoubleClick={() => remove(endpoint.id)} onRemove={() => remove(endpoint.id)} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section
        ref={enabledDrop.ref}
        className={cn('bg-card flex h-96 flex-col rounded-lg border transition-colors', enabledDrop.isDropTarget && 'border-primary/50 bg-accent ring-primary/30 ring-2')}
      >
        <div className="bg-card sticky top-0 z-10 flex items-center gap-2 rounded-t-lg border-b px-3.5 py-2.5">
          <h3 className={panelTitleClass}>启用队列</h3>
          <span className="bg-muted ml-auto rounded-md px-2 py-0.5 text-xs">
            <TabularText>{enabledQueue.length}</TabularText>
          </span>
        </div>
        <div className="flex-1 scrollbar-none overflow-y-auto p-4">
          {enabledQueue.length === 0 ? (
            <div className="bg-muted/50 flex h-full items-center justify-center rounded-lg border border-dashed p-5">
              <EmptyState align="center">
                启用队列暂无可加入
                <br />
                快速队列的端点
              </EmptyState>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {enabledQueue.map((endpoint) => (
                <DraggableEndpointCard key={endpoint.id} endpoint={endpoint} onDoubleClick={() => moveIntoFast(endpoint.id)} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function FastQueueDialog({
  open,
  onOpenChange,
  fastQueue,
  enabledQueue,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  fastQueue: Endpoint[]
  enabledQueue: Endpoint[]
}) {
  const qc = useQueryClient()
  const fastIds = fastQueue.map((e) => e.id)

  const save = useMutation({
    mutationFn: async (nextIds: number[]) => endpointApi.reorderFast(nextIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['endpoints'] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  })

  const setFast = useMutation({
    mutationFn: async ({ id, fast, order }: { id: number; fast: boolean; order?: number[] }) => {
      await endpointApi.update(id, { fast })
      if (order) await endpointApi.reorderFast(order)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['endpoints'] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  })

  const moveIntoFast = (id: number) => {
    setFast.mutate({ id, fast: true, order: appendFastId(fastIds, id) })
  }
  const remove = (id: number) => {
    setFast.mutate({ id, fast: false, order: removeFastId(fastIds, id) })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>编辑快速队列</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto">
          <DragDropProvider
            onDragEnd={(event) => {
              if (event.canceled) return
              const sourceId = event.operation.source?.id
              const targetId = event.operation.target?.id
              if (typeof sourceId !== 'number') return
              if (targetId === ENABLED_QUEUE_DROP_ID && fastIds.includes(sourceId)) {
                remove(sourceId)
                return
              }
              const sourceIsFast = fastIds.includes(sourceId)
              const targetFastId = typeof targetId === 'number' && fastIds.includes(targetId) ? targetId : undefined
              if (sourceIsFast && targetFastId !== undefined) {
                const next = move(fastQueue, event).map((endpoint) => endpoint.id)
                if (next.some((id, index) => id !== fastIds[index])) save.mutate(next)
                return
              }
              if (targetId === FAST_QUEUE_DROP_ID || targetFastId !== undefined) {
                const withSource = appendFastId(fastIds, sourceId)
                const next = targetFastId ? reorderFastIds(withSource, sourceId, targetFastId) : withSource
                setFast.mutate({ id: sourceId, fast: true, order: next })
              }
            }}
          >
            <FastQueueTransfer fastQueue={fastQueue} enabledQueue={enabledQueue} moveIntoFast={moveIntoFast} remove={remove} />
          </DragDropProvider>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * 仪表盘首卡（左 2/3 / 右 1/3 双卡片）：
 * 左卡=端点队列（快速队列优先显示）；
 * 右卡=本地代理信息 + 开关 + 端口跳设置，叠加雪山日落场景（开启太阳升起、关闭落下）。
 */
export function ServiceCard() {
  const qc = useQueryClient()
  const { data: status } = useProxyStatus()
  const { data: endpointList } = useEndpoints()
  const setActiveView = useLayoutStore((s) => s.setActiveView)
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
  const [fastEditorOpen, setFastEditorOpen] = useState(false)
  // 最近一条请求明细对应的端点（与实时监控同源，第一时间反映轮换/故障转移）。
  const [liveEndpoint, setLiveEndpoint] = useState<string | null>(null)
  // 端点实时健康/熔断态；健康/端点变更事件到达即刷新（共享 hook 统一订阅）。
  useEndpointHealthEvents()
  const { data: epHealth } = useEndpointHealth()
  const healthById = useMemo(() => {
    const byId = new Map<string, EndpointHealth>()
    for (const health of epHealth ?? []) byId.set(health.endpointId, health)
    return byId
  }, [epHealth])
  const { fastQueue, enabledQueue } = useMemo(() => splitEndpointQueues(endpointList ?? []), [endpointList])
  const allQueueEndpoints = useMemo(() => [...fastQueue, ...enabledQueue], [fastQueue, enabledQueue])

  // 实时高亮：新请求明细到达即更新当前工作端点（与下方实时监控同一事件源）。
  useEffect(() => {
    let un: (() => void) | undefined
    statsApi
      .onRequestLogged((log) => setLiveEndpoint(log.endpointId))
      .then((u) => {
        un = u
      })
    return () => un?.()
  }, [])

  const running = status?.running ?? false
  // 停机后清空实时端点，避免重启后短暂高亮上次的陈旧端点。
  useEffect(() => {
    if (!running) setLiveEndpoint(null)
  }, [running])

  // 优先用最近请求明细的端点；回退代理状态；停机不高亮。
  const current = running ? (liveEndpoint ?? status?.currentEndpointId ?? null) : null
  const gatewayUrl = status?.port != null ? `http://127.0.0.1:${status.port}` : null

  const copyGateway = async () => {
    if (!gatewayUrl) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(gatewayUrl)
      } else {
        const ta = document.createElement('textarea')
        ta.value = gatewayUrl
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      toast.success('已复制代理信息')
    } catch {
      toast.error('复制失败')
    }
  }

  const toggle = async (next: boolean) => {
    try {
      const s = next ? await proxyApi.start() : await proxyApi.stop()
      qc.invalidateQueries({ queryKey: ['proxy-status'] })
      toast.success(next ? `代理已启动 · 端口 ${s.port}` : '代理已停止')
    } catch (e) {
      toast.error(`操作失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-stretch">
        {/* 左 2/3：端点队列 */}
        <Card className="min-h-36 gap-0 py-0 md:col-span-2">
          <CardContent className="flex h-full flex-col gap-2 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className={panelTitleClass}>端点队列</h3>
                <span className={metaClass}>
                  <TabularText>{allQueueEndpoints.length}</TabularText>
                </span>
              </div>
              <IconButton type="button" size="xs" variant="ghost" onClick={() => setFastEditorOpen(true)} aria-label="编辑快速队列">
                <ZapIcon className="size-4" />
              </IconButton>
            </div>

            <QueueSection endpoints={allQueueEndpoints} empty="暂无启用端点" current={current} running={running} healthById={healthById} />
          </CardContent>
        </Card>

        {/* 右 1/3：本地代理信息 + 开关 + 端口跳设置 + 雪山日落场景 */}
        <Card className="relative min-h-36 gap-0 overflow-hidden py-0 md:col-span-1">
          <ProxyScene running={running} dark={dark} />
          {/* 文字可读性遮罩：亮色用白雾托底、暗色用深色压底 */}
          <div
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-0 z-10',
              dark ? 'bg-gradient-to-t from-black/45 via-black/5 to-black/15' : 'bg-gradient-to-t from-white/60 via-white/5 to-white/40',
            )}
          />
          <CardContent className={cn('relative z-20 flex h-full min-h-36 flex-col justify-between gap-2 px-4 py-3', dark ? 'text-white' : 'text-foreground')}>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold">本地代理</span>
              <div className="flex items-center gap-1.5 self-start">
                <button
                  type="button"
                  onClick={() => setActiveView('settings')}
                  className={cn(
                    'cursor-pointer text-xs transition-colors hover:opacity-90',
                    dark ? 'text-white/85 hover:text-white' : 'text-muted-foreground hover:text-foreground',
                  )}
                  title="前往设置修改端口"
                >
                  端口 <TabularText>{status?.port ?? '—'}</TabularText>
                </button>
                {gatewayUrl ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={copyGateway}
                        className={cn('inline-flex shrink-0 transition-colors', dark ? 'text-white/85 hover:text-white' : 'text-muted-foreground hover:text-foreground')}
                        aria-label="复制代理信息"
                      >
                        <CopyIcon className="size-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>点击复制代理信息</TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className={cn('text-xs', dark ? 'text-white/85' : 'text-muted-foreground')}>{running ? '运行中' : '已停止'}</span>
              <Switch checked={running} onCheckedChange={toggle} aria-label="代理开关" />
            </div>
          </CardContent>
        </Card>
      </div>

      <FastQueueDialog open={fastEditorOpen} onOpenChange={setFastEditorOpen} fastQueue={fastQueue} enabledQueue={enabledQueue} />
    </>
  )
}
