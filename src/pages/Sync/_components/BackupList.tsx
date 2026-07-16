import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudUploadIcon, DownloadIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { TabularText } from "@/components/ui";
import { emptyClass, sectionTitleClass, SurfaceCard, tableHeadClass } from "@/components/common";
import { Button } from "@/components/ui/button";
import { webdavApi } from "@/services/modules/webdav";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function BackupList() {
  const qc = useQueryClient();
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

  return (
    <SurfaceCard className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className={sectionTitleClass}>云端备份</h2>
        <Button size="sm" onClick={() => backup.mutate()} disabled={backup.isPending}>
          <CloudUploadIcon className="size-4" /> 立即备份
        </Button>
      </div>

      {backups.isError ? (
        <p className={emptyClass}>无法连接 WebDAV，请先在上方配置并保存。</p>
      ) : list.length === 0 ? (
        <p className={emptyClass}>暂无备份</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-edge-subtle bg-surface-raised">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge-subtle">
                <th className={`px-4 py-2 text-left ${tableHeadClass}`}>文件</th>
                <th className={`px-4 py-2 text-right ${tableHeadClass}`}>大小</th>
                <th className={`px-4 py-2 text-left ${tableHeadClass}`}>时间</th>
                <th className={`px-4 py-2 text-right ${tableHeadClass}`}>操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.filename} className="border-b border-edge-subtle last:border-0">
                  <td className="px-4 py-2">{b.filename}</td>
                  <td className="px-4 py-2 text-right">
                    <TabularText>{(b.size / 1024).toFixed(1)} KB</TabularText>
                  </td>
                  <td className="px-4 py-2">
                    <TabularText>{new Date(b.modTime).toLocaleString()}</TabularText>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="恢复"
                        onClick={() => restore.mutate(b.filename)}
                        disabled={restore.isPending}
                      >
                        <DownloadIcon className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="删除"
                        onClick={() => del.mutate(b.filename)}
                        disabled={del.isPending}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SurfaceCard>
  );
}
