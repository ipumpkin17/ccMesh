//! Linux 专用主窗口恢复补丁。
//!
//! Tauri 2.x 在部分 Linux 发行版（Wayland / 某些 WebKitGTK 版本）上启动后
//! UI 无法响应点击，存在两种失效模式：
//!
//! - **A**（Tauri #10746 / wry #637）：`show()` 后 webview 未获 keyboard focus，
//!   首次点击被 X11/Wayland 当作 click-to-activate 而非传给 webview。
//! - **B**：GTK surface 与 WebKitWebView 的 input region 尺寸协商在
//!   `visible:false` → `show()` 路径上失败，需重新 `size_allocate` 才能恢复。
//!
//! [`nudge_main_window`] 通过「set_focus + ±1px 伪 resize」模拟用户手动最大化再
//! 还原的 workaround。所有"让主窗口出现"的路径（启动、single_instance 回调、
//! 托盘 show_main）都应在 `set_focus()` 后追加调用。

use std::time::Duration;

use tauri::{PhysicalSize, Runtime, WebviewWindow};

/// 等 GTK 主循环处理完 webview realize。200ms 为社区经验值。
const REALIZE_WAIT: Duration = Duration::from_millis(200);

/// 两步伪 resize 的间隔，确保 GTK 先处理第一次 `size_allocate`。Tao 在 Linux
/// 上的尺寸 API 异步（`gtk_window_resize` → 合成器 configure），太短会被
/// 合成器 coalesce 成一次。
const RESIZE_GAP: Duration = Duration::from_millis(100);

/// 尺寸对账回读前的等待，确保合成器处理完 resize 队列。
const RECONCILE_WAIT: Duration = Duration::from_millis(500);

/// 对主窗口执行 Linux 专用的「focus + surface 重激活」序列。
///
/// fire-and-forget：内部 spawn 异步任务，~800ms 后完成，不阻塞 UI。
pub(crate) fn nudge_main_window<R: Runtime>(window: WebviewWindow<R>) {
    // webview 可能还未 realize，通常无效但成本低，顺手做掉。
    let _ = window.set_focus();

    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(REALIZE_WAIT).await;

        // realize 完成后这一次会生效，消除失效模式 A。
        let _ = window.set_focus();

        // ±1px 伪 resize 触发 GTK size-allocate → 重新 attach input surface，
        // 消除失效模式 B。PhysicalSize 避免跨 DPI 漂移；saturating_add 防溢出。
        match window.inner_size() {
            Ok(original) => {
                let bumped = PhysicalSize::new(original.width.saturating_add(1), original.height);
                let _ = window.set_size(bumped);
                tokio::time::sleep(RESIZE_GAP).await;
                let _ = window.set_size(original);
                tracing::info!("Linux: 已对主窗口执行 focus + surface 重激活");

                // Tao 的 set_size 只入队，合成器可能 coalesce 第二次请求，导致窗口
                // 停在 width+1。回读实际尺寸，drift 时补一次。
                //
                // ponytail: tiling Wayland 合成器（sway/river/hyprland）会忽略
                // set_size，drift 永远为 0、失效模式 B 实际未被修复；升级路径是
                // 用户侧设 GDK_BACKEND=x11 绕过。
                tokio::time::sleep(RECONCILE_WAIT).await;
                match window.inner_size() {
                    Ok(after) => {
                        if after.width != original.width || after.height != original.height {
                            tracing::info!(
                                "Linux nudge 尺寸 drift: expected={}x{}, got={}x{}，已补偿",
                                original.width,
                                original.height,
                                after.width,
                                after.height
                            );
                            let _ = window.set_size(original);
                            // 补偿后仍不一致则告警，窗口会停在非预期尺寸（通常 +1px）。
                            if let Ok(final_size) = window.inner_size() {
                                if final_size.width != original.width
                                    || final_size.height != original.height
                                {
                                    tracing::warn!(
                                        "Linux nudge 尺寸 drift 补偿后仍不一致: expected={}x{}, got={}x{}",
                                        original.width, original.height,
                                        final_size.width, final_size.height
                                    );
                                }
                            }
                        }
                    }
                    Err(e) => tracing::warn!("Linux nudge: 对账回读 inner_size 失败: {e}"),
                }
            }
            Err(e) => tracing::warn!("Linux nudge: 读取 inner_size 失败，跳过伪 resize: {e}"),
        }
    });
}
