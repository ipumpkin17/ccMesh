import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";

import { emptyClass, metaClass } from "@/components/common";
import { SettingsRow, SettingsSection } from "@/components/settings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ccSwitchApi, type PreviewItem } from "@/services/modules/ccSwitch";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** 跳过原因 → 中文展示。 */
const skipReasonLabel = (reason?: string): string => {
  if (!reason) return "不可迁移";
  if (reason.startsWith("oauth")) return "OAuth/托管账号，需手动配置";
  if (reason === "managed_account") return "托管账号，不支持迁移";
  if (reason === "no_url") return "缺少上游地址";
  if (reason === "no_key") return "缺少 API Key";
  if (reason === "invalid_api_url") return "上游地址无效";
  if (reason.startsWith("unsupported_app")) return "暂不支持的客户端类型";
  return reason;
};

/** cc-switch 客户端类型 → 色块标签（claude 暖橙 / codex 蓝）。 */
const APP_TYPE_BADGE: Record<string, string> = {
  claude: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  codex: "bg-info/12 text-info",
};

const APP_TYPE_ORDER: Record<string, number> = { claude: 0, codex: 1 };

/** 不可用在前；可迁移项 claude → codex，同组按名称。 */
function sortPreviewItems(items: PreviewItem[]): PreviewItem[] {
  return [...items].sort((a, b) => {
    const aSkipped = a.status === "skipped" ? 0 : 1;
    const bSkipped = b.status === "skipped" ? 0 : 1;
    if (aSkipped !== bSkipped) return aSkipped - bSkipped;

    const aApp = APP_TYPE_ORDER[a.appType] ?? 99;
    const bApp = APP_TYPE_ORDER[b.appType] ?? 99;
    if (aApp !== bApp) return aApp - bApp;

    return a.name.localeCompare(b.name, "zh-CN");
  });
}

type AppFilter = { claude: boolean; codex: boolean };

function matchesAppFilter(item: PreviewItem, filter: AppFilter): boolean {
  const active = filter.claude || filter.codex;
  if (!active) return true;
  if (item.appType === "claude") return filter.claude;
  if (item.appType === "codex") return filter.codex;
  return false;
}

function AppTypeFilterButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 cursor-pointer items-center justify-center rounded-md border px-2 text-xs transition-colors",
        active
          ? "border-primary/40 bg-primary/10 ring-1 ring-primary/30"
          : "border-edge bg-surface-card opacity-60 hover:bg-surface-hover hover:opacity-100",
      )}
    >
      {children}
    </button>
  );
}

function AppTypeBadge({ appType }: { appType: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
        APP_TYPE_BADGE[appType] ?? "bg-surface-hover text-ink-mute",
      )}
    >
      {appType}
    </span>
  );
}

/** 行尾展示来源与出站协议。 */
function AppTypeTrail({
  appType,
  transformer,
}: {
  appType: string;
  transformer: string;
}) {
  return (
    <div className="flex w-[7.5rem] shrink-0 items-center justify-end self-center">
      <AppTypeBadge appType={appType} />
      <span className="ml-1.5 text-xs text-ink-mute">{transformer}</span>
    </div>
  );
}

/** 纯展示勾选框（无原生 input，避免 label 聚焦时 scrollIntoView 错位）。 */
function CheckboxBox({
  checked,
  disabled,
  className,
}: {
  checked: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-edge bg-surface-card",
        disabled && "opacity-50",
        className,
      )}
    >
      {checked ? <CheckIcon className="size-3.5" strokeWidth={2.5} /> : null}
    </span>
  );
}

