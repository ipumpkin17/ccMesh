import { useMemo, useState } from "react";

import { emptyClass, PageShell, SurfaceCard } from "@/components/common";
import { useEndpoints } from "@/hooks/useEndpoints";
import { useEndpointHealthEvents } from "@/hooks/useEndpointHealth";
import type { Endpoint } from "@/services/modules/endpoint";
import { useFilterStore, useLayoutStore } from "@/stores";
import { DnDList } from "./_components/DnDList";
import { EndpointForm } from "./_components/EndpointForm";
import { EndpointSidebar } from "./_components/EndpointSidebar";
import { FilterBar } from "./_components/FilterBar";

export function Endpoints() {
  const { data: endpoints, isLoading } = useEndpoints();
  const search = useFilterStore((s) => s.search);
  const enabledOnly = useFilterStore((s) => s.enabledOnly);
  const transformer = useFilterStore((s) => s.transformer);
  const typeFilterActive = transformer !== "all";
  const view = useLayoutStore((s) => s.endpointView);

  // 熔断/端点变更事件 → 刷新各卡片的实时健康态与列表（共享 hook 统一订阅）。
  useEndpointHealthEvents();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Endpoint | null>(null);

  const filtered = useMemo(
    () =>
      (endpoints ?? []).filter(
        (e) =>
          (!enabledOnly || e.enabled) &&
          (transformer === "all" || e.transformer === transformer) &&
          (search === "" ||
            e.name.toLowerCase().includes(search.toLowerCase()) ||
            e.apiUrl.toLowerCase().includes(search.toLowerCase())),
      ),
    [endpoints, search, enabledOnly, transformer],
  );

  const dragEnabled = search === "" && !enabledOnly;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (e: Endpoint) => {
    setEditing(e);
    setFormOpen(true);
  };

  return (
    <>
      <PageShell
        title="端点管理"
        headerExtra={<FilterBar onCreate={openCreate} />}
        contentScrollable={false}
        contentClassName="flex flex-col"
      >
        {/* 端点列表自适应剩余宽度，右侧统计栏保持固定宽度 */}
        <div className="flex min-h-0 flex-1 gap-4">
          <SurfaceCard as="div" padding="md" className="scrollbar-none min-h-0 min-w-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <p className={emptyClass}>加载中…</p>
            ) : filtered.length === 0 ? (
              <p className={emptyClass}>暂无端点，点击「新建端点」添加。</p>
            ) : (
              <DnDList
                endpoints={filtered}
                allEndpoints={endpoints ?? []}
                draggable={dragEnabled}
                typeFilterActive={typeFilterActive}
                view={view}
                onEdit={openEdit}
              />
            )}
          </SurfaceCard>

          {/* 右栏：端点统计 + 可用模型，顶部与中栏端点列表卡片对齐 */}
          <EndpointSidebar />
        </div>
      </PageShell>

      <EndpointForm open={formOpen} onOpenChange={setFormOpen} editing={editing} />
    </>
  );
}
