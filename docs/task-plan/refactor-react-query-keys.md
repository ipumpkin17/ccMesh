# React Query 缓存治理方案

> 修订说明：本方案于 2026-06-26 初稿，2026-07-03 依据当前代码库全量核对后修订。
> 初稿后已落地 8.x（端点状态同步）、11.x（代理端口修复，引入 `proxy-status-changed` 事件）、13.x（启动行为与 autostart 插件集成）。
> 修订修正了过时事实、剔除了不合理设计（`autostart` 合并进 `config`）、补全了初稿未覆盖的 `set_config` 非 emit 缺口，并按三项架构决策调整目标架构。

## 一、现状分析（核对至当前代码库）

### 1.1 QueryKey 全景

| QueryKey | 数据源 | 负责页面/组件 | 定义位置 |
|----------|--------|---------------|----------|
| `["endpoints"]` | `endpointApi.list` | 端点管理、仪表盘 | `hooks/useEndpoints.ts`（共享 hook） |
| `["endpoint-health"]` | `healthApi.getEndpointHealth` | 仪表盘、端点管理 | `hooks/useEndpointHealth.ts`（共享 hook） |
| `["health"]` | `healthApi.getHealth` | 仪表盘 ServiceCard（仅用 `.endpoints`） | `ServiceCard.tsx:34-37`（内联） |
| `["stats"]` | `statsApi.getStats` | 仪表盘、统计页 | `hooks/useStats.ts`（共享 hook，含 `onUpdated` 失效） |
| `["config"]` | `configApi.getConfig` | 设置、同步(WebdavForm)、主题同步 | `Settings/index.tsx:17`、`useThemeSync.ts`、`useAutoTheme.ts`、`WebdavForm.tsx` |
| `["app-config"]` | `configApi.getConfig` | 配置档案页 | `ClaudeWorkspace.tsx:71`、`CodexWorkspace.tsx:68` |
| `["autostart-enabled"]` | `isEnabled()`（`@tauri-apps/plugin-autostart`） | 设置页启动行为 | `Settings/index.tsx:29-31`（内联） |
| `["backups"]` | `webdavApi.listBackups` | 同步页备份列表 | `BackupList.tsx:13-15`（内联） |
| `["cc-switch-preview"]` | `ccSwitchApi.preview` | 同步页 cc-switch 迁移弹窗 | `CcSwitchImport.tsx:194-196`（内联） |
| `["profile-channels", app]` | `toolConfigApi.list(appType)` | 配置档案页渠道列表 | `hooks/useToolConfigChannels.ts`（共享 hook） |
| `["stats-history", page]` | `statsApi.getStatsHistory` | 统计页历史弹窗 | `HistoryDialog.tsx:30-32`（内联） |
| `["usage", "summary", app, start, end]` | `usageApi.getSummary` | 统计页用量汇总 | `UsagePanel.tsx:63-65`（内联） |
| `["usage", "day-model", app, start, end]` | `usageApi.getByDayModel` | 统计页用量明细 | `UsagePanel.tsx:67-69`（内联） |
| `["request-logs", mode, startMs, endMs, endpointFilter, page, pageSize]` | `statsApi.getRequestLogs` | 仪表盘实时监控 | `RequestMonitor.tsx:52-69`（内联，7 段复合 key） |

> 修订要点：
> - `["request-logs", "live"]` 已扩展为 7 段复合 key，`queryFn` 为 `statsApi.getRequestLogs`（非初稿的 `getLogs`）。
> - `["profile-channels", app]` 的 `queryFn` 为 `toolConfigApi.list`（非初稿的 `configApi.getChannels`），且已有共享 hook。
> - `["autostart-enabled"]` 的 `queryFn` 是 Tauri 插件 `isEnabled()`（非初稿的 `autostartApi.isEnabled`，后端无自启命令）。
> - 新增 `["cc-switch-preview"]`（初稿未列）。
> - 全项目 `mutationKey`：0（所有 `useMutation` 均未设 `mutationKey`）。

### 1.2 共享 Hook 现状

