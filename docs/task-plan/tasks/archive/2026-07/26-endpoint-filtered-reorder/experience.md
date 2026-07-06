# 端点筛选排序拖拽经验总结

## 背景

端点全局排序会影响后端轮询顺序；类型筛选视图只展示局部端点。如果筛选后直接提交局部顺序，会破坏全局轮询序列。因此筛选态拖拽必须在前端构造完整全局顺序，再提交完整 id 排列。

## 最终设计

- 普通视图：继续使用 `@dnd-kit/helpers` 的 `move(order, event)`。
- 类型筛选视图：拖拽前切换为全局预览顺序。
  - 当前拖动卡片保持可拖动。
  - 同类型端点显示为不可交互预览卡片，透明度 `80%`。
  - 筛选外端点显示为不可交互预览卡片，透明度 `60%`。
- 放到任一预览卡位时，拖动卡片插入到该卡位前面。
- 提交给后端的仍是完整全局端点 id 列表，满足后端 `reorder_endpoints` 的完整排列校验。

## Ponytail 校对后的取舍

- 删除 `sameEndpointOrder` 和 `visibleFromGlobal`。
  - 二者都是一行包装，只在当前组件服务当前逻辑。
  - 内联后更短、更少抽象、更少测试实现细节。
- 保留 `moveBeforeEndpoint`。
  - 这是业务语义，不是 UI 细节：`drop target` 表示“插入到目标前”。
  - 有独立单测保护前移、后移两种方向。
- `moveBeforeEndpoint` 从 `find + filter + findIndex + slice` 优化为 `findIndex + splice`。
  - 更少中间数组。
  - 插入下标用 `targetIndex > activeIndex ? targetIndex - 1 : targetIndex` 修正移除 active 后的索引偏移。

## 滚动校准经验

问题现象：类型筛选视图中，拖动一个位于全局中间位置的端点时，全局预览会在它前面生成很多卡片，原卡片的 DOM 位置被向下推。如果不校准滚动条，用户会看到拖动卡片浮在新生成卡片上方，产生跳动和恍惚。

最终处理：

1. 在 `onBeforeDragStart` 记录当前拖动卡片的 viewport `top`。
2. 同步设置 `activeId`，让筛选视图提前切换为全局预览。
3. `@dnd-kit/react` 会等待 `onBeforeDragStart` 触发的 React 渲染完成后再正式进入拖拽测量。
4. `useLayoutEffect` 在全局预览 DOM 落地后，重新读取同一张卡片的新 `top`。
5. 对真实滚动容器执行 `scrollTop += newTop - oldTop`，保持拖动卡片在视窗中的视觉位置不变。

关键点：

- 不能放在 `onDragStart` 才切换预览；那时 dnd 测量已经开始，容易出现拖拽源与新布局错位。
- 不能用 `scrollHeight > clientHeight` 找滚动容器；拖动前筛选列表可能尚未溢出，拖动后全局预览才溢出。
- 需要按 CSS 向上找最近的真实滚动面板：`overflow-y: auto | scroll | overlay`。
- `scrollbar-none` 只隐藏滚动条视觉，不会禁用 `scrollTop`。

## 验证口径

本任务的最小可靠验证：

- 单测：`pnpm vitest run src/__tests__/endpointReorder.test.ts`
  - 覆盖“拖动项插入到预览目标前”的核心业务语义。
- 类型检查：`pnpm check:front`
  - 覆盖 React/TypeScript 导出、props、hook 类型。
- 构建：`pnpm build`
  - 覆盖 Vite 模块导出和生产打包路径，排除 `DnDList` 导出缺失类问题。

## 后续注意

- 如果 `DnDList` 以后不再直接处于端点列表滚动面板内，应改为从父组件显式传入 `scrollRef`，不要继续猜 DOM 层级。
- 如果 grid 卡片高度继续变复杂，仍应保留 DOM 锚点校准，不要退回“卡片数量 × 估算高度”的算法。
- 后端已经拒绝局部排序、重复 id、未知 id；前端应继续提交完整全局排列，不要绕过该契约。
