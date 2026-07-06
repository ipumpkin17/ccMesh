---
id: 25-request-logs-cleanup
title: 请求明细清理入口 + 90 天保留期限提示
status: planning
mode: standard
priority: P2
layer: 全栈
deps: 22.5
prd_story: 25
owner: claude
branch:
base_branch: main
created: 2026-07-06
completed:
parent:
children:
note: 实时请求监控（request_logs 单表）此前无前端清理入口；90 天保留为后端硬编码，用户不可见
---

# 25-request-logs-cleanup 请求明细清理入口 + 90 天保留期限提示

## 1. 背景与问题

实时请求监控是仪表盘的核心模块，逐条落库到 SQLite 单表 `request_logs`。当前存在两个产品缺口：

1. **没有数据清理入口**：用户无法手动清理监控明细。后端虽然有自动清理（90 天过期 + 每小时一次 prune），但
   - 用户不知道这件事；
   - 用户无法主动触发（例如想立刻释放空间、或想清空全部历史重新开始）；
   - 现有前端命令 `delete_daily_stat` / `delete_stats_by_date` 作用的是聚合表 `daily_stats`，**不是** `request_logs`，无法复用。

2. **90 天保存期限用户无感知**：`RETENTION_MS = 90 * 24 * 60 * 60 * 1000` 是 `aggregator.rs` 的硬编码常量，前端任何位置都没有出现这个数字。用户看不到"数据会自动清理"的事实，也无法预期"为什么 3 个月前的记录查不到"。

补充：UI 当前很紧凑——`RequestMonitor` 头部 `live` 模式右侧为空白，`ranged` 模式只有一个时间段 Select；没有现成的"更多操作"菜单，所以"清理入口放哪"需要明确的产品决策。

## 2. 现状调研结论（来自 Explore 调研）

### 2.1 数据链路

```
代理转发完成 → StatsAggregator::record()
  ├─ pending_logs 缓冲 RequestLog（2 秒防抖批量写）
  ├─ 立即 emit request-logged（前端 live 刷新，此时 id=0）
  └─ flush() → insert_batch 写 request_logs + 周期性 prune(90d)
```

- 写入不是每请求直写，2 秒批量；
- prune 由 `flush` 触发，每小时至多一次；
- `request_logs` 与 `daily_stats` 是两张独立的表，清理互不影响。

### 2.2 关键文件

| 文件 | 角色 |
|------|------|
| `src/components/business/RequestMonitor.tsx` | 监控 UI 主体，清理按钮与提示的唯一直接落点 |
| `src/hooks/useRequestLogs.ts` | 数据获取 + live 事件刷新 |
| `src/services/modules/stats.ts` | 前端 API 层，需新增清理方法 |
| `src-tauri/src/modules/stats/aggregator.rs` | `RETENTION_MS`、写入时机、自动 prune 触发 |
| `src-tauri/src/modules/storage/request_logs_repo.rs` | `prune_older_than` 可直接复用；全量清空需新增 |
| `src-tauri/src/commands/stats.rs` | Tauri command 注册点 |
| `src/pages/Endpoints/_components/EndpointCard.tsx` | 删除二次确认 Dialog 范式参考 |
| `src/components/settings/SettingDescRow.tsx` | 标题+描述+控件 的设置行范式参考 |

### 2.3 UI 当前结构（`RequestMonitor` 头部）

```
<section>
  <div flex justify-between>
    <h2>实时请求监控 / 端点请求记录</h2>
    {ranged && <Select 时间段>}    ← live 模式右侧为空
  </div>
  <RequestLogTable />
  <Pagination />
</section>
```

## 3. 产品目标与非目标

### 目标

- G1：用户能手动清理 `request_logs`，至少支持"立即清理过期"和"清空全部明细"两种粒度。
- G2：用户能在监控界面看到"数据保留 90 天、超期自动清理"的事实，无需翻文档。
- G3：清理操作有二次确认 + 结果反馈（Toast），避免误删。
- G4：前后端保留天数保持一致，不出现"前端写 90、后端改 60"的漂移。

