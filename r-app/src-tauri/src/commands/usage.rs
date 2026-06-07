use tauri::State;

use crate::error::AppResult;
use crate::models::usage::{DailyUsage, ModelUsage, UsageSummary, UsageSyncResult};
use crate::modules::storage::usage_repo;
use crate::modules::usage_local;
use crate::state::AppState;

/// 触发一次本机用量增量同步（读取 ~/.claude 与 ~/.codex 会话日志）。
#[tauri::command]
pub fn sync_session_usage(state: State<AppState>) -> AppResult<UsageSyncResult> {
    let conn = state.db_pool.get()?;
    Ok(usage_local::sync_all(&conn))
}

/// 用量总览（可选日期段[YYYY-MM-DD] + app_type 过滤）。
#[tauri::command]
pub fn get_usage_summary(
    state: State<AppState>,
    start: Option<String>,
    end: Option<String>,
    app_type: Option<String>,
) -> AppResult<UsageSummary> {
    let conn = state.db_pool.get()?;
    usage_repo::summary(&conn, start.as_deref(), end.as_deref(), app_type.as_deref())
}

/// 按模型聚合用量。
#[tauri::command]
pub fn get_usage_by_model(
    state: State<AppState>,
    start: Option<String>,
    end: Option<String>,
    app_type: Option<String>,
) -> AppResult<Vec<ModelUsage>> {
    let conn = state.db_pool.get()?;
    usage_repo::by_model(&conn, start.as_deref(), end.as_deref(), app_type.as_deref())
}

/// 按天聚合用量。
#[tauri::command]
pub fn get_usage_by_day(
    state: State<AppState>,
    start: Option<String>,
    end: Option<String>,
    app_type: Option<String>,
) -> AppResult<Vec<DailyUsage>> {
    let conn = state.db_pool.get()?;
    usage_repo::by_day(&conn, start.as_deref(), end.as_deref(), app_type.as_deref())
}
