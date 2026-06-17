# 本地代理端口读取/生效修复

## Goal
让本地代理实际监听端口、仪表盘显示端口、设置端口、配置档案生成的端点 URL 端口四者始终一致，消除「设置 3002 但代理跑在 3000」的不一致。

## Requirements
- 启动/停止/查询代理状态时读取用户在设置中保存的端口（键 `port`），而非不存在的 `proxy_port`。
- 设置中修改端口后，仪表盘与配置档案的端口展示与新建配置生成的 URL 同步生效。
- 排查所有用到端口的配置入口（仪表盘、托盘、设置、配置档案 Claude/Codex），保证读取同一真相源。

## Acceptance Criteria
- [ ] 设置端口为 3002 后，从仪表盘启动代理，日志 `代理服务已启动 port=3002`。
- [ ] 关闭代理后仪表盘显示端口仍为 3002（不回落 3000）。
- [ ] 再次启动监听 3002；配置档案生成的端点 URL 为 `127.0.0.1:3002`。
- [ ] 托盘启停与仪表盘行为一致。
- [ ] 后端单测覆盖端口解析读 `port` 键。

## Definition of Done
- read_port 统一读 `port` 键；set_config 重启后推送状态事件；前端保存端口后刷新代理状态与配置 query。
- cargo test / tsc 通过。

## User Stories
- 作为用户，我希望设置里填的代理端口能真正生效，以便我的客户端与端点配置都指向同一个端口。
- 作为用户，我希望关闭再开启代理后端口不被重置，以便配置保持稳定。

## Implementation Decisions
- 端口真相源统一为 app_config 键 `port`；废弃 `proxy_port` 读取路径。
- 抽取共享解析函数，proxy 命令与 config 命令复用，避免再次分叉。
- set_config 重启代理后 emit `proxy-status-changed`，前端订阅刷新。
- Codex 默认 TOML 模板改为基于当前 gateway 端口动态生成。

## Testing Decisions
- Rust 单测：端口解析在有/无 `port` 键时分别返回配置值/默认值。
- 前端：依赖现有 mock，手动核对仪表盘/设置/配置档案端口一致。

## Out of Scope
- 端口占用检测与范围校验（记为后续增强）。
- 统一 React Query queryKey 的全面重构（仅做必要的刷新）。

## Technical Notes
- 无头环境无法启动真实 GUI 验证端口绑定，需本地手动核对启停链路。
