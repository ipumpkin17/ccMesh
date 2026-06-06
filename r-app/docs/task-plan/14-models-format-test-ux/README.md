# 阶段 14：/v1/models 双格式 + 端点测试选模型 + 浮层组件

> 来源：[`../task2.md`](../task2.md)。参考实现：new-api（QuantumNous）、sub2api（Wei-Shaw）的 Anthropic `/v1/models` 处理。
> 进度跟踪见同目录 [`progress.csv`](./progress.csv)。定稿日期：2026-06-07。

## 一、问题

1. **端点测试连通性缺少选模型步骤**：`EndpointCard` 测试按钮直接用 `ep.model`（空则默认）测，未让用户选模型。需设计交互；浮层用 radix-ui/shadcn 合适组件，并替换其它用浮层凑合处（阶段12 用 tooltip 实现的卡片模型浮层）。
2. **`/v1/models` Anthropic 端点拿不到数据**：路由统一返回 OpenAI 格式，Claude Code（Anthropic 客户端）解析不到；且 Claude 端点候选拉取（`fetch_model_ids`）直接返回空，导致配置态无数据来源。

## 二、方案选择

### 2.1 `/v1/models` 按入站格式返回（问题2）
对比 new-api（按 API 类型返回 Anthropic/OpenAI 不同格式）与 sub2api（按 platform 返回），两者都**返回网关配置的模型、按入站类型切换格式**，不实际查上游。采用同一思路：
- 入站带 `x-api-key` 或 `anthropic-version` → **Anthropic 格式**：`{data:[{id,type:"model",display_name,created_at}],first_id,last_id,has_more}`（空列表 first_id/last_id 为 `null`，对齐官方）。
- 否则 → **OpenAI 格式**：`{object:"list",data:[{id,object,created,owned_by}]}`。
- 数据来源保持配置态（`endpoint.model` 锁定 / `models[]` 清单），不实时查上游（与参考项目一致）。

### 2.2 修复 Claude 候选拉取（问题2 数据来源）
`fetch_model_ids` 让 Claude 端点也拉上游 `/v1/models`（Anthropic 官方有此 API），鉴权用 `x-api-key + anthropic-version: 2023-06-01`，与 OpenAI 共用 `data[].id` 解析。这样表单刷新对 Claude 端点也能拿到候选填入 `models[]`，配置态才有数据。

### 2.3 测试选模型交互（问题1）
- `test_endpoint(id, model: Option<String>)`：前端选择优先 → 端点锁定 `model` → 按格式回落默认。
- `EndpointCard` 测试按钮：端点展示模型（`model` 优先，否则 `models[]`）**≥2 个时点击弹 Popover 选模型**再测；**0/1 个直接测**（避免无意义弹层）。
- 弹层用 **Popover**（点击可交互选择，优于 tooltip）。

### 2.4 浮层组件统一（问题1）
- 新增 `components/ui/popover.tsx`、`hover-card.tsx`，参照既有 `tooltip.tsx` 的 radix-ui 统一包风格（项目 `radix-ui ^1.4.3`）。
- 卡片可用性悬停展示模型：阶段12 的 **tooltip 换为 HoverCard**（hover 富内容更合适）。
- 测试选模型：**Popover**（点击交互）。

## 三、任务（见 progress.csv）

- **P14-1** 问题2后端：/v1/models 双格式 + Anthropic 候选拉取
- **P14-2** 问题1后端：test_endpoint 接受 model 参数
- **P14-3** 问题1前端：popover/hover-card 组件 + 测试选模型 + 卡片浮层换 HoverCard
- **P14-4** 自检与提交：编译/测试/code-review + 提交

## 四、验收

- Claude Code（带 x-api-key）调 `/v1/models` 得 Anthropic 格式且能解析；OpenAI 客户端得 OpenAI 格式
- Claude 端点表单刷新能拉到候选模型
- 测试连通性可选模型（多模型弹 Popover）
- 卡片悬停用 HoverCard 展示模型
- 后端 46 + 前端 10 测试通过，code-review 通过
