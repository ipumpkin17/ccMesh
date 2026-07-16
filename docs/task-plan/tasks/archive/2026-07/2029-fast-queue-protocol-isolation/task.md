---
id: 2029-fast-queue-protocol-isolation
title: 快速队列按 CLI 入站协议隔离
status: done
mode: full
priority: P1
layer: 后端
deps: 2027.2
prd_story:
owner: codex
branch: master
base_branch: master
created: 2026-07-16
completed: 2026-07-16
parent:
children:
note: 修复 Responses 快速端点抢占 Claude Code 请求的问题
---

# 2029 快速队列按 CLI 入站协议隔离

快速队列只在当前入站协议兼容的端点中生效。Codex、Claude Code 和 OpenAI Chat 客户端不再因其他协议的快速端点而丢失自己的普通候选端点。
