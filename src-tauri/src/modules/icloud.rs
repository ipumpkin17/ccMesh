use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::Value;

use crate::error::{AppError, AppResult};
use crate::models::backup::{EndpointExport, ImportSummary};
use crate::models::icloud::{
    EndpointsBundle, ICloudSyncStatus, ENDPOINTS_BUNDLE_TYPE, ENDPOINTS_BUNDLE_VERSION,
};
use crate::modules::backup::{build_endpoints_only, replace_endpoints};
use crate::modules::storage::config_repo;
use crate::utils::paths::home_dir;
use rusqlite::Connection;

pub const ICLOUD_ENABLED_KEY: &str = "icloud_endpoints_enabled";
const BUNDLE_FILE_NAME: &str = "endpoints.json";

/// iCloud Drive 中的 ccMesh 目录：`~/Library/Mobile Documents/com~apple~CloudDocs/ccMesh`。
pub fn icloud_dir() -> AppResult<PathBuf> {
    let home = home_dir().ok_or_else(|| AppError::Config("无法解析用户主目录".into()))?;
    let dir = home
        .join("Library")
        .join("Mobile Documents")
        .join("com~apple~CloudDocs")
        .join("ccMesh");
    Ok(dir)
}

pub fn endpoints_bundle_path() -> AppResult<PathBuf> {
    Ok(icloud_dir()?.join(BUNDLE_FILE_NAME))
}

pub fn is_available() -> bool {
    #[cfg(target_os = "macos")]
    {
        if let Ok(dir) = icloud_dir() {
            // 上级 iCloud Drive 容器存在即可用；ccMesh 子目录可自动创建。
            if let Some(parent) = dir.parent() {
                return parent.exists();
            }
        }
        false
    }
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

pub fn is_enabled(conn: &Connection) -> AppResult<bool> {
    Ok(config_repo::get_value(conn, ICLOUD_ENABLED_KEY)?
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false))
}

pub fn set_enabled(conn: &Connection, enabled: bool) -> AppResult<()> {
    config_repo::set_value(conn, ICLOUD_ENABLED_KEY, if enabled { "true" } else { "false" })
}

fn normalize_endpoints(mut endpoints: Vec<EndpointExport>) -> Vec<EndpointExport> {
    for ep in &mut endpoints {
        if let Some(id) = ep.id.as_mut() {
            *id = id.trim().to_string();
        }
        ep.name = ep.name.trim().to_string();
        ep.api_url = ep.api_url.trim().to_string();
        ep.models.sort();
        ep.active_models.sort();
        ep.model_mappings
            .sort_by(|a, b| (&a.from, &a.to).cmp(&(&b.from, &b.to)));
        ep.credentials
            .sort_by(|a, b| (a.sort_order, &a.api_key).cmp(&(b.sort_order, &b.api_key)));
    }
    endpoints.sort_by(|a, b| {
        let aid = a.id.clone().unwrap_or_default();
        let bid = b.id.clone().unwrap_or_default();
        (aid, a.name.clone()).cmp(&(bid, b.name.clone()))
    });
    endpoints
}

/// 对规范化端点快照做稳定指纹（不回传明文，避免把 API Key 泄露到前端状态）。
pub fn content_hash(endpoints: &[EndpointExport]) -> AppResult<String> {
    let normalized = normalize_endpoints(endpoints.to_vec());
    let payload = serde_json::to_string(&normalized)?;
    Ok(fnv1a64_hex(payload.as_bytes()))
}

