# 08 — WP9 端点熔断 + 智能切换（请求驱动）

> 关联：[TASKS.md](./TASKS.md) · [PRD-3.md](./PRD-3.md)
> 所属层：后端（Rust/Tauri/axum）为主 + 前端（实时展示）
> 前置：无（在现有 round-robin 轮换 + 请求内重试之上叠加）
> 参考：旧版 ccNexus（`docs/origin/ccNexus`，Go）、cc-switch（`E:\myCode\cc-switch`，Rust，本设计主蓝本）
> 原始需求：[需求3.txt](./需求3.txt)

## 目标

新增**每端点熔断器**（请求驱动、惰性时间戳恢复、**无后台定时轮询**），作为「智能端点检测 + 智能切换」的统一机制：三态 Closed/Open/HalfOpen，连续失败/错误率触发 Open，选路跳过 Open，冷却后由真实请求半开探测恢复，全熔断兜底放行，显式端点绕过；状态转换时发事件，前端实时展示。

## 参考结论（要点）

- ccNexus：端点层无熔断（失败即轮换，即当前实现）；借鉴状态码分级 + 惰性时间戳恢复 + 两次容错。
- cc-switch：完整三态 + 惰性恢复（无定时器）+ 半开单许可（`AllowResult{allowed, used_half_open_permit}`）+ 双触发 + 错误分类只让 Retryable 计入。**本 WP 直接移植此模型**，选路顺序换成本项目既有 `Rotation` 游标。

## 现状（落点）

- `forward.rs::handle_proxy`：轮换 + 请求内连续失败（`CONSECUTIVE_FAIL_SWITCH=2`）切换；`max_retries=端点数×2`；瞬时网络错误同端点 300ms 重试。
- `rotation.rs`：`Rotation` 游标 + `should_retry_status`（200/400/401 不重试）+ `is_transient_network_error`。
- `ProxyState`（`forward.rs`）：运行期共享态（`rotation`/`active`/`current_endpoint`）。
- `commands/endpoint.rs::test_endpoint`：手动探测（**保留不变**，不接入自动探测）。
- `commands/health.rs::get_health`：读静态 `test_status`。

## 关键文件/落点

- 新增 `src-tauri/src/modules/proxy/circuit_breaker.rs`：`CircuitState`、`CircuitBreakerConfig`、`EndpointBreaker`、`AllowResult`、`BreakerRegistry`、`select_candidates` 纯函数。
- 扩展 `src-tauri/src/modules/proxy/rotation.rs`：`categorize(status, network_err) -> Retryable|NonRetryable|ClientAbort`（复用 `should_retry_status`）。
- `ProxyState`（`forward.rs`）增 `breakers: BreakerRegistry`；`server.rs::start_proxy` 构造（无需 spawn 任务）。
- `forward.rs::handle_proxy`：选路用 `is_available` 过滤 + `allow_request` 取许可 + 结束 `record_*` 回传许可；全 Open 兜底；显式端点绕过。
- `commands/health.rs`：增 `get_endpoint_health`；`lib.rs` 注册。事件 `endpoint-health-changed`（前端 `Events` + `request.ts`）。
- 前端：`services/modules/health.ts`（`getEndpointHealth` + 订阅）；`pages/Dashboard/_components/ServiceCard.tsx` 端点列表健康灯；`pages/Endpoints/_components/EndpointCard.tsx` 实时徽标。

## 任务拆解

- **9.1** `circuit_breaker.rs`：三态机 + `CircuitBreakerConfig`（常量默认 4/2/60s/0.6/10）+ `EndpointBreaker`（计数/`last_opened_at`/`half_open_in_flight`）+ `AllowResult` + `is_available`/`allow_request`/`record_success`/`record_failure`/`record_neutral` + `BreakerRegistry`(池化 HashMap)/`snapshot` + `select_candidates` 纯函数。**含完整单测**（三态转换/惰性恢复/半开单许可/双触发/neutral 不污染/选路过滤）。
- **9.2** `rotation.rs` 增 `categorize` 错误分类 + 单测；请求内重试与熔断计数复用。
- **9.3** `ProxyState` 增 `breakers`；`handle_proxy` 集成：`is_available` 跳过 Open（全 Open 兜底放行）、`allow_request` 取许可、按 `categorize` 结果 `record_success/failure/neutral`（每条结束路径都回传 `used_half_open_permit`）、显式端点绕过；转换时发 `endpoint-health-changed`。
- **9.4** 命令 `get_endpoint_health` + 注册；前端 `Events.endpointHealthChanged` + `healthApi.getEndpointHealth/onHealthChanged`。
- **9.5** 前端实时展示：仪表盘端点列表健康灯（事件实时）+ 端点页熔断徽标/连续失败/最近错误 + 组件单测。

构建顺序：9.1/9.2（纯逻辑+分类，可并行）→ 9.3（集成）→ 9.4（命令+事件）→ 9.5（前端）。

## 数据契约（新增）

```
CircuitState = "closed" | "open" | "halfOpen"
AllowResult  = { allowed: bool, usedHalfOpenPermit: bool }   // 后端内部
EndpointHealthInfo {
  name: string,
  status: "healthy" | "unhealthy" | "recovering",
  circuit: CircuitState,
  consecutiveFailures: number,
  successRate: number,        // failed/total 反算，0~1
  lastError: string | null,
  lastFailureMs: number | null,
}
get_endpoint_health() -> EndpointHealthInfo[]
event "endpoint-health-changed" -> EndpointHealthInfo[]   // 仅状态转换时发，快照
```

## 验收标准

- 端点连续失败达 4 次（或错误率 ≥0.6 且样本 ≥10）→ Open；选路跳过；冷却 60s 后下一个到达请求转 HalfOpen 并作探测放行；半开同时只 1 个探测；成功累计 2 次 → Closed，失败 → 立即 Open。
- 客户端错误（400/401/422 等）与中断不计入熔断（neutral，仅释放许可）。
- 全部 Open 时兜底放行一个，不 100% 拒绝；显式指定端点绕过熔断仍尝试。
- 熔断状态转换时前端端点列表/端点页实时更新（事件驱动，无轮询）。
- 代理停止后熔断态随运行态销毁；既有请求内重试/轮换不回归。

## 测试点

- 后端 `circuit_breaker.rs`：三态转换、惰性恢复（构造 `last_opened_at`）、半开单许可与回传释放、双触发（连续/错误率）、`record_neutral` 不改计数、`select_candidates`（跳过 Open/全 Open 回退/显式不过滤）。
- 后端 `rotation.rs`：`categorize` 分类断言。
- 前端（vitest）：健康灯按 status/circuit 渲染；`endpoint-health-changed` 事件后列表更新。

## 提交策略（WP9）

- `9.1/9.2 熔断器+错误分类（纯逻辑+单测）` 一组；`9.3 handle_proxy 集成` 一组；`9.4 命令+事件` 一组；`9.5 前端展示` 一组。
