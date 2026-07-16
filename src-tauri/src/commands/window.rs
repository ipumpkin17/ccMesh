use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, Runtime, State, WebviewWindow};

use crate::error::AppResult;
use crate::modules::storage::config_repo;
use crate::modules::tray;
use crate::state::AppState;

const MAIN_WINDOW_STATE_KEY: &str = "mainWindowState";
const MIN_WINDOW_WIDTH: u32 = 940;
const MIN_WINDOW_HEIGHT: u32 = 600;
const MAX_WINDOW_DIMENSION: u32 = 10_000;
const MIN_VISIBLE_WINDOW_PIXELS: i64 = 100;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct MainWindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}

impl MainWindowState {
    fn is_valid_size(&self) -> bool {
        (MIN_WINDOW_WIDTH..=MAX_WINDOW_DIMENSION).contains(&self.width)
            && (MIN_WINDOW_HEIGHT..=MAX_WINDOW_DIMENSION).contains(&self.height)
    }
}

fn intersects_available_monitor<R: Runtime>(
    window: &WebviewWindow<R>,
    state: &MainWindowState,
) -> bool {
    let right = i64::from(state.x) + i64::from(state.width);
    let bottom = i64::from(state.y) + i64::from(state.height);

    window
        .available_monitors()
        .map(|monitors| {
            monitors.iter().any(|monitor| {
                let position = monitor.position();
                let size = monitor.size();
                let monitor_right = i64::from(position.x) + i64::from(size.width);
                let monitor_bottom = i64::from(position.y) + i64::from(size.height);
                let visible_width =
                    right.min(monitor_right) - i64::from(state.x).max(i64::from(position.x));
                let visible_height =
                    bottom.min(monitor_bottom) - i64::from(state.y).max(i64::from(position.y));
                visible_width >= MIN_VISIBLE_WINDOW_PIXELS
                    && visible_height >= MIN_VISIBLE_WINDOW_PIXELS
            })
        })
        // 显示器查询失败时保守保留用户位置，避免无故覆盖已有偏好。
        .unwrap_or(true)
}

/// 在主窗口首次展示前恢复上次正常退出时保存的位置、尺寸和最大化状态。
pub fn restore_main_window<R: Runtime>(app: &AppHandle<R>, conn: &Connection) {
    let state = config_repo::get_value(conn, MAIN_WINDOW_STATE_KEY)
        .ok()
        .flatten()
        .and_then(|value| serde_json::from_str::<MainWindowState>(&value).ok());
    let Some(state) = state.filter(MainWindowState::is_valid_size) else {
        return;
    };
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if !intersects_available_monitor(&window, &state) {
        tracing::info!("上次窗口位置不在当前显示器范围内，使用默认位置");
        return;
    }

    if let Err(error) = window.set_size(PhysicalSize::new(state.width, state.height)) {
        tracing::warn!("恢复窗口尺寸失败: {error}");
        return;
    }
    if let Err(error) = window.set_position(PhysicalPosition::new(state.x, state.y)) {
        tracing::warn!("恢复窗口位置失败: {error}");
        return;
    }
    if state.maximized {
        if let Err(error) = window.maximize() {
            tracing::warn!("恢复窗口最大化状态失败: {error}");
        }
    }
}

/// 在应用退出前保存主窗口状态。保存失败不阻断退出流程。
pub fn persist_main_window<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let (Ok(position), Ok(size), Ok(maximized)) = (
        window.outer_position(),
        window.outer_size(),
        window.is_maximized(),
    ) else {
        tracing::warn!("读取窗口状态失败，跳过保存");
        return;
    };
    let state = MainWindowState {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        maximized,
    };
    let Ok(value) = serde_json::to_string(&state) else {
        return;
    };
    let state = app.state::<AppState>();
    match state.db_pool.get() {
        Ok(conn) => {
            if let Err(error) = config_repo::set_value(&conn, MAIN_WINDOW_STATE_KEY, &value) {
                tracing::warn!("保存窗口状态失败: {error}");
            }
        }
        Err(error) => tracing::warn!("获取数据库连接以保存窗口状态失败: {error}"),
    }
}

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
