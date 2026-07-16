import type { ReactNode } from "react";

import { ConfigurationActionRow } from "@/components/settings/foundation/ConfigurationActionRow";

/** 设置中心的标准单行，所有文案基线和控件位置由此处统一。 */
export function SettingsRow({
  title,
  description,
  control,
  density = "compact",
  framed = false,
  controlLayout = "auto",
}: {
  title: string;
  description?: ReactNode;
  control: ReactNode;
  density?: "compact" | "regular";
  framed?: boolean;
  controlLayout?: "auto" | "wide";
}) {
  return (
    <ConfigurationActionRow
      title={title}
      description={description}
      density={density}
      surface={framed}
      controlLayout={controlLayout}
    >
      {control}
    </ConfigurationActionRow>
  );
}
