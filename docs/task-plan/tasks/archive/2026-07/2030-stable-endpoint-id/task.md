---
id: 2030-stable-endpoint-id
title: 全链路使用稳定端点唯一 ID
status: done
mode: full
priority: P1
layer: 全栈
deps: 2029.3
prd_story:
owner: codex
branch: master
base_branch: master
created: 2026-07-16
completed: 2026-07-16
parent:
children:
note: 名称仅用于展示，旧统计不回填 ID
---

# 2030 全链路使用稳定端点唯一 ID

为端点增加跨改名、配置迁移和 WebDAV 同步保持不变的 UUID。代理运行状态、熔断、在途请求、模型列表、统计和前端关联全部改用该 ID，名称只保留为展示快照。