| Hook | 状态 | 说明 |
|------|------|------|
| `useEndpoints` | ✅ 已落地 | `["endpoints"]`，但 ServiceCard 未使用它（仍用 `health.endpoints`） |
| `useEndpointHealth` | ✅ 已落地 | `["endpoint-health"]` |
| `useEndpointHealthEvents` | ✅ 已落地 | 订阅 `endpoint-health-changed` + `endpoints-changed`，**broad 失效** `["endpoints"]`/`["health"]`/`["endpoint-health"]` 三 key |
| `useStats` | ✅ 已落地 | `["stats"]`，含 `onUpdated` 事件失效 |
| `useToolConfigChannels` | ✅ 已落地 | `["profile-channels", app]` |
| `useProxyStatus` | ❌ 未抽取 | 代理态走 Zustand `useProxyStore` + `proxyApi.status()` + `onStatusChanged`（`ServiceCard.tsx:43-50`） |
| `useConfig` / `useAppConfig` | ❌ 未抽取 | 各页面内联 `useQuery` |
| `useAutostartEnabled` | ❌ 未抽取 | `Settings/index.tsx:29-31` 内联 |
| `useRequestLogs` | ❌ 未抽取 | `RequestMonitor.tsx:52-69` 内联（复合 key） |
| `useBackups` / `useStatsHistory` / `useUsage` | ❌ 未抽取 | 单消费者内联（抽取收益低，YAGNI） |

### 1.3 事件驱动失效关系

| 后端事件 | emit 位置 | 当前前端处理 |
|----------|-----------|--------------|
| `endpoints-changed` | `update_endpoint`、`reorder_endpoints`、`test_endpoint`、`import_cc_switch_providers`（imported>0） | `useEndpointHealthEvents` → 失效 `["endpoints"]`/`["health"]`/`["endpoint-health"]` |
| `endpoint-health-changed` | `forward.rs` 熔断状态转换（成功闭合/HTTP 失败/网络错误） | `useEndpointHealthEvents` → 同上 broad 失效 |
| `proxy-status-changed` | `start_proxy`、`stop_proxy`、`switch_endpoint`、`set_config`（**仅 port_changed**）、`auto_run` 启动 | `ServiceCard` 内 `proxyApi.onStatusChanged` → 写 Zustand `useProxyStore`（**非 RQ 失效**） |
| `stats-updated` | `StatsAggregator::record` 每次代理请求 | `useStats` 内 `statsApi.onUpdated` → 失效 `["stats"]` |
| `request-logged` | `StatsAggregator::record` | `RequestMonitor` 内失效 `["request-logs", "live", ...]`（仅 live 第 1 页）；`ServiceCard` 内更新本地 `liveEndpoint` UI 状态 |

> 修订要点：初稿事件表**遗漏** `proxy-status-changed`。该事件已在 11.x 落地，但前端走 Zustand 而非 RQ 失效链。

### 1.4 Mutation 失效关系

| 页面 | Mutation | 失效的 QueryKey |
|------|----------|-----------------|
| 端点管理 | `toggle` / `test` / `clone` / `del` / `save` / `reorder` / `ModelMapping.save` | `["endpoints"]`（均已在 `onSuccess` 内 `invalidateQueries`） |
| 统计页 | `sync` | `["usage", ...]` |
| 统计页 | `delRow` / `delDay` | `["stats-history"]`、`["stats"]` |
| 同步页 | `backup` / `restore` / `del` | `["backups"]` |
| 同步页 | WebDAV 保存 | `["config"]`、`["backups"]` |
| 设置页 | 配置保存 | `["config"]`、`["app-config"]`（**不**失效 `["proxy-status"]`） |
| 设置页 | 自启切换 | `["autostart-enabled"]` |
| 配置档案 | `saveCh` / `applyCfg` / `delCh` / `fetchModels` | `["profile-channels", ...]` |

> 修订要点：端点增删改的 `invalidateQueries` 已由前端 mutation 自行处理，故后端 `create_endpoint`/`delete_endpoint`/`clone_endpoint` 不 emit `endpoints-changed` **不构成缺口**。

---

## 二、设计合理性评估

### 2.1 已落地的合理设计

- **共享 Hook**：`useEndpoints`/`useEndpointHealth`/`useStats`/`useToolConfigChannels` 已封装，多组件同 key 自动去重。
- **事件驱动失效**：`useEndpointHealthEvents` 统一订阅端点/健康事件，消除各页面内联重复订阅。
- **Mutation 失效**：写操作后 `onSuccess` 失效相关查询，模式一致。

