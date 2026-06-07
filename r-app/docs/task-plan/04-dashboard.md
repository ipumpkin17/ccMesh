# 04 — WP4 仪表盘改造

> 关联：[TASKS.md](./TASKS.md) · [PRD.md](./PRD.md)
> 所属层：前端（React 19 + Tailwind v4 + motion）
> 前置：WP1（1.10）；底部监控复用 WP2 的 `RequestMonitor`（2.5）

## 目标

重构仪表盘首屏：第一张卡片改"左3右2"（左=启用端点列表+当前工作端点，右=本地代理信息+开关+端口跳设置+海水涨潮动效）；删除"端点数量"卡片、服务状态并入第一卡片；原位置改请求/失败/Token 实时；底部"端点+密钥"换成实时请求监控（live）。

## 关键文件/落点

- 页面：`src/pages/Dashboard/index.tsx`
- 现有组件：`src/pages/Dashboard/_components/ProxyControl.tsx`（本地代理卡 + 开关 + 端口 + 当前端点）、`HealthOverview.tsx`（服务状态/启用端点卡 + 底部端点密钥卡）
- 数据：`src/services/modules/proxy.ts`（`ProxyStatus{running,port,currentEndpoint,enabledEndpointCount}`，`onStatusChanged`）、`health.ts`（`get_health -> HealthInfo{proxyRunning,enabledEndpoints,endpoints[]}`）、`src/stores/modules/proxy.ts`、`src/hooks/useStats.ts`（今日数据 + `stats-updated`）
- 复用：`StatCard`、`StatusDot`、`ui/{card,switch,badge}`、`motion`、路由（跳设置）
- 监控组件：WP2 的 `RequestMonitor`

## 任务拆解

- **4.1** 第一卡片改 `grid` 左3右2（如 `grid-cols-5`，左 `col-span-3`、右 `col-span-2`），响应式下可堆叠。
- **4.2** 左侧：启用端点列表（`health.endpoints` 过滤启用）+ 当前工作端点（`proxy.currentEndpoint`）高亮；端点别名用 `name`。
- **4.3** 右侧：本地代理信息（运行状态 + 端口 + 启用端点数）+ 启停 `Switch`（复用 ProxyControl 逻辑）；端口文字做成可点击元素，点击路由到设置页。
- **4.4** 海水涨潮动效：代理 `running` 时，右侧（或整卡）底部水位/波浪用 `motion` 上升起伏；停止时退去。注意低性能与无障碍（尊重 reduced-motion）。
- **4.5** 删除独立"端点数量"卡片；服务状态（运行中/已停止 + StatusDot）并入第一卡片。
- **4.6** 原"端点数量"位置改为三个实时数字：请求数/失败数/Token（订阅已有 `stats-updated`，读"今日"周期 `PeriodStats`）。
- **4.7** 底部"端点（密钥脱敏）"卡片整体替换为 `<RequestMonitor mode="live" />`（事件追加 + 分页 + 别名展示）。

## 验收标准

- 第一卡片左3右2 成立，左侧端点列表与当前工作端点正确高亮。
- 点击端口文字跳转到设置页。
- 代理启动后第一卡片出现海水涨潮动效，停止后消失；reduced-motion 下退化为静态。
- 不再有"端点数量"卡片；服务状态在第一卡片可见。
- 请求/失败/Token 三数字随 `stats-updated` 实时变化。
- 底部为实时监控，新请求自动追加、可分页、行显示端点别名。

## 测试点（vitest + testing-library）

- 第一卡片渲染：给定 health/proxy 状态，左侧列表与当前端点高亮；端口点击触发路由。
- 实时数字：模拟 `stats-updated` 后请求/失败/Token 更新。
- 底部 `RequestMonitor`（live）：收到 `request-logged` 事件追加新行。
- 动效：running 切换时容器出现/移除动效节点（行为层面断言，不测像素）。
