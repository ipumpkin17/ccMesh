import type { ReactNode } from "react";

import { ConfigurationActionGroup } from "./ConfigurationActionGroup";
import { bodyClass, metaClass } from "@/components/common/SurfaceCard";

export function ConfigurationActionRow({
  title,
  description,
  children,
  surface = true,
  density = "regular",
  controlLayout = "auto",
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  surface?: boolean;
  density?: "regular" | "compact";
  controlLayout?: "auto" | "wide";
}) {
  const rowClass =
    density === "compact"
      ? description
        ? "min-h-12 px-4 py-2 sm:px-5"
        : "min-h-10 px-4 py-2 sm:px-5"
      : "min-h-16 px-4 py-3 sm:px-5";

  const content = (
    <div className={`flex items-center justify-between gap-4 ${rowClass}`}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={bodyClass}>{title}</span>
        {description ? <span className={metaClass}>{description}</span> : null}
      </div>
      <div className={controlLayout === "wide" ? "min-w-0 flex-1" : "shrink-0"}>{children}</div>
    </div>
  );

  return surface ? <ConfigurationActionGroup>{content}</ConfigurationActionGroup> : content;
}
