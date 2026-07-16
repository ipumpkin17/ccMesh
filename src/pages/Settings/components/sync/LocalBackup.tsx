import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { SettingsControl, SettingsRow, SettingsSection } from "@/components/settings";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { backupApi, type ImportStrategy } from "@/services/modules/backup";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** 本地配置导出/导入（换机迁移）：端点(含多密钥)+应用设置 JSON，原生文件对话框。 */
export function LocalBackup() {
  const qc = useQueryClient();
  const [strategy, setStrategy] = useState<ImportStrategy>("skip");

  const exportM = useMutation({
    mutationFn: () => backupApi.exportConfig(),
    onSuccess: (path) => {
      if (path) toast.success(`已导出到 ${path}`);
    },
    onError: (e) => toast.error(`导出失败：${errMsg(e)}`),
  });

  const importM = useMutation({
    mutationFn: () => backupApi.importConfig(strategy),
    onSuccess: (s) => {
      if (!s) return; // 用户取消
      toast.success(
        `导入完成：新增 ${s.endpointsAdded} · 更新 ${s.endpointsUpdated} · 跳过 ${s.endpointsSkipped} 端点，保留本地身份 ${s.identitiesPreserved}，凭证 ${s.credentials}，设置 ${s.configKeys}`,
      );
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(`导入失败：${errMsg(e)}`),
  });

  const busy = exportM.isPending || importM.isPending;

  return (
    <SettingsSection title="导入导出">
        <SettingsRow
          title="导出数据"
          description="导出端点、多密钥和可迁移的应用设置为 JSON"
          control={
            <Button variant="outline" size="sm" onClick={() => exportM.mutate()} disabled={busy}>
              导出
            </Button>
          }
        />
        <SettingsRow
          title="导入策略"
          description="遇到同名端点时的处理方式"
          control={
            <SettingsControl width="sm">
              <Select value={strategy} onValueChange={(v) => setStrategy(v as ImportStrategy)}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">跳过同名</SelectItem>
                  <SelectItem value="overwrite">覆盖同名</SelectItem>
                </SelectContent>
              </Select>
            </SettingsControl>
          }
        />
        <SettingsRow
          title="导入数据"
          description="从导出的 JSON 文件恢复端点与应用设置"
          control={
            <Button variant="outline" size="sm" onClick={() => importM.mutate()} disabled={busy}>
              导入
            </Button>
          }
        />
    </SettingsSection>
  );
}
