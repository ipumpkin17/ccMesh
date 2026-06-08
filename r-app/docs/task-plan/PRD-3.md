# PRD（第三轮）：端点熔断 + 智能切换（请求驱动，无定时轮询）

> 状态：ready-for-agent
> 来源：`需求3.txt` + 参考实现分析（旧版 ccNexus〔Go〕、cc-switch〔Rust〕）+ 需求对齐
> 适用范围：tauri-gateway（r-app，后端 Rust/Tauri + axum 代理；前端 React 19）
> 关联：[PRD.md](./PRD.md) · [PRD-2.md](./PRD-2.md) · [TASKS.md](./TASKS.md) · [progress.csv](./progress.csv) · 子文档 [08-endpoint-resilience.md](./08-endpoint-resilience.md)

## Problem Statement

当前网关弹性只有「请求内」被动重试 + round-robin 轮换（`handle_proxy`/`rotation.rs`，从旧版 ccNexus 移植）。端点失败状态**不跨请求保留**：持续宕机的端点每一轮仍被选中，反复消耗「端点数×2」的重试与连接超时，拖慢请求。端点健康只有手动 `test_endpoint` 时才更新 `test_status`（静态）。需求3 要求补齐「智能端点检测/切换」与「熔断」（P1/P2），并参考 ccNexus 与 cc-switch。

## 参考实现结论（驱动本设计）

- **ccNexus（旧版）**：端点层**无三态熔断**，失败即轮换（即当前实现）；仅凭证层有惰性 cooldown。可借鉴其「状态码分级 + 惰性时间戳恢复 + 两次容错」。缺真熔断/阈值/优先级。
- **cc-switch**：完整三态熔断且**纯请求驱动、无后台定时器**——`allow_request` 在 Open 态按 `last_opened_at` 惰性转 HalfOpen；HalfOpen 单探测许可（`AllowResult{allowed, used_half_open_permit}`，请求结束回传释放）；双触发（连续失败阈值 / 错误率窗口）；错误分类只让 Retryable 计入熔断。**本设计直接采用 cc-switch 模型**，选路顺序沿用本项目既有 round-robin 游标。

## Solution

新增**每端点熔断器**（运行期、请求驱动、无定时轮询），作为"智能端点检测 + 智能切换"的统一机制，驻留代理运行态 `ProxyState`（随代理启停）：

1. **检测（事件驱动）**：不做后台轮询。每次转发结束按结果 `record_success/record_failure/record_neutral` 更新对应端点熔断器；健康完全来自真实流量。
2. **熔断（三态 + 惰性恢复）**：Closed→Open→HalfOpen。连续失败达 `failure_threshold`（或错误率 ≥ `error_rate_threshold` 且样本 ≥ `min_requests`）→ Open。选路用 `is_available` 跳过未到期的 Open 端点；距 `last_opened_at` 超过 `timeout` 后，下一个到达该端点的请求触发 Open→HalfOpen，并把**该真实请求**作为探测放行（HalfOpen 单许可，防雪崩）；HalfOpen 成功达 `success_threshold` → Closed，失败 → 立即 Open。
3. **智能切换**：沿用 round-robin 游标顺序，在「可用（非 Open）」子集中轮换/故障转移；全部 Open 时**兜底放行**一个（避免 100% 拒绝）；客户端**显式指定**端点（头部/`@端点`/查询）时**绕过熔断**按意图尝试，但结果照常计入。
4. **错误分类**：仅 Retryable（5xx/可重试状态/网络错误）计入熔断；NonRetryable（400/401/422 等客户端错误）与客户端中断走 neutral——仅释放半开许可、不污染熔断器。
5. **前端实时呈现**：熔断**状态转换时**发 `endpoint-health-changed` 事件（事件驱动，非轮询）；仪表盘端点列表与端点页显示实时健康灯/熔断态。

