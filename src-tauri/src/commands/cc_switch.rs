//! cc-switch 配置迁移 Tauri 命令：薄包装公共外部迁移管道。

use tauri::{AppHandle, Emitter, State};

use crate::error::AppResult;
use crate::modules::external_migration::{
    self, importer,
    sources::cc_switch,
    types::{ImportSummary, PreviewItem},
};
use crate::state::AppState;

const ENDPOINTS_CHANGED_EVENT: &str = "endpoints-changed";

/// 预览：只读识别 cc-switch 供应商，不写库、不探测。
#[tauri::command]
pub fn preview_cc_switch_import(db_path: Option<String>) -> AppResult<Vec<PreviewItem>> {
    let path = cc_switch::resolve_path(db_path.as_deref())?;
    let items = cc_switch::load(&path)?;
    Ok(external_migration::preview(items))
}

/// 导入：探测模型并写入 endpoints；同名加 (cc-switch) 后缀；写库后 emit 刷新。
#[tauri::command]
pub async fn import_cc_switch_providers(
    app: AppHandle,
    state: State<'_, AppState>,
    db_path: Option<String>,
    ids: Vec<String>,
) -> AppResult<ImportSummary> {
    let path = cc_switch::resolve_path(db_path.as_deref())?;
    // 重新 load，不信任前端预览快照。
    let items = cc_switch::load(&path)?;

    let client = {
        let conn = state.db_pool.get()?;
        importer::build_import_client(&conn)?
    };

    let summary = {
        let mut conn = state.db_pool.get()?;
        importer::import(&mut conn, &client, &items, &ids, cc_switch::NAME_SUFFIX).await?
    };

    if summary.imported > 0 {
        let _ = app.emit(ENDPOINTS_CHANGED_EVENT, ());
    }
    Ok(summary)
}
