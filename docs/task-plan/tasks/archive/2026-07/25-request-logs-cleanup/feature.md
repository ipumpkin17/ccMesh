# 25 请求明细清理入口 + 90 天保留期限提示

## 目标

在请求监控明细附近提供最小可用的数据清理入口，并展示后端真实保留天数。清理只作用于 `request_logs`，不影响 `daily_stats` 聚合统计。

## 现状（根因）

- `request_logs` 明细已有自动 90 天 prune，但保留期只在后端常量中体现，前端无提示。
- `RequestMonitor` 是 live/ranged 两处请求明细的共同入口，当前只负责查询和展示。
- 已有历史统计清理命令只清 `daily_stats`，不能复用。

## 关键文件/落点

- `src-tauri/src/modules/stats/aggregator.rs`：公开保留天数/毫秒换算，继续供自动 prune 使用。
- `src-tauri/src/modules/storage/request_logs_repo.rs`：新增 `clear_all` 与最小单测。
- `src-tauri/src/commands/stats.rs`：新增 `get_retention_days`、`prune_request_logs`、`clear_request_logs`。
- `src-tauri/src/lib.rs`：注册新增 Tauri commands。
- `src/services/modules/stats.ts`：新增三个 API 方法。
- `src/components/business/RequestLogsCleanupDialog.tsx`：两档清理确认与 Toast。
- `src/components/business/RequestMonitor.tsx`：展示保留说明与清理入口，清理成功回到第一页。

## 任务拆解

| 编号 | 标题 | 层 | 前置 |
|------|------|-----|------|
| 25.1 | 后端 request_logs 清理 repo、command 与注册 | 后端 | - |
| 25.2 | 前端 statsApi 清理与保留期 API | 前端 | 25.1 |
| 25.3 | 请求明细清理 Dialog 与确认反馈 | 前端 | 25.2 |
| 25.4 | RequestMonitor 头部保留说明与清理入口 | 前端 | 25.3 |
| 25.5 | 验证收尾与 scoped 提交 | 全栈 | 25.1;25.4 |

## 数据契约

```ts
statsApi.getRetentionDays(): Promise<number>
statsApi.pruneRequestLogs(): Promise<number>
statsApi.clearRequestLogs(): Promise<number>
```

```rust
#[tauri::command]
pub fn get_retention_days() -> i64
#[tauri::command]
pub fn prune_request_logs(state: State<AppState>) -> AppResult<usize>
#[tauri::command]
pub fn clear_request_logs(state: State<AppState>) -> AppResult<usize>
```

## 验收标准

- 仪表盘实时监控和统计页端点请求记录都可见“请求明细保留 N 天，超期自动清理”。
- N 来自后端 `get_retention_days`，前端不写死 90。
- 清理入口包含“清理过期记录”和“清空全部明细”。
- 清空全部使用 destructive 样式和不可恢复提示。
- 清理成功 Toast 显示删除条数，列表刷新并回到第 1 页。
- 清理 `request_logs` 不修改 `daily_stats`。

## 测试点

- `request_logs_repo::clear_all`：插入多条后清空，返回删除条数，后续查询为 0。
- Rust：`cargo test --manifest-path src-tauri/Cargo.toml request_logs_repo`。
- 前端：`pnpm check:front`、`pnpm test`。
- 后端类型：`pnpm check:rust` 或 `cargo check --manifest-path src-tauri/Cargo.toml`。
- GUI 无头核对：按钮位置、Dialog 文案、Toast、清理后列表刷新。

## 提交策略

1. `docs(task-plan): 更新请求明细清理任务产物`：task/prd/feature/context/research/progress。
2. `feat(backend): 增加请求明细清理命令`：Rust repo、command、注册与测试。
3. `feat(frontend): 增加请求明细清理入口`：API、Dialog、RequestMonitor 与前端测试更新。
