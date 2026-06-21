use tauri::{AppHandle, Manager, State};

use crate::error::AppResult;
use crate::modules::storage::config_repo;
use crate::modules::tray;
use crate::state::AppState;

/// 设置语言：持久化到配置并重建托盘文案。
#[tauri::command]
pub fn set_language(app: AppHandle, state: State<AppState>, lang: String) -> AppResult<()> {
    {
        let conn = state.db_pool.get()?;
        config_repo::set_value(&conn, "language", &lang)?;
    }
    let _ = tray::rebuild_tray(&app);
    Ok(())
}

/// 关闭行为（ask 模式前端选择后调用）：minimize 隐藏到托盘，否则退出。
#[tauri::command]
pub fn apply_close_action(app: AppHandle, action: String) -> AppResult<()> {
    match action.as_str() {
        "minimize" => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.hide();
            }
        }
        _ => app.exit(0),
    }
    Ok(())
}

/// 隐藏主窗口到托盘。
#[tauri::command]
pub fn hide_to_tray(app: AppHandle) -> AppResult<()> {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
    Ok(())
}

/// 前端首屏 show() 后调用：在 Linux 上执行窗口交互重激活（focus + 无视觉伪 resize），
/// 修复 WebKitGTK `visible:false → show()` 路径下整窗点击无响应。Windows/macOS 为 no-op。
#[tauri::command]
pub fn notify_window_shown(app: AppHandle) {
    #[cfg(target_os = "linux")]
    {
        if let Some(w) = app.get_webview_window("main") {
            crate::linux_fix::nudge_main_window(w);
        }
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = app;
    }
}
