import type { ReactNode } from "react";

/** 列表的独立入口和主要操作分别落在左右两侧。 */
export function SettingsToolbar({
  leading,
  actions,
}: {
  leading?: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>{leading}</div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}

/** 标准垂直内容流，统一模块内部的间距。 */
export function SettingsStack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

/** 列表折叠等次级操作统一居中。 */
export function SettingsCenteredAction({ children }: { children: ReactNode }) {
  return <div className="flex justify-center">{children}</div>;
}
