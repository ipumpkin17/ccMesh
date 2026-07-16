import type { ReactNode } from "react";

/** 同一设置栏目中各模块的标准垂直节奏。 */
export function SettingsPageContent({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-6">{children}</div>;
}
