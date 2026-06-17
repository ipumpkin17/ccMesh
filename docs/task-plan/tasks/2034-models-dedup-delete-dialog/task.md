---
id: 2034-models-dedup-delete-dialog
title: /v1/models 跨端点去重 + 删除渠道弹窗文案优化
status: done
mode: lite
priority: P2
layer: 全栈
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

# 2034 模型去重 + 删除渠道弹窗优化

来源：用户追加（截图）两点。

- 配置工作区「拉取模型」下拉重复：根因为网关 `/v1/models`(server.rs models_route) 跨端点 flat_map 公布模型未去重，
  多端点公布同名模型时返回重复项。修复：新增 `resolver::dedup_advertised_pairs`（大小写不敏感、保留首次出现）并接入，
  使拉取结果与对外可用模型口径一致；补单测。
- 删除渠道确认弹窗文案优化：Claude/Codex 工作区改为「主问句 + 次级灰字说明」，明确仅删除保存的渠道方案、
  不影响已写入系统的真实配置文件（Claude: ~/.claude/settings.json；Codex: ~/.codex/auth.json 与 config.toml），且不可恢复。

落点：`src-tauri/src/modules/proxy/server.rs`、`src-tauri/src/modules/proxy/resolver.rs`、
`src/pages/ConfigProfiles/_components/ClaudeWorkspace.tsx`、`src/pages/ConfigProfiles/_components/CodexWorkspace.tsx`。
验证：`cargo test resolver`（含新增去重单测）、`pnpm check:front` 通过。
