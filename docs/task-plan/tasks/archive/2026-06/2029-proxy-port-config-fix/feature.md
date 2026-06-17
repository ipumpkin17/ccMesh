# 2030 本地代理端口读取/生效修复

## 目标
端口真相源统一为 app_config 键 `port`，修复启停代理回落 3000 的 bug，并让端口变更全链路同步。

## 现状（根因）
`commands/proxy.rs:read_port()` 读 `proxy_port`（从未写入）→ 永远回落 3000；只有 `set_config` 走 `port` 键正确。详见 research/proxy-port-flow.md。

## 关键文件/落点
- `src-tauri/src/commands/proxy.rs`：`read_port()` 改读 `port`（复用 config_repo）；`start_proxy`/`build_status` 共用。
- `src-tauri/src/modules/storage/config_repo.rs`：如需，暴露按连接读取单值/配置的 helper。
- `src-tauri/src/commands/config.rs`：`set_config` 重启代理成功后 emit `proxy-status-changed`。
- `src/pages/Settings/index.tsx`：保存端口后 invalidate proxy 状态查询/触发刷新。
- `src/pages/ConfigProfiles/_components/CodexWorkspace.tsx`：默认 TOML 用当前 gateway 端口生成。

## 任务拆解
- 2030.1 后端：read_port 统一读 `port` 键（复用 config_repo::get_config），删除 proxy_port；加单测。
- 2030.2 后端：set_config 重启代理后发 proxy-status-changed 事件。
- 2030.3 前端：设置保存端口后刷新代理状态；Codex 默认 TOML 端口动态化。

## 数据契约
```
app_config: key='port' value=<u16 字符串>   # 唯一端口真相源
event: 'proxy-status-changed' -> ProxyStatus { running, port }
```

## 验收标准
见 prd.md Acceptance Criteria。

## 测试点
- read_port 有/无 port 键的返回值（Rust 单测）。
- cargo test、tsc。

## 提交策略
- fix(proxy): 后端端口键统一 + 事件（proxy.rs/config.rs/config_repo.rs + 测试）
- fix(frontend): 设置刷新 + Codex TOML 端口动态化
- docs: 本任务 prd/feature/research/progress
