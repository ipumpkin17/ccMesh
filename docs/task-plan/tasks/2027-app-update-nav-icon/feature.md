# 2027 应用更新提示与导航栏图标置换

## 目标

导航栏图标换真实图片；补全更新提示交互：常驻版本号 + 按需更新图标（点击直接下载安装）+ 点版本号弹 Popover（更新日志/手动检查/发布页跳转/Star）。复用既有更新链路，仅新增前端 UI 与一项 opener 基础能力。

## 现状（根因）

- `src/components/common/Logo.tsx` 用 lucide `ZapIcon` + 文案 ccMesh，无真实图标、无版本号。被 `SideNav.tsx`(iconOnly=collapsed) 与 `TopNav.tsx` 共用。
- 更新链路已完整但只有 Settings 页 `UpdateSection.tsx` 暴露入口；导航栏仅 `UpdateBadge.tsx` 一个红点挂在 Settings 项旁，无版本号、无更新日志、无一键更新、无发布页跳转。
- 打开外部链接无任何手段：未装 opener/shell 插件，CSP `connect-src 'self' ipc:` 未放行外链。
- 详见 `research/current-state.md`。

## 关键文件/落点

### 后端（opener 能力接入）
- `src-tauri/Cargo.toml`：依赖区加 `tauri-plugin-opener = "2"`。
- `src-tauri/src/lib.rs`：`tauri::Builder` 链加 `.plugin(tauri_plugin_opener::init())`（紧随其他 `.plugin(...)`）。
- `src-tauri/capabilities/default.json`：permissions 加对象项
  `{ "identifier": "opener:allow-open-url", "allow": [{ "url": "https://github.com/VkRainB/ccMesh/*" }] }`。

### 前端依赖与资源
- `package.json`：dependencies 加 `@tauri-apps/plugin-opener`（与后端插件版本对应，pnpm add）。
- `src/assets/logo.png`：从 `src-tauri/icons/Square71x71Logo.png` 拷贝重命名而来（图片资源）。

### 前端实现
- `src/services/modules/update.ts`：
  - 导出常量 `GITHUB_RELEASES_URL = "https://github.com/VkRainB/ccMesh/releases"`。
  - 导出 `openReleases()`：调用 `@tauri-apps/plugin-opener` 的 `openUrl(GITHUB_RELEASES_URL)`。
  - 导出 `getAppVersion()`：封装 `@tauri-apps/api/app` 的 `getVersion()`。
- `src/components/common/Logo.tsx`：
  - 用 `import logoUrl from "@/assets/logo.png"` + `<img src={logoUrl} className="size-7 rounded-md" alt="ccMesh" />` 替换 ZapIcon 容器。
  - 新增可选 `extra?: React.ReactNode`：非空时在名称下方以 flex-col 渲染（用于挂版本号区）；不传则保持原"图标+名称"横向布局（TopNav 用）。
- `src/components/business/VersionPopover.tsx`（新建，核心组件）：
  - 触发器：`<button>` 显示 `v{version}`（蓝色小字）+ 紧随的条件「更新图标」（`useUpdateStore.available` 为 true 时显示，lucide `ArrowUpCircleIcon`/`DownloadIcon`，点击 `stopPropagation` 后直接 `updateApi.downloadAndInstall()` + toast）。
  - 用 `src/components/ui/popover.tsx` 的 Popover 包裹；PopoverContent 内：标题"当前版本" + 右上角 `RefreshCwIcon` 按钮（手动 `updateApi.check()`，loading 态）；大号版本号 + 状态（最新=绿勾文案 / 发现新版本 vX）；`notes` 正文（有则 whitespace-pre-wrap）；底部「查看发布」(GitHub 图标, `openReleases()`) + 填充 `StarIcon`(fill-current 高亮, `openReleases()`)。
  - 进度：订阅 `updateApi.onProgress` 显示下载百分比（复用 UpdateSection 模式）。
- `src/components/business/index.ts`：导出 `VersionPopover`。
- `src/layouts/SideNav.tsx`：顶部 Logo 区改为 `<Logo iconOnly={collapsed} extra={!collapsed ? <VersionPopover /> : undefined} />`。

