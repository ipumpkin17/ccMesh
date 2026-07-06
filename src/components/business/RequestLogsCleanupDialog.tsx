import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { statsApi } from "@/services/modules/stats";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

type CleanupKind = "expired" | "all";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  retentionDays?: number;
  onCleaned: () => void;
}

export function RequestLogsCleanupDialog({
  open,
  onOpenChange,
  retentionDays,
  onCleaned,
}: Props) {
  const qc = useQueryClient();
  const cleanup = useMutation({
    mutationFn: (kind: CleanupKind) =>
      kind === "expired" ? statsApi.pruneRequestLogs() : statsApi.clearRequestLogs(),
    onSuccess: (removed, kind) => {
      toast.success(`${kind === "expired" ? "已清理过期记录" : "已清空请求明细"}：${removed} 条`);
      qc.invalidateQueries({ queryKey: ["request-logs"] });
      onCleaned();
      onOpenChange(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const retentionLabel = retentionDays == null ? "保留期限" : `${retentionDays} 天`;
  const expiredLabel = retentionDays == null ? "保留期限外" : `${retentionDays} 天前`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>清理请求明细</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-sm text-ink-secondary">
          <p>请求明细仅影响监控列表，不影响端点统计汇总。</p>
          <p>系统会自动清理超过 {retentionLabel} 的记录，你也可以立即执行清理。</p>

          <div className="rounded-lg border border-edge p-3">
            <div className="font-medium text-foreground">清理过期记录</div>
            <p className="mt-1 text-xs text-ink-mute">删除 {expiredLabel} 的请求明细，等价于立即触发自动清理。</p>
            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              disabled={cleanup.isPending}
              onClick={() => cleanup.mutate("expired")}
            >
              清理过期记录
            </Button>
          </div>

          <div className="rounded-lg border border-destructive/40 p-3">
            <div className="font-medium text-destructive">清空全部明细</div>
            <p className="mt-1 text-xs text-ink-mute">删除全部请求明细，不可恢复；统计汇总不会归零。</p>
            <Button
              className="mt-3"
              size="sm"
              variant="destructive"
              disabled={cleanup.isPending}
              onClick={() => cleanup.mutate("all")}
            >
              清空全部明细
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
