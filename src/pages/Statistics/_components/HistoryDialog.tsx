import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HistoryIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { TabularText } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/Pagination";
import { statsApi } from "@/services/modules/stats";
import { emptyClass } from "@/lib/typography";

const PAGE_SIZE = 12;

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** 历史记录弹窗：分页查看按端点×日聚合明细，支持按行 / 按整天删除。 */
export function HistoryDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["stats-history", page],
    queryFn: () => statsApi.getStatsHistory(page, PAGE_SIZE),
    enabled: open,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["stats-history"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
  };

  const delRow = useMutation({
    mutationFn: (v: { endpointId: string; date: string }) =>
      statsApi.deleteDailyStat(v.endpointId, v.date),
    onSuccess: () => {
      toast.success("已删除该记录");
      invalidate();
    },
    onError: (e) => toast.error(`删除失败：${errMsg(e)}`),
  });

  const delDay = useMutation({
    mutationFn: (date: string) => statsApi.deleteStatsByDate(date),
    onSuccess: (n) => {
      toast.success(`已删除该日 ${n} 条记录`);
      setPage(1);
      invalidate();
    },
    onError: (e) => toast.error(`删除失败：${errMsg(e)}`),
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const pending = delRow.isPending || delDay.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HistoryIcon className="size-4" /> 历史记录
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>历史记录</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className={emptyClass}>加载中…</p>
        ) : rows.length === 0 ? (
          <p className={emptyClass}>暂无历史记录</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="max-h-[60vh] overflow-auto rounded-lg border border-edge-subtle bg-surface-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="sticky top-0 border-b border-edge-subtle bg-background">
                    <th className="px-3 py-2 text-left font-medium">日期</th>
                    <th className="px-3 py-2 text-left font-medium">端点</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">请求</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">错误</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">输入</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">输出</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">缓存</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={`${r.date}-${r.endpointId}-${i}`}
                      className="border-b border-edge-subtle last:border-0"
                    >
                      <td className="px-3 py-2">
                        <TabularText>{r.date}</TabularText>
                      </td>
                      <td className="px-3 py-2">{r.endpointName}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <TabularText>{r.requests}</TabularText>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <TabularText>{r.errors}</TabularText>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <TabularText>{r.inputTokens}</TabularText>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <TabularText>{r.outputTokens}</TabularText>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <TabularText>
                          {r.cacheCreationTokens + r.cacheReadTokens}
                        </TabularText>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            disabled={pending}
                            aria-label="删除该行"
                            onClick={() =>
                              delRow.mutate({
                                endpointId: r.endpointId,
                                date: r.date,
                              })
                            }
                          >
                            <Trash2Icon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            disabled={pending}
                            onClick={() => delDay.mutate(r.date)}
                          >
                            整天
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
