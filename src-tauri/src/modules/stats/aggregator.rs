use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter};

use crate::error::AppResult;
use crate::models::stats::{EndpointQualityAttempt, RequestLog, StatsOverview, TrendCompare};
use crate::modules::stats::periods;
use crate::modules::storage::{db::DbPool, request_logs_repo, stats_repo};
use crate::modules::usage::TokenUsage;

const STATS_EVENT: &str = "stats-updated";
const REQUEST_LOG_EVENT: &str = "request-logged";
const ENDPOINT_HEALTH_EVENT: &str = "endpoint-health-changed";
const ENDPOINT_QUALITY_EVENT: &str = "endpoint-quality-updated";
const FLUSH_INTERVAL: Duration = Duration::from_secs(2);
/// 请求明细保留窗口：90 天。
pub const RETENTION_DAYS: i64 = 90;
const RETENTION_MS: i64 = RETENTION_DAYS * 24 * 60 * 60 * 1000;

/// ponytail: 当前产品只要求固定 90 天；未来配置化时从这里改为读取 app_config。
pub fn retention_days() -> i64 {
    RETENTION_DAYS
}

pub fn retention_cutoff_ms() -> i64 {
    chrono::Utc::now().timestamp_millis() - RETENTION_MS
}
/// 明细清理最小间隔：每小时至多一次。
const PRUNE_INTERVAL: Duration = Duration::from_secs(3600);

#[derive(Default, Clone, Copy)]
struct Delta {
    requests: i64,
    errors: i64,
    input_tokens: i64,
    output_tokens: i64,
    cache_creation_tokens: i64,
    cache_read_tokens: i64,
}

/// 端点质量仅保留并展示本次代理运行内最近 1 小时，24 格时每格对应 2 分 30 秒。
pub const ENDPOINT_QUALITY_WINDOW_MS: i64 = 60 * 60 * 1000;

#[derive(Default)]
struct EndpointQualityAccumulator {
    total: i64,
    success_count: i64,
    latency_total_ms: i64,
    latency_count: i64,
    attempts: VecDeque<EndpointQualityAttempt>,
}

/// 本次运行的端点质量原始快照。只在后端内部使用，避免把 1 小时原始尝试推送到前端。
pub struct EndpointQualitySnapshot {
    pub total: i64,
    pub success_count: i64,
    pub success_rate: Option<f64>,
    pub avg_latency_ms: Option<i64>,
    pub attempts: Vec<EndpointQualityAttempt>,
}

impl EndpointQualityAccumulator {
    fn record(
        &mut self,
        now_ms: i64,
        status_code: Option<i64>,
        success: bool,
        latency_ms: Option<i64>,
    ) {
        self.total += 1;
        if success {
            self.success_count += 1;
        }
        if let Some(latency) = latency_ms {
            self.latency_total_ms += latency;
            self.latency_count += 1;
        }
        self.attempts.push_back(EndpointQualityAttempt {
            ts: now_ms,
            success,
            throttled: !success && status_code == Some(429),
        });
        self.prune_attempts(now_ms);
    }

    fn prune_attempts(&mut self, now_ms: i64) {
        let visible_cutoff = now_ms - ENDPOINT_QUALITY_WINDOW_MS;
        while self
            .attempts
            .front()
            .map(|attempt| attempt.ts < visible_cutoff)
            .unwrap_or(false)
        {
            self.attempts.pop_front();
        }
    }

    fn snapshot(&mut self, now_ms: i64) -> EndpointQualitySnapshot {
        self.prune_attempts(now_ms);
        EndpointQualitySnapshot {
            total: self.total,
            success_count: self.success_count,
            success_rate: if self.total == 0 {
                None
            } else {
                Some(self.success_count as f64 / self.total as f64)
            },
            avg_latency_ms: if self.latency_count == 0 {
                None
            } else {
                Some(self.latency_total_ms / self.latency_count)
            },
            attempts: self.attempts.iter().cloned().collect(),
        }
    }
}

/// 一次请求结果的完整记录（由代理转发汇聚点构造）。
pub struct RequestRecord {
    pub endpoint_id: String,
    pub endpoint_name: String,
    pub model: Option<String>,
    pub inbound_format: String,
    /// 端点 transformer 快照（claude/openai/codex 等），用于前端按端点类型显示品牌图标。
    pub transformer: Option<String>,
    pub upstream_url: String,
    /// 真实入站路由路径（`uri.path()`）。
    pub inbound_path: String,
    /// 真实出站路由路径（实际转发上游的路径）。失败兜底为空串。
    pub upstream_path: String,
    pub status_code: Option<i64>,
    pub is_error: bool,
    pub usage: TokenUsage,
    pub duration_ms: Option<i64>,
    pub first_byte_ms: Option<i64>,
    pub actual_model: Option<String>,
    pub error_body: Option<String>,
}