### 2.2 仍存在的问题

#### 问题 1（中）：`["config"]` 与 `["app-config"]` 查询相同数据

`Settings/index.tsx:17` 与 `ClaudeWorkspace.tsx:71`/`CodexWorkspace.tsx:68` 的 `queryFn` 均为 `configApi.getConfig`，两个 queryKey → 两份缓存 → 两次请求。设置页保存需同时失效两者。

#### 问题 2（中）：`set_config` 非端口变更重启代理但不 emit `proxy-status-changed`

`config.rs:62` 仅 `if port_changed` 才 emit；但 `needs_restart`（`config.rs:43-46`）覆盖 `proxyUrl`/`proxyEnabled`/`openaiUa`/`claudeCliUa` 变更——这些会重建转发 client 并重启代理，却**不推事件**。改代理地址/启停代理/UA 后，仪表盘代理态（端口/running/currentEndpoint）滞后，直到下次手动刷新。

#### 问题 3（中）：代理运行态走 Zustand store，未纳入 RQ 缓存体系

`useProxyStore`（`stores/modules/proxy.ts`）单独维护代理状态，与全站 RQ 策略不一致：无法用 `invalidateQueries` 刷新、不享受 RQ 去重/缓存生命周期、事件订阅与 RQ 失效链割裂。仅 `ServiceCard` 一处消费。

#### 问题 4（低）：`["health"]` 与 `["endpoints"]` 数据重复

`HealthInfo.endpoints`（`health.rs:24-28`）与 `endpointApi.list` 同源端点列表。ServiceCard 用 `health.endpoints`（`ServiceCard.tsx:69`）而非 `useEndpoints()`，导致仪表盘与端点管理页可能短暂不一致。`["health"]` 全项目仅 ServiceCard 一处消费，且**仅用 `.endpoints` 字段**（不用 `deviceId`/`proxyRunning`）。

#### 问题 5（低）：`useEndpointHealthEvents` 失效范围过广

`RELATED_KEYS = [["endpoints"], ["health"], ["endpoint-health"]]`（`useEndpointHealth.ts:8`），任何端点/健康事件都同批失效三者。配置变更（`endpoints-changed`）不会改变熔断态，熔断变更（`endpoint-health-changed`）不会改变配置，但当前互相触发重请求。

#### 问题 6（低）：`["request-logs", ...]` 缺少共享 Hook

7 段复合 key 内联于 `RequestMonitor.tsx:52-69`，事件订阅（`onRequestLogged`）也内联，扩展性差。

### 2.3 已驳回的初稿问题

#### 初稿问题 6（原评"低"）：`["autostart-enabled"]` 粒度过细 → **驳回**

初稿提议"合并到 `["config"]` 的 autostart 字段"。**不合理**：系统自启是 OS 级开关（Tauri 插件 `isEnabled`/`enable`/`disable`，状态由 OS 持有），`AppConfig` 的 `silentStart`/`autoRun` 是应用内行为（ persisted in DB）。二者不同维度，强行合并会让 config 既承载应用配置又反射 OS 状态，语义混淆且 `setConfig` 无法写 OS 自启状态。正确做法：**保持 `["autostart-enabled"]` 独立，仅抽取 `useAutostartEnabled` 共享 hook** 消除内联。

### 2.4 问题汇总（修订后）

| 严重程度 | 问题 | 影响 |
|----------|------|------|
| **中** | `["config"]` / `["app-config"]` 重复 | 多余请求，两份缓存可能不一致 |
| **中** | `set_config` 非端口变更不 emit | 代理态展示滞后（初稿未覆盖） |
| **中** | 代理态走 Zustand 未入 RQ | 缓存策略割裂，无法 invalidate 刷新 |
| **低** | `health.endpoints` 与 `["endpoints"]` 重复 | 数据来源不统一 |
| **低** | `useEndpointHealthEvents` 失效过广 | 不必要重请求 |
| **低** | `["request-logs", ...]` 无共享 hook | 扩展性差 |

---

## 三、目标架构

