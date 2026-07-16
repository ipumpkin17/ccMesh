use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::models::endpoint::ModelMapping;

fn default_true() -> bool {
    true
}
fn default_auth_mode() -> String {
    "api_key".to_string()
}
fn default_transformer() -> String {
    "claude".to_string()
}

/// 端点多凭证项（迁移用）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialItem {
    pub api_key: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub sort_order: i64,
}

/// 导出/导入的端点（全字段 + 稳定 ID + 多凭证），不含数据库行主键/时间戳/test_status/device。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EndpointExport {
    /// 稳定端点 ID。旧版 v1 配置缺失时，导入阶段自动生成。
    #[serde(default)]
    pub id: Option<String>,
    pub name: String,
    pub api_url: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default = "default_auth_mode")]
    pub auth_mode: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub use_proxy: bool,
    #[serde(default = "default_transformer")]
    pub transformer: String,
    #[serde(default)]
    pub model: String,
    #[serde(default)]
    pub models: Vec<String>,
    #[serde(default)]
    pub active_models: Vec<String>,
    #[serde(default)]
    pub model_mappings: Vec<ModelMapping>,
    #[serde(default)]
    pub remark: String,
    #[serde(default)]
    pub sort_order: i64,
    #[serde(default)]
    pub fast: bool,
    #[serde(default)]
    pub fast_sort_order: i64,
    #[serde(default)]
    pub credentials: Vec<CredentialItem>,
}

/// 配置迁移包（JSON 信封）。`type` 固定 "ccmesh-config"。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigBundle {
    #[serde(rename = "type")]
    pub kind: String,
    pub version: u32,
    pub app_version: String,
    pub exported_at: String,
    pub endpoints: Vec<EndpointExport>,
    /// 仅迁移白名单配置键（不含 device_id / webdav_* 同步凭证）。
    #[serde(default)]
    pub config: BTreeMap<String, String>,
}

/// 导入结果摘要。
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    pub endpoints_added: i64,
    pub endpoints_updated: i64,
    pub endpoints_skipped: i64,
    /// 同名不同 ID 时保留本地稳定身份的端点数。
    pub identities_preserved: i64,
    pub credentials: i64,
    pub config_keys: i64,
}
