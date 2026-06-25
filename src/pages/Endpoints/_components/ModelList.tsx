import { Badge } from "@/components/ui/badge";
import { useEndpoints } from "@/hooks/useEndpoints";
import { advertisedModels } from "@/services/modules/endpoint";

/** 按端点分组展示其对外可用模型（出站模型 + 映射入站名）。 */
export function ModelList() {
  const { data: endpoints } = useEndpoints();
  const groups = (endpoints ?? [])
    .filter((e) => e.enabled)
    .map((e) => ({
      name: e.name,
      models: advertisedModels(e),
    }))
    .filter((g) => g.models.length > 0);

  return (
    <section className="flex h-full flex-col gap-3">
      <h2 className="shrink-0 text-sm font-medium text-ink-secondary">可用模型（按端点）</h2>
      {groups.length === 0 ? (
        <p className="text-sm text-ink-mute">暂无模型（在端点中配置模型清单或锁定模型）</p>
      ) : (
        <div className="scrollbar-none flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {groups.map((g) => (
            <div key={g.name} className="flex flex-col gap-1.5">
              <span className="text-xs text-ink-mute">
                {g.name} <span className="text-ink-disabled">({g.models.length})</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {g.models.map((m, i) => (
                  <Badge key={`${m}-${i}`} variant="muted">
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
