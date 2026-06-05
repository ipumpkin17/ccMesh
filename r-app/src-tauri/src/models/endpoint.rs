use serde::{Deserialize, Serialize};

/// 端点（上游 API 提供方）。对应 `endpoints` 表。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Endpoint {
    pub id: i64,
    pub name: String,
    pub api_url: String,
    pub api_key: String,
    /// 认证模式：api_key（默认）/ auth_token 等。
    pub auth_mode: String,
    pub enabled: bool,
    /// 转换器名：claude / openai。
    pub transformer: String,
    pub model: String,
    pub remark: String,
    pub sort_order: i64,
    /// 测试状态：unknown / available / unavailable。
    pub test_status: String,
    pub created_at: String,
    pub updated_at: String,
}

/// 端点多凭证（Token 轮换的凭证项）。对应 `endpoint_credentials` 表。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EndpointCredential {
    pub id: i64,
    pub endpoint_id: i64,
    pub api_key: String,
    pub enabled: bool,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEndpointRequest {
    pub name: String,
    pub api_url: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default = "default_auth_mode")]
    pub auth_mode: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_transformer")]
    pub transformer: String,
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub remark: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEndpointRequest {
    pub name: Option<String>,
    pub api_url: Option<String>,
    pub api_key: Option<String>,
    pub auth_mode: Option<String>,
    pub enabled: Option<bool>,
    pub transformer: Option<String>,
    pub model: Option<String>,
    pub remark: Option<String>,
}

fn default_true() -> bool {
    true
}
fn default_auth_mode() -> String {
    "api_key".to_string()
}
fn default_transformer() -> String {
    "claude".to_string()
}
