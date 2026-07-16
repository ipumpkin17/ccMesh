import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { bodyClass } from "@/lib/typography";

/** 带参考值说明的表单标签。 */
export function SettingsHelpLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={bodyClass}>{label}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-xs text-ink-mute hover:text-ink-primary"
            aria-label={`${label}参考示例`}
          >
            示例
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm font-mono text-xs">{hint}</TooltipContent>
      </Tooltip>
    </div>
  );
}
