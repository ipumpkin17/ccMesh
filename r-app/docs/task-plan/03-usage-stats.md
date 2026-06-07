# 03 — WP3 用量统计（MVP）

> 关联：[TASKS.md](./TASKS.md) · [PRD.md](./PRD.md)
> 所属层：后端（Rust/SQLite）+ 前端
> 前置：无（与 WP1 解耦，可并行）
> 参考实现：cc-switch（`E:\myCode\cc-switch\src-tauri\src`，权威；忽略 `cc-switch-main`）

## 目标

读取本机 Claude Code 与 Codex 的会话 JSONL，**增量同步进 SQLite**，按 app/模型/天聚合 Token 总量并展示。**MVP：不计算成本、不做定价表、不做大趋势图。** 用量数据与网关 `request_logs` 相互独立、不跨源去重。

## 数据来源（参考 cc-switch）

- **Claude Code**：`~/.claude/projects/<project>/*.jsonl` 及子代理目录；取 `type=="assistant"` 行，字段 `message.id`、`message.model`、`message.usage.{input_tokens,output_tokens,cache_read_input_tokens,cache_creation_input_tokens}`、`stop_reason`、顶层 `timestamp`(RFC3339)。按 `message.id` 去重，仅取有 `stop_reason` 的条目。
- **Codex**：`~/.codex/sessions/YYYY/MM/DD/*.jsonl` + `archived_sessions/*.jsonl`；取 `event_msg` 的 `token_count`，字段 `info.total_token_usage.{input_tokens,cached_input_tokens,output_tokens}`（**累计值**）；对相邻记录取增量（`saturating_sub`），钳制 `cached_input ≤ input`，跳过零增量；`session_meta` 取 session_id、`turn_context` 取 model。
- 路径解析需可处理 Windows 用户目录（`%USERPROFILE%`/home）。

## 关键文件/落点

- 后端新增模块（建议）：`src-tauri/src/modules/usage_local/`（与现有上游 `usage.rs` 区分命名，避免混淆）：`claude.rs`、`codex.rs`、`repo.rs`、`mod.rs`
- 迁移：`src-tauri/src/modules/storage/migration.rs` 追加用量表（与 WP1 的 v3 可合并或单列 v4，按实现时顺序定）
- 命令：`src-tauri/src/commands/usage_local.rs` + `commands/mod.rs` 注册
- 前端：`src/pages/Statistics/_components/UsagePanel.tsx`（挂在 WP2 顶部"用量统计"Tab）+ `src/services/modules/usageLocal.ts`

## 任务拆解

- **3.1** 迁移：用量明细/聚合表 + 同步进度表（按文件路径 + mtime(nanos) + 行偏移记录解析位置）。
- **3.2** Claude 读取器：扫描目录、增量解析、按 message.id 去重、写入（`app_type="claude"`）。
- **3.3** Codex 读取器：扫描目录、累计取差、模型名归一化（小写、去 `provider/` 前缀与日期后缀）、写入（`app_type="codex"`）。
- **3.4** 命令：
  - `sync_session_usage() -> { imported, skipped, files_scanned, errors }`
  - `get_usage_summary(start?, end?, app_type?) -> UsageSummary`
  - `get_usage_by_model(start?, end?, app_type?) -> ModelUsage[]`
  - `get_usage_by_day(start?, end?, app_type?) -> DailyUsage[]`
- **3.5** 前端 UsagePanel：进入 Tab 先 `sync_session_usage` 再查询；app_type 过滤（全部/Claude Code/Codex）；展示总量卡片 + 按模型表 + 按天表 + 手动刷新按钮。

## 数据契约

```
UsageSummary { total_requests, total_input_tokens, total_output_tokens,
               total_cache_creation_tokens, total_cache_read_tokens }
ModelUsage   { app_type, model, requests, input_tokens, output_tokens,
               cache_creation_tokens, cache_read_tokens }
DailyUsage   { date, app_type, requests, input_tokens, output_tokens,
               cache_creation_tokens, cache_read_tokens }
```
（均不含成本字段 — MVP）

## 验收标准

- 首次进入 Tab 触发同步，能读到本机 Claude Code / Codex 的 Token 汇总。
- 二次同步对同一文件不重复计数（偏移推进）。
- 可按 app_type 过滤；按模型表与按天表数据正确。
- 本机无对应目录/文件时优雅返回空（不报错崩溃）。

## 测试点

- 后端：fixture JSONL（Claude assistant 行 / Codex token_count 累计行）测增量解析、去重/取差、按 app/model/day 聚合；二次同步不重复计数。
- 前端（vitest）：总量卡片、按模型/按天表在给定数据下渲染；app_type 过滤生效；空数据态。
