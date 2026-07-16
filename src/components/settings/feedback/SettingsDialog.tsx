import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** 设置页弹框的统一标题、尺寸与操作区。 */
export function SettingsDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
  size = "sm",
  stackedActions = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  size?: "sm" | "form";
  stackedActions?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={size === "form" ? "sm:max-w-2xl" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
        {actions ? (
          <DialogFooter className={stackedActions ? "flex flex-col gap-2 sm:flex-col [&>button]:w-full" : undefined}>
            {actions}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
