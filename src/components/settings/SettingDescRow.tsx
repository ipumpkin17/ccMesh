import type { ReactNode } from "react";

import { bodyClass, metaClass } from "@/lib/typography";

export function SettingDescRow({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={bodyClass}>{title}</span>
        <span className={metaClass}>{desc}</span>
      </div>
      {children}
    </div>
  );
}
