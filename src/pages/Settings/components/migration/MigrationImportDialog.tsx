import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";

import { emptyClass, metaClass } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  ExternalMigrationSourceApi,
  ImportSummary,
  PreviewItem,
} from "@/services/modules/externalMigration";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const EMPTY_CATEGORY_FILTERS: CategoryFilterOption[] = [];
const EMPTY_CATEGORY_ORDER: Record<string, number> = {};

/** 跳过原因 → 中文展示。 */
function skipReasonLabel(reason?: string): string {
  if (!reason) return "不可迁移";
  if (reason.startsWith("oauth")) return "OAuth/托管账号，需手动配置";
  if (reason === "managed_account") return "托管账号，不支持迁移";
  if (reason === "no_url") return "缺少上游地址";
  if (reason === "no_key") return "缺少 API Key";
  if (reason === "invalid_api_url") return "上游地址无效";
  if (reason.startsWith("unsupported_app")) return "暂不支持的客户端类型";
  return reason;
}

function importSuccessMessage(s: ImportSummary): string {
  return (
    `导入完成：成功 ${s.imported}（启用 ${s.enabledCount}）` +
    (s.disabledNoModels > 0 ? `，未启用 ${s.disabledNoModels}` : "") +
    (s.skipped > 0 ? `，跳过 ${s.skipped}` : "")
  );
}

export type CategoryFilterOption = {
  id: string;
  label: string;
  badgeClass?: string;
};

export type MigrationImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** react-query 缓存键前缀，按源区分。 */
  queryKey: string;
  api: ExternalMigrationSourceApi;
  /** 可选路径覆盖（上传场景）；默认源路径时省略。 */
  path?: string;
  loadingText: string;
  errorText: (message: string) => string;
  emptyText: string;
  categoryFilters?: CategoryFilterOption[];
  categoryOrder?: Record<string, number>;
  defaultCategoryBadgeClass?: string;
};

function emptyCategoryFilterState(
  filters: CategoryFilterOption[],
): Record<string, boolean> {
  return Object.fromEntries(filters.map((f) => [f.id, false]));
}

function sortPreviewItems(
  items: PreviewItem[],
  categoryOrder: Record<string, number>,
): PreviewItem[] {
  return [...items].sort((a, b) => {
    const byStatus =
      (a.status === "skipped" ? 0 : 1) - (b.status === "skipped" ? 0 : 1);
    if (byStatus !== 0) return byStatus;

    const byCategory =
      (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99);
    if (byCategory !== 0) return byCategory;

    return a.name.localeCompare(b.name, "zh-CN");
  });
}

function CategoryFilterButton({
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

function PreviewRow({
  item,
  checked,
  onToggle,
  badgeClass,
}: {
  item: PreviewItem;
  checked: boolean;
  onToggle: () => void;
  badgeClass?: string;
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
          <span className={`truncate font-mono ${metaClass}`}>{item.apiUrl}</span>
        ) : null}
        <span className={metaClass}>
          {skipped ? skipReasonLabel(item.skipReason) : item.apiKeyMasked || "—"}
        </span>
      </div>
      <div className="flex w-[7.5rem] shrink-0 items-center justify-end self-center">
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
            badgeClass ?? "bg-surface-hover text-ink-mute",
          )}
        >
          {item.category}
        </span>
        <span className="ml-1.5 text-xs text-ink-mute">{item.transformer}</span>
      </div>
    </div>
  );
}

function PreviewToolbar({
  allSelected,
  selectedCount,
  importableCount,
  totalCount,
  visibleImportableCount,
  categoryFilters,
  categoryFilter,
  onSelectAll,
  onDeselectAll,
  onToggleCategory,
}: {
  allSelected: boolean;
  selectedCount: number;
  importableCount: number;
  totalCount: number;
  visibleImportableCount: number;
  categoryFilters: CategoryFilterOption[];
  categoryFilter: Record<string, boolean>;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onToggleCategory: (id: string) => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-2 text-xs text-ink-secondary"
          onClick={onSelectAll}
          disabled={visibleImportableCount === 0}
        >
          <CheckboxBox
            checked={allSelected}
            disabled={visibleImportableCount === 0}
          />
          全选
        </button>
        <button
          type="button"
          className="cursor-pointer rounded px-1.5 py-0.5 text-xs text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-secondary"
          onClick={onDeselectAll}
          disabled={selectedCount === 0}
        >
          取消全选
        </button>
        {categoryFilters.length > 0 ? (
          <div className="flex items-center gap-1 border-l border-edge-subtle pl-3">
            {categoryFilters.map((f) => (
              <CategoryFilterButton
                key={f.id}
                active={!!categoryFilter[f.id]}
                label={`仅显示 ${f.label}`}
                onClick={() => onToggleCategory(f.id)}
              >
                {f.label}
              </CategoryFilterButton>
            ))}
          </div>
        ) : null}
      </div>
      <span className={metaClass}>
        已勾选 {selectedCount} / 可迁移 {importableCount}（共 {totalCount}）
      </span>
    </div>
  );
}