/// 单次发往上游的尝试结果。与 RequestRecord 分开，重试不会放大用户请求统计。
pub struct EndpointQualityRecord {
    pub endpoint_id: String,
    pub status_code: Option<i64>,
    pub success: bool,
    pub latency_ms: Option<i64>,
}

/// 统计聚合器：内存累加 + 2 秒防抖批量落库 + 零延迟事件推送。
///
/// `record` 累加内存（按日聚合 + 明细缓冲）并立即发 `stats-updated` / `request-logged` 事件；
/// DB 写入由 2s 刷新循环或 `overview`（flush-then-read）触发，避免每请求都写库。
pub struct StatsAggregator {
    db_pool: DbPool,
    app_handle: AppHandle,
    device_id: String,
    pending: Mutex<HashMap<(String, String), (String, Delta)>>,
    pending_logs: Mutex<Vec<RequestLog>>,
    endpoint_quality: Mutex<HashMap<String, EndpointQualityAccumulator>>,
    endpoint_quality_started_at: Mutex<Option<i64>>,
    last_prune: Mutex<Option<Instant>>,
}

impl StatsAggregator {
    pub fn new(db_pool: DbPool, app_handle: AppHandle, device_id: String) -> Arc<Self> {
        let agg = Arc::new(Self {
            db_pool,
            app_handle,
            device_id,
            pending: Mutex::new(HashMap::new()),
            pending_logs: Mutex::new(Vec::new()),
            endpoint_quality: Mutex::new(HashMap::new()),
            endpoint_quality_started_at: Mutex::new(None),
            last_prune: Mutex::new(None),
        });
        // 2 秒防抖刷新循环；聚合器被释放后自动退出
        let weak = Arc::downgrade(&agg);
        tauri::async_runtime::spawn(async move {
            let mut tick = tokio::time::interval(FLUSH_INTERVAL);
            tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            loop {
                tick.tick().await;
                match weak.upgrade() {
                    Some(a) => {
                        if let Err(e) = a.flush() {
                            tracing::warn!("统计刷新失败: {e}");
                        }
                    }
                    None => break,
                }
            }
        });
        agg
    }

    /// 端点健康/熔断状态变化事件（前端收到后重新拉取 `get_endpoint_health`）。
    pub fn emit_health_changed(&self) {
        let _ = self.app_handle.emit(ENDPOINT_HEALTH_EVENT, ());
    }

    /// 记录每次真实上游尝试。仅供端点质量展示，不参与用户请求/Token 聚合。
    pub fn record_endpoint_attempt(&self, rec: EndpointQualityRecord) {
        let now_ms = chrono::Utc::now().timestamp_millis();
        self.endpoint_quality
            .lock()
            .unwrap()
            .entry(rec.endpoint_id)
            .or_default()
            .record(now_ms, rec.status_code, rec.success, rec.latency_ms);
        let _ = self.app_handle.emit(ENDPOINT_QUALITY_EVENT, ());
    }

    /// 代理每次成功启动时重置本轮运行态，停止后数据不落库。
    pub fn reset_endpoint_quality(&self) {
        self.endpoint_quality.lock().unwrap().clear();
        *self.endpoint_quality_started_at.lock().unwrap() =
            Some(chrono::Utc::now().timestamp_millis());
        let _ = self.app_handle.emit(ENDPOINT_QUALITY_EVENT, ());
    }

    /// 返回本次代理运行期间的端点质量原始快照，仅供命令层按显示宽度分桶。
    pub fn endpoint_quality(&self) -> HashMap<String, EndpointQualitySnapshot> {
        let now_ms = chrono::Utc::now().timestamp_millis();
        self.endpoint_quality
            .lock()
            .unwrap()
            .iter_mut()
            .map(|(endpoint_id, quality)| (endpoint_id.clone(), quality.snapshot(now_ms)))
            .collect()
    }

    pub fn endpoint_quality_started_at(&self) -> Option<i64> {
        *self.endpoint_quality_started_at.lock().unwrap()
    }

