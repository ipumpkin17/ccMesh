use tauri::{AppHandle, Emitter, State};

use crate::error::AppResult;
use crate::models::backup::ImportSummary;
use crate::models::icloud::ICloudSyncStatus;
use crate::modules::icloud;
use crate::state::AppState;

const ENDPOINTS_CHANGED_EVENT: &str = "endpoints-changed";

#[tauri::command]
pub fn get_icloud_sync_status(state: State<AppState>) -> AppResult<ICloudSyncStatus> {
    let conn = state.db_pool.get()?;
    icloud::status(&conn, &state.device_id)
}

/// 开启/关闭 iCloud 端点同步。开启时若云端为空则自动推送本地；若存在差异返回状态供前端弹窗。
#[tauri::command]
pub fn set_icloud_sync_enabled(
    state: State<AppState>,
    enabled: bool,
) -> AppResult<ICloudSyncStatus> {
    let conn = state.db_pool.get()?;
    icloud::set_enabled(&conn, enabled)?;
    if enabled {
        // 云端为空：自动上传本地端点，降低首次开启摩擦。
        if icloud::is_available() {
            if icloud::read_cloud_bundle()?.is_none() {
                let _ = icloud::push_local_to_cloud(&conn, &state.device_id)?;
            }
        }
    }
    icloud::status(&conn, &state.device_id)
}

/// 本地覆盖 iCloud。
#[tauri::command]
pub fn icloud_push_endpoints(state: State<AppState>) -> AppResult<ICloudSyncStatus> {
    let conn = state.db_pool.get()?;
    if !icloud::is_enabled(&conn)? {
        icloud::set_enabled(&conn, true)?;
    }
    let _ = icloud::push_local_to_cloud(&conn, &state.device_id)?;
    icloud::status(&conn, &state.device_id)
}

/// iCloud 覆盖本地。
#[tauri::command]
pub fn icloud_pull_endpoints(
    app: AppHandle,
    state: State<AppState>,
) -> AppResult<(ImportSummary, ICloudSyncStatus)> {
    let mut conn = state.db_pool.get()?;
    if !icloud::is_enabled(&conn)? {
        icloud::set_enabled(&conn, true)?;
    }
    let (summary, _) = icloud::pull_cloud_to_local(&mut conn, &state.device_id)?;
    let status = icloud::status(&conn, &state.device_id)?;
    let _ = app.emit(ENDPOINTS_CHANGED_EVENT, ());
    Ok((summary, status))
}

/// 端点变更后的自动备份（仅开启且可用时写入 iCloud）。
#[tauri::command]
pub fn icloud_auto_backup_endpoints(state: State<AppState>) -> AppResult<ICloudSyncStatus> {
    let conn = state.db_pool.get()?;
    icloud::auto_backup_if_safe(&conn, &state.device_id)
}
