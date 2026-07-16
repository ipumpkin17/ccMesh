import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import {
  ConfigurationWorkspace,
  type ConfigurationWorkspaceItem,
} from "@/components/settings/foundation/ConfigurationWorkspace";

export interface SettingsWorkspaceItem<Id extends string> {
  id: Id;
  label: string;
  icon: LucideIcon;
  content: ReactNode;
}

/** 设置中心的左侧栏目和右侧内容工作区。 */
export function SettingsWorkspace<Id extends string>({
  items,
  defaultItemId,
  ariaLabel,
}: {
  items: readonly SettingsWorkspaceItem<Id>[];
  defaultItemId: Id;
  ariaLabel: string;
}) {
  return (
    <ConfigurationWorkspace
      items={items as readonly ConfigurationWorkspaceItem<Id>[]}
      defaultItemId={defaultItemId}
      ariaLabel={ariaLabel}
    />
  );
}