### 非目标

- N1：不做成"保留天数可配置"（当前产品未要求，避免增加 `app_config` 与清理逻辑复杂度；后续如需要再扩展）。
- N2：不做按端点/按时间段选择性清理（YAGNI，等真实诉求出现再加）。
- N3：不清理 `daily_stats` 聚合表（已有 `HistoryDialog` 负责）。

## 4. 方案设计

### 4.1 清理入口位置——三选一对比

| 方案 | 说明 | 优点 | 缺点 |
|------|------|------|
| **A. RequestMonitor 头部按钮**（推荐） | 在头部右侧加"清理"按钮，live/ranged 通用 | 离数据最近、操作意图清晰、复用现有组件、改动最小 | 头部从"零按钮"变"一按钮"，视觉需克制 |
| B. 设置页"数据管理"卡片 | 在 Settings 新增卡片，放清理按钮 + 保留说明 | 设置类操作集中、不污染监控页 | 离数据远、用户难发现、与"实时监控"心智模型割裂 |
| C. 头部 + 设置页都放 | 头部快捷 + 设置页完整管理 | 双入口覆盖不同心智 | 双份维护、两套确认逻辑、过度设计 |

**推荐方案 A**：理由是清理动作的触发场景几乎都在"看着监控列表"时发生（数据多了/想重置），离数据最近的入口最符合直觉；设置页方案对"我现在就想清"的用户多一次跳转。90 天提示也顺势放在监控头部，形成"说明 + 操作"的完整心智闭环。

### 4.2 清理操作粒度——采用两档

| 操作 | 后端实现 | 前端语义 |
|------|---------|---------|
| **立即清理过期** | 复用 `prune_older_than(now - RETENTION_MS)` | "清理 90 天前的记录"——与自动 prune 等价，只是立即触发 |
| **清空全部明细** | 新增 `DELETE FROM request_logs`（保留表结构） | "清空所有请求记录"——重置监控历史 |

不做"按时间段/端点选择性清理"（N2）。

### 4.3 90 天提示形式——主副双提示

- **主提示**：`RequestMonitor` 标题下方一行 `text-xs text-ink-mute` 说明文字：
  > 请求明细保留 90 天，超期自动清理。
- **副提示**：清理确认 Dialog 内再次说明保留策略，避免用户在"清空全部"时误以为系统不会自动清理。

保留天数来源：**新增后端 command `get_retention_days` 返回 90**，前端不写死，避免漂移（满足 G4）。

### 4.4 确认交互范式

参考 `EndpointCard` 的 `Dialog` 二次确认 + `variant="destructive"`，**不**参考 `HistoryDialog` 的"点击即删"：

- "立即清理过期"：温和确认（说明将删除 N 天前的记录，可显示预估条数）；
- "清空全部明细"：`destructive` 风格 + 明确文案"将删除全部 N 条请求记录，不可恢复"。

## 5. 用户故事

- **US-1**：作为网关使用者，我在仪表盘查看实时监控时，能看到"数据保留 90 天"的说明，知道旧记录会自动消失。
- **US-2**：作为网关使用者，我能点"清理"按钮，选择"清理过期记录"立即释放空间，看到删除条数 Toast。
- **US-3**：作为网关使用者，我能选择"清空全部"重置监控历史，操作前有红色风险确认。
- **US-4**：作为网关使用者，清理完成后列表立即刷新，分页/时间段筛选状态保持合理（回到第 1 页）。

## 6. 技术实现要点

### 6.1 后端（Rust / Tauri）

1. **新增 command `prune_request_logs`**（立即清理过期）
   - 实现：调用现有 `request_logs_repo::prune_older_than(now - RETENTION_MS)`；
   - 返回删除条数 `usize`；
   - 在 `lib.rs` 注册。

2. **新增 command `clear_request_logs`**（清空全部）
   - 实现：`request_logs_repo` 新增 `clear_all(conn) -> AppResult<usize>`，`DELETE FROM request_logs`；
   - 返回删除条数；
   - 在 `lib.rs` 注册。

