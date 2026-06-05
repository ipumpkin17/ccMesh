use serde::Serialize;
use tauri::State;

use crate::error::AppResult;
use crate::state::AppState;

/// 健康信息（脱敏端点列表等在 P4-7 补全）。Phase 0 占位，验证 IPC 通路。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthInfo {
    pub status: String,
    pub device_id: String,
    pub enabled_endpoints: i64,
}

#[tauri::command]
pub fn get_health(state: State<AppState>) -> AppResult<HealthInfo> {
    let conn = state.db_pool.get()?;
    let enabled_endpoints: i64 = conn
        .query_row("SELECT COUNT(*) FROM endpoints WHERE enabled = 1", [], |row| {
            row.get(0)
        })
        .unwrap_or(0);

    Ok(HealthInfo {
        status: "ok".to_string(),
        device_id: state.device_id.clone(),
        enabled_endpoints,
    })
}
