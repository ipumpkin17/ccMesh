import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";

import { endpointApi, type Endpoint } from "@/services/modules/endpoint";
import type { EndpointView } from "@/stores";
import { EndpointCard } from "./EndpointCard";
import { mergeVisibleOrder, sameEndpointOrder } from "./reorder";

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

  useEffect(() => {
    setVisibleOrder(endpoints);
  }, [endpoints]);

  const visibleIds = useMemo(
    () => new Set(endpoints.map((endpoint) => endpoint.id)),
    [endpoints],
  );

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
      onDragEnd={(event) => {
        if (event.canceled) return;

        const previousVisible = visibleOrder;
        const next = move(visibleOrder, event);
        if (sameEndpointOrder(next, visibleOrder)) return;

        const nextGlobal = typeFilterActive
          ? mergeVisibleOrder(allEndpoints, visibleIds, next)
          : next;

        setVisibleOrder(next);
        reorder.mutate(nextGlobal.map((e) => e.id), {
          onError: (e) => {
            setVisibleOrder(previousVisible);
            toast.error(e instanceof Error ? e.message : String(e));
          },
        });
      }}
    >
      {typeFilterActive && (
        <p className="mb-2 rounded-md border border-dashed border-edge/70 bg-surface-raised/40 px-3 py-2 text-xs text-muted-foreground">
          当前类型内拖拽排序；松手后会映射回全局轮询顺序。
        </p>
      )}
      <div className={containerClass}>
        {visibleOrder.map((ep, index) => (
          <SortableRow
            key={ep.id}
            endpoint={ep}
            index={index}
            draggable={draggable}
            view={view}
            onEdit={onEdit}
          />
        ))}
      </div>
    </DragDropProvider>
  );
}
