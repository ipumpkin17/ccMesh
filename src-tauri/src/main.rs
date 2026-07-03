// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // 必须在 WebKitGTK 初始化（即 run()）前设环境变量，规避部分发行版/GPU 的渲染问题。
    // 参考 Tauri #9394。
    #[cfg(target_os = "linux")]
    {
        // DMA-BUF 渲染器在某些环境（如 Nvidia、虚拟机）导致白屏/黑屏。
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
        // 不设 WEBKIT_DISABLE_COMPOSITING_MODE：它虽能规避 visible:false → show() 的
        // 整窗无响应，但会令 WebKit 合成层失效，React Portal（Radix Dialog/Modal）的
        // overlay 收不到指针事件、弹窗按钮全卡死。改由 linux_fix::nudge_main_window
        // 的 ±1px 伪 resize 修复整窗无响应，不影响合成模式。
    }

    ccmesh_lib::run()
}