### 3.1 架构决策（已澄清）

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 代理运行态数据源 | **废 Zustand `useProxyStore`，改用 `["proxy-status"]` RQ + `useProxyStatus`** | 统一到 RQ 体系，可用 `invalidateQueries` 刷新，与全站策略一致；`useProxyStore` 仅 ServiceCard 消费，迁移范围干净 |
| `["health"]` 处理 | **保留 `healthApi.getHealth` API，ServiceCard 端点列表改用 `useEndpoints()`，移除 `["health"]` useQuery** | ServiceCard 仅用 `.endpoints`，改 `useEndpoints()` 后 `["health"]` 无活跃消费者；API 保留备 `deviceId` 未来所需；不破坏后端契约 |
| `["autostart-enabled"]` | **保持独立 key，抽取 `useAutostartEnabled` 共享 hook** | OS 自启状态不属于应用 config；`silentStart`/`autoRun` 已在 config，无需动 |

### 3.2 QueryKey 清单（目标）

| QueryKey | 职责 | 数据源 | 事件失效 |
|----------|------|--------|----------|
| `["endpoints"]` | 端点配置列表 | `endpointApi.list` | `endpoints-changed` |
| `["endpoint-health"]` | 端点运行时健康/熔断态 | `healthApi.getEndpointHealth` | `endpoint-health-changed` |
| `["proxy-status"]`（新） | 代理运行态（running/port/currentEndpoint/enabledCount） | `proxyApi.status` | `proxy-status-changed` |
| `["config"]` | 全局配置（含 silentStart/autoRun/代理设置/UA/主题） | `configApi.getConfig` | 手动失效 |
| `["stats"]` | 四周期统计 | `statsApi.getStats` | `stats-updated` |
| `["request-logs", ...]` | 请求日志（7 段复合 key） | `statsApi.getRequestLogs` | `request-logged` |
| `["usage", ...]` | 用量统计 | `usageApi.*` | 手动失效 |
| `["backups"]` | 备份列表 | `webdavApi.listBackups` | 手动失效 |
| `["profile-channels", app]` | 配置档案渠道 | `toolConfigApi.list` | 手动失效 |
| `["autostart-enabled"]` | OS 自启状态 | `isEnabled()`（Tauri 插件） | 手动失效 |
| `["cc-switch-preview"]` | cc-switch 迁移预览 | `ccSwitchApi.preview` | 手动失效 |
| `["stats-history", page]` | 历史记录分页 | `statsApi.getStatsHistory` | 手动失效 |

### 3.3 废弃/合并项

| 原项 | 处理方式 | 目标 |
|------|----------|------|
| `["app-config"]` | 合并 | → `["config"]` |
| `useProxyStore`（Zustand） | 替换 | → `["proxy-status"]` RQ + `useProxyStatus`，删除 store 文件 |
| `["health"]` useQuery | 移除 | ServiceCard 改用 `useEndpoints()`；`healthApi.getHealth` API 保留备用 |
| `useEndpointHealthEvents` RELATED_KEYS 的 `["health"]` | 移除 | 精确化失效时自然剔除 |

---

## 四、实施计划

### 阶段一：统一 config 查询

**目标**：消除 `["config"]` / `["app-config"]` 重复。

**改动**：
- [ ] `ConfigProfiles/_components/ClaudeWorkspace.tsx`：`["app-config"]` → `["config"]`
- [ ] `ConfigProfiles/_components/CodexWorkspace.tsx`：`["app-config"]` → `["config"]`
- [ ] `Settings/index.tsx`：`save` 内移除 `["app-config"]` 失效（保留 `["config"]`）
- [ ] （可选）抽取 `useConfig` 共享 hook，统一 4 处内联（`Settings`、`useThemeSync`、`useAutoTheme`、`WebdavForm`）

**影响范围**：配置档案页、设置页、主题同步

### 阶段二：代理状态 RQ 化 + ServiceCard 端点列表收口 + set_config 根因修复

**目标**：代理态纳入 RQ；ServiceCard 端点列表改用 `useEndpoints()`；修复 `set_config` 非 emit 缺口。

