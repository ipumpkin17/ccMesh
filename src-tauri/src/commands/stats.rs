use tauri::State;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::stats::{RequestLogPage, StatsHistoryPage, StatsOverview};
use crate::modules::stats::aggregator;
use crate::modules::storage::{request_logs_repo, stats_repo};
use crate::state::AppState;

/// 四周期统计总览 + 趋势（先 flush 内存增量再聚合）。
#[tauri::command]
pub fn get_stats(state: State<AppState>) -> AppResult<StatsOverview> {
    state.stats.overview()
}

/// 请求明细分页查询（时间段[毫秒] + 可选端点过滤，按时间倒序）。
#[tauri::command]
pub fn get_request_logs(
    state: State<AppState>,
    start_ms: Option<i64>,
    end_ms: Option<i64>,
    endpoint: Option<String>,
    page: i64,
    page_size: i64,
) -> AppResult<RequestLogPage> {
    state.stats.flush()?;
    let conn = state.db_pool.get()?;
    let limit = page_size.max(1);
    let offset = (page.max(1) - 1) * limit;
    let (items, total) =
        request_logs_repo::query_page(&conn, start_ms, end_ms, endpoint.as_deref(), limit, offset)?;
    Ok(RequestLogPage { items, total })
}

/// 请求明细保留天数。前端展示用，避免 UI 文案与后端清理策略漂移。
#[tauri::command]
pub fn get_retention_days() -> i64 {
    aggregator::retention_days()
}

/// 立即清理超过保留期限的请求明细，返回删除行数。
#[tauri::command]
pub fn prune_request_logs(state: State<AppState>) -> AppResult<usize> {
    state.stats.flush()?;
    let conn = state.db_pool.get()?;
    request_logs_repo::prune_older_than(&conn, aggregator::retention_cutoff_ms())
}

/// 清空全部请求明细，返回删除行数；不影响 daily_stats 聚合统计。
#[tauri::command]
pub fn clear_request_logs(state: State<AppState>) -> AppResult<usize> {
    state.stats.flush()?;
    let conn = state.db_pool.get()?;
    request_logs_repo::clear_all(&conn)
}

/// 历史记录分页（跨全时间，按端点×日聚合行，date 倒序）。
#[tauri::command]
pub fn get_stats_history(
    state: State<AppState>,
    page: i64,
    page_size: i64,
) -> AppResult<StatsHistoryPage> {
    state.stats.flush()?;
    let conn = state.db_pool.get()?;
    let limit = page_size.max(1);
    let offset = (page.max(1) - 1) * limit;
    let (items, total) = stats_repo::history_page(&conn, limit, offset)?;
    Ok(StatsHistoryPage { items, total })
}

/// 删除单端点单日的历史记录，返回删除行数。
#[tauri::command]
pub fn delete_daily_stat(
    state: State<AppState>,
    endpoint_id: String,
    date: String,
) -> AppResult<usize> {
    let endpoint_id = endpoint_id.trim();
    let parsed = Uuid::parse_str(endpoint_id)
        .map_err(|_| AppError::InvalidArgument("端点 ID 无效".to_string()))?;
    if parsed.to_string() != endpoint_id {
        return Err(AppError::InvalidArgument(
            "端点 ID 必须使用规范 UUID".to_string(),
        ));
    }
    let conn = state.db_pool.get()?;
    stats_repo::delete_row(&conn, endpoint_id, &date)
}

/// 删除某一天全部端点的历史记录，返回删除行数。
#[tauri::command]
pub fn delete_stats_by_date(state: State<AppState>, date: String) -> AppResult<usize> {
    let conn = state.db_pool.get()?;
    stats_repo::delete_by_date(&conn, &date)
}
