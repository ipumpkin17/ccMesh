use serde::{Deserialize, Serialize};

use crate::models::backup::EndpointExport;

pub const ENDPOINTS_BUNDLE_TYPE: &str = "ccmesh-endpoints";
pub const ENDPOINTS_BUNDLE_VERSION: u32 = 1;

/// 仅端点配置的 iCloud 快照。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EndpointsBundle {
    #[serde(rename = "type")]
    pub kind: String,
    pub version: u32,
    pub app_version: String,
    pub updated_at: String,
    #[serde(default)]
    pub device_id: String,
    /// 规范化内容哈希，用于差异检测。
    pub content_hash: String,
    pub endpoints: Vec<EndpointExport>,
}

/// iCloud 同步状态。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ICloudSyncStatus {
    pub available: bool,
    pub enabled: bool,
    pub path: Option<String>,
    pub state: String, // unavailable / disabled / empty / synced / local_ahead / cloud_ahead / conflict
    pub local_hash: String,
    pub cloud_hash: Option<String>,
    pub cloud_updated_at: Option<String>,
    pub message: String,
}