阈值用**固定常量**（参考 cc-switch 默认：`failure_threshold=4`、`success_threshold=2`、`timeout=60s`、`error_rate_threshold=0.6`、`min_requests=10`），结构上预留运行时热更新能力，但本期不做配置 UI。

## User Stories

1. 作为使用者，我希望端点健康由真实请求结果实时判定（事件驱动），无需后台空轮询，以便低开销地识别故障端点。
2. 作为使用者，我希望持续失败的端点被自动熔断（Open）并在选路时跳过，不再每轮被选中拖慢请求。
3. 作为使用者，我希望熔断在连续失败达阈值时触发，也能在错误率过高（样本足够）时触发，以兼顾突发与间歇性故障。
4. 作为使用者，我希望被熔断端点在冷却（timeout）后，由**下一个到达的真实请求**作为探测自动尝试恢复（HalfOpen），无需我干预、也无需后台探测。
5. 作为使用者，我希望半开恢复期同一时刻只放行一个探测请求，探测成功累计达阈值才恢复 Closed，失败立即重新 Open，以防恢复瞬间被打垮（雪崩）。
6. 作为使用者，我希望客户端错误（如 400/401/422）与客户端主动断开**不计入熔断**，以免我自己的错误请求误伤端点健康。
7. 作为使用者，我希望当所有端点都被熔断时系统仍兜底放行一个，避免完全不可用。
8. 作为使用者，我希望显式指定端点时即使其处于熔断也按我的意图尝试（显式优先），但失败照常计入熔断。
9. 作为使用者，我希望智能切换在「可用端点」子集中沿用现有轮换顺序进行故障转移，不破坏既有重试语义。
10. 作为使用者，我希望在仪表盘端点列表看到实时健康灯（健康/熔断中/恢复中）。
11. 作为使用者，我希望端点管理页展示实时熔断态、连续失败数与最近错误，便于排查。
12. 作为使用者，我希望健康/熔断状态在发生转换时前端实时更新（事件驱动），无需手动刷新。
13. 作为使用者，我希望代理停止后熔断状态随运行态销毁、不残留、不空跑。
14. 作为开发者，我希望熔断器是可单测的纯逻辑（状态机 + 许可协议），覆盖三态转换、惰性恢复、半开限流、双触发、neutral 不污染。
15. 作为开发者，我希望错误分类（Retryable/NonRetryable/ClientAbort）在「请求内重试」与「熔断计数」之间复用同一判定，避免口径漂移。

## Implementation Decisions

### 熔断器（新增 `modules/proxy/circuit_breaker.rs`，移植 cc-switch 模型）
- `CircuitState`：`Closed` / `Open` / `HalfOpen`。
- `CircuitBreakerConfig`：`failure_threshold/success_threshold/timeout/error_rate_threshold/min_requests`（常量默认；放 `RwLock` 预留热更新）。
- `EndpointBreaker`：状态 + 计数（`consecutive_failures`、`consecutive_successes`、`total_requests`、`failed_requests`、`half_open_in_flight`、`last_opened_at`、`last_error`）。并发用 `Mutex`/原子（请求路径中持锁极短、不跨 `.await`）。
- `AllowResult { allowed: bool, used_half_open_permit: bool }`。
- 方法：
  - `is_available()`：选路过滤用，不占许可。Closed→true；Open→（`elapsed>=timeout` 当场转 HalfOpen→true，否则 false）；HalfOpen→true。
  - `allow_request() -> AllowResult`：发请求前调用。Closed→allow(无许可)；Open→到期转 HalfOpen 后按新态取半开许可、否则 deny；HalfOpen→`half_open_in_flight` `fetch_add<1` 才放行并标记 `used_half_open_permit`，超额回退 deny。
  - `record_success(used_permit)` / `record_failure(used_permit)` / `record_neutral(used_permit)`：更新计数与转换；HalfOpen 成功达 `success_threshold`→Closed（清零）、失败→Open；Closed 失败达 `failure_threshold` 或错误率触发→Open；neutral 仅释放半开许可、不改计数。
