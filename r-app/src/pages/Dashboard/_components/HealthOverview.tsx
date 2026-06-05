import { useQuery } from "@tanstack/react-query";

import { StatCard } from "@/components/business";
import { StatusDot } from "@/components/ui";
import { Card, CardContent } from "@/components/ui/card";
import { healthApi } from "@/services/modules/health";

/** Dashboard 健康概览：服务状态、启用端点数、脱敏端点列表。 */
export function HealthOverview() {
  const { data } = useQuery({ queryKey: ["health"], queryFn: healthApi.getHealth });
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="服务状态"
          value={data.proxyRunning ? "运行中" : "已停止"}
          hint={<StatusDot status={data.proxyRunning ? "success" : "idle"} pulse={data.proxyRunning} />}
        />
        <StatCard label="启用端点" value={data.enabledEndpoints} />
      </div>
      <Card>
        <CardContent className="flex flex-col gap-2 px-5 py-4">
          <span className="text-xs text-ink-secondary">端点（密钥脱敏）</span>
          {data.endpoints.length === 0 ? (
            <span className="text-sm text-ink-mute">暂无端点</span>
          ) : (
            data.endpoints.map((e) => (
              <div key={e.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <StatusDot status={e.enabled ? "success" : "idle"} />
                  {e.name}
                </span>
                <span className="font-mono text-xs text-ink-mute">
                  {e.maskedKey || "—"}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
