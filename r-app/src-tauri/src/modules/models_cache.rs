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

pub fn model_info(id: &str, endpoint_name: &str) -> Value {
    json!({
        "id": id,
        "object": "model",
        "owned_by": endpoint_name,
        "endpoint_id": endpoint_name
    })
}

/// 拉取指定上游的模型 id 列表（OpenAI 端点走 `/v1/models`；非 OpenAI 或失败返回空）。
/// 按字段传参，供「端点尚未保存」的表单刷新场景调用。
pub async fn fetch_model_ids(
    client: &reqwest::Client,
    api_url: &str,
    api_key: &str,
    transformer: &str,
) -> Vec<String> {
    let base = api_url.trim_end_matches('/');
    if let UpstreamFormat::OpenAiChat = UpstreamFormat::from_transformer_name(transformer) {
        let url = format!("{base}/v1/models");
        if let Ok(resp) = client
            .get(&url)
            .header("authorization", format!("Bearer {api_key}"))
            .send()
            .await
        {
            if resp.status().is_success() {
                if let Ok(v) = resp.json::<Value>().await {
                    if let Some(data) = v.get("data").and_then(|d| d.as_array()) {
                        return data
                            .iter()
                            .filter_map(|m| m.get("id").and_then(|i| i.as_str()).map(String::from))
                            .collect();
                    }
                }
            }
        }
    }
    Vec::new()
}

/// 拉取单个端点的模型列表（OpenAI 走 `/v1/models`；Claude 或失败回落默认模型）。
pub async fn fetch_models(client: &reqwest::Client, ep: &Endpoint) -> Vec<Value> {
    let ids = fetch_model_ids(client, &ep.api_url, &ep.api_key, &ep.transformer).await;
    if ids.is_empty() {
        vec![model_info(default_model(ep), &ep.name)]
    } else {
        ids.iter().map(|id| model_info(id, &ep.name)).collect()
    }
}
