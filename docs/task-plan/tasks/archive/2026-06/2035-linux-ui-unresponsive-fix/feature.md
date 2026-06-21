# 2035 Linux 下 UI 点击无响应修复

## 目标
移植 cc-switch 两层防御，修复 Ubuntu 22.04 上 ccMesh 整窗点击无响应；非 Linux 零影响。

## 现状（根因）
`tauri.conf.json` `visible:false` → 前端/Rust `show()` 的路径在 WebKitGTK 上触发
两种失效模式：A（show 后 webview 未获 focus）、B（GTK surface 与 WebKitWebView 的
input region 尺寸协商失败，整窗不响应，仅 size_allocate 可恢复）。用户症状=模式 B。
托盘可用 → GTK 主循环存活，非主线程死锁。详见 research/root-cause.md。

## 关键文件/落点
- `src-tauri/src/main.rs` — 第一层：`run()` 前 Linux 设两个 WebKit 环境变量。
- `src-tauri/src/linux_fix.rs` —（新增）第二层 nudge 模块，从 cc-switch 移植。
- `src-tauri/src/lib.rs` — 声明 `mod linux_fix`（cfg linux）；single_instance 回调接线；
  注册命令 `notify_window_shown`。
- `src-tauri/src/modules/tray.rs` — `show_main()` 接线 nudge。
- `src-tauri/src/commands/window.rs` — 新增命令 `notify_window_shown`（非 Linux no-op）。
- `src/lib/boot.ts` — `revealMainWindow()` 在 `setFocus()` 后 invoke `notify_window_shown`。

## 任务拆解
- 2035.1 main.rs：Linux 下设置 `WEBKIT_DISABLE_DMABUF_RENDERER=1` 与
  `WEBKIT_DISABLE_COMPOSITING_MODE=1`（仅当未显式设置）。
- 2035.2 linux_fix.rs：移植 `nudge_main_window`，泛型化 `<R: Runtime>`，
  `log::` → `tracing::`，保留 200/100/500ms 时序与尺寸对账回读。
- 2035.3 lib.rs：`#[cfg(target_os="linux")] mod linux_fix;`；single_instance 回调
  `set_focus()` 后追加 `nudge_main_window(w.clone())`（cfg linux）；invoke_handler
  注册 `commands::window::notify_window_shown`。
- 2035.4 tray.rs：`show_main()` 在 `set_focus()` 后追加 nudge（cfg linux）。
- 2035.5 commands/window.rs：新增命令 `notify_window_shown`，Linux 取 main 窗口调 nudge，
  非 Linux `let _ = app;`。
- 2035.6 boot.ts：`setFocus()` 后 `await invoke("notify_window_shown").catch(()=>{})`。
- 2035.7 验证：tsc + cargo check（非 Linux 分支）；声明 Linux 实测移交用户。

## 数据契约
新增 Tauri 命令（无业务参数/返回）：
```
notify_window_shown() -> ()   // 前端首屏 show() 后调用；Linux 触发窗口重激活，其他平台 no-op
```

## 验收标准
见 prd.md Acceptance Criteria。核心：Ubuntu 22.04 三条显示路径均可点击；Win/macOS 无回归；
静态检查通过。

## 测试点
- tsc 通过（boot.ts 的 invoke 导入与调用类型正确）。
- cargo check 通过：`notify_window_shown` 命令签名在 Windows 下编译；invoke_handler 注册不报错。
- 人工复核 linux_fix.rs 泛型签名、Send/'static、方法调用与 cc-switch 一致。
- Linux 实测（用户）：正常启动/单例/托盘三路径点击恢复。

## 提交策略
1. docs：task-plan 文档（prd/feature/research/progress）。
2. fix(desktop)：main.rs WebKit 环境变量（2035.1）。
3. fix(desktop)：linux_fix.rs + lib.rs + tray.rs + commands/window.rs 接线（2035.2-2035.5）。
4. fix(desktop)：boot.ts 前端触发（2035.6）。
