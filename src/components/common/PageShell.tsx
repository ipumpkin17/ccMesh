import type { ReactNode } from "react";

import { pageTitleClass } from "@/lib/typography";
import { cn } from "@/lib/utils";

interface PageShellProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  headerExtra?: ReactNode;
  className?: string;
  contentClassName?: string;
  contentScrollable?: boolean;
}

export function PageShell({
  title,
  children,
  actions,
  headerExtra,
  className,
  contentClassName,
  contentScrollable = true,
}: PageShellProps) {
  return (
    <section className={cn("flex h-full min-h-0 flex-col gap-4", className)}>
      <header className="flex shrink-0 flex-col gap-4">
        <div className="flex min-w-0 items-center justify-between gap-4">
          <h1 className={cn("min-w-0 shrink truncate", pageTitleClass)}>
            {title}
          </h1>
          {actions ? (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          ) : null}
        </div>
        {headerExtra ? <div className="min-w-0">{headerExtra}</div> : null}
      </header>

      <div
        className={cn(
          "min-h-0 flex-1",
          contentScrollable
            ? "scrollbar-none overflow-y-auto pb-6 pr-1"
            : "overflow-hidden",
          contentClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
