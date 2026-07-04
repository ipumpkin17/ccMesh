import { useQueryClient } from "@tanstack/react-query";
import { AppWindow, Languages, Moon, Palette, ScrollText, Server } from "lucide-react";
import { useTheme } from "next-themes";

import { SettingCard, SettingRow } from "@/components/settings";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AppConfig } from "@/services/modules/config";
import { logsApi } from "@/services/modules/logs";
import { windowApi } from "@/services/modules/window";

export function GeneralCard({
  cfg,
  save,
}: {
  cfg: AppConfig;
  save: (patch: Record<string, string>) => Promise<void>;
}) {
  const qc = useQueryClient();
  const { setTheme } = useTheme();

  return (
    <SettingCard icon={Palette} title="常规">
      <SettingRow label="代理端口" icon={Server}>
        <Input
          className="w-32"
          defaultValue={String(cfg.port)}
          onBlur={(e) => save({ port: e.target.value })}
        />
      </SettingRow>

      <SettingRow label="主题" icon={Moon}>
        <Select
          value={cfg.theme}
          onValueChange={(v) => {
            setTheme(v);
            save({ theme: v });
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">跟随系统</SelectItem>
            <SelectItem value="light">浅色</SelectItem>
            <SelectItem value="dark">深色</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow label="定时自动切换主题">
        <Switch
          checked={cfg.themeAuto}
          onCheckedChange={(v) => save({ themeAuto: String(v) })}
        />
      </SettingRow>

      {cfg.themeAuto && (
        <SettingRow label="浅色 / 深色起始时间">
          <div className="flex items-center gap-2">
            <Input
              type="time"
              className="w-28"
              defaultValue={cfg.autoLightStart}
              onBlur={(e) => save({ autoLightStart: e.target.value })}
            />
            <Input
              type="time"
              className="w-28"
              defaultValue={cfg.autoDarkStart}
              onBlur={(e) => save({ autoDarkStart: e.target.value })}
            />
          </div>
        </SettingRow>
      )}

      <SettingRow label="语言" icon={Languages}>
        <Select
          value={cfg.language}
          onValueChange={(v) => {
            windowApi.setLanguage(v).catch(() => undefined);
            save({ language: v });
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="zh">中文</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow label="关闭窗口行为" icon={AppWindow}>
        <Select
          value={cfg.closeWindowBehavior}
          onValueChange={(v) => save({ closeWindowBehavior: v })}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ask">每次询问</SelectItem>
            <SelectItem value="minimize">最小化到托盘</SelectItem>
            <SelectItem value="quit">直接退出</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow label="日志级别" icon={ScrollText}>
        <Select
          value={cfg.logLevel}
          onValueChange={(v) => {
            logsApi.setLevel(v).catch(() => undefined);
            qc.invalidateQueries({ queryKey: ["config"] });
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["trace", "debug", "info", "warn", "error"].map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
    </SettingCard>
  );
}
