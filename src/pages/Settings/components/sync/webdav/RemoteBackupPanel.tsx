import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { SettingsDialog, SettingsPanel, SettingsSection } from "@/components/settings";
import { configApi } from "@/services/modules/config";
import { BackupList } from "./BackupList";
import { WebdavForm } from "./WebdavForm";

/** WebDAV 连接信息是远程备份、恢复与管理的共同前置条件。 */
export function RemoteBackupPanel() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { data: config } = useQuery({ queryKey: ["config"], queryFn: configApi.getConfig });
  const webdav = config?.webdav;
  const connected = Boolean(webdav?.url && webdav.username && webdav.password);

  return (
    <>
      <SettingsSection title="WebDAV 备份" layout="panel">
        {connected ? (
          <SettingsPanel>
            <BackupList onOpenSettings={() => setSettingsOpen(true)} />
          </SettingsPanel>
        ) : (
          <WebdavForm layout="stack" onSaved={() => setSettingsOpen(false)} />
        )}
      </SettingsSection>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="WebDAV 连接设置"
        description="用于访问远程备份目录"
        size="form"
      >
        <WebdavForm onSaved={() => setSettingsOpen(false)} />
      </SettingsDialog>
    </>
  );
}
