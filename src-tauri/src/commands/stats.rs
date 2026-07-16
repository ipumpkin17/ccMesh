use tauri::State;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::stats::{
    EndpointQuality, EndpointQualityBlock, RequestLogPage, StatsHistoryPage, StatsOverview,
};
use crate::modules::stats::aggregator;
use crate::modules::stats::aggregator::EndpointQualitySnapshot;
use crate::modules::storage::{endpoint_repo, request_logs_repo, stats_repo};
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

/// 每端点本次代理运行期间的上游尝试状态与摘要，不触发主动连通性检查。
#[tauri::command]
pub fn get_endpoint_quality(
    state: State<AppState>,
    bucket_count: Option<i64>,
) -> AppResult<Vec<EndpointQuality>> {
    let conn = state.db_pool.get()?;
    let endpoints = endpoint_repo::list_all(&conn)?;
    let mut quality_by_endpoint = state.stats.endpoint_quality();
    let started_at_ms = state.stats.endpoint_quality_started_at();
    let now_ms = chrono::Utc::now().timestamp_millis();
    let bucket_count = bucket_count.unwrap_or(24).clamp(8, 64) as usize;

    Ok(endpoints
        .into_iter()
        .map(|endpoint| {
            let endpoint_id = endpoint.uid;
            let snapshot = quality_by_endpoint.remove(&endpoint_id);
            build_endpoint_quality(
                endpoint_id,
                endpoint.name,
                snapshot,
                started_at_ms,
                now_ms,
                bucket_count,
            )
        })
        .collect())
}

fn build_endpoint_quality(
    endpoint_id: String,
    endpoint_name: String,
    snapshot: Option<EndpointQualitySnapshot>,
    started_at_ms: Option<i64>,
    now_ms: i64,
    bucket_count: usize,
) -> EndpointQuality {
    let window_start_ms = now_ms - aggregator::ENDPOINT_QUALITY_WINDOW_MS;
    let bucket_ms = ((now_ms - window_start_ms) / bucket_count as i64).max(1);
    let mut blocks = (0..bucket_count)
        .map(|index| EndpointQualityBlock {
            start_ms: window_start_ms + index as i64 * bucket_ms,
            ..EndpointQualityBlock::default()
        })
        .collect::<Vec<_>>();
    let snapshot = snapshot.unwrap_or(EndpointQualitySnapshot {
        total: 0,
        success_count: 0,
        success_rate: None,
        avg_latency_ms: None,
        attempts: Vec::new(),
    });

    for attempt in snapshot.attempts {
        if attempt.ts < window_start_ms || attempt.ts > now_ms {
            continue;
        }
        let index = ((attempt.ts - window_start_ms) / bucket_ms)
            .min(bucket_count.saturating_sub(1) as i64) as usize;
        let block = &mut blocks[index];
        block.total += 1;
        if attempt.success {
            block.success_count += 1;
        } else if attempt.throttled {
            block.throttled_count += 1;
        } else {
            block.failed_count += 1;
        }
    }

    EndpointQuality {
        endpoint_id,
        endpoint_name,
        started_at_ms,
        window_start_ms,
        window_end_ms: now_ms,
        bucket_ms,
        total: snapshot.total,
        success_count: snapshot.success_count,
        failure_count: snapshot.total - snapshot.success_count,
        success_rate: snapshot.success_rate,
        avg_latency_ms: snapshot.avg_latency_ms,
        blocks,
    }
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
