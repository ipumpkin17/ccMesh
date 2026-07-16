import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common";
import { VersionPopover } from "@/components/business";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLayoutStore } from "@/stores";
import { NavItem } from "./NavItem";
import { getVisibleNavItems } from "./navConfig";
import { SettingsShortcut } from "./SettingsShortcut";

export function SideNav() {
  const sidebarState = useLayoutStore((s) => s.sidebarState);
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);
  const hiddenNavIds = useLayoutStore((s) => s.hiddenNavIds);
  const collapsed = sidebarState === "collapsed";
  const navItems = getVisibleNavItems(hiddenNavIds);

  return (
    <nav
      className={cn(
        "flex shrink-0 flex-col border-r border-edge bg-surface transition-[width] duration-200 ease-in-out",
        collapsed ? "w-14" : "w-[220px]"
      )}
    >
      <div className="relative flex h-14 shrink-0 items-center border-b border-edge-subtle px-4">
        <Logo
          iconOnly={collapsed}
          extra={!collapsed ? <VersionPopover /> : undefined}
        />
        {collapsed && (
          <span className="absolute right-2 top-2">
            <VersionPopover compact />
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        <div className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              variant="vertical"
              collapsed={collapsed}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1 border-t border-edge px-2 py-2">
        <div
          className={cn(
            "flex gap-1 pt-1",
            collapsed ? "flex-col items-center" : "items-center justify-between"
          )}
        >
          <SettingsShortcut />
          <div className={cn("flex gap-1", collapsed && "flex-col")}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
                  onClick={toggleSidebar}
                >
                  {collapsed ? (
                    <ChevronRightIcon className="size-4" />
                  ) : (
                    <ChevronLeftIcon className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {collapsed ? "展开侧边栏" : "折叠侧边栏"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </nav>
  );
}
