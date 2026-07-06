---
id: 25-request-logs-cleanup
title: 请求明细清理入口 + 90 天保留期限提示
status: done
mode: full
priority: P2
layer: 全栈
deps: 22.5
prd_story: 25
owner: claude
branch: 
base_branch: main
created: 2026-07-06
completed: 2026-07-06
parent: 
children: 
note: 实时请求监控 request_logs 单表此前无前端清理入口；90 天保留为后端硬编码，用户不可见
---

# 25-request-logs-cleanup 请求明细清理入口 + 90 天保留期限提示

按现有 PRD 推进：RequestMonitor 增加请求明细清理入口与保留期限提示，后端暴露保留天数与清理命令。
