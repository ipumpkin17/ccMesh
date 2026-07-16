import { Cpu, InfoIcon } from "lucide-react";

import { SettingCard } from "@/components/settings";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AppConfig } from "@/services/modules/config";
import { bodyClass } from "@/lib/typography";

const OPENAI_UA_HINT = "codex_cli_rs/0.114.0 (Mac OS 14.2.0; x86_64) vscode/1.111.0";
const CLAUDE_UA_HINT = "claude-cli/2.1.185 (external, sdk-cli)";

function UaFieldLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={bodyClass}>{label}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex text-ink-disabled hover:text-ink-mute"
            aria-label={`${label}参考示例`}
          >
            <InfoIcon className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm font-mono text-xs">{hint}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function AdvancedCard({
  cfg,
  save,
}: {
  cfg: AppConfig;
  save: (patch: Record<string, string>) => Promise<void>;
}) {
  return (
    <SettingCard icon={Cpu} title="系统 / 高级">
      <div className="flex flex-col gap-1.5">
        <UaFieldLabel label="OpenAI 通用端点 UA" hint={OPENAI_UA_HINT} />
        <Input
          placeholder="清空后透传客户端 UA"
          defaultValue={cfg.openaiUa}
          onBlur={(e) => save({ openaiUa: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <UaFieldLabel label="Claude 端点 UA" hint={CLAUDE_UA_HINT} />
        <Input
          placeholder="清空后透传客户端 UA"
          defaultValue={cfg.claudeCliUa}
          onBlur={(e) => save({ claudeCliUa: e.target.value })}
        />
      </div>
    </SettingCard>
  );
}
