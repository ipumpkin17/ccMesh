import { SettingsRow, SettingsSection } from "@/components/settings";
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
    <SettingsSection title="导航显示">
      {NAV_ITEMS.map((item) => {
        const id = item.id as NavPageId;
        const visible = !hiddenNavIds.includes(id);
        const disableHide = visible && visibleCount <= 1;
        return (
          <SettingsRow
            key={id}
            title={item.label}
            control={
            <Switch
              checked={visible}
              disabled={disableHide}
              onCheckedChange={(v) => setNavPageVisible(id, v)}
              aria-label={`显示${item.label}`}
            />
            }
          />
        );
      })}
    </SettingsSection>
  );
}
