import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { bodyClass } from "@/lib/typography";

export function SettingRow({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {Icon ? (
          <Icon className="h-4 w-4 shrink-0 text-ink-mute" aria-hidden />
        ) : null}
        <span className={bodyClass}>{label}</span>
      </div>
      {children}
    </div>
  );
}
