import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SettingsRow, SettingsSection, SettingsTextField } from "@/components/settings";
import type { AppConfig } from "@/services/modules/config";
import { toolEnvApi } from "@/services/modules/toolEnv";

export function AdvancedCard({
  cfg,
  save,
}: {
  cfg: AppConfig;
  save: (patch: Record<string, string>) => Promise<void>;
}) {
  const [openaiUa, setOpenaiUa] = useState(cfg.openaiUa);
  const [claudeUa, setClaudeUa] = useState(cfg.claudeCliUa);
  const [readingLocal, setReadingLocal] = useState(false);

  useEffect(() => setOpenaiUa(cfg.openaiUa), [cfg.openaiUa]);
  useEffect(() => setClaudeUa(cfg.claudeCliUa), [cfg.claudeCliUa]);

  const useLocalUa = async (target: "openai" | "claude") => {
    setReadingLocal(true);
    try {
      const local = await toolEnvApi.getLocalCliUserAgents();
      const ua = target === "openai" ? local.codexUa : local.claudeUa;
      if (!ua) {
        toast.error(target === "openai" ? "未找到可运行的本机 Codex CLI" : "未找到可运行的本机 Claude Code");
        return;
      }
      if (target === "openai") {
        setOpenaiUa(ua);
        await save({ openaiUa: ua });
      } else {
        setClaudeUa(ua);
        await save({ claudeCliUa: ua });
      }
      toast.success("已同步本机 CLI 的 UA");
    } catch (error) {
      toast.error(`读取本机 UA 失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setReadingLocal(false);
    }
  };

  return (
    <SettingsSection title="高级设置">
      <SettingsRow
        title="OpenAI 端点 UA"
        description="始终以 Codex 客户端身份转发"
        density="regular"
        controlLayout="wide"
        control={
          <SettingsTextField
            value={openaiUa}
            placeholder="Codex 客户端 User-Agent"
            onValueChange={setOpenaiUa}
            onCommit={() => save({ openaiUa })}
            actionLabel="读取本机"
            onAction={() => void useLocalUa("openai")}
            actionPending={readingLocal}
          />
        }
      />
      <SettingsRow
        title="Claude 端点 UA"
        description="始终以 Claude Code 身份转发"
        density="regular"
        controlLayout="wide"
        control={
          <SettingsTextField
            value={claudeUa}
            placeholder="Claude Code User-Agent"
            onValueChange={setClaudeUa}
            onCommit={() => save({ claudeCliUa: claudeUa })}
            actionLabel="读取本机"
            onAction={() => void useLocalUa("claude")}
            actionPending={readingLocal}
          />
        }
      />
    </SettingsSection>
  );
}