export function CcSwitchImport() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [appFilter, setAppFilter] = useState<AppFilter>({
    claude: false,
    codex: false,
  });

  // 预览：仅在弹窗打开时查询。
  const preview = useQuery({
    queryKey: ["cc-switch-preview"],
    queryFn: () => ccSwitchApi.preview(),
    enabled: open,
    retry: false,
  });

  const importable = useMemo(
    () => (preview.data ?? []).filter((i) => i.status === "ok"),
    [preview.data],
  );

  const sortedItems = useMemo(
    () => sortPreviewItems(preview.data ?? []),
    [preview.data],
  );

  const visibleItems = useMemo(
    () => sortedItems.filter((i) => matchesAppFilter(i, appFilter)),
    [sortedItems, appFilter],
  );

  const visibleImportable = useMemo(
    () => visibleItems.filter((i) => i.status === "ok"),
    [visibleItems],
  );

  const allSelected =
    visibleImportable.length > 0 &&
    visibleImportable.every((i) => selected.has(i.ccSwitchId));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(visibleImportable.map((i) => i.ccSwitchId)));
  };

  const toggleAppFilter = (type: keyof AppFilter) => {
    setAppFilter((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const deselectAll = () => {
    setSelected(new Set());
  };

  const openDialog = () => {
    setSelected(new Set());
    setAppFilter({ claude: false, codex: false });
    setOpen(true);
  };

  const importMutation = useMutation({
    mutationFn: () => ccSwitchApi.import([...selected]),
    onSuccess: (s) => {
      toast.success(
        `导入完成：成功 ${s.imported}（启用 ${s.enabledCount}）` +
          (s.disabledNoModels > 0
            ? `，未启用 ${s.disabledNoModels}`
            : "") +
          (s.skipped > 0 ? `，跳过 ${s.skipped}` : ""),
      );
      qc.invalidateQueries({ queryKey: ["endpoints"] });
      qc.invalidateQueries({ queryKey: ["cc-switch-preview"] });
      setOpen(false);
    },
    onError: (e) => toast.error(`导入失败：${errMsg(e)}`),
  });

  return (
    <>
      <SettingsSection title="外部迁移" layout="plain">
        <SettingsRow
          title="cc-switch"
          description="从本机 cc-switch 迁移端点配置，导入前会探测可用模型"
          density="regular"
          framed
          control={
            <Button size="sm" onClick={openDialog}>
              选择导入
            </Button>
          }
        />
      </SettingsSection>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[min(80vh,calc(100dvh-2rem))] w-full min-w-2xl max-w-3xl flex-col overflow-hidden sm:max-w-3xl">
          <DialogHeader className="shrink-0">
            <DialogTitle>cc-switch 配置迁移</DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            {preview.isLoading ? (
              <p className={emptyClass}>正在读取 cc-switch 配置…</p>
            ) : preview.isError ? (
              <p className={emptyClass}>
                读取失败：{errMsg(preview.error)}。请确认已安装 cc-switch 且配置数据库存在。
              </p>
            ) : (preview.data ?? []).length === 0 ? (
              <p className={emptyClass}>
                未在 cc-switch 中找到可识别的 claude / codex 供应商。
              </p>
            ) : (
              <>
                <div className="flex shrink-0 items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="flex cursor-pointer items-center gap-2 text-xs text-ink-secondary"
                      onClick={selectAll}
                      disabled={visibleImportable.length === 0}
                    >
                      <CheckboxBox
                        checked={allSelected}
                        disabled={visibleImportable.length === 0}
                      />
                      全选
                    </button>
                    <button
                      type="button"
                      className="cursor-pointer rounded px-1.5 py-0.5 text-xs text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-secondary"
                      onClick={deselectAll}
                      disabled={selected.size === 0}
                    >
                      取消全选
                    </button>
                    <div className="flex items-center gap-1 border-l border-edge-subtle pl-3">
                      <AppTypeFilterButton
                        active={appFilter.claude}
                        label="仅显示 Claude"
                        onClick={() => toggleAppFilter("claude")}
                      >
                        Claude
                      </AppTypeFilterButton>
                      <AppTypeFilterButton
                        active={appFilter.codex}
                        label="仅显示 Codex"
                        onClick={() => toggleAppFilter("codex")}
                      >
                        Codex
                      </AppTypeFilterButton>
                    </div>
                  </div>
                  <span className={metaClass}>
                    已勾选 {selected.size} / 可迁移 {importable.length}（共{" "}
                    {(preview.data ?? []).length}）
                  </span>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto rounded-sm border border-input bg-surface-raised">
                  <div className="flex flex-col divide-y divide-edge-subtle">
                    {visibleItems.length === 0 ? (
                      <p className={`px-4 py-6 text-center ${metaClass}`}>
                        当前筛选下没有可展示的项
                      </p>
                    ) : (
                      visibleItems.map((item) => (
                        <PreviewRow
                          key={item.ccSwitchId}
                          item={item}
                          checked={selected.has(item.ccSwitchId)}
                          onToggle={() => toggle(item.ccSwitchId)}
                        />
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={selected.size === 0 || importMutation.isPending}
            >
              {importMutation.isPending
                ? "导入中…"
                : `导入 ${selected.size} 项`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PreviewRow({
  item,
  checked,
  onToggle,
}: {
  item: PreviewItem;
  checked: boolean;
  onToggle: () => void;
}) {
  const skipped = item.status === "skipped";
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      aria-disabled={skipped}
      tabIndex={skipped ? -1 : 0}
      onClick={() => {
        if (!skipped) onToggle();
      }}
      onKeyDown={(e) => {
        if (skipped) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        "flex cursor-pointer items-start gap-3 px-4 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        skipped ? "cursor-not-allowed opacity-50" : "hover:bg-surface-hover",
      )}
    >
      <CheckboxBox checked={checked} disabled={skipped} className="mt-0.5" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm text-ink-primary">{item.name}</span>
        {item.apiUrl ? (
          <span className={`truncate font-mono ${metaClass}`}>
            {item.apiUrl}
          </span>
        ) : null}
        {skipped ? (
          <span className={metaClass}>
            {skipReasonLabel(item.skipReason)}
          </span>
        ) : (
          <span className={metaClass}>
            {item.apiKeyMasked || "—"}
          </span>
        )}
      </div>
      <AppTypeTrail appType={item.appType} transformer={item.transformer} />
    </div>
  );
}
