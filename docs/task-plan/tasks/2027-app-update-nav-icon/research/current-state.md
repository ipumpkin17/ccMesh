# 现状调研：导航栏图标 + 版本更新提示

## 1. 导航栏与 Logo

- `src/layouts/SideNav.tsx`：侧栏布局。顶部 `<Logo iconOnly={collapsed} />`（h-14 区）；
  底部 Settings 项右侧绝对定位挂 `<UpdateBadge />`（红点）。折叠态 `w-14`，展开 `w-[220px]`。
- `src/components/common/Logo.tsx`：当前用 lucide `ZapIcon`（size-7 圆角 bg-primary 容器）+ 文案 `ccMesh`。
  `iconOnly` 时只显示图标块。**需求要换成真实图片 `Square71x71Logo.png`，并在 Logo 旁/下显示版本号**。
- `src/layouts/navConfig.tsx`：导航项定义（与本需求无关，仅供定位）。
- Logo 通过 `@/components/common` 桶文件导出（`src/components/common/index.ts`）。

## 2. 更新功能链路（已完整，可复用）

后端 `src-tauri/src/commands/update.rs`（已注册于 lib.rs invoke_handler）：
- `check_for_updates` → `UpdateInfo { available, version, currentVersion, notes }`（联网，未配置 endpoints 会 Err）
- `download_and_install` → 通过 `update-progress` 事件推送 `{ downloaded, total }`
- `get_update_settings` / `set_update_settings` / `skip_version`
- 当前版本来自 `app.package_info().version`（= Cargo/tauri.conf 的 0.1.2）

前端：
- `src/services/modules/update.ts`：`updateApi`（check/downloadAndInstall/getSettings/setSettings/skipVersion/onProgress）。
  事件名 `Events.updateProgress`（实际后端 emit `"update-progress"`）。
- `src/stores/modules/update.ts`：`useUpdateStore { available, version, set }`。
- `src/hooks/useUpdate.ts`：启动时若 autoCheck 则 check，有新版本且未跳过 → `set(true, version)` 置红点。
- `src/components/business/UpdateBadge.tsx`：仅在 `available` 时渲染一个红点 span。
- `src/pages/Settings/_components/UpdateSection.tsx`：**完整流程参考**——检查更新、显示 notes、
  下载安装（进度条）、跳过版本、toast 反馈。本需求的弹窗逻辑可大量参照此处。

## 3. 版本号来源

- `tauri.conf.json` version = `0.1.2`；`package.json` version = `0.1.2`。
- 前端常驻显示版本号：用 `@tauri-apps/api/app` 的 `getVersion()`（本地读取，不联网）。
  **已核实（context7/Tauri v2 官方）**：`core:default` 已包含 `core:app:default`，后者覆盖 getVersion/getName/getTauriVersion。
  → **getVersion 无需改 capability**，当前配置即可用。

## 4. GitHub 地址

- updater endpoint：`https://github.com/VkRainB/ccMesh/releases/latest/download/latest.json`
- 仓库：`https://github.com/VkRainB/ccMesh`
- **发布页**（本需求"查看发布"与 Star 图标的跳转目标）：`https://github.com/VkRainB/ccMesh/releases`

## 5. 缺失能力（需新增）

- **打开外部链接**：未装 opener/shell 插件；CSP `connect-src 'self' ipc:` 未放行外链；
  webview 内 `<a target=_blank>` 不会走系统浏览器。→ 需引入 `tauri-plugin-opener`（**已核实 context7/Tauri v2**）：
  - Cargo.toml：`tauri-plugin-opener = "2"`
  - lib.rs：`.plugin(tauri_plugin_opener::init())`
  - package.json：`@tauri-apps/plugin-opener`
  - capability：`opener:allow-open-url` + `allow: [{ "url": "https://github.com/VkRainB/ccMesh/*" }]`（带范围更安全）
  - 前端：`import { openUrl } from '@tauri-apps/plugin-opener'; await openUrl(url)`
- 已装插件：`tauri-plugin-updater` / `tauri-plugin-process` / `tauri-plugin-dialog`。
- capabilities/default.json permissions：core:default、window 控制若干、`updater:default`、`process:default`、`dialog:default`。

## 6. 图标资源

- 源：`src-tauri/icons/Square71x71Logo.png`（确认存在）。
- 目标：`src/assets/`（当前为空）。需求"按资源存放的目录存放"→ 放 `src/assets/`，前端用 `import logoUrl from "@/assets/xxx.png"`。

## 7. 澄清结论（2026-06-11）

1. 版本信息弹窗形态：**Popover 锚定浮层**（非 Dialog）。
2. 导航栏更新图标点击：**直接 download_and_install**（不先弹窗确认）。
3. Star 图标行为：可点击，**跳 GitHub 发布页**（不跳仓库主页；与"查看发布"同目标 releases）。
4. 顶部名称文案：**保持 ccMesh**（截图的 "Code AI" 仅作布局参考）。

## 8. 技术栈/命令

- 前端：React 19 + TS + Tailwind v4 + radix-ui + zustand + sonner（toast）。图标库 `lucide-react ^1.17`。
- 校验：`pnpm check:front`（tsc --noEmit）、`pnpm check:rust`（cargo check）、`pnpm test`（vitest）。
- Popover 用 radix-ui（已依赖 `radix-ui ^1.4.3`，统一桶导出在 `src/components/ui/`，需确认有无 popover 封装）。