**改动**：
- [ ] 新增 `hooks/useProxyStatus.ts`：`queryKey: ["proxy-status"]`，`queryFn: proxyApi.status`，订阅 `proxyApi.onStatusChanged` → `qc.invalidateQueries({ queryKey: ["proxy-status"] })`
- [ ] `ServiceCard.tsx`：`useProxyStore` → `useProxyStatus()`；`health.endpoints` → `useEndpoints()`；移除 `["health"]` useQuery 与 `proxyApi.status/onStatusChanged` 内联订阅；`toggle` 改为 `proxyApi.start/stop` 后 `invalidateQueries(["proxy-status"])`
- [ ] 删除 `stores/modules/proxy.ts`（`useProxyStore` 无其他消费者）
- [ ] 后端 `commands/config.rs:62`：`if port_changed` → `if needs_restart`（根因修复，覆盖 proxyUrl/proxyEnabled/UA 重启场景）

**影响范围**：仪表盘 ServiceCard、后端 set_config

### 阶段三：精确化事件失效

**目标**：事件失效范围最小化。

**改动**：
- [ ] `hooks/useEndpointHealth.ts`：`useEndpointHealthEvents` 拆分失效——`endpointApi.onChanged` → 仅失效 `["endpoints"]`；`healthApi.onHealthChanged` → 仅失效 `["endpoint-health"]`；移除 `RELATED_KEYS` 常量与 `["health"]`
- [ ] （可选）重命名为 `useEndpointEvents`（当前名 `useEndpointHealthEvents` 已含端点事件，名实不符）

**影响范围**：所有使用端点/健康数据的页面

### 阶段四：粒度优化

**目标**：抽取仍为内联但有复用价值的共享 hook。

**改动**：
- [ ] 新增 `hooks/useAutostartEnabled.ts`：`queryKey: ["autostart-enabled"]`，`queryFn: isEnabled()`；`Settings/index.tsx` 替换内联
- [ ] 新增 `hooks/useRequestLogs.ts`：封装 7 段复合 key + `statsApi.getRequestLogs` + `onRequestLogged` 事件失效；`RequestMonitor.tsx` 替换内联

**影响范围**：设置页、仪表盘实时监控

> 说明：`useBackups`/`useStatsHistory`/`useUsage` 各为单消费者，抽取属 YAGNI，不在本计划内。

---

## 五、验证清单

### 5.1 功能验证

- [ ] 端点管理：拖拽排序/启停/编辑/克隆/删除后仪表盘即时更新
- [ ] 仪表盘：代理开关切换后端口/running/currentEndpoint 即时反映
- [ ] 设置页：改代理地址/启停代理/UA 后仪表盘代理态即时反映（验证 set_config 修复）
- [ ] 设置页：改端口后仪表盘端口即时反映
- [ ] 设置页：自启/静默启动/自动运行开关正常
- [ ] 配置档案：渠道增删改后即时刷新；与设置页 config 数据一致（同源 `["config"]`）
- [ ] 仪表盘：熔断状态变化即时反映
- [ ] 实时监控：请求日志正常分页/筛选/刷新

### 5.2 性能验证

- [ ] DevTools Network：`getConfig` 同页只请求一次（无双发）
- [ ] 端点配置变更时，`getEndpointHealth` 不重请求
- [ ] 熔断状态变更时，`listEndpoints` 不重请求
- [ ] 代理状态变更时，`getHealth` 不被触发（已无 `["health"]` 失效）

### 5.3 构建验证

- [ ] `npx tsc --noEmit` 通过
- [ ] `npx vitest run` 通过（含新增 hook 单测）
- [ ] `cargo check`（若改后端）通过

---

## 六、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 废 Zustand 改 RQ 影响 ServiceCard 代理态交互 | 中 | 中 | `useProxyStatus` 保持 `proxyApi.status` 数据源；`toggle` 改 invalidate 后 RQ 自动重拉；保留事件订阅失效链 |
| `set_config` emit 扩大化引发多余刷新 | 低 | 低 | `needs_restart` 仅在重启触发时为真，非全量 setConfig；emit 频率与重启一致 |
| 精确化失效导致跨页同步延迟 | 低 | 中 | `endpoints-changed` 仍失效 `["endpoints"]`（仪表盘 ServiceCard 已改用 `useEndpoints()`）；回归测试端点管理↔仪表盘联动 |
| `["health"]` 移除后 device_id 无前端来源 | 低 | 低 | 当前无前端消费者；`healthApi.getHealth` API 保留，未来需要时单独查询 |
