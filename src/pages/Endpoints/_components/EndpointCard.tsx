import { useCallback, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { openUrl } from '@tauri-apps/plugin-opener'
import { ActivityIcon, ArchiveIcon, CopyIcon, EllipsisVerticalIcon, GripVerticalIcon, PencilIcon, Trash2Icon, WaypointsIcon } from 'lucide-react'
import { toast } from 'sonner'
import { EndpointBrandIcon } from '@/components/business'
import { IconButton } from '@/components/ui'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useEndpointHealth } from '@/hooks/useEndpointHealth'
import { getModelIcon } from '@/lib/model-icons'
import { advertisedModels, endpointApi, outboundModels, type Endpoint } from '@/services/modules/endpoint'
import type { EndpointView } from '@/stores'
import { ModelMappingDialog } from './ModelMappingDialog'
import { TestBadge } from './TestBadge'
import { EndpointQualityPanel } from './EndpointQualityStrip'
import { emptyClass } from '@/lib/typography'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

function IconAction({ label, onClick, disabled, children }: { label: string; onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <IconButton size="default" variant="ghost" aria-label={label} onClick={onClick} disabled={disabled}>
          {children}
        </IconButton>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

interface Props {
  endpoint: Endpoint
  onEdit: (e: Endpoint) => void
  draggable: boolean
  /** useSortable 的 handleRef；存在时 grip 图标作为拖拽手柄，筛选态下不传。 */
  dragHandleRef?: (element: Element | null) => void
  /** 展示形态：list 横向行式（默认），grid 纵向小卡片。 */
  view?: EndpointView
}

export function EndpointCard({ endpoint, onEdit, draggable, dragHandleRef, view = 'list' }: Props) {
  const qc = useQueryClient()
  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: ['endpoints'] }), [qc])
  const [testOpen, setTestOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const onMutateError = (e: unknown) => toast.error(errMsg(e))

  // 共享 ["endpoint-health"] 查询（多卡片去重）；展示运行期熔断态。
  const { data: epHealth } = useEndpointHealth()
  const health = epHealth?.find((h) => h.endpointId === endpoint.uid)
  const toggle = useMutation({
    mutationFn: (v: boolean) => endpointApi.update(endpoint.id, { enabled: v }),
    onSuccess: invalidate,
    onError: onMutateError,
  })
  const test = useMutation({
    mutationFn: (model?: string) => endpointApi.test(endpoint.id, model),
    onSuccess: (r) => {
      if (r.success) {
        toast.success(`${endpoint.name}：${r.message} (${r.latencyMs}ms)`)
        // 测试成功：主动失效健康态，让卡片即时显示可用、熔断 Badge 消失
        // （后端也会 emit endpoint-health-changed；此处覆盖代理未运行、靠 test_status 回退的场景）
        qc.invalidateQueries({ queryKey: ['endpoint-health'] })
      } else {
        toast.error(`${endpoint.name}：${r.message}`)
      }
      invalidate()
    },
    onError: onMutateError,
  })
  const clone = useMutation({
    mutationFn: () => endpointApi.clone(endpoint.id),
    onSuccess: () => {
      toast.success('已克隆')
      invalidate()
    },
    onError: onMutateError,
  })
  const del = useMutation({
    mutationFn: () => endpointApi.remove(endpoint.id),
    onSuccess: () => {
      toast.success('已删除')
      invalidate()
    },
    onError: onMutateError,
  })
  const archive = useMutation({
    mutationFn: () => endpointApi.archive(endpoint.id),
    onSuccess: () => {
      toast.success('已归档')
      invalidate()
      qc.invalidateQueries({ queryKey: ['archived-endpoints'] })
    },
    onError: onMutateError,
  })

  const grip =
    draggable && dragHandleRef ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <span ref={dragHandleRef} aria-label="拖动以排序" className="text-muted-foreground shrink-0 cursor-grab touch-none">
            <GripVerticalIcon className="size-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent>拖动以排序</TooltipContent>
      </Tooltip>
    ) : (
      <GripVerticalIcon className="text-muted-foreground size-4 shrink-0" />
    )

  const enableSwitch = (
    <span className="inline-flex shrink-0 items-center">
      <Switch checked={endpoint.enabled} onCheckedChange={(v) => toggle.mutate(v)} aria-label={endpoint.enabled ? '禁用端点' : '启用端点'} />
    </span>
  )

  const handleOpenUrl = () => {
    if (window.getSelection()?.isCollapsed === false) return
    openUrl(endpoint.apiUrl).catch((err) => toast.error(errMsg(err)))
  }

  // 测试连通性使用真实出站模型：测试直连上游，不经网关，入站映射名上游不认。
  const testModels = outboundModels(endpoint)
  // 可用性展示用公布集合：出站模型并入映射入站名。
  const displayModels = advertisedModels(endpoint)

  // 多个模型时由用户选择实际出站模型；0/1 个模型走协议默认值或锁定模型。
  const testButton =
    testModels.length >= 2 ? (
      <Popover open={testOpen} onOpenChange={setTestOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <IconButton size="default" variant="ghost" aria-label="测试连通性" disabled={test.isPending}>
                <ActivityIcon className="size-4" />
              </IconButton>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>测试连通性</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" className="w-56 p-2">
          <p className="text-muted-foreground mb-1.5 px-1 text-xs">选择测试模型</p>
          <div className="flex max-h-60 scrollbar-none flex-col gap-1 overflow-auto">
            {testModels.map((model) => {
              const ModelIcon = getModelIcon(model)
              return (
                <button
                  key={model}
                  type="button"
                  className="hover:bg-accent flex min-w-0 cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-left text-xs"
                  onClick={() => {
                    setTestOpen(false)
                    test.mutate(model)
                  }}
                >
                  <ModelIcon size={14} className="shrink-0" />
                  <span className="truncate font-mono">{model}</span>
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    ) : (
      <IconAction label="测试连通性" onClick={() => test.mutate(testModels[0])} disabled={test.isPending}>
        <ActivityIcon className="size-4" />
      </IconAction>
    )

  const moreMenu = (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton size="default" variant="ghost" aria-label="更多操作">
            <EllipsisVerticalIcon className="size-4" />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem disabled={clone.isPending} onClick={() => clone.mutate()}>
            <CopyIcon />
            克隆
          </DropdownMenuItem>
          <DropdownMenuItem disabled={archive.isPending} onClick={() => archive.mutate()}>
            <ArchiveIcon />
            归档
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2Icon />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>删除端点</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            确定删除端点「<span className="font-medium">{endpoint.name}</span>」吗？此操作不可撤销。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={() => {
                del.mutate(undefined, { onSuccess: () => setDeleteOpen(false) })
              }}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )

  const actions = (
    <div className="flex gap-0.5">
      {testButton}
      <IconAction label="模型映射" onClick={() => setMapOpen(true)}>
        <WaypointsIcon className="size-4" />
      </IconAction>
      <IconAction label="编辑" onClick={() => onEdit(endpoint)}>
        <PencilIcon className="size-4" />
      </IconAction>
      {moreMenu}
      <ModelMappingDialog open={mapOpen} onOpenChange={setMapOpen} endpoint={endpoint} />
    </div>
  )

  const meta = (
    <span className="text-muted-foreground flex min-w-0 items-center text-xs">
      <span
        role="link"
        tabIndex={0}
        className="hover:text-primary cursor-pointer truncate text-left"
        title={`在浏览器打开 ${endpoint.apiUrl}`}
        onClick={handleOpenUrl}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          handleOpenUrl()
        }}
      >
        {endpoint.apiUrl}
      </span>
      {endpoint.model ? <span className="shrink-0 whitespace-pre select-none"> · {endpoint.model}</span> : null}
    </span>
  )

  // 可用性合并：实时请求结果优先于手动测试（healthy/recovering→可用，unhealthy→不可用）；
  // 无实时数据（端点禁用/代理未运行无记录）或 unknown 时回退手动测试结果 testStatus。
  const availabilityStatus = health?.status === 'healthy' || health?.status === 'recovering' ? 'available' : health?.status === 'unhealthy' ? 'unavailable' : endpoint.testStatus

  // 可用性指示：悬停展示该端点模型清单（限高可滚动）
  const availability = (
    <HoverCard openDelay={100} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span className="cursor-default" title={health?.lastError ?? undefined}>
          <TestBadge status={availabilityStatus} />
        </span>
      </HoverCardTrigger>
      <HoverCardContent side="top" className="max-h-60 w-56 scrollbar-none overflow-auto">
        {displayModels.length === 0 ? (
          <span className={emptyClass}>无已配置模型</span>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground mb-0.5 text-xs">模型（{displayModels.length}）</span>
            {displayModels.map((m) => {
              const ModelIcon = getModelIcon(m)
              return (
                <span key={m} className="flex min-w-0 items-center gap-1.5 text-xs">
                  <ModelIcon size={14} className="shrink-0" />
                  <span className="truncate font-mono">{m}</span>
                </span>
              )
            })}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  )

  if (view === 'grid') {
    return (
      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="flex flex-col p-0">
          <div className="flex min-w-0 flex-col gap-1 px-4 pt-3 pb-1">
            <div className="flex items-center gap-2 select-none">
              <EndpointBrandIcon type={endpoint.transformer} size={16} />
              <span className="min-w-0 flex-1 truncate font-medium">{endpoint.name}</span>
              {grip}
            </div>
            {meta}
          </div>
          <div className="flex w-full px-4 py-1.5">
            <EndpointQualityPanel endpointId={endpoint.uid} />
          </div>
          <div className="flex items-center gap-2 border-t px-4 py-1.5 select-none">
            <div className="flex items-center gap-1.5">{availability}</div>
            <div className="ml-auto flex items-center gap-1">
              {actions}
              {enableSwitch}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="endpoint-list-card min-w-0 gap-0 overflow-hidden rounded-md py-0">
      <CardContent className="endpoint-list-card-content grid min-w-0 grid-cols-[minmax(0,1fr)_13.125rem_auto] items-center gap-5 p-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex shrink-0 items-center select-none">{grip}</div>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2 select-none">
              <EndpointBrandIcon type={endpoint.transformer} size={16} />
              <span className="min-w-0 truncate font-medium">{endpoint.name}</span>
            </div>
            {meta}
          </div>
        </div>
        <div className="endpoint-list-quality flex min-w-0 justify-center">
          <EndpointQualityPanel endpointId={endpoint.uid} variant="list" />
        </div>
        <div className="flex shrink-0 items-center gap-1 select-none">
          <div className="flex w-20 shrink-0 items-center justify-end gap-1.5">{availability}</div>
          <div className="flex items-center gap-1">{actions}</div>
          {enableSwitch}
        </div>
      </CardContent>
    </Card>
  )
}
