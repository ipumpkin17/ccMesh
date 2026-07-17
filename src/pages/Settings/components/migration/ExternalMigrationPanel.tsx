import { useState } from "react";

import { SettingsRow, SettingsSection } from "@/components/settings";
import { Button } from "@/components/ui/button";
import { ccSwitchSourceApi } from "@/services/modules/externalMigration";

import { MigrationImportDialog } from "./MigrationImportDialog";

const CC_SWITCH_FILTERS = [
  {
    id: "claude",
    label: "Claude",
    badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  {
    id: "codex",
    label: "Codex",
    badgeClass: "bg-info/12 text-info",
  },
] as const;

const CC_SWITCH_CATEGORY_ORDER: Record<string, number> = {
  claude: 0,
  codex: 1,
};

/** 外部迁移面板：多源入口；对话框复用通用组件。 */
export function ExternalMigrationPanel() {
  const [ccSwitchOpen, setCcSwitchOpen] = useState(false);

  return (
    <>
      <SettingsSection title="外部迁移" layout="plain">
        <SettingsRow
          title="cc-switch"
          description="从本机 cc-switch 迁移端点配置，导入前会探测可用模型"
          density="regular"
          framed
          control={
            <Button size="sm" onClick={() => setCcSwitchOpen(true)}>
              选择导入
            </Button>
          }
        />
      </SettingsSection>

      <MigrationImportDialog
        open={ccSwitchOpen}
        onOpenChange={setCcSwitchOpen}
        title="cc-switch 配置迁移"
        queryKey="external-migration-cc-switch"
        api={ccSwitchSourceApi}
        loadingText="正在读取 cc-switch 配置…"
        errorText={(message) =>
          `读取失败：${message}。请确认已安装 cc-switch 且配置数据库存在。`
        }
        emptyText="未在 cc-switch 中找到可识别的 claude / codex 供应商。"
        categoryFilters={[...CC_SWITCH_FILTERS]}
        categoryOrder={CC_SWITCH_CATEGORY_ORDER}
      />
    </>
  );
}
