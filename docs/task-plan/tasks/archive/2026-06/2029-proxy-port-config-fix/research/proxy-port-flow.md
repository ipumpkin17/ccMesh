# 本地代理端口数据流调研（根因）

## 结论（根因）
配置键名不一致：
- 设置页 / `get_config` / `set_config` / `config_repo` 统一用键 **`port`**（默认 3000）。
- 启停命令 `start_proxy` / `stop_proxy` / `get_proxy_status`(停机时) 调用 `read_port()`，读取的是 **`proxy_port`** 键——该键**从未被写入**，因此永远回落 `DEFAULT_PORT=3000`。

因此：
- 仪表盘/托盘 `start_proxy` → 监听 3000（错误）。
- 仅当代理「正在运行」时在设置改端口，`set_config` 用正确的 `port` 键重启 → 3002（与日志 port=3002 吻合）。
- 关闭代理 → `build_status` 停机分支 `read_port()` → 3000（UI 从 3002 跳回 3000）。
- 再次启动 → 仍 3000，与配置档案里基于 `get_config().port` 生成的 3002 端点 URL 不一致。

## 关键文件/行
- 代理服务器：`src-tauri/src/modules/proxy/server.rs:79-157`（port 由调用方传入，自身不读监听端口）。
- **bug 点**：`src-tauri/src/commands/proxy.rs:13-29` `read_port()` 读 `proxy_port`；`build_status`(停机)/`start_proxy` 都用它。
- 正确路径：`src-tauri/src/commands/config.rs:23-61` `set_config` 重启时读 `port` 键。
- 配置仓储：`src-tauri/src/modules/storage/config_repo.rs:10,78`（白名单键 `port`）。
- 配置模型：`src-tauri/src/models/config.rs:39,65`（`port: u16` 默认 3000）。
- 前端仪表盘：`src/pages/Dashboard/_components/ServiceCard.tsx:41-77,161`。
- 设置页：`src/pages/Settings/index.tsx:77-82`（onBlur save port）。
- 配置档案网关 URL：`src/lib/toolConfig.ts:4-7`；Claude/Codex Workspace 读 `getConfig().port`。
- Codex 默认 TOML 模板硬编码 3000：`src/pages/ConfigProfiles/_components/CodexWorkspace.tsx:45-57`。
- queryKey 分裂：Settings 用 `["config"]`，ConfigProfiles 用 `["app-config"]`。

## 修复落点
- P0：`read_port()` 改读 `port` 键（复用 `config_repo::get_config(&conn)?.port`），删除 `proxy_port` 引用，抽共享函数供 proxy.rs/config.rs 复用。
- P1：`set_config` 重启代理后发 `proxy-status-changed`，前端保存端口后刷新 proxy status。
- P2：Codex 默认 TOML 用当前 gateway 动态生成；统一 queryKey。
