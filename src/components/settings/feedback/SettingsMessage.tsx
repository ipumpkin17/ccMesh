import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** 设置模块内的状态和提示文案。 */
export function SettingsMessage({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "warning";
}) {
  return <p className={cn("text-xs", tone === "warning" ? "text-warning" : "text-ink-mute")}>{children}</p>;
}

/** 同一行的次级状态与操作使用统一间距。 */
export function SettingsInlineActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 text-xs text-ink-mute">{children}</div>;
}
