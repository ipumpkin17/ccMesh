# 请求明细清理入口调研

## 数据链路

- `RequestMonitor` 同时服务仪表盘 live 和统计页 ranged。两种模式都通过 `useRequestLogs` 调 `statsApi.getRequestLogs`。
- 后端 `get_request_logs` 先 `state.stats.flush()`，再调用 `request_logs_repo::query_page` 查询 `request_logs`。
- `StatsAggregator::record` 先把请求明细放进 `pending_logs`，立即发 `request-logged` 事件；`flush` 批量 `insert_batch` 写入 `request_logs`，并按保留期执行 prune。
- `daily_stats` 是聚合统计表，由 `stats_repo::period_stats/history_page` 使用；清理 `request_logs` 不应影响统计汇总。

## 可复用点

- 后端已有 `request_logs_repo::prune_older_than(conn, cutoff_ms)` 和覆盖测试，可直接复用为“立即清理过期”。
- `request_logs_repo` 已有内存 SQLite 测试工具与 `log()` fixture，新增 `clear_all` 只需最小单测。
- 前端已有 `EndpointCard` 删除确认范式：`Dialog` + `Button variant="destructive"` + `toast` + React Query invalidate。
- `useRequestLogs` 已集中管理请求明细 query key，清理成功后可通过 `queryClient.invalidateQueries({ queryKey: ["request-logs"] })` 刷新所有相关列表。

## 影响范围

- 后端：`src-tauri/src/modules/stats/aggregator.rs`、`src-tauri/src/modules/storage/request_logs_repo.rs`、`src-tauri/src/commands/stats.rs`、`src-tauri/src/lib.rs`。
- 前端：`src/services/modules/stats.ts`、`src/components/business/RequestMonitor.tsx`，新增 `src/components/business/RequestLogsCleanupDialog.tsx`。
- 测试：后端补 `clear_all` repo 单测；前端按新增 API 与文案更新现有相关测试。

## Ponytail 校准

- 不做保留天数配置化，只暴露后端常量读接口，避免新增配置迁移。
- 不做按端点/时间段清理，当前只实现过期清理和全量清空。
- 不新增通用抽象；清理 Dialog 仅服务请求明细。
- `get_retention_days` 作为未来配置化扩展点，代码中用 `ponytail:` 注明当前固定常量的上限。
