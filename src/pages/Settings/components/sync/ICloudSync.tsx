import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  SettingsDialog,
  SettingsInlineActions,
  SettingsMessage,
  SettingsRow,
  SettingsSection,
} from "@/components/settings";
import { Button } from "@/components/ui/button";
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
      <SettingsSection title="iCloud 同步" layout="plain">
        <SettingsRow
          title="自动同步"
          description="端点变更会同步到 iCloud，检测到差异时由你选择同步方向"
          density="regular"
          framed
          control={
            <Switch
              checked={enabled}
              disabled={busy || statusQ.isLoading || status?.available === false}
              onCheckedChange={(v) => toggle.mutate(v)}
            />
          }
        />
        {status?.available === false ? (
          <SettingsMessage tone="warning">
            当前环境不可用 iCloud Drive，请确认已登录 Apple ID 并启用 iCloud 云盘。
          </SettingsMessage>
        ) : null}

        {status?.enabled ? (
          <SettingsInlineActions>
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
          </SettingsInlineActions>
        ) : null}
      </SettingsSection>

      <SettingsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="提示"
        description={dialogStatus?.message || "iCloud 端点配置与本地存在差异，请选择同步方向。将按所选方向全量覆盖端点配置（含可用模型与映射）。"}
        stackedActions
        actions={
          <>
            <Button disabled={busy} onClick={() => pull.mutate()}>
              iCloud 覆盖本地
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => push.mutate()}>
              本地覆盖 iCloud
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => disable.mutate()}>
              关闭同步
            </Button>
          </>
        }
      />
    </>
  );
}
