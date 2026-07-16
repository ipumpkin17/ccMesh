import type { ToolInstallation } from "@/services/modules/toolEnv";

export function ToolInstallRow({ inst }: { inst: ToolInstallation }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="shrink-0 rounded bg-surface-raised px-1 py-0.5 font-mono text-ink-mute">
        {inst.source}
      </span>
      <span
        className="min-w-0 flex-1 truncate font-mono text-ink-mute"
        title={inst.path}
      >
        {inst.path}
      </span>
      <span
        className={
          inst.runnable
            ? "shrink-0 font-mono tabular-nums text-ink-primary"
            : "shrink-0 text-warning"
        }
      >
        {inst.runnable ? inst.version : "无法运行"}
      </span>
      {inst.is_path_default && (
        <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-1 py-0.5 text-[9px] text-primary-soft">
          默认
        </span>
      )}
    </div>
  );
}
