import type { ComponentType } from "react";
import {
  GaugeIcon,
  ServerIcon,
  FileCogIcon,
  ChartColumnIcon,
  ScrollTextIcon,
} from "lucide-react";

import type { NavPageId, ViewId } from "@/stores";

export interface NavItemDef {
  id: ViewId;
  label: string;
  labelEn: string;
  icon: ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItemDef[] = [
  { id: "dashboard", label: "仪表盘", labelEn: "Dashboard", icon: GaugeIcon },
  { id: "endpoints", label: "端点管理", labelEn: "Endpoints", icon: ServerIcon },
  {
    id: "configProfiles",
    label: "配置文件",
    labelEn: "Config Profiles",
    icon: FileCogIcon,
  },
  { id: "statistics", label: "统计", labelEn: "Statistics", icon: ChartColumnIcon },
  { id: "logs", label: "日志", labelEn: "Logs", icon: ScrollTextIcon },
];

/** 按隐藏列表过滤业务导航项。 */
export function getVisibleNavItems(hiddenNavIds: NavPageId[]): NavItemDef[] {
  const hidden = new Set(hiddenNavIds);
  return NAV_ITEMS.filter((item) => !hidden.has(item.id as NavPageId));
}
