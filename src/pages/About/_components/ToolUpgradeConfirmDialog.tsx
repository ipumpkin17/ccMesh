import { AlertTriangleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ToolInstallationReport } from "@/services/modules/toolEnv";
import { ToolInstallRow } from "./ToolInstallRow";

interface Props {
  open: boolean;
  plans: ToolInstallationReport[];
  displayName: (tool: string) => string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ToolUpgradeConfirmDialog({
  open,
  plans,
  displayName,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangleIcon className="size-5 text-warning" />
            确认升级目标
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            检测到多处安装。升级只会写入命令行默认命中的那一处，其余安装不会改动。
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-3 overflow-y-auto">
          {plans.map((plan) => (
            <div
              key={plan.tool}
              className="space-y-1.5 rounded-lg border border-warning/20 bg-warning/5 p-2.5"
            >
              <div className="text-xs font-medium">{displayName(plan.tool)}</div>
              {!plan.anchored && (
                <div className="text-[10px] leading-snug text-warning">
                  未能锚定到具体安装路径，将使用通用升级命令。
                </div>
              )}
              <ul className="space-y-1">
                {plan.installs.map((inst) => (
                  <li key={inst.path}>
                    <ToolInstallRow inst={inst} />
                  </li>
                ))}
              </ul>
              <div className="space-y-0.5">
                <div className="text-[10px] text-ink-mute">将执行</div>
                <code
                  className="block truncate rounded bg-surface-raised px-1.5 py-0.5 font-mono text-[10px]"
                  title={plan.command}
                >
                  {plan.command}
                </code>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button onClick={onConfirm}>确认升级</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