fn fnv1a64_hex(bytes: &[u8]) -> String {
    // 64-bit FNV-1a：仅用于相等性比较，不用于安全场景。
    let mut hash: u64 = 0xcbf29ce484222325;
    for b in bytes {
        hash ^= u64::from(*b);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

pub fn build_bundle(conn: &Connection, device_id: &str) -> AppResult<EndpointsBundle> {
    let endpoints = build_endpoints_only(conn)?;
    let content_hash = content_hash(&endpoints)?;
    Ok(EndpointsBundle {
        kind: ENDPOINTS_BUNDLE_TYPE.to_string(),
        version: ENDPOINTS_BUNDLE_VERSION,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        updated_at: chrono::Local::now().to_rfc3339(),
        device_id: device_id.to_string(),
        content_hash,
        endpoints,
    })
}

fn ensure_dir(path: &Path) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    Ok(())
}

fn write_atomic(path: &Path, bytes: &[u8]) -> AppResult<()> {
    ensure_dir(path)?;
    let tmp = path.with_extension(format!(
        "tmp-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0)
    ));
    fs::write(&tmp, bytes)?;
    fs::rename(&tmp, path)?;
    Ok(())
}

pub fn read_cloud_bundle() -> AppResult<Option<EndpointsBundle>> {
    let path = endpoints_bundle_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path)?;
    let value: Value = serde_json::from_str(&raw)?;
    let kind = value
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or_default();
    if kind != ENDPOINTS_BUNDLE_TYPE {
        return Err(AppError::InvalidArgument(format!(
            "iCloud 文件类型不是 {ENDPOINTS_BUNDLE_TYPE}"
        )));
    }
    let mut bundle: EndpointsBundle = serde_json::from_value(value)?;
    if bundle.version > ENDPOINTS_BUNDLE_VERSION {
        return Err(AppError::InvalidArgument(format!(
            "iCloud 端点配置版本 {} 高于当前支持的 {}",
            bundle.version, ENDPOINTS_BUNDLE_VERSION
        )));
    }
    // 兼容旧文件：缺 contentHash 时现算。
    if bundle.content_hash.trim().is_empty() {
        bundle.content_hash = content_hash(&bundle.endpoints)?;
    }
    Ok(Some(bundle))
}

pub fn push_local_to_cloud(conn: &Connection, device_id: &str) -> AppResult<EndpointsBundle> {
    if !is_available() {
        return Err(AppError::Config("当前环境不可用 iCloud Drive".into()));
    }
    let bundle = build_bundle(conn, device_id)?;
    let path = endpoints_bundle_path()?;
    // 内容未变化则跳过写盘，减少 iCloud 抖动与无意义冲突。
    if let Ok(Some(cloud)) = read_cloud_bundle() {
        if cloud.content_hash == bundle.content_hash {
            return Ok(cloud);
        }
    }
    let bytes = serde_json::to_vec_pretty(&bundle)?;
    write_atomic(&path, &bytes)?;
    Ok(bundle)
}

/// 自动备份：本地端点变更后推送到 iCloud（本地写路径优先）。
/// 入站冲突不自动拉取，由前端提示用户选择方向。
pub fn auto_backup_if_safe(conn: &Connection, device_id: &str) -> AppResult<ICloudSyncStatus> {
    if !is_available() || !is_enabled(conn)? {
        return status(conn, device_id);
    }
    let _ = push_local_to_cloud(conn, device_id)?;
    status(conn, device_id)
}

pub fn pull_cloud_to_local(
    conn: &mut Connection,
    device_id: &str,
) -> AppResult<(ImportSummary, EndpointsBundle)> {
    let cloud = read_cloud_bundle()?.ok_or_else(|| {
        AppError::NotFound("iCloud 中尚无端点配置文件".into())
    })?;
    // 防止空快照误覆盖导致本地端点被清空。
    if cloud.endpoints.is_empty() {
        let local_count = build_endpoints_only(conn)?.len();
        if local_count > 0 {
            return Err(AppError::InvalidArgument(
                "iCloud 端点列表为空，已拒绝覆盖本地端点".into(),
            ));
        }
    }
    let summary = replace_endpoints(conn, &cloud.endpoints)?;
    // 拉取后回写规范化快照，避免后续因格式差异反复冲突。
    let local = build_bundle(conn, device_id)?;
    let path = endpoints_bundle_path()?;
    let bytes = serde_json::to_vec_pretty(&local)?;
    write_atomic(&path, &bytes)?;
    Ok((summary, local))
}

