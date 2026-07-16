import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { IS_MAC } from "@/lib/platform";
import { endpointApi } from "@/services/modules/endpoint";
import { icloudApi } from "@/services/modules/icloud";

/**
 * macOS：
 * 1) 端点变更后 debounce 自动备份到 iCloud
 * 2) 启动 + 运行中轮询检测 iCloud 差异，提示去同步页处理（不静默覆盖）
 */
export function useICloudEndpointSync() {
  const backupTimer = useRef<number | null>(null);
  const pollTimer = useRef<number | null>(null);
  const lastConflictHash = useRef<string>("");

  useEffect(() => {
    if (!IS_MAC) return;

    let disposed = false;
    const unlistens: Array<() => void> = [];

    const scheduleBackup = () => {
      if (backupTimer.current) window.clearTimeout(backupTimer.current);
      backupTimer.current = window.setTimeout(() => {
        icloudApi.autoBackup().catch(() => undefined);
      }, 800);
    };

    const checkConflict = async () => {
      try {
        const status = await icloudApi.getStatus();
        if (disposed) return;
        if (!(status.enabled && status.state === "conflict")) return;
        const key = `${status.localHash}|${status.cloudHash ?? ""}`;
        if (key && key === lastConflictHash.current) return;
        lastConflictHash.current = key;
        toast.message("iCloud 端点配置与本地存在差异", {
          description: "请到「同步」页选择同步方向",
        });
      } catch {
        // iCloud 不可用/未登录时静默
      }
    };

    void checkConflict();
    pollTimer.current = window.setInterval(() => {
      void checkConflict();
    }, 15000);

    endpointApi
      .onChanged(() => {
        scheduleBackup();
      })
      .then((un) => {
        if (disposed) un();
        else unlistens.push(un);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      if (backupTimer.current) window.clearTimeout(backupTimer.current);
      if (pollTimer.current) window.clearInterval(pollTimer.current);
      unlistens.forEach((un) => un());
    };
  }, []);
}
