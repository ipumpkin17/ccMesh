//! cc-switch 配置迁移 Tauri 命令：预览（只读识别）+ 导入（探测写库）。

use tauri::{AppHandle, Emitter, State};

use crate::error::AppResult;
use crate::modules::cc_switch_migration::{self, importer::ImportSummary, PreviewItem};
use crate::state::AppState;

/// 端点配置变更事件（与 commands::endpoint 一致，导入写库后通知前端刷新）。
const ENDPOINTS_CHANGED_EVENT: &str = "endpoints-changed";

/// 预览：只读识别 cc-switch 供应商，不写库、不探测。db_path 省略时用默认候选路径。
#[tauri::command]
pub fn preview_cc_switch_import(db_path: Option<String>) -> AppResult<Vec<PreviewItem>> {
    let path = cc_switch_migration::resolve_db_path(db_path.as_deref())?;
    cc_switch_migration::preview(&path)
}

/// 导入：对勾选的供应商探测模型并写入 endpoints；同名加 (cc-switch) 后缀；写库后 emit 刷新。
#[tauri::command]
pub async fn import_cc_switch_providers(
    app: AppHandle,
    state: State<'_, AppState>,
    db_path: Option<String>,
    ids: Vec<String>,
) -> AppResult<ImportSummary> {
    let path = cc_switch_migration::resolve_db_path(db_path.as_deref())?;

    // 重新读取并映射（不信任前端传入的预览快照，保证一致性）。
    let rows = cc_switch_migration::reader::read_providers(&path)?;
    let providers: Vec<cc_switch_migration::mapper::MappedProvider> = {
        let mut v = Vec::with_capacity(rows.len());
        for row in &rows {
            v.push(cc_switch_migration::mapper::map_row(row)?);
        }
        v
    };

    let client = {
        let conn = state.db_pool.get()?;
        cc_switch_migration::importer::build_import_client(&conn)?
    };

    let summary = {
        let mut conn = state.db_pool.get()?;
        cc_switch_migration::importer::import(&mut conn, &client, &providers, &ids).await?
    };

    // 有任何入库 → 通知前端刷新端点列表。
    if summary.imported > 0 {
        let _ = app.emit(ENDPOINTS_CHANGED_EVENT, ());
    }
    Ok(summary)
}
