# 需要修复内容.txt — 调研结论

## 1/2 代理端口读取与生效（验证为主）
- `src-tauri/src/commands/proxy.rs::read_port` 已正确读 `config.port`（`port` 键），停机态 `build_status` 也用 `read_port`。
- `commands/config.rs::set_config` 端口变更会停旧代理→按库内最新 `port` 重启→emit `proxy-status-changed`。
- 前端 `Settings/index.tsx` 保存 `{ port }`，并 invalidate `["config"]` 与 `["app-config"]`。
- 结论：2030.x 已修复，符合"仅检查"。补一条端口往返回归测试加固即可。

## 3 新建配置读取端口
- `ClaudeWorkspace.tsx` / `CodexWorkspace.tsx`：`const port = cfgQ.data?.port ?? 3000`，来源 `useQuery(["app-config"])`。
- 设置保存后 invalidate `["app-config"]` → 工作区端口实时刷新；端点模式 baseUrl = `gatewayBaseUrl(port, app)`。
- `defaultCodexToml(gateway)` 已用动态 gateway，不写死 3000。结论：已正确，仅验证。

## 4 单例 + 桌面快捷唤起（主改动）
- 参考 `F:\IT\cockpit-tools`：`tauri-plugin-single-instance = { version="2" }`，在 `lib.rs` `.plugin(single_instance::init(|app,args,cwd|{ 聚焦已有窗口 }))`，且须放在最前。
- 本项目 `lib.rs` 未接入；macOS `RunEvent::Reopen` 已处理（show/unminimize/set_focus）。
- 方案：新增依赖 + 在 builder 最前注册 single-instance，回调里 show+unminimize+set_focus 主窗口（复用 tray.rs 的 show_main 思路）。Windows/Linux/macOS 通用。

## 5 icon.icns 验证
- `tauri.conf.json` bundle.icon 含 `icons/icon.icns`（macOS 专用）。Windows 无头环境无法实际验证 .icns 渲染。
- 结论：给本地核对清单（macOS 打包后 Dock/Finder 图标）；确认文件存在与引用正确。

## 6 历史记录数值溢出弹窗
- `Statistics/_components/HistoryDialog.tsx`：`DialogContent max-w-5xl`，表格 8 列，大数字（如 1255919）撑宽 → 横向溢出、"操作"列被裁。
- 方案：加宽弹窗（如 max-w-6xl/响应式）+ 数字列 `whitespace-nowrap` + 表格容器允许横向滚动，确保操作列完整。

## 7 小窗弹窗显示不全（滚动）
- `components/ui/dialog.tsx::DialogContent`：垂直居中、无 `max-height`，小窗时高内容（EndpointForm）上下被裁、按钮够不到。
- 方案：DialogContent 增加 `max-h-[90dvh]` + 纵向 `overflow-y-auto`（或 grid-rows 让 body 滚动、header/footer 固定）。需兼顾既有用 max-h 的弹窗。

## 8 端点卡片 API URL 点击跳转浏览器
- 已有 `@tauri-apps/plugin-opener` 的 `openUrl`（见 `services/modules/update.ts`）。
- `EndpointCard.tsx` 的 `meta` 现以纯文本展示 `endpoint.apiUrl`。
- 方案：把 apiUrl 渲染为可点击按钮，`onClick` 调 `openUrl(endpoint.apiUrl)`，阻止冒泡。简单可行。

## 9 模型点亮态（最大改动，DB 迁移）
- 数据真相源：`resolver.rs::advertised_models(ep)` 同时供 `/v1/models`（server.rs models_route）与路由匹配（filter_by_model）。
- 端点存储：`endpoints.models TEXT`（JSON 数组），repo COLS/create/update 串。
- 方案（活动子集）：
  - 后端 `Endpoint` 新增 `active_models: Vec<String>`；DB 迁移 v9 `ALTER TABLE endpoints ADD COLUMN active_models TEXT NOT NULL DEFAULT '[]'`；repo COLS/row/create/update 同步；Create/Update 请求 DTO 增可选字段。
  - `advertised_models` 基础集：`model` 非空→[model]；否则 `active_models` 非空→active_models，空→models（向后兼容：旧端点全公布）。
  - 前端 `Endpoint`/请求类型加 `activeModels`；`EndpointForm` 标签可点亮切换（亮=在 activeModels，灰=不在）；一个都没亮=全用；保存回显。
  - `advertisedModels`（前端 endpoint.ts）同步按 activeModels 过滤，保证 ModelList/卡片展示一致。
- 兼容：activeModels 视为 models 的子集；移除某 model 时同步从 activeModels 删除。
