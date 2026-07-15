import { BackupList } from "./_components/BackupList";
import { CcSwitchImport } from "./_components/CcSwitchImport";
import { LocalBackup } from "./_components/LocalBackup";
import { WebdavForm } from "./_components/WebdavForm";

export function Sync() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-light tracking-tight">同步</h1>
      <CcSwitchImport />
      <WebdavForm />
      <BackupList />
      <LocalBackup />
    </div>
  );
}
