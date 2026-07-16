import { useState } from "react";

import { PageShell } from "@/components/common";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClaudeWorkspace } from "./_components/ClaudeWorkspace";
import { CodexWorkspace } from "./_components/CodexWorkspace";

type Tab = "claude" | "codex";

export function ConfigProfiles() {
  const [tab, setTab] = useState<Tab>("claude");

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="h-full min-h-0">
      <PageShell
        title="配置文件"
        className="flex-1"
        actions={
          <TabsList>
            <TabsTrigger value="claude">Claude Code</TabsTrigger>
            <TabsTrigger value="codex">Codex</TabsTrigger>
          </TabsList>
        }
        contentScrollable={false}
        contentClassName="flex flex-col"
      >
        <div className="min-h-0 flex-1">
          {tab === "claude" ? <ClaudeWorkspace key="claude" /> : <CodexWorkspace key="codex" />}
        </div>
      </PageShell>
    </Tabs>
  );
}
