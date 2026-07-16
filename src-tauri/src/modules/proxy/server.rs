use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::extract::{DefaultBodyLimit, State};
use axum::http::HeaderMap;
use axum::routing::{get, post};
use axum::{
    body::Bytes,
    response::{IntoResponse, Response},
    Json, Router,
};
use serde_json::json;
use tokio::sync::oneshot;
use tokio::task::JoinHandle;

use crate::error::{AppError, AppResult};
use crate::models::endpoint::Endpoint;
use crate::modules::models_cache::model_info;
use crate::modules::proxy::circuit_breaker::{BreakerRegistry, CircuitBreakerConfig};
use crate::modules::proxy::forward::{
    handle_proxy, select_routable_endpoints, ActiveRequests, InboundProtocol, ProxyState,
};
use crate::modules::proxy::rotation::Rotation;
use crate::modules::stats::aggregator::StatsAggregator;
use crate::modules::storage::{config_repo, db::DbPool, endpoint_repo};
use crate::modules::transform::thinking_rectifier::RectifierConfig;

fn set_rotation_for_endpoint(
    rotation: &Rotation,
    enabled: &[Endpoint],
    endpoint_uid: &str,
) -> bool {
    let mut routable = false;
    for inbound in InboundProtocol::ALL {
        let (candidates, _) = select_routable_endpoints(enabled.to_vec(), inbound);
        if candidates
            .iter()
            .any(|candidate| candidate.uid == endpoint_uid)
        {
            rotation.set_endpoint(inbound.label(), endpoint_uid);
            routable = true;
        }
    }
    routable
}

/// 代理运行句柄，存于 `AppState.proxy`。持有关停信号、任务句柄与共享状态。
pub struct ProxyHandle {
    pub port: u16,
    shutdown: Option<oneshot::Sender<()>>,
    join: Option<JoinHandle<()>>,
    pub state: Arc<ProxyState>,
}

impl ProxyHandle {
    /// 优雅停止代理服务并释放端口。
    pub async fn stop(mut self) {
        if let Some(tx) = self.shutdown.take() {
            let _ = tx.send(());
        }
        if let Some(j) = self.join.take() {
            let _ = j.await;
        }
    }

    pub fn current_endpoint(&self) -> Option<crate::modules::proxy::forward::CurrentEndpoint> {
        self.state.current_endpoint()
    }

    /// 手动切换到指定稳定端点 ID：按兼容协议队列保存 ID、取消旧端点在途请求、置为当前。
    pub fn switch_endpoint(&self, endpoint_id: &str) -> AppResult<()> {
        let conn = self.state.db_pool.get()?;
        let enabled = endpoint_repo::list_enabled(&conn)?;
        let endpoint = enabled
            .iter()
            .find(|e| e.uid == endpoint_id.trim())
            .ok_or_else(|| AppError::NotFound(format!("端点 ID '{endpoint_id}' 不存在或未启用")))?;

        if !set_rotation_for_endpoint(&self.state.rotation, &enabled, &endpoint.uid) {
            return Err(AppError::InvalidArgument(format!(
                "端点 '{}' 不在当前有效队列中",
                endpoint.name
            )));
        }

        if let Some(old) = self.state.current_endpoint() {
            self.state.active.cancel(&old.id);
        }
        *self.state.current_endpoint.lock().unwrap() =
            Some(crate::modules::proxy::forward::CurrentEndpoint {
                id: endpoint.uid.clone(),
                name: endpoint.name.clone(),
            });
        Ok(())
    }
}

fn build_router(state: Arc<ProxyState>) -> Router {
    Router::new()
        .route("/health", get(health_route))
        .route("/stats", get(stats_route))
        .route("/v1/models", get(models_route))
        .route("/v1/messages/count_tokens", post(count_tokens_route))
        .fallback(handle_proxy)
        .layer(DefaultBodyLimit::disable())
        .with_state(state)
}

