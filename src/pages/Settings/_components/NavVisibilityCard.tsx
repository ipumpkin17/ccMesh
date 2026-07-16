import { LayoutList } from "lucide-react";

import { SettingCard, SettingDescRow } from "@/components/settings";
import { Switch } from "@/components/ui/switch";
import { NAV_ITEMS } from "@/layouts/navConfig";
import {
  NAV_PAGE_IDS,
  useLayoutStore,
  type NavPageId,
} from "@/stores";

export function NavVisibilityCard() {
  const hiddenNavIds = useLayoutStore((s) => s.hiddenNavIds);
  const setNavPageVisible = useLayoutStore((s) => s.setNavPageVisible);
  const visibleCount = NAV_PAGE_IDS.length - hiddenNavIds.length;

  return (
    <SettingCard icon={LayoutList} title="导航显示">
      <p className="text-xs leading-relaxed text-ink-mute">
        控制侧边栏/顶部导航中的业务页是否显示。设置与关于始终保留；至少保留一个业务页。
      </p>
      {NAV_ITEMS.map((item) => {
        const id = item.id as NavPageId;
        const visible = !hiddenNavIds.includes(id);
        const disableHide = visible && visibleCount <= 1;
        return (
          <SettingDescRow key={id} title={item.label} desc={item.labelEn}>
            <Switch
              checked={visible}
              disabled={disableHide}
              onCheckedChange={(v) => setNavPageVisible(id, v)}
              aria-label={`显示${item.label}`}
            />
          </SettingDescRow>
        );
      })}
    </SettingCard>
  );
}
