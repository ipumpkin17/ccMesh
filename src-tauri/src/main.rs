// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Linux：在 WebKitGTK 初始化前设置环境变量，规避部分发行版/GPU 下的渲染问题。
    // 必须早于 tauri::Builder（即 run()）执行，否则 WebView 已初始化无效。
    // 参考 cc-switch；Tauri #9394。
    #[cfg(target_os = "linux")]
    {
        // DMA-BUF 渲染器在某些环境（如 Nvidia、虚拟机）导致白屏/黑屏。
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
        // 注意：不设置 WEBKIT_DISABLE_COMPOSITING_MODE。
        // 该变量虽可规避 `visible:false → show()` 路径下的整窗无响应，
        // 但会导致 WebKit 合成层失效，使所有 React Portal（Radix UI Dialog/Modal）
        // 的 overlay 层无法正确接收指针事件 → 弹窗按钮点击全部无响应（卡死）。
        // 整窗无响应问题改由 linux_fix::nudge_main_window（±1px 伪 resize）修复，
        // 该方案不影响合成模式，两个问题均得以解决。
    }

    ccmesh_lib::run()
}
