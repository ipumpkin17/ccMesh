import { PageShell } from "@/components/common";

import { BackupList } from "./_components/BackupList";
import { CcSwitchImport } from "./_components/CcSwitchImport";
import { LocalBackup } from "./_components/LocalBackup";
import { WebdavForm } from "./_components/WebdavForm";

export function Sync() {
  return (
    <PageShell title="同步" contentClassName="flex flex-col gap-6">
      <CcSwitchImport />
      <WebdavForm />
      <BackupList />
      <LocalBackup />
    </PageShell>
  );
}
