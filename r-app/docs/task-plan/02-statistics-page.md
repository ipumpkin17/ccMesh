# 02 — WP2 统计页改造

> 关联：[TASKS.md](./TASKS.md) · [PRD.md](./PRD.md)
> 所属层：前端（React 19 + Tailwind v4）
> 前置：WP1（1.10 services/types）

## 目标

统计页顶部加一级 Tab（端点统计 | 用量统计）；端点统计表增缓存两列；"归档"改"历史记录"弹窗（分页 + 删除）；下半接入共享实时请求监控（ranged 时间段模式）。

## 关键文件/落点

- 页面：`src/pages/Statistics/index.tsx`
- 现有组件：`src/pages/Statistics/_components/EndpointStatsTable.tsx`、`HistoryPanel.tsx`（即原"归档"）、`TrendBadge.tsx`
- 复用：`src/components/business/StatCard.tsx`、`src/components/ui/{tabs,select,card,badge,scroll-area,dialog}.tsx`、`src/components/ui/StatusDot.tsx`、`TabularText.tsx`
- 数据：`src/hooks/useStats.ts`、`src/services/modules/stats.ts`
- 用量统计 Tab 内容由 WP3（[03-usage-stats.md](./03-usage-stats.md)）提供

## 任务拆解

- **2.1** 顶部一级 `Tabs`：`端点统计` | `用量统计`；把原"今日/昨日/本周/本月"周期 Tab 降为端点统计内的子级。
- **2.2** `EndpointStatsTable` 增"缓存创建/缓存读取"两列（读 1.10 扩展后的字段）。
- **2.3** 通用分页组件 `src/components/ui/Pagination.tsx`（受控 page/pageSize/total + onChange），库内当前无分页组件。
- **2.4** 历史记录弹窗：用 `Dialog` 承载分页表格（走 `get_stats_history`），每行"删除"+ 按天"删除整天"（走 `delete_daily_stat`/`delete_stats_by_date`），操作后失效 `stats`/历史查询缓存。替换原 `HistoryPanel` 的内联月份归档。
- **2.5** 共享 `RequestMonitor` 组件（见数据契约与 Req9）：列=时间/入站/出站/状态码 + Token 悬停明细；`mode` 支持 `live`|`ranged`。
- **2.6** 端点统计下半渲染 `<RequestMonitor mode="ranged" />` + 时间段选择器，走 `get_request_logs` 分页查询。

## RequestMonitor 组件契约（WP2 与 WP4 共用 — Req9）

```
type RequestMonitorProps = {
  mode: "live" | "ranged";
  // ranged: 时间段 + 分页查询 get_request_logs
  // live:   订阅 request-logged 事件追加 + 分页浏览
  endpointFilter?: string;   // 可选端点过滤
  pageSize?: number;
};
```
- 列：请求时间、入站请求（inbound_format/endpoint）、出站请求（upstream_url）、响应状态码（成功/失败着色）、Token 图标。
- Token 悬停：popover 展示 输入/输出/缓存创建/缓存读取/合计（合计=四者之和，前端计算，参考 sub2api `UsageTable.vue` 的 token tooltip 交互）。
- `ranged`：分页 + start/end 过滤；`live`：挂载时拉首页 + 订阅 `request-logged` 实时 prepend，超出 pageSize 截断展示。

## 验收标准

- 顶部可在端点统计/用量统计切换；端点统计内周期切换与四张汇总卡片、趋势保持原状。
- 端点表出现缓存两列并显示正确数值。
- 历史记录弹窗分页可翻页、可删行/删整天且即时反映。
- 下半监控按时间段查询并分页，Token 悬停展开明细正确。

## 测试点（vitest + testing-library）

- `RequestMonitor`（ranged）：给定分页数据渲染列；Token 悬停展开明细；状态码着色。
- 历史记录弹窗：分页回调、删除触发对应命令并刷新。
- `Pagination`：页码切换回调正确。
- 顶部 Tab 切换渲染对应内容。