pub fn status(conn: &Connection, device_id: &str) -> AppResult<ICloudSyncStatus> {
    let available = is_available();
    let enabled = is_enabled(conn)?;
    let path = endpoints_bundle_path().ok().map(|p| p.display().to_string());
    let local = build_bundle(conn, device_id)?;

    if !available {
        return Ok(ICloudSyncStatus {
            available: false,
            enabled,
            path,
            state: "unavailable".into(),
            local_hash: local.content_hash,
            cloud_hash: None,
            cloud_updated_at: None,
            message: "当前环境不可用 iCloud Drive".into(),
        });
    }

    if !enabled {
        return Ok(ICloudSyncStatus {
            available: true,
            enabled: false,
            path,
            state: "disabled".into(),
            local_hash: local.content_hash,
            cloud_hash: None,
            cloud_updated_at: None,
            message: "iCloud 同步未开启".into(),
        });
    }

    match read_cloud_bundle()? {
        None => Ok(ICloudSyncStatus {
            available: true,
            enabled: true,
            path,
            state: "empty".into(),
            local_hash: local.content_hash,
            cloud_hash: None,
            cloud_updated_at: None,
            message: "iCloud 尚无端点配置，可将本地覆盖到 iCloud".into(),
        }),
        Some(cloud) => {
            // 内容哈希不同即冲突，交由用户选择方向（对齐 Loon 交互，避免静默覆盖）。
            let state = if cloud.content_hash == local.content_hash {
                "synced"
            } else {
                "conflict"
            };
            let message = match state {
                "synced" => "本地与 iCloud 端点配置一致".into(),
                _ => "iCloud 与本地端点配置存在差异，请选择同步方向".into(),
            };
            Ok(ICloudSyncStatus {
                available: true,
                enabled: true,
                path,
                state: state.into(),
                local_hash: local.content_hash,
                cloud_hash: Some(cloud.content_hash),
                cloud_updated_at: Some(cloud.updated_at),
                message,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::endpoint::ModelMapping;
    use crate::modules::storage::migration::run_migrations;
    use rusqlite::Connection;

    fn db() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        run_migrations(&c).unwrap();
        c
    }

    #[test]
    fn content_hash_ignores_order_noise() {
        let a = vec![EndpointExport {
            id: Some("11111111-1111-4111-8111-111111111111".into()),
            name: "ep".into(),
            api_url: "https://a".into(),
            api_key: "k".into(),
            auth_mode: "api_key".into(),
            enabled: true,
            use_proxy: false,
            transformer: "openai".into(),
            model: String::new(),
            models: vec!["b".into(), "a".into()],
            active_models: vec!["a".into()],
            model_mappings: vec![ModelMapping {
                from: "x".into(),
                to: "a".into(),
            }],
            remark: String::new(),
            sort_order: 0,
            fast: false,
            fast_sort_order: 0,
            credentials: vec![],
        }];
        let mut b = a.clone();
        b[0].models = vec!["a".into(), "b".into()];
        assert_eq!(content_hash(&a).unwrap(), content_hash(&b).unwrap());
    }

    #[test]
    fn build_bundle_includes_models_and_mappings() {
        let c = db();
        c.execute(
            "INSERT INTO endpoints(
                uid,name,api_url,api_key,models,active_models,model_mappings
             ) VALUES(
                '11111111-1111-4111-8111-111111111111','ep','https://a','k',
                ?1,?2,?3
             )",
            rusqlite::params![
                r#"["gpt","o3"]"#,
                r#"["gpt"]"#,
                r#"[{"from":"alias","to":"gpt"}]"#,
            ],
        )
        .unwrap();
        let bundle = build_bundle(&c, "dev").unwrap();
        assert_eq!(bundle.kind, ENDPOINTS_BUNDLE_TYPE);
        assert_eq!(bundle.endpoints.len(), 1);
        assert_eq!(bundle.endpoints[0].models.len(), 2);
        assert_eq!(bundle.endpoints[0].model_mappings.len(), 1);
        assert!(!bundle.content_hash.is_empty());
    }
}