## 任务拆解

- **2027f.1** opener 能力接入：Cargo + lib.rs 注册 + capability 放行（后端）。
- **2027f.2** 前端依赖与资源：pnpm add `@tauri-apps/plugin-opener`；拷贝 `Square71x71Logo.png`→`src/assets/logo.png`。
- **2027f.3** update service 扩展：`GITHUB_RELEASES_URL` + `openReleases()` + `getAppVersion()`。
- **2027f.4** Logo 图标置换 + `extra` slot。
- **2027f.5** VersionPopover 组件（版本号触发器 + 条件更新图标 + Popover 内容）+ business 桶导出。
- **2027f.6** SideNav 接入 VersionPopover。
- **2027f.7** 组件测试 + `pnpm check` + `pnpm test` 回归。

## 数据契约

复用既有，无新增后端契约。前端涉及：

```ts
// services/modules/update.ts 既有
interface UpdateInfo { available: boolean; version: string; currentVersion: string; notes: string }
interface DownloadProgress { downloaded: number; total: number | null }
// 既有 store
useUpdateStore: { available: boolean; version: string; set(available, version) }

// 新增
const GITHUB_RELEASES_URL = "https://github.com/VkRainB/ccMesh/releases";
function openReleases(): Promise<void>;   // openUrl(GITHUB_RELEASES_URL)
function getAppVersion(): Promise<string>; // app.getVersion()
```

capability 新增项：
```json
{ "identifier": "opener:allow-open-url", "allow": [{ "url": "https://github.com/VkRainB/ccMesh/*" }] }
```

## 验收标准

- [ ] 导航栏图标为真实图片（侧栏展开/折叠、顶栏均正确），名称仍为 ccMesh。
- [ ] 导航栏显示 `v0.1.2`（与打包版本一致）。
- [ ] 无更新不显示更新图标；有更新显示，点击触发下载安装并 toast 反馈。
- [ ] 单击版本号弹 Popover，点外部关闭。
- [ ] 「手动检查」可刷新浮层内状态/版本/日志，最新时给"已是最新"反馈。
- [ ] 「查看发布」与 Star 图标均用系统浏览器打开 GitHub 发布页。
- [ ] `pnpm check` 与 `pnpm test` 通过。

## 测试点

- 新建 `src/__tests__/VersionPopover.test.tsx`（参照既有 `src/__tests__/LogRow.test.tsx` 风格，vitest + RTL）：
  - mock `@/services/modules/update`（getAppVersion/check/downloadAndInstall/openReleases/onProgress）与 `useUpdateStore`。
  - 用例：`available=false` 不渲染更新图标；`available=true` 渲染更新图标且点击调用 downloadAndInstall。
  - 用例：打开 Popover 后点「查看发布」调用 openReleases；点 Star 调用 openReleases。
  - 用例（可选）：手动检查返回 available=false → 显示"已是最新"文案。
- 无法无头验证：真实出网检查更新、系统浏览器跳转、实际下载安装与重启 → 手动核对。

## 提交策略（scoped，按模块分组）

1. `docs(task-plan)`：prd.md / feature.md / research/ / progress.csv（task-plan 目录文件）。
2. `feat(updater)` 后端：`src-tauri/Cargo.toml` + `src-tauri/src/lib.rs` + `src-tauri/capabilities/default.json`。
3. `chore(deps)` 前端依赖+资源：`package.json` + `pnpm-lock.yaml` + `src/assets/logo.png`。
4. `feat(update)` 前端服务：`src/services/modules/update.ts`。
5. `feat(ui)` 前端组件：`src/components/common/Logo.tsx` + `src/components/business/VersionPopover.tsx` + `src/components/business/index.ts`。
6. `feat(ui)` 接入+测试：`src/layouts/SideNav.tsx` + `src/__tests__/VersionPopover.test.tsx`。

> 永不 `git add -A/.`；每组只 add 精确文件路径，提交前 `git status --short` 核对暂存集。
