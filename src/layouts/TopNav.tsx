import { useEffect, useRef } from "react";

import { Logo } from "@/components/common";
import { VersionPopover } from "@/components/business";
import { useLayoutStore } from "@/stores";
import { NavItem } from "./NavItem";
import { getVisibleNavItems } from "./navConfig";
import { SettingsShortcut } from "./SettingsShortcut";

export function TopNav() {
  const hiddenNavIds = useLayoutStore((s) => s.hiddenNavIds);
  const navItems = getVisibleNavItems(hiddenNavIds);
  // 顶部导航横向滚动条已隐藏，监听纵向滚轮映射为左右滚动，保持横向列表可操作。
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      nav.scrollLeft += e.deltaY;
    };
    // 非被动监听才能 preventDefault 阻止页面纵向滚动。
    nav.addEventListener("wheel", onWheel, { passive: false });
    return () => nav.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <header
      data-tauri-drag-region
      className="flex h-14 shrink-0 items-center gap-4 border-b border-edge bg-surface px-6"
    >
      <div className="w-[160px] shrink-0">
        <Logo extra={<VersionPopover />} />
      </div>

      <nav
        ref={navRef}
        className="scrollbar-none flex flex-1 items-center gap-1 overflow-x-auto"
      >
        {navItems.map((item) => (
          <NavItem key={item.id} item={item} variant="horizontal" />
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-2">
        <SettingsShortcut side="bottom" />
      </div>
    </header>
  );
}
