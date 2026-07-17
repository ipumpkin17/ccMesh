import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { DragDropProvider } from '@dnd-kit/react'
import { useSortable } from '@dnd-kit/react/sortable'
import { move } from '@dnd-kit/helpers'

import { endpointApi, type Endpoint } from '@/services/modules/endpoint'
import type { EndpointView } from '@/stores'
import { EndpointCard } from './EndpointCard'
import { moveBeforeEndpoint } from './reorder'
import { metaClass } from '@/lib/typography'

interface Props {
  endpoints: Endpoint[]
  allEndpoints: Endpoint[]
  draggable: boolean
  typeFilterActive: boolean
  view: EndpointView
  onEdit: (e: Endpoint) => void
}

interface RowProps {
  endpoint: Endpoint
  index: number
  draggable: boolean
  view: EndpointView
  onEdit: (e: Endpoint) => void
}

interface PreviewRowProps {
  endpoint: Endpoint
  index: number
  visible: boolean
  view: EndpointView
}

/** 单行：useSortable 接管位移/放置动画，把 handleRef 交给 EndpointCard 的 grip 图标。 */
function SortableRow({ endpoint, index, draggable, view, onEdit }: RowProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: endpoint.id,
    index,
    disabled: !draggable,
  })

  return (
    <div ref={ref} data-endpoint-row-id={endpoint.id} style={{ opacity: isDragging ? 0.5 : undefined }}>
      <EndpointCard endpoint={endpoint} onEdit={onEdit} draggable={draggable} dragHandleRef={handleRef} view={view} />
    </div>
  )
}

/** 预览卡位：参与碰撞检测但不可拖动；拖拽时除当前卡片外全部使用该效果。 */
function PreviewRow({ endpoint, index, visible, view }: PreviewRowProps) {
  const { targetRef, isDropTarget } = useSortable({ id: endpoint.id, index })

  return (
    <div ref={targetRef} className={isDropTarget ? 'ring-primary/50 rounded-xl ring-2' : 'rounded-xl'}>
      <div className={visible ? 'pointer-events-none opacity-80' : 'pointer-events-none opacity-60'}>
        <EndpointCard endpoint={endpoint} onEdit={() => undefined} draggable={false} view={view} />
      </div>
    </div>
  )
}

/** 基于 @dnd-kit/react 的拖拽排序；list/grid 仅切换容器样式，拖拽逻辑共用。 */
export function DnDList({ endpoints, allEndpoints, draggable, typeFilterActive, view, onEdit }: Props) {
  const qc = useQueryClient()
  const [visibleOrder, setVisibleOrder] = useState<Endpoint[]>(endpoints)
  const [globalOrder, setGlobalOrder] = useState<Endpoint[]>(allEndpoints)
  const [activeId, setActiveId] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const scrollAnchorRef = useRef<{
    id: number
    top: number
    scrollParent: HTMLElement
  } | null>(null)

  useEffect(() => {
    setVisibleOrder(endpoints)
  }, [endpoints])

  useEffect(() => {
    setGlobalOrder(allEndpoints)
  }, [allEndpoints])

  const visibleIds = useMemo(() => new Set(endpoints.map((endpoint) => endpoint.id)), [endpoints])
  const showGlobalPreview = draggable && activeId !== null && typeFilterActive
  const order = showGlobalPreview ? globalOrder : visibleOrder

  useLayoutEffect(() => {
    if (!showGlobalPreview || activeId === null) return
    const anchor = scrollAnchorRef.current
    if (!anchor || anchor.id !== activeId) return
    const row = listRef.current?.querySelector<HTMLElement>(`[data-endpoint-row-id="${activeId}"]`)
    if (row) {
      anchor.scrollParent.scrollTop += row.getBoundingClientRect().top - anchor.top
    }
    scrollAnchorRef.current = null
  }, [activeId, showGlobalPreview])

  const reorder = useMutation({
    mutationFn: (ids: number[]) => endpointApi.reorder(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['endpoints'] }),
  })

  const containerClass = view === 'grid' ? 'grid grid-cols-[repeat(auto-fit,minmax(min(18rem,100%),1fr))] gap-4' : 'flex flex-col gap-2'

  return (
    <DragDropProvider
      onBeforeDragStart={(event) => {
        const sourceId = event.operation.source?.id
        if (typeof sourceId !== 'number') {
          setActiveId(null)
          return
        }
        const row = listRef.current?.querySelector<HTMLElement>(`[data-endpoint-row-id="${sourceId}"]`)
        // ponytail: 按 CSS 找滚动面板；拖动前内容可能还没溢出，不能用 scrollHeight 判断。
        let scrollParent = listRef.current?.parentElement
        while (scrollParent) {
          const overflowY = window.getComputedStyle(scrollParent).overflowY
          if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') break
          scrollParent = scrollParent.parentElement
        }
        if (typeFilterActive && row && scrollParent) {
          scrollAnchorRef.current = {
            id: sourceId,
            top: row.getBoundingClientRect().top,
            scrollParent,
          }
        }
        setActiveId(sourceId)
      }}
      onDragEnd={(event) => {
        setActiveId(null)
        if (event.canceled) return

        const previousGlobal = globalOrder
        const previousVisible = visibleOrder
        const targetId = event.operation.target?.id
        const next = showGlobalPreview && activeId !== null && typeof targetId === 'number' ? moveBeforeEndpoint(order, activeId, targetId) : move(order, event)
        if (next.length === order.length && next.every((item, index) => item.id === order[index]?.id)) {
          return
        }

        if (showGlobalPreview) {
          const nextVisible = next.filter((endpoint) => visibleIds.has(endpoint.id))
          setGlobalOrder(next)
          setVisibleOrder(nextVisible)
          reorder.mutate(
            next.map((e) => e.id),
            {
              onError: (e) => {
                setGlobalOrder(previousGlobal)
                setVisibleOrder(previousVisible)
                toast.error(e instanceof Error ? e.message : String(e))
              },
            },
          )
          return
        }

        setVisibleOrder(next)
        reorder.mutate(
          next.map((e) => e.id),
          {
            onError: (e) => {
              setVisibleOrder(previousVisible)
              toast.error(e instanceof Error ? e.message : String(e))
            },
          },
        )
      }}
    >
      {typeFilterActive && (
        <p className={`border-edge/70 bg-surface-raised/40 mb-2 rounded-md border border-dashed px-3 py-2 ${metaClass}`}>
          拖拽时其余端点固定为半透明卡位；松手后按预览位置更新全局轮询顺序。
        </p>
      )}
      <div ref={listRef} className={containerClass}>
        {order.map((ep, index) =>
          showGlobalPreview && ep.id !== activeId ? (
            <PreviewRow key={ep.id} endpoint={ep} index={index} visible={visibleIds.has(ep.id)} view={view} />
          ) : (
            <SortableRow key={ep.id} endpoint={ep} index={index} draggable={draggable} view={view} onEdit={onEdit} />
          ),
        )}
      </div>
    </DragDropProvider>
  )
}
