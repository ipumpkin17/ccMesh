import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { modelsApi } from "@/services/modules/models";

/** 可用模型列表 + 刷新（命中缓存不重复请求；刷新强制拉取）。 */
export function ModelList() {
  const [refreshing, setRefreshing] = useState(false);
  const q = useQuery({
    queryKey: ["models"],
    queryFn: () => modelsApi.getModels(false),
  });

  const refresh = async () => {
    setRefreshing(true);
    try {
      await modelsApi.getModels(true);
      await q.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const models = q.data?.data ?? [];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink-secondary">
          可用模型 <span className="text-ink-mute">({models.length})</span>
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={refresh}
          disabled={refreshing || q.isFetching}
        >
          <RefreshCwIcon className="size-4" /> 刷新
        </Button>
      </div>
      {models.length === 0 ? (
        <p className="text-sm text-ink-mute">暂无模型（启用端点后刷新）</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {models.map((m, i) => (
            <Badge key={`${m.id}-${i}`} variant="muted">
              {m.id}
            </Badge>
          ))}
        </div>
      )}
    </section>
  );
}
