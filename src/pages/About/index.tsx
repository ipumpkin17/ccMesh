import { PageShell } from "@/components/common";
import { AppInfoSection } from "./_components/AppInfoSection";
import { LocalEnvCheck } from "./_components/LocalEnvCheck";

export function About() {
  return (
    <PageShell title="关于" contentClassName="flex flex-col gap-6">
      <AppInfoSection />
      <LocalEnvCheck />
    </PageShell>
  );
}
