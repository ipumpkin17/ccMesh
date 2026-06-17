---
id: 2033-endpoint-filter-form-hints
title: 端点类型筛选补codex + 端点表单点亮提示与文案
status: done
mode: lite
priority: P2
layer: 前端
deps: 
prd_story: 
owner: claude
branch: 
base_branch: main
created: 2026-06-17
completed: 2026-06-17
parent: 
children: 
note: lite 快速通道
---

# 2033 端点类型筛选补 codex + 端点表单点亮提示与文案

来源：docs/task-plan/端点类型筛选缺少.txt（4 点，纯前端文案/UI）。

- FilterBar 类型筛选补 `codex`（与 transformer=codex 端点对应）。
- EndpointForm「模型清单」标签内联说明改为信息图标 + 悬停 tooltip「通过点亮模型对外公布可用模型」。
- 删「全部未点亮时默认全部公布」后的「（兼容旧配置）」。
- 删 apiUrl 预览「（随转换器类型变化）」。

落点：`src/pages/Endpoints/_components/FilterBar.tsx`、`src/pages/Endpoints/_components/EndpointForm.tsx`。
验证：`pnpm check:front` 通过；纯文案/UI 无新增单测。
