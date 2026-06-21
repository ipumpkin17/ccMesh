# 根因调研：Linux 下 UI 点击无响应

## 症状（用户报告）
Ubuntu 22.04 安装后打开 ccMesh，界面正常显示，但鼠标点击任何选项都无响应，
点击自绘的 X 也不关闭，只有右键托盘图标「退出」可用。

## 根因
Tauri 2.x + WebKitGTK 在部分 Linux 发行版上的已知缺陷，由 `visible:false → show()`
的窗口显示路径触发。两种失效模式（命名沿用 cc-switch/linux_fix.rs）：

- **失效模式 A**（Tauri #10746 / wry #637）：webview 在 `show()` 后未获得 keyboard
  focus，首次点击被 X11/Wayland 当作 click-to-activate 而非传给 webview。
- **失效模式 B**：GTK surface 与 WebKitWebView 的 input region 尺寸协商在
  `visible:false → show()` 路径上失败，整窗永远不响应点击，只有重新 `size_allocate`
  （如最大化-还原）才能恢复。**用户症状逐字对应此模式。**

托盘菜单仍可用，说明 GTK 主循环存活、主线程未阻塞——纯粹是 webview 收不到指针事件，
排除"主线程死锁"假设。

## ccMesh 命中条件
- `src-tauri/tauri.conf.json`: `"visible": false` + `"decorations": false`（无原生标题栏，
  X 是前端自绘按钮）。
- 窗口由**前端** `src/lib/boot.ts: revealMainWindow()` 调 `win.show()` + `win.setFocus()`
  显示（React 挂载后显示以避免白屏）——正是触发路径。
- main.rs 未设任何 WebKit 环境变量。

### 所有"显示主窗口"路径（修复需全覆盖）
| 路径 | 位置 | 当前操作 |
|---|---|---|
| 正常启动 | 前端 `src/lib/boot.ts:24-26` | `show()` + `setFocus()` |
| 单例二次启动 | `src-tauri/src/lib.rs:33-39` | `show()`+`unminimize()`+`set_focus()` |
| 托盘显示窗口 | `src-tauri/src/modules/tray.rs:43-49` `show_main()` | `show()`+`unminimize()`+`set_focus()` |
| macOS Reopen | `src-tauri/src/lib.rs:242-247` | macOS only，与 Linux 无关 |

## 参考方案：cc-switch 的两层防御
cc-switch 同症状，用两层（缺一不可，分别覆盖两种失效模式）：

### 第一层 — main.rs 环境变量（主修复，最高置信度）
`F:\IT\cc-switch\src-tauri\src\main.rs:4-22`：在 `run()` 前、Linux 下设置
```rust
WEBKIT_DISABLE_DMABUF_RENDERER=1   // 修复部分 GPU 白屏/黑屏 (Tauri #9394)
WEBKIT_DISABLE_COMPOSITING_MODE=1  // 注释逐字写：修复"整窗 UI 点击无响应、必须最大化-还原才能恢复"
```
仅当用户未显式设置时才设（`std::env::var(...).is_err()` 守卫），不覆盖用户意图。

### 第二层 — linux_fix.rs 的 nudge（防御纵深，补救失效模式 A）
`F:\IT\cc-switch\src-tauri\src\linux_fix.rs`：导出 `nudge_main_window(window)`，
fire-and-forget 异步执行「显式 set_focus + 无视觉的 ±1px 伪 resize + 尺寸对账回读」，
等价于肉眼不可见的"最大化-还原"。在所有显示主窗口路径的 `set_focus()` 后追加一次调用。
- 用 `log::` 宏 → ccMesh 需改为 `tracing::`（ccMesh 无 `log` crate 直接依赖）。
- 已知限制：tiling Wayland 合成器（sway/river/hyprland）会忽略 `set_size`，nudge 对模式 B
  无效，需用户侧 `GDK_BACKEND=x11` 绕过。

cc-switch 接线点（`lib.rs`）：deeplink 显示窗口后、single_instance 回调后、
lightweight 退出后——每处 `set_focus()` 之后 `#[cfg(target_os="linux")]` 调 `nudge_main_window`。

## ccMesh 移植要点
- 第二层正常启动路径：ccMesh 由**前端**显示窗口，故需新增一个命令（如
  `notify_window_shown`），boot.ts 在 `setFocus()` 后 `invoke` 触发 Rust 侧 nudge。
  单例/托盘路径在 Rust 侧，直接追加调用。
- 所有改动 `#[cfg(target_os="linux")]` 门控或非 Linux no-op，对 Windows/macOS 零影响。
- 本机为 Windows，**无法自动验证 Linux GUI**，需用户在 Ubuntu 22.04 实测。
