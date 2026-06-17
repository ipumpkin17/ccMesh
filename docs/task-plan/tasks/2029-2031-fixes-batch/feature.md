# 2031 需要修复内容批次

## 目标
落地 9 个修复点，分模块实现并保证回归命令通过。

## 现状（根因）
见 research/findings.md。要点：端口逻辑已正确（仅验证）；单例未接入；弹窗无限高/历史弹窗过窄；卡片 URL 纯文本；模型清单无点亮态。

## 关键文件/落点
- 单例(4)：`src-tauri/Cargo.toml`（加依赖）、`src-tauri/src/lib.rs`（注册插件+回调）。
- 图标(5)：`src-tauri/tauri.conf.json`、`src-tauri/icons/icon.icns`（仅核对）。
- 历史弹窗(6)：`src/pages/Statistics/_components/HistoryDialog.tsx`。
- 弹窗滚动(7)：`src/components/ui/dialog.tsx`。
- URL跳转(8)：`src/pages/Endpoints/_components/EndpointCard.tsx`。
- 模型点亮(9-后端)：`src-tauri/src/models/endpoint.rs`、`src-tauri/src/modules/storage/migration.rs`、`src-tauri/src/modules/storage/endpoint_repo.rs`、`src-tauri/src/modules/proxy/resolver.rs`。
- 模型点亮(9-前端)：`src/services/modules/endpoint.ts`、`src/pages/Endpoints/_components/EndpointForm.tsx`。
- 端口回归(1/2)：`src-tauri/src/modules/storage/config_repo.rs`（已有测试，补充必要项）。

## 任务拆解
- 2031.1 单例与桌面唤起（Cargo 依赖 + lib.rs 注册回调）。
- 2031.2 通用弹窗限高滚动（dialog.tsx）。
- 2031.3 历史记录弹窗加宽与列不换行（HistoryDialog.tsx）。
- 2031.4 端点卡片 API URL 点击跳转（EndpointCard.tsx）。
- 2031.5 模型点亮态后端：DTO + 迁移 v9 + repo + advertised_models 过滤 + 单测。
- 2031.6 模型点亮态前端：类型 + 表单点亮切换 + advertisedModels 过滤 + 单测。
- 2031.7 端口验证与回归测试加固；整体回归（cargo test / tsc / vitest）+ 核对清单。

## 数据契约
```jsonc
// Endpoint 新增字段（后端 camelCase 序列化）
{ "activeModels": ["gpt-5"] } // 空数组=全量公布；非空=仅这些公布/可路由
```
```sql
-- 迁移 v9
ALTER TABLE endpoints ADD COLUMN active_models TEXT NOT NULL DEFAULT '[]';
```

## 验收标准
见 prd.md Acceptance Criteria。

## 测试点
- repo：active_models 往返、移除 model 同步删 active、迁移 v9 列存在。
- resolver：active 非空只公布 active；空回退 models；locked model 优先。
- 前端：advertisedModels 按 activeModels 过滤；空回退全量。

## 提交策略
- docs：本任务 PRD/feature/progress 单独提交。
- 后端：单例(2031.1) 一组；模型点亮后端(2031.5) 一组（models/migration/repo/resolver）。
- 前端：弹窗(2031.2/2031.3/2031.4) 一组；模型点亮前端(2031.6) 一组。
- 端口回归测试(2031.7) 并入后端相关提交。