function PreviewList({
  items,
  selected,
  badgeClassOf,
  onToggle,
}: {
  items: PreviewItem[];
  selected: Set<string>;
  badgeClassOf: (category: string) => string | undefined;
  onToggle: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto rounded-sm border border-input bg-surface-raised">
        <p className={`px-4 py-6 text-center ${metaClass}`}>
          当前筛选下没有可展示的项
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-sm border border-input bg-surface-raised">
      <div className="flex flex-col divide-y divide-edge-subtle">
        {items.map((item) => (
          <PreviewRow
            key={item.sourceId}
            item={item}
            checked={selected.has(item.sourceId)}
            onToggle={() => onToggle(item.sourceId)}
            badgeClass={badgeClassOf(item.category)}
          />
        ))}
      </div>
    </div>
  );
}

/** 通用外部迁移导入对话框：预览勾选 → 导入。 */
export function MigrationImportDialog({
  open,
  onOpenChange,
  title,
  queryKey,
  api,
  path,
  loadingText,
  errorText,
  emptyText,
  categoryFilters = EMPTY_CATEGORY_FILTERS,
  categoryOrder = EMPTY_CATEGORY_ORDER,
  defaultCategoryBadgeClass,
}: MigrationImportDialogProps) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [categoryFilter, setCategoryFilter] = useState(() =>
    emptyCategoryFilterState(categoryFilters),
  );

  const preview = useQuery({
    queryKey: [queryKey, path ?? ""],
    queryFn: () => api.preview(path),
    enabled: open,
    retry: false,
  });

  const items = preview.data ?? [];
  const importable = useMemo(
    () => items.filter((i) => i.status === "ok"),
    [items],
  );
  const sortedItems = useMemo(
    () => sortPreviewItems(items, categoryOrder),
    [items, categoryOrder],
  );

  const filterActive = categoryFilters.some((f) => categoryFilter[f.id]);
  const visibleItems = useMemo(() => {
    if (!filterActive) return sortedItems;
    return sortedItems.filter((i) => categoryFilter[i.category]);
  }, [sortedItems, categoryFilter, filterActive]);

  const visibleImportable = useMemo(
    () => visibleItems.filter((i) => i.status === "ok"),
    [visibleItems],
  );

  const allSelected =
    visibleImportable.length > 0 &&
    visibleImportable.every((i) => selected.has(i.sourceId));

  const badgeClassOf = (category: string) =>
    categoryFilters.find((f) => f.id === category)?.badgeClass ??
    defaultCategoryBadgeClass;

  const resetLocalState = () => {
    setSelected(new Set());
    setCategoryFilter(emptyCategoryFilterState(categoryFilters));
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const importMutation = useMutation({
    mutationFn: () => api.import([...selected], path),
    onSuccess: (summary) => {
      toast.success(importSuccessMessage(summary));
      qc.invalidateQueries({ queryKey: ["endpoints"] });
      qc.invalidateQueries({ queryKey: [queryKey] });
      onOpenChange(false);
      resetLocalState();
    },
    onError: (e) => toast.error(`导入失败：${errMsg(e)}`),
  });

  const body = (() => {
    if (preview.isLoading) return <p className={emptyClass}>{loadingText}</p>;
    if (preview.isError) {
      return <p className={emptyClass}>{errorText(errMsg(preview.error))}</p>;
    }
    if (items.length === 0) return <p className={emptyClass}>{emptyText}</p>;
    return (
      <>
        <PreviewToolbar
          allSelected={allSelected}
          selectedCount={selected.size}
          importableCount={importable.length}
          totalCount={items.length}
          visibleImportableCount={visibleImportable.length}
          categoryFilters={categoryFilters}
          categoryFilter={categoryFilter}
          onSelectAll={() =>
            setSelected(new Set(visibleImportable.map((i) => i.sourceId)))
          }
          onDeselectAll={() => setSelected(new Set())}
          onToggleCategory={(id) =>
            setCategoryFilter((prev) => ({ ...prev, [id]: !prev[id] }))
          }
        />
        <PreviewList
          items={visibleItems}
          selected={selected}
          badgeClassOf={badgeClassOf}
          onToggle={toggle}
        />
      </>
    );
  })();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetLocalState();
      }}
    >
      <DialogContent className="flex h-[min(80vh,calc(100dvh-2rem))] w-full min-w-2xl max-w-3xl flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          {body}
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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
  );
}
