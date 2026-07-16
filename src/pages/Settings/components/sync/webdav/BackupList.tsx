import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { TabularText } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  SettingsCenteredAction,
  SettingsDataTable,
  SettingsMessage,
  SettingsStack,
  SettingsTableAction,
  SettingsTableActions,
  SettingsToolbar,
} from "@/components/settings";
import { RefreshCwIcon, SlidersHorizontalIcon } from "lucide-react";
import { webdavApi } from "@/services/modules/webdav";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function BackupList({ onOpenSettings }: { onOpenSettings: () => void }) {
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const backups = useQuery({
    queryKey: ["backups"],
    queryFn: webdavApi.listBackups,
    retry: false,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["backups"] });

  const backup = useMutation({
    mutationFn: () => webdavApi.backup(),
    onSuccess: (name) => {
      toast.success(`已备份：${name}`);
      refresh();
    },
    onError: (e) => toast.error(`备份失败：${errMsg(e)}`),
  });
  const restore = useMutation({
    mutationFn: (f: string) => webdavApi.restore(f, "remote"),
    onSuccess: () => {
      toast.success("恢复完成");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(`恢复失败：${errMsg(e)}`),
  });
  const del = useMutation({
    mutationFn: (f: string) => webdavApi.deleteBackup(f),
    onSuccess: () => {
      toast.success("已删除");
      refresh();
    },
    onError: (e) => toast.error(`删除失败：${errMsg(e)}`),
  });

  const list = backups.data ?? [];
  const visibleList = showAll ? list : list.slice(0, 5);

  return (
    <SettingsStack>
      <SettingsToolbar
        leading={
          <Button size="sm" variant="outline" onClick={onOpenSettings}>
          <SlidersHorizontalIcon />
          连接设置
          </Button>
        }
        actions={
          <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => backups.refetch()}
            disabled={backups.isFetching}
          >
            <RefreshCwIcon className={backups.isFetching ? "animate-spin" : undefined} />
            刷新
          </Button>
          <Button size="sm" onClick={() => backup.mutate()} disabled={backup.isPending}>
            立即备份
          </Button>
          </>
        }
      />

      {backups.isError ? (
        <SettingsMessage>无法读取云端备份，请检查连接设置后重试。</SettingsMessage>
      ) : list.length === 0 ? (
        <SettingsMessage>暂无备份</SettingsMessage>
      ) : (
        <SettingsDataTable
          columns={[
            { label: "文件" },
            { label: "大小", align: "right" },
            { label: "时间" },
            { label: "操作", align: "right" },
          ]}
          rows={visibleList.map((backupFile) => [
            backupFile.filename,
            <TabularText>{(backupFile.size / 1024).toFixed(1)} KB</TabularText>,
            <TabularText>{new Date(backupFile.modTime).toLocaleString()}</TabularText>,
            <SettingsTableActions>
              <SettingsTableAction
                onClick={() => restore.mutate(backupFile.filename)}
                disabled={restore.isPending}
              >
                恢复
              </SettingsTableAction>
              <SettingsTableAction
                onClick={() => del.mutate(backupFile.filename)}
                disabled={del.isPending}
              >
                删除
              </SettingsTableAction>
            </SettingsTableActions>,
          ])}
        />
      )}
      {list.length > 5 ? (
        <SettingsCenteredAction>
          <Button size="sm" variant="ghost" onClick={() => setShowAll((value) => !value)}>
            {showAll ? "收起记录" : `显示全部 ${list.length} 条`}
          </Button>
        </SettingsCenteredAction>
      ) : null}
    </SettingsStack>
  );
}