/// 在本地端口启动代理服务。返回运行句柄。
pub async fn start_proxy(
    db_pool: DbPool,
    port: u16,
    stats: Arc<StatsAggregator>,
) -> AppResult<ProxyHandle> {
    let client = reqwest::Client::builder()
        .pool_max_idle_per_host(10)
        .pool_idle_timeout(Duration::from_secs(90))
        .timeout(Duration::from_secs(300))
        .connect_timeout(Duration::from_secs(30))
        .no_proxy()
        .build()
        .map_err(|e| AppError::Proxy(format!("构建 HTTP 客户端失败: {e}")))?;

    // 读取代理地址与伪装 UA 配置
    let cfg = {
        let conn = db_pool.get()?;
        config_repo::get_config(&conn)?
    };
    let proxy_client = if cfg.proxy_url.trim().is_empty() {
        None
    } else {
        match reqwest::Proxy::all(cfg.proxy_url.trim()) {
            Ok(proxy) => reqwest::Client::builder()
                .pool_max_idle_per_host(10)
                .pool_idle_timeout(Duration::from_secs(90))
                .timeout(Duration::from_secs(300))
                .connect_timeout(Duration::from_secs(30))
                .proxy(proxy)
                .build()
                .ok(),
            Err(e) => {
                tracing::warn!("代理地址无效，回落直连: {e}");
                None
            }
        }
    };

    let state = Arc::new(ProxyState {
        db_pool,
        client,
        proxy_client,
        openai_ua: cfg.openai_ua,
        claude_cli_ua: cfg.claude_cli_ua,
        rotation: Rotation::new(),
        active: ActiveRequests::default(),
        stats,
        current_endpoint: Mutex::new(None),
        proxy_enabled: cfg.proxy_enabled,
        breakers: BreakerRegistry::new(CircuitBreakerConfig::default()),
        rectifier_config: RectifierConfig::default(),
    });

    let app = build_router(state.clone());

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| AppError::Proxy(format!("绑定端口 {port} 失败: {e}")))?;
    let actual_port = listener.local_addr().map(|a| a.port()).unwrap_or(port);

    // 端点质量仅表示本次代理运行态，确认成功绑定端口后再清空上一轮数据。
    state.stats.reset_endpoint_quality();

    let (tx, rx) = oneshot::channel::<()>();
    let join = tokio::spawn(async move {
        let server = axum::serve(listener, app).with_graceful_shutdown(async move {
            let _ = rx.await;
        });
        if let Err(e) = server.await {
            tracing::error!("代理服务退出: {e}");
        }
    });

    tracing::info!(port = actual_port, "代理服务启动");
    Ok(ProxyHandle {
        port: actual_port,
        shutdown: Some(tx),
        join: Some(join),
        state,
    })
}

async fn health_route() -> Response {
    Json(json!({ "status": "healthy" })).into_response()
}

async fn stats_route() -> Response {
    Json(json!({})).into_response()
}

