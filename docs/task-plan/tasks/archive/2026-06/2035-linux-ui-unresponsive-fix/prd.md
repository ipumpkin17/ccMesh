# Linux 下 UI 点击无响应（WebKitGTK 窗口交互冻结）修复

## Goal
修复 ccMesh 在 Ubuntu 22.04（及同类 Linux/WebKitGTK 环境）上启动后界面显示但
整窗鼠标点击无响应、自绘标题栏按钮（含关闭）失效、仅能经托盘退出的问题，
使 Linux 用户首次启动即可正常交互；对 Windows/macOS 行为零影响。

## Requirements
- 采用 cc-switch 已验证的**两层防御**：
  1. 进程启动早期（WebKitGTK 初始化前）在 Linux 上设置 WebKit 环境变量。
  2. 在所有"显示主窗口"路径上，于 `set_focus()` 后追加一次 Linux 专用的
     "focus + 无视觉伪 resize"窗口交互重激活（nudge）。
- 覆盖 ccMesh 全部三条会让主窗口出现在用户面前的路径：正常启动（前端 show）、
  单例二次启动、托盘显示窗口。
- 所有新增逻辑以 `#[cfg(target_os = "linux")]` 门控或在非 Linux 上 no-op。
- 不覆盖用户已显式设置的环境变量（设置前先检测）。

## Acceptance Criteria
- [ ] Ubuntu 22.04 安装版启动后，鼠标可正常点击界面所有选项。
- [ ] 自绘标题栏的最小化/最大化/关闭按钮可用。
- [ ] 单例二次启动（再次点击图标/快捷方式）唤起的窗口可正常点击。
- [ ] 托盘"显示窗口"/左键唤起的窗口可正常点击。
- [ ] Windows/macOS 启动与交互行为无变化（回归）。
- [ ] `pnpm check:front` 与 `pnpm check:rust`（Windows 可编译部分）通过。

## Definition of Done
- 两层修复代码合入，全部显示路径接线完成。
- 文档（prd/feature/research）落地，progress.csv 更新为完成。
- 按模块 scoped 提交。
- 显式声明 Linux GUI 行为本机无法自动验证，附用户侧 Ubuntu 22.04 核对清单。

## User Stories
- 作为 Ubuntu 用户，我希望打开 ccMesh 后能直接用鼠标操作界面，以便正常配置和使用代理。
- 作为 Ubuntu 用户，我希望从托盘或二次启动唤起窗口后仍可点击，以便日常反复使用不被卡死。

## Implementation Decisions
- 选定**完整两层**方案（用户确认）：环境变量为主修复，nudge 为防御纵深，分别覆盖
  失效模式 B（compositing/input region 协商）与 A（show 后 focus 缺失）。
- 环境变量置于 bin 入口 `main.rs`、`run()` 之前——必须早于 WebKitGTK 初始化；
  仅在用户未显式设置时写入。
- nudge 逻辑独立为 `#[cfg(target_os = "linux")] mod linux_fix`，从 cc-switch 移植，
  日志宏由 `log::` 改为 ccMesh 既用的 `tracing::`；函数泛型化 `<R: Runtime>` 以兼容
  托盘的泛型 `show_main` 与 lib/command 的具体 `Wry` 调用点。
- 正常启动路径由前端 `boot.ts` 控制 show()，故新增一个 no-op-on-non-Linux 的命令
  `notify_window_shown`，由前端在 `setFocus()` 后 invoke 触发 Rust 侧 nudge；
  单例与托盘路径在 Rust 侧直接追加调用。

## Testing Decisions
- 静态门：`pnpm check:front`（tsc）+ `pnpm check:rust`（覆盖非 Linux 分支与命令签名）。
- Linux 运行时行为属 GUI + 平台特定，本机（Windows）无法自动验证，移交用户在
  Ubuntu 22.04 实测，提供核对清单。

## Out of Scope
- tiling Wayland 合成器（sway/river/hyprland）忽略 set_size 的残留场景（已知限制，
  需用户侧 `GDK_BACKEND=x11` 绕过，文档说明即可，不在本次代码内处理）。
- 任何 Windows/macOS 侧窗口行为调整。
- decorations/标题栏的重构。

## Technical Notes
- 参考：`F:\IT\cc-switch\src-tauri\src\main.rs`（环境变量）与 `linux_fix.rs`（nudge）。
- 根因详见 `research/root-cause.md`。
- Tauri #9394（DMABUF/compositing 白屏与输入）、#10746 / wry #637（show 后 focus）。
