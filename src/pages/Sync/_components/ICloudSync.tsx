import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { IS_MAC } from "@/lib/platform";
import { icloudApi, type ICloudSyncStatus } from "@/services/modules/icloud";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function ICloudSync() {
  const qc = useQueryClient();
  const statusQ = useQuery({
    queryKey: ["icloud-sync"],
    queryFn: icloudApi.getStatus,
    enabled: IS_MAC,
    retry: false,
    refetchInterval: (query) => {
      const s = query.state.data as ICloudSyncStatus | undefined;
      return s?.enabled ? 10000 : false;
    },
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStatus, setDialogStatus] = useState<ICloudSyncStatus | null>(null);

  useEffect(() => {
    const s = statusQ.data;
    if (!s) return;
    if (s.enabled && s.state === "conflict") {
      setDialogStatus(s);
      setDialogOpen(true);
    }
  }, [statusQ.data]);

  const refresh = async (next?: ICloudSyncStatus) => {
    if (next) qc.setQueryData(["icloud-sync"], next);
    await qc.invalidateQueries({ queryKey: ["icloud-sync"] });
  };

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => icloudApi.setEnabled(enabled),
    onSuccess: async (status) => {
      await refresh(status);
      if (!status.enabled) {
        toast.success("已关闭 iCloud 同步");
        setDialogOpen(false);
        return;
      }
      if (status.state === "synced") {
        toast.success("已开启 iCloud 同步");
        return;
      }
      if (status.state === "empty") {
        toast.success("已开启，本地端点已写入 iCloud");
        return;
      }
      if (status.state === "conflict") {
        setDialogStatus(status);
        setDialogOpen(true);
      }
    },
    onError: (e) => toast.error(`设置失败：${errMsg(e)}`),
  });

  const push = useMutation({
    mutationFn: () => icloudApi.push(),
    onSuccess: async (status) => {
      await refresh(status);
      setDialogOpen(false);
      toast.success("已用本地端点覆盖 iCloud");
    },
    onError: (e) => toast.error(`同步失败：${errMsg(e)}`),
  });

  const pull = useMutation({
    mutationFn: () => icloudApi.pull(),
    onSuccess: async ([summary, status]) => {
      await refresh(status);
      await qc.invalidateQueries({ queryKey: ["endpoints"] });
      setDialogOpen(false);
      toast.success(
        `已用 iCloud 覆盖本地：新增 ${summary.endpointsAdded} · 更新 ${summary.endpointsUpdated} · 跳过 ${summary.endpointsSkipped}`,
      );
    },
    onError: (e) => toast.error(`同步失败：${errMsg(e)}`),
  });

  const disable = useMutation({
    mutationFn: () => icloudApi.setEnabled(false),
    onSuccess: async (status) => {
      await refresh(status);
      setDialogOpen(false);
      toast.success("已关闭 iCloud 同步");
    },
    onError: (e) => toast.error(`关闭失败：${errMsg(e)}`),
  });

  if (!IS_MAC) return null;

  const status = statusQ.data;
  const enabled = !!status?.enabled;
  const busy = toggle.isPending || push.isPending || pull.isPending || disable.isPending;

  return (
    <>
      <section className="flex flex-col gap-4 rounded-lg border border-edge p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex flex-col gap-1">
            <h2 className="text-sm font-medium text-ink-secondary">iCloud 同步</h2>
            <p className="text-xs leading-relaxed text-ink-mute">
              开启后，端点配置的添加、修改、删除会自动备份到 iCloud；当 iCloud
              文件有更新时，也会提示同步到本地。仅同步端点配置（含可用模型、映射、快速队列与多密钥），不含统计、设置与
              WebDAV 凭证。
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={busy || statusQ.isLoading || status?.available === false}
            onCheckedChange={(v) => toggle.mutate(v)}
          />
        </div>

        {status?.available === false ? (
          <p className="text-xs text-warning">
            当前环境不可用 iCloud Drive，请确认已登录 Apple ID 并启用 iCloud 云盘。
          </p>
        ) : null}

        {status?.enabled ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-mute">
            <span>{status.message}</span>
            {status.state !== "synced" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setDialogStatus(status);
                  setDialogOpen(true);
                }}
              >
                同步配置
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>提示</DialogTitle>
            <DialogDescription>
              {dialogStatus?.message ||
                "iCloud 端点配置与本地存在差异，请选择同步方向。将按所选方向全量覆盖端点配置（含可用模型与映射）。"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button className="w-full" disabled={busy} onClick={() => pull.mutate()}>
              iCloud 覆盖本地
            </Button>
            <Button
              className="w-full"
              variant="secondary"
              disabled={busy}
              onClick={() => push.mutate()}
            >
              本地覆盖 iCloud
            </Button>
            <Button
              className="w-full"
              variant="outline"
              disabled={busy}
              onClick={() => disable.mutate()}
            >
              关闭同步
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