- `BreakerRegistry`：按端点名池化的 `HashMap<String, EndpointBreaker>`（存 `ProxyState`），含 `snapshot()` 供 UI。

### 错误分类（扩展 `rotation.rs` 或新增）
- `categorize(status, network_err) -> Retryable | NonRetryable | ClientAbort`，复用既有 `should_retry_status`（200/400/401 不重试）并细化客户端错误集合（400/401/422/413/415/405/406/414/501 等）→ NonRetryable；网络中断 → ClientAbort。请求内重试与熔断计数共用。

### 选路集成（`handle_proxy`）
- 候选 = 启用端点（含 OpenAI 入站过滤），用 `is_available` 跳过未到期 Open；全为 Open 则兜底放行（取轮换当前一个）。
- 沿用 `Rotation` 游标在可用子集中顺序故障转移。每次发请求前 `allow_request`（取许可）；结束后据错误分类 `record_success/failure/neutral`（务必回传 `used_half_open_permit` 释放许可）。
- `resolution.use_specific()`（显式端点）：绕过熔断直接尝试，但仍 `record_*`。
- 与既有「请求内连续失败切换 + 瞬时错误同端点重试」叠加，不改其语义。

### 命令与事件（新增）
- `get_endpoint_health() -> Vec<EndpointHealthInfo>`：读 registry 快照（代理未运行则回退 unknown / 库内 `test_status`）。字段：`name, status(healthy|unhealthy|recovering), circuit(closed|open|halfOpen), consecutiveFailures, successRate, lastError, lastFailureMs`。
- `endpoint-health-changed`：**仅在状态转换时**发（Closed↔Open↔HalfOpen），payload 为快照，前端实时刷新。

### 前端
- `healthApi` 增 `getEndpointHealth` + `onHealthChanged`；仪表盘 `ServiceCard` 端点列表健康灯（事件实时）；端点页徽标（熔断态 + 连续失败 + 最近错误）。

## Testing Decisions

- **熔断器（后端，纯逻辑，新 seam）**：单测三态转换（连续失败→Open；Open 未到期 `is_available` 跳过、到期转 HalfOpen 放行；HalfOpen 成功达阈值→Closed、失败→Open）；半开单许可（并发只放 1，`AllowResult.used_half_open_permit` 回传释放）；错误率触发（样本≥min 且率≥阈值）；`record_neutral` 不改计数。到期用构造的 `last_opened_at` 直接断言，不依赖真实时钟。沿用 `rotation.rs` 纯逻辑单测风格。
- **错误分类**：`categorize` 对 200/400/401/422/5xx/网络错误的分类断言。
- **选路（后端）**：`select_candidates(enabled, registry)` 纯函数——跳过 Open / 全 Open 回退 / 显式不过滤。
- **前端（vitest）**：健康灯按 status/circuit 渲染；收到 `endpoint-health-changed` 后端点列表更新。

## Out of Scope

- **后台定时健康轮询 / 主动探测上游**：本期纯请求驱动；恢复用真实请求作半开探测。手动 `test_endpoint` 保留不变。
- **优先级 / 权重路由**：沿用 round-robin（cc-switch 用优先级队列，本期不引入）。
- **阈值/冷却的配置 UI**：固定常量（结构预留热更新）。
- **熔断态持久化**：运行期内存态，代理重启重建。
- **多设备健康聚合 / 告警**。

## Further Notes

- 关键差异修正：早前草案的「定时轮询 + 主动探测器复用」已废弃，改为 cc-switch 式**请求驱动 + 惰性时间戳恢复**，更省资源、移植成本更低。
- 「许可-回传」协议（`used_half_open_permit` 在 record 时释放）是防半开名额泄漏/雪崩的关键，必须贯穿请求结束的每条路径（成功/失败/中性/提前返回）。
- 「全熔断兜底放行」是安全阀；「显式端点绕过熔断」尊重用户意图。
