use serde_json::{json, Value};

use crate::models::endpoint::Endpoint;
use crate::modules::transform::transformer::UpstreamFormat;

fn default_model(ep: &Endpoint) -> &str {
    if ep.model.is_empty() {
        "claude-3-5-sonnet-latest"
    } else {
        ep.model.as_str()
    }
}

fn model_info(id: &str, endpoint_name: &str) -> Value {
    json!({
        "id": id,
        "object": "model",
        "owned_by": endpoint_name,
        "endpoint_id": endpoint_name
    })
}

/// 拉取单个端点的模型列表（OpenAI 走 `/v1/models`；Claude 或失败回落默认模型）。
pub async fn fetch_models(client: &reqwest::Client, ep: &Endpoint) -> Vec<Value> {
    let base = ep.api_url.trim_end_matches('/');
    if let UpstreamFormat::OpenAiChat = UpstreamFormat::from_transformer_name(&ep.transformer) {
        let url = format!("{base}/v1/models");
        if let Ok(resp) = client
            .get(&url)
            .header("authorization", format!("Bearer {}", ep.api_key))
            .send()
            .await
        {
            if resp.status().is_success() {
                if let Ok(v) = resp.json::<Value>().await {
                    if let Some(data) = v.get("data").and_then(|d| d.as_array()) {
                        let models: Vec<Value> = data
                            .iter()
                            .filter_map(|m| m.get("id").and_then(|i| i.as_str()))
                            .map(|id| model_info(id, &ep.name))
                            .collect();
                        if !models.is_empty() {
                            return models;
                        }
                    }
                }
            }
        }
    }
    vec![model_info(default_model(ep), &ep.name)]
}