3. **新增 command `get_retention_days`**
   - 把 `aggregator.rs` 的 `RETENTION_MS` 提取为 pub 常量或函数 `retention_days() -> i64`；
   - command 返回 `90`，前端展示用；
   - ponytail: 若未来要做可配置，从这里扩展为读 `app_config`。

4. **复用现有 prune 单测**：`prune_older_than` 已有测试，新 command 只需薄封装，无需重复测试；`clear_all` 加一个最小单测（插入→清空→计数为 0）。

### 6.2 前端（React / TS）

1. **`statsApi` 扩展**（`src/services/modules/stats.ts`）
   ```ts
   pruneRequestLogs: () => request<number>("prune_request_logs"),
   clearRequestLogs: () => request<number>("clear_request_logs"),
   getRetentionDays: () => request<number>("get_retention_days"),
   ```

2. **`RequestMonitor` 头部改造**
   - 标题下方加说明行：`请求明细保留 {retentionDays} 天，超期自动清理。`
   - 右侧加"清理"按钮（`live` 与 `ranged` 模式都显示；`ranged` 时与时间段 Select 并列）；
   - 点击弹出 `CleanupDialog`（新建，参考 `EndpointCard` 的 Dialog 范式）。

3. **`CleanupDialog` 组件**（新建于 `src/components/business/`）
   - 两个选项：清理过期 / 清空全部；
   - 清空全部用 `variant="destructive"`；
   - 提交后调对应 API，`toast.success(\`已清理 N 条记录\`)`；
   - 成功后 invalidate `useRequestLogs` 的 query，回到第 1 页。

4. **数据刷新**：复用 `useRequestLogs` 的 queryKey invalidate（参考 22.5 的 React Query 缓存治理），不新引入刷新机制。

### 6.3 边界与风险

- **R1**：清理期间若有新请求写入，"清空全部"可能漏掉刚插入的行——可接受（用户预期是"清空当前"）；
- **R2**：`daily_stats` 不受影响，统计卡片数字不会因清理 `request_logs` 而归零，需在 Dialog 文案说明（"仅影响请求明细，不影响统计汇总"）；
- **R3**：live 模式下清理后事件订阅仍在，新请求会继续追加——符合预期。

## 7. 任务拆解（里程碑 25）

| 编号 | 标题 | 层 | 前置 |
|------|------|-----|------|
| 25.1 | 后端 `clear_all` repo + 单测，`prune_request_logs`/`clear_request_logs`/`get_retention_days` command + 注册 | 后端 | - |
| 25.2 | 前端 `statsApi` 扩展三个方法 + 类型 | 前端 | 25.1 |
| 25.3 | `CleanupDialog` 组件（两档清理 + 二次确认 + Toast） | 前端 | 25.2 |
| 25.4 | `RequestMonitor` 头部改造：保留说明 + 清理按钮接入 | 前端 | 25.3 |
| 25.5 | 验证收尾：cargo test + tsc + vitest + 人工清单 + scoped 提交 | 全栈 | 25.1;25.4 |

## 8. 开放问题（待确认）

> 用户已跳过澄清问题，按推荐方案推进。如需调整，在实现前提出。

- [ ] 清理粒度是否需要"按时间段/端点选择性清理"——当前方案不做（N2）。
- [ ] 90 天是否需要做成可配置——当前方案不做（N1），仅暴露 command 返回常量。
- [ ] 是否需要在设置页也放一份清理入口——当前方案仅在监控头部（方案 A）。

## 9. 验收标准

- [ ] 仪表盘实时监控标题下可见"保留 90 天"说明，数字来自后端而非前端写死。
- [ ] 点"清理"弹出 Dialog，含"清理过期"和"清空全部"两个选项，后者为红色风险样式。
- [ ] 清理成功后 Toast 显示删除条数，列表刷新回第 1 页。
- [ ] 清理 `request_logs` 后 `daily_stats` 聚合数据不变。
- [ ] cargo test / tsc / vitest 全绿。
