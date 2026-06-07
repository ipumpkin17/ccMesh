# 01 — WP1 数据层地基

> 关联：[TASKS.md](./TASKS.md) · [PRD.md](./PRD.md)
> 所属层：后端（Rust/SQLite）+ 前端 services/types
> 前置：无（关键路径，WP2/WP4 监控依赖本包）

## 目标

为"缓存 Token 维度"与"实时请求监控"打地基：扩展聚合表、补全 Token 解析、新建逐条明细表、在转发汇聚点双写、提供分页查询与实时事件、改造历史记录命令。**严格遵循增列式改造，保持 `get_stats`/`stats-updated`/趋势向后兼容。**

## 关键文件/落点（研究所得，实现时以实际为准）

- 迁移：`src-tauri/src/modules/storage/migration.rs`（`MIGRATIONS` 版本化数组，`daily_stats` DDL；追加 v3）
- 统计仓储：`src-tauri/src/modules/storage/stats_repo.rs`（`upsert`、`period_stats`、`monthly_data`）
- 聚合器：`src-tauri/src/modules/stats/aggregator.rs`（`Delta`、`record`/`flush`，发 `stats-updated`，持有 `AppHandle`）
- 模型：`src-tauri/src/models/stats.rs`（`DailyStat`/`EndpointStat`/`PeriodStats`/`TrendCompare`）
- Token 解析：`src-tauri/src/modules/usage.rs`（`from_response`、`UsageAccumulator`）
- 转发汇聚点：`src-tauri/src/modules/proxy/forward.rs`（`handle_proxy`，四个响应处理器与错误路径里的 `stats.record(...)`）
- 命令：`src-tauri/src/commands/stats.rs` + `src-tauri/src/commands/mod.rs`（注册）
- 前端：`src/services/modules/stats.ts`、`src/services/request.ts`（Events/subscribe）、`src/hooks/useStats.ts`

## 任务拆解

- **1.1** v3 迁移：`daily_stats` 增 `cache_creation_tokens INTEGER NOT NULL DEFAULT 0`、`cache_read_tokens INTEGER NOT NULL DEFAULT 0`。
- **1.2** Token 解析补缓存：`from_response` 与 `UsageAccumulator`（Claude `message_start`/`message_delta`）读取 `cache_creation_input_tokens`/`cache_read_input_tokens`；OpenAI 入站缺字段记 0。
- **1.3** 聚合/仓储/模型同步两个字段：`Delta`、`record`/`flush`、`upsert`（INSERT 列 + ON CONFLICT 累加）、`period_stats`/`monthly_data`、模型结构体。
- **1.4** 新建 `request_logs` 表（见数据契约）+ 索引（`ts`、`endpoint_name`）。
- **1.5** 汇聚点双写：把 `model`、`status_code`、时间戳、入站格式、出站 URL 透传到记录点，写一行明细；保持原 `daily_stats` 累加不变。流式在流结束拿到最终 Token 后落行，`duration_ms` 取请求起止。
- **1.6** `get_request_logs(filter, page, page_size)` 命令，filter 含 start/end/可选 endpoint。
- **1.7** `request-logged` 事件，payload 为新落库单条 `RequestLog`。
- **1.8** 90 天保留：插入时或启动时 `DELETE FROM request_logs WHERE ts < now-90d`。
- **1.9** 历史记录命令：`get_stats_history(page, page_size)`（跨全时间分页读 daily_stats）+ `delete_daily_stat(endpoint_name, date)` + `delete_stats_by_date(date)`。
- **1.10** 前端同步：`stats.ts` 加缓存字段类型、`RequestLog` 类型、新命令封装、`request-logged` 订阅（在 `request.ts` Events 注册）。

## 数据契约

`request_logs` 列：
```
id INTEGER PK AUTOINCREMENT
ts INTEGER NOT NULL              -- epoch ms
endpoint_name TEXT NOT NULL
inbound_format TEXT NOT NULL     -- 入站协议/格式
upstream_url TEXT                -- 实际转发上游
status_code INTEGER
is_error INTEGER NOT NULL DEFAULT 0
input_tokens INTEGER NOT NULL DEFAULT 0
output_tokens INTEGER NOT NULL DEFAULT 0
cache_creation_tokens INTEGER NOT NULL DEFAULT 0
cache_read_tokens INTEGER NOT NULL DEFAULT 0
model TEXT
duration_ms INTEGER
device_id TEXT
```

命令返回：
- `get_request_logs -> { items: RequestLog[], total: i64 }`
- `get_stats_history -> { items: DailyStat[], total: i64 }`（DailyStat 已含缓存字段）

## 验收标准

- 旧库升级到 v3 不丢数据；新列默认 0；`request_logs` 建成。
- 含缓存字段的 Claude 响应（流式/非流式）解析出正确缓存 Token；端点统计能读到缓存列。
- 每个成功/失败请求都在 `request_logs` 落一行，含状态码、入站/出站、Token、时间。
- `get_request_logs` 支持时间段 + 分页；`request-logged` 在新请求时推送单条。
- 超过 90 天的明细被清理。
- `get_stats`/`stats-updated`/趋势行为不变（仅多了字段）。

## 测试点

- `usage.rs` 单测：补缓存字段用例（流式 + 非流式）。
- `stats_repo.rs` 单测：缓存列 UPSERT 累加、`get_stats_history` 分页、删除命令。
- `migration.rs` 单测：v3 后列/表存在、平滑升级。
- 新增请求明细仓储单测：插入、时间段分页、90 天清理（内存 SQLite）。