/// `/v1/models`：按启用端点的配置态模型清单聚合（读库，不请求上游）。
/// 专用型端点（model 非空）公布锁定模型；聚合型端点展开 models 清单。
/// 按入站鉴权格式返回：带 x-api-key/anthropic-version → Anthropic 格式；否则 OpenAI 格式。
async fn models_route(State(st): State<Arc<ProxyState>>, headers: HeaderMap) -> Response {
    let entries: Vec<(String, String, String)> = match st.db_pool.get() {
        Ok(conn) => match endpoint_repo::list_enabled(&conn) {
            Ok(endpoints) => endpoints
                .iter()
                .flat_map(|ep| {
                    crate::modules::proxy::resolver::advertised_models(ep)
                        .into_iter()
                        .map(|m| (m, ep.uid.clone(), ep.name.clone()))
                        .collect::<Vec<_>>()
                })
                .collect(),
            Err(_) => Vec::new(),
        },
        Err(_) => Vec::new(),
    };

    // 跨端点去重（大小写不敏感，保留首次出现），与对外公布模型口径一致，
    // 避免多个端点公布同名模型时 /v1/models 出现重复项（拉取模型下拉重复）。
    let entries = crate::modules::proxy::resolver::dedup_advertised_entries(entries);

    let anthropic = headers.contains_key("x-api-key") || headers.contains_key("anthropic-version");
    if anthropic {
        // Anthropic 格式：data[].{id,type,display_name,created_at} + first_id/last_id/has_more
        let data: Vec<serde_json::Value> = entries
            .iter()
            .map(|(id, _, _)| {
                json!({
                    "id": id,
                    "type": "model",
                    "display_name": id,
                    "created_at": "2025-01-01T00:00:00Z"
                })
            })
            .collect();
        // 空列表时 first_id/last_id 为 null（对齐官方 Anthropic 行为）
        let first_id = entries.first().map(|(id, _, _)| id.as_str());
        let last_id = entries.last().map(|(id, _, _)| id.as_str());
        Json(json!({
            "data": data,
            "first_id": first_id,
            "last_id": last_id,
            "has_more": false
        }))
        .into_response()
    } else {
        // OpenAI 格式：object:list + data[].{id,object,created,owned_by}
        let data: Vec<serde_json::Value> = entries
            .iter()
            .map(|(id, endpoint_id, name)| model_info(id, endpoint_id, name))
            .collect();
        Json(json!({ "object": "list", "data": data })).into_response()
    }
}

/// `/v1/messages/count_tokens`：解析请求体 system/messages，返回输入 token 估算。
async fn count_tokens_route(body: Bytes) -> Response {
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap_or(serde_json::Value::Null);
    let system = json.get("system");
    let messages = json.get("messages").cloned().unwrap_or_else(|| json!([]));
    let input = crate::modules::tokens::estimate_input_tokens(system, &messages);
    Json(json!({ "input_tokens": input })).into_response()
}

#[cfg(test)]
mod tests {
    use super::set_rotation_for_endpoint;
    use crate::models::endpoint::Endpoint;
    use crate::modules::proxy::forward::{select_routable_endpoints, InboundProtocol};
    use crate::modules::proxy::rotation::Rotation;

    fn endpoint(id: i64, name: &str, transformer: &str) -> Endpoint {
        Endpoint {
            id,
            uid: format!("00000000-0000-4000-8000-{id:012}"),
            name: name.into(),
            api_url: String::new(),
            api_key: String::new(),
            auth_mode: "api_key".into(),
            enabled: true,
            use_proxy: false,
            transformer: transformer.into(),
            model: String::new(),
            models: Vec::new(),
            active_models: Vec::new(),
            model_mappings: Vec::new(),
            remark: String::new(),
            sort_order: id,
            fast: false,
            fast_sort_order: id,
            test_status: "unknown".into(),
            created_at: String::new(),
            updated_at: String::new(),
            archived: false,
        }
    }

    #[test]
    fn manual_switch_tracks_endpoint_id_after_protocol_filtering() {
        let enabled = vec![
            endpoint(1, "claude-a", "claude"),
            endpoint(2, "codex", "codex"),
            endpoint(3, "claude-b", "claude"),
        ];
        let rotation = Rotation::new();

        assert!(set_rotation_for_endpoint(
            &rotation,
            &enabled,
            "00000000-0000-4000-8000-000000000003"
        ));
        let (claude_candidates, _) = select_routable_endpoints(enabled, InboundProtocol::Claude);
        let candidate_ids: Vec<String> = claude_candidates
            .iter()
            .map(|endpoint| endpoint.uid.clone())
            .collect();

        assert_eq!(
            candidate_ids,
            vec![
                "00000000-0000-4000-8000-000000000001",
                "00000000-0000-4000-8000-000000000003"
            ]
        );
        assert_eq!(rotation.current_index("claude", &candidate_ids), Some(1));
    }
}
