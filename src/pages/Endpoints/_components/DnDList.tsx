import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";

import { endpointApi, type Endpoint } from "@/services/modules/endpoint";
import type { EndpointView } from "@/stores";
import { EndpointCard } from "./EndpointCard";
import { sameEndpointOrder, visibleFromGlobal } from "./reorder";

interface Props {
  endpoints: Endpoint[];
  allEndpoints: Endpoint[];
  draggable: boolean;
  typeFilterActive: boolean;
  view: EndpointView;
  onEdit: (e: Endpoint) => void;
}

interface RowProps {
  endpoint: Endpoint;
  index: number;
  draggable: boolean;
  view: EndpointView;
  onEdit: (e: Endpoint) => void;
}

interface VirtualRowProps {
  endpoint: Endpoint;
  index: number;
  view: EndpointView;
}

/** 单行：useSortable 接管位移/放置动画，把 handleRef 交给 EndpointCard 的 grip 图标。 */
function SortableRow({ endpoint, index, draggable, view, onEdit }: RowProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: endpoint.id,
    index,
    disabled: !draggable,
  });

  return (
    <div ref={ref} style={{ opacity: isDragging ? 0.5 : undefined }}>
      <EndpointCard
        endpoint={endpoint}
        onEdit={onEdit}
        draggable={draggable}
        dragHandleRef={handleRef}
        view={view}
      />
    </div>
  );
}

/** 灰色虚拟占位：只提供全局排序锚点，不渲染真实卡片，也不提供拖拽 handle。 */
function VirtualRow({ endpoint, index, view }: VirtualRowProps) {
  const { targetRef, isDropTarget } = useSortable({
    id: endpoint.id,
    index,
  });

  const className =
    view === "grid"
      ? "col-span-full flex h-6 items-center rounded-md border border-dashed border-edge/70 bg-surface-raised/40 px-3 text-[11px] text-muted-foreground"
      : "flex h-5 items-center rounded-md border border-dashed border-edge/70 bg-surface-raised/40 px-3 text-[11px] text-muted-foreground";

  return (
    <div
      ref={targetRef}
      className={isDropTarget ? `${className} border-primary/60 text-primary` : className}
      aria-hidden
    >
      筛选外端点：{endpoint.name}
    </div>
  );
}

/** 基于 @dnd-kit/react 的拖拽排序；list/grid 仅切换容器样式，拖拽逻辑共用。 */
export function DnDList({
  endpoints,
  allEndpoints,
  draggable,
  typeFilterActive,
  view,
  onEdit,
}: Props) {
  const qc = useQueryClient();
  const [visibleOrder, setVisibleOrder] = useState<Endpoint[]>(endpoints);
  const [globalOrder, setGlobalOrder] = useState<Endpoint[]>(allEndpoints);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setVisibleOrder(endpoints);
  }, [endpoints]);

  useEffect(() => {
    setGlobalOrder(allEndpoints);
  }, [allEndpoints]);

  const visibleIds = useMemo(
    () => new Set(endpoints.map((endpoint) => endpoint.id)),
    [endpoints],
  );
  const showGlobalPreview = draggable && isDragging && typeFilterActive;
  const order = showGlobalPreview ? globalOrder : visibleOrder;

  const reorder = useMutation({
    mutationFn: (ids: number[]) => endpointApi.reorder(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["endpoints"] }),
  });

  const containerClass =
    view === "grid"
      ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      : "flex flex-col gap-2";

  return (
    <DragDropProvider
      onDragStart={() => setIsDragging(true)}
      onDragEnd={(event) => {
        setIsDragging(false);
        if (event.canceled) return;

        const previousGlobal = globalOrder;
        const previousVisible = visibleOrder;
        const next = move(order, event);
        if (sameEndpointOrder(next, order)) return;

        if (showGlobalPreview) {
          const nextVisible = visibleFromGlobal(next, visibleIds);
          setGlobalOrder(next);
          setVisibleOrder(nextVisible);
          reorder.mutate(next.map((e) => e.id), {
            onError: (e) => {
              setGlobalOrder(previousGlobal);
              setVisibleOrder(previousVisible);
              toast.error(e instanceof Error ? e.message : String(e));
            },
          });
          return;
        }

        setVisibleOrder(next);
        reorder.mutate(next.map((e) => e.id), {
          onError: (e) => {
            setVisibleOrder(previousVisible);
            toast.error(e instanceof Error ? e.message : String(e));
          },
        });
      }}
    >
      {typeFilterActive && (
        <p className="mb-2 rounded-md border border-dashed border-edge/70 bg-surface-raised/40 px-3 py-2 text-xs text-muted-foreground">
          拖拽时显示全局排序位置；灰色占位为筛选外端点，不可编辑。
        </p>
      )}
      <div className={containerClass}>
        {order.map((ep, index) =>
          visibleIds.has(ep.id) ? (
            <SortableRow
              key={ep.id}
              endpoint={ep}
              index={index}
              draggable={draggable}
              view={view}
              onEdit={onEdit}
            />
          ) : (
            <VirtualRow key={ep.id} endpoint={ep} index={index} view={view} />
          ),
        )}
      </div>
    </DragDropProvider>
  );
}
