import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ConfigurationWorkspaceItem<Id extends string> {
  id: Id;
  label: string;
  icon: LucideIcon;
  content: ReactNode;
  group?: string;
}

export function ConfigurationWorkspace<Id extends string>({
  items,
  defaultItemId,
  ariaLabel,
  className,
}: {
  items: readonly ConfigurationWorkspaceItem<Id>[];
  defaultItemId: Id;
  ariaLabel: string;
  className?: string;
}) {
  const [activeItemId, setActiveItemId] = useState<Id>(defaultItemId);
  const groups = items.reduce<Array<{ label?: string; items: ConfigurationWorkspaceItem<Id>[] }>>(
    (result, item) => {
      const last = result[result.length - 1];
      if (last && last.label === item.group) {
        last.items.push(item);
      } else {
        result.push({ label: item.group, items: [item] });
      }
      return result;
    },
    [],
  );

  return (
    <div
      className={cn(
        "grid h-full min-h-0 grid-cols-[11.5rem_minmax(0,1fr)] gap-6 max-[760px]:flex max-[760px]:flex-col max-[760px]:gap-4",
        className,
      )}
    >
      <aside className="flex min-h-0 flex-col border-r border-edge-subtle pr-4 max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:pb-3 max-[760px]:pr-0">
        <nav
          className="scrollbar-none flex min-h-0 flex-col gap-1 overflow-y-auto max-[760px]:flex-row max-[760px]:overflow-x-auto max-[760px]:overflow-y-hidden"
          aria-label={ariaLabel}
        >
          {groups.map((group, groupIndex) => (
            <div
              key={group.label ?? groupIndex}
              className="flex shrink-0 flex-col gap-1 max-[760px]:flex-row"
            >
              {group.label ? (
                <p className="px-3 pb-1 pt-3 text-xs font-medium text-ink-mute first:pt-0 max-[760px]:hidden">
                  {group.label}
                </p>
              ) : null}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeItemId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => setActiveItemId(item.id)}
                    className={cn(
                      "flex min-h-10 w-full shrink-0 items-center gap-3 rounded-md px-3 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring/60 max-[760px]:w-auto",
                      active
                        ? "bg-primary/10 text-primary-soft"
                        : "text-ink-secondary hover:bg-surface-hover hover:text-ink-primary",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="scrollbar-none min-h-0 min-w-0 overflow-y-auto pb-6 pr-1">
        <div className="w-full">
          {items.map((item) => (
            <section key={item.id} hidden={activeItemId !== item.id} aria-label={item.label}>
              {item.content}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
