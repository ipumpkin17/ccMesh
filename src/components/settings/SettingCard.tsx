import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { sectionTitleClass, SurfaceCard } from "@/components/common";
import { cn } from "@/lib/utils";

export function SettingCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <SurfaceCard className={className}>
      <h2 className={cn(sectionTitleClass, "mb-5 flex items-center gap-2")}>
        <Icon className="h-5 w-5 shrink-0" aria-hidden />
        {title}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </SurfaceCard>
  );
}