    /// 记录一次请求结果（累加内存 + 缓冲明细 + 立即发事件）。
    pub fn record(&self, rec: RequestRecord) {
        let date = periods::today();
        let ts = chrono::Utc::now().timestamp_millis();
        {
            let mut p = self.pending.lock().unwrap();
            let entry = p
                .entry((rec.endpoint_id.clone(), date))
                .or_insert_with(|| (rec.endpoint_name.clone(), Delta::default()));
            // 名称只作为最新展示快照；聚合身份始终使用 endpoint_id。
            entry.0 = rec.endpoint_name.clone();
            let d = &mut entry.1;
            d.requests += 1;
            if rec.is_error {
                d.errors += 1;
            }
            d.input_tokens += rec.usage.input;
            d.output_tokens += rec.usage.output;
            d.cache_creation_tokens += rec.usage.cache_creation;
            d.cache_read_tokens += rec.usage.cache_read;
        }
        let log = RequestLog {
            id: 0,
            ts,
            endpoint_id: rec.endpoint_id,
            endpoint_name: rec.endpoint_name,
            inbound_format: rec.inbound_format,
            transformer: rec.transformer,
            upstream_url: rec.upstream_url,
            inbound_path: rec.inbound_path,
            upstream_path: rec.upstream_path,
            status_code: rec.status_code,
            is_error: rec.is_error,
            input_tokens: rec.usage.input,
            output_tokens: rec.usage.output,
            cache_creation_tokens: rec.usage.cache_creation,
            cache_read_tokens: rec.usage.cache_read,
            model: rec.model,
            duration_ms: rec.duration_ms,
            first_byte_ms: rec.first_byte_ms,
            actual_model: rec.actual_model,
            error_body: rec.error_body,
        };
        {
            let mut pl = self.pending_logs.lock().unwrap();
            pl.push(log.clone());
        }
        let _ = self.app_handle.emit(STATS_EVENT, ());
        let _ = self.app_handle.emit(REQUEST_LOG_EVENT, &log);
    }

    fn should_prune(&self) -> bool {
        match *self.last_prune.lock().unwrap() {
            None => true,
            Some(t) => t.elapsed() >= PRUNE_INTERVAL,
        }
    }

    fn mark_pruned(&self) {
        *self.last_prune.lock().unwrap() = Some(Instant::now());
    }

    /// 将内存增量批量写入 DB（幂等：无增量且无需清理时直接返回）。
    pub fn flush(&self) -> AppResult<()> {
        let drained: Vec<((String, String), (String, Delta))> = {
            let mut p = self.pending.lock().unwrap();
            p.drain().collect()
        };
        let drained_logs: Vec<RequestLog> = {
            let mut pl = self.pending_logs.lock().unwrap();
            pl.drain(..).collect()
        };
        let prune = self.should_prune();
        if drained.is_empty() && drained_logs.is_empty() && !prune {
            return Ok(());
        }
        let mut conn = self.db_pool.get()?;
        for ((endpoint_id, date), (endpoint_name, d)) in drained {
            stats_repo::upsert(
                &conn,
                &endpoint_id,
                &endpoint_name,
                &date,
                &self.device_id,
                d.requests,
                d.errors,
                d.input_tokens,
                d.output_tokens,
                d.cache_creation_tokens,
                d.cache_read_tokens,
            )?;
        }
        if !drained_logs.is_empty() {
            request_logs_repo::insert_batch(&mut conn, &drained_logs, &self.device_id)?;
        }
        if prune {
            let cutoff = retention_cutoff_ms();
            if let Err(e) = request_logs_repo::prune_older_than(&conn, cutoff) {
                tracing::warn!("请求明细清理失败: {e}");
            }
            self.mark_pruned();
        }
        Ok(())
    }

    /// 四周期总览 + 趋势（先 flush 保证数据完整，再查 DB）。
    pub fn overview(&self) -> AppResult<StatsOverview> {
        self.flush()?;
        let conn = self.db_pool.get()?;
        let t = periods::today_range();
        let y = periods::yesterday_range();
        let w = periods::this_week_range();
        let m = periods::this_month_range();
        let today = stats_repo::period_stats(&conn, &t.start, &t.end)?;
        let yesterday = stats_repo::period_stats(&conn, &y.start, &y.end)?;
        let this_week = stats_repo::period_stats(&conn, &w.start, &w.end)?;
        let this_month = stats_repo::period_stats(&conn, &m.start, &m.end)?;
        let trend = TrendCompare {
            requests_pct: periods::calculate_trend(today.requests, yesterday.requests),
            input_tokens_pct: periods::calculate_trend(today.input_tokens, yesterday.input_tokens),
            output_tokens_pct: periods::calculate_trend(
                today.output_tokens,
                yesterday.output_tokens,
            ),
        };
        Ok(StatsOverview {
            today,
            yesterday,
            this_week,
            this_month,
            trend,
        })
    }
}
