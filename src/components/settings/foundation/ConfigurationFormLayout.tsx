import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { ConfigurationPanelContent } from "./ConfigurationPanelContent";

/** 配置表单的统一内容区域，可在宽屏使用双列字段。 */
export function ConfigurationFormLayout({
  fields,
  actions,
  columns = "one",
}: {
  fields: readonly { id: string; label: ReactNode; control: ReactNode }[];
  actions?: ReactNode;
  columns?: "one" | "two";
}) {
  return (
    <ConfigurationPanelContent className="flex flex-col gap-4">
      <div className={cn("grid gap-3", columns === "two" && "grid-cols-2 max-[560px]:grid-cols-1")}>
        {fields.map((field) => (
          <ConfigurationFormField key={field.id} label={field.label}>
            {field.control}
          </ConfigurationFormField>
        ))}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </ConfigurationPanelContent>
  );
}

/** 配置表单字段的统一标签和控件间距。 */
export function ConfigurationFormField({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label}
      {children}
    </div>
  );
}
