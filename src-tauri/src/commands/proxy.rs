use tauri::{AppHandle, Emitter, State};

use crate::error::{AppError, AppResult};
use crate::models::config::AppConfig;
use crate::models::proxy::ProxyStatus;
use crate::modules::proxy::server::start_proxy as start_server;
use crate::modules::storage::{config_repo, endpoint_repo};
use crate::state::AppState;

pub(crate) const PROXY_STATUS_EVENT: &str = "proxy-status-changed";

/// 读取代理监听端口：唯一真相源为 app_config 键 `port`（与设置页/get_config 一致）。
/// 历史上这里误读不存在的 `proxy_port` 键，导致启停始终回落默认端口。
fn read_port(state: &AppState) -> u16 {
    state
        .db_pool
        .get()
        .ok()
        .and_then(|conn| config_repo::get_config(&conn).ok())
        .map(|cfg| cfg.port)
        .unwrap_or_else(|| AppConfig::default().port)
}

fn enabled_count(state: &AppState) -> usize {
    state
        .db_pool
        .get()
        .ok()
        .and_then(|c| endpoint_repo::list_enabled(&c).ok())
        .map(|v| v.len())
        .unwrap_or(0)
}

pub(crate) fn build_status(state: &AppState) -> ProxyStatus {
    let guard = state.proxy.lock().unwrap();
    match guard.as_ref() {
        Some(h) => {
            let current = h.current_endpoint();
            ProxyStatus {
                running: true,
                port: h.port,
                current_endpoint_id: current.as_ref().map(|endpoint| endpoint.id.clone()),
                current_endpoint: current.map(|endpoint| endpoint.name),
                enabled_endpoint_count: enabled_count(state),
            }
        }
        None => ProxyStatus {
            running: false,
            port: read_port(state),
            current_endpoint_id: None,
            current_endpoint: None,
            enabled_endpoint_count: enabled_count(state),
        },
    }
}

fn emit_status(app: &AppHandle, status: &ProxyStatus) {
    let _ = app.emit(PROXY_STATUS_EVENT, status);
}

#[tauri::command]
pub async fn start_proxy(app: AppHandle, state: State<'_, AppState>) -> AppResult<ProxyStatus> {
    {
        // 已运行则直接返回当前状态（不重复绑定端口）
        if state.proxy.lock().unwrap().is_some() {
            return Ok(build_status(&state));
        }
    }
    let port = read_port(&state);
    let pool = state.db_pool.clone();
    let handle = start_server(pool, port, state.stats.clone()).await?;
    {
        *state.proxy.lock().unwrap() = Some(handle);
    }
    let status = build_status(&state);
    emit_status(&app, &status);
    Ok(status)
}

/// 更新/退出前停止代理，不推送状态事件。
pub(crate) async fn stop_proxy_for_update(state: &AppState) {
    let handle = { state.proxy.lock().unwrap().take() };
    if let Some(h) = handle {
        h.stop().await;
        tracing::debug!("更新前已停止代理");
    }
}

#[tauri::command]
pub async fn stop_proxy(app: AppHandle, state: State<'_, AppState>) -> AppResult<ProxyStatus> {
    stop_proxy_for_update(&state).await;
    let status = build_status(&state);
    emit_status(&app, &status);
    Ok(status)
}

#[tauri::command]
pub fn get_proxy_status(state: State<'_, AppState>) -> AppResult<ProxyStatus> {
    Ok(build_status(&state))
}

#[tauri::command]
pub fn switch_endpoint(
    app: AppHandle,
    state: State<'_, AppState>,
    endpoint_id: String,
) -> AppResult<ProxyStatus> {
    {
        let guard = state.proxy.lock().unwrap();
        let h = guard
            .as_ref()
            .ok_or_else(|| AppError::Proxy("代理未运行".to_string()))?;
        h.switch_endpoint(&endpoint_id)?;
    }
    let status = build_status(&state);
    emit_status(&app, &status);
    Ok(status)
}
