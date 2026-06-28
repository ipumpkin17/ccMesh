import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLineIcon, CheckCheckIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export function CcSwitchImport() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  const allSelected =
    importable.length > 0 && selected.size === importable.length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(importable.map((i) => i.ccSwitchId)));
    }
  };

  const openDialog = () => {
    setSelected(new Set());
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
      <section className="flex flex-col gap-3 rounded-lg border border-edge p-5">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium text-ink-secondary">
              从 cc-switch 迁移配置
            </h2>
            <p className="text-xs text-ink-mute">
              读取本机 cc-switch 供应商，识别可迁移端点并勾选导入
            </p>
          </div>
          <Button size="sm" onClick={openDialog}>
            <ArrowDownToLineIcon className="size-4" /> 同步配置
          </Button>
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>cc-switch 配置迁移</DialogTitle>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-3 overflow-hidden">
            {preview.isLoading ? (
              <p className="text-sm text-ink-mute">正在读取 cc-switch 配置…</p>
            ) : preview.isError ? (
              <p className="text-sm text-ink-mute">
                读取失败：{errMsg(preview.error)}。请确认已安装 cc-switch 且配置数据库存在。
              </p>
            ) : (preview.data ?? []).length === 0 ? (
              <p className="text-sm text-ink-mute">
                未在 cc-switch 中找到可识别的 claude / codex 供应商。
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-secondary">
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer accent-emerald-500"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={importable.length === 0}
                    />
                    全选
                  </label>
                  <span className="text-xs text-ink-mute">
                    已勾选 {selected.size} / 可迁移 {importable.length}（共{" "}
                    {(preview.data ?? []).length}）
                  </span>
                </div>

                <div className="flex flex-col divide-y divide-edge-subtle overflow-y-auto rounded-md border border-edge">
                  {(preview.data ?? []).map((item) => (
                    <PreviewRow
                      key={`${item.appType}:${item.ccSwitchId}`}
                      item={item}
                      checked={selected.has(item.ccSwitchId)}
                      onToggle={() => toggle(item.ccSwitchId)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={selected.size === 0 || importMutation.isPending}
            >
              <CheckCheckIcon className="size-4" />
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
    <label
      className={`flex cursor-pointer items-start gap-3 px-4 py-2.5 ${
        skipped ? "opacity-50" : "hover:bg-surface-hover"
      }`}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 cursor-pointer accent-emerald-500"
        checked={checked}
        onChange={onToggle}
        disabled={skipped}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm text-ink-primary">{item.name}</span>
          <span className="shrink-0 rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-ink-mute">
            {item.appType}
          </span>
          <span className="shrink-0 text-[10px] text-ink-mute">
            {item.transformer}
          </span>
        </div>
        {item.apiUrl ? (
          <span className="truncate font-mono text-xs text-ink-mute">
            {item.apiUrl}
          </span>
        ) : null}
        {skipped ? (
          <span className="text-xs text-ink-mute">
            {skipReasonLabel(item.skipReason)}
          </span>
        ) : (
          <span className="text-xs text-ink-mute">
            {item.apiKeyMasked || "—"}
          </span>
        )}
      </div>
    </label>
  );
}
