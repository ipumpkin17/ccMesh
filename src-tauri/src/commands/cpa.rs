//! CPA (Cli-Proxy-API) 配置迁移命令：薄包装公共外部迁移管道。

use tauri::{AppHandle, Emitter, State};

use crate::error::AppResult;
use crate::modules::external_migration::{
    self, importer,
    sources::cpa,
    types::{ImportSummary, PreviewItem},
};
use crate::state::AppState;

const ENDPOINTS_CHANGED_EVENT: &str = "endpoints-changed";

/// 预览：只读识别 CPA 上游凭证。`path` 省略时用默认候选路径。
#[tauri::command]
pub fn preview_cpa_import(path: Option<String>) -> AppResult<Vec<PreviewItem>> {
    let resolved = cpa::resolve_path(path.as_deref())?;
    let items = cpa::load(&resolved)?;
    Ok(external_migration::preview(items))
}

/// 导入：探测模型并写 endpoints；同名加 `(cpa)` 后缀。
#[tauri::command]
pub async fn import_cpa_providers(
    app: AppHandle,
    state: State<'_, AppState>,
    path: Option<String>,
    ids: Vec<String>,
) -> AppResult<ImportSummary> {
    let resolved = cpa::resolve_path(path.as_deref())?;
    // 重新 load，不信任前端预览快照。
    let items = cpa::load(&resolved)?;

    let client = {
        let conn = state.db_pool.get()?;
        importer::build_import_client(&conn)?
    };

    let summary = {
        let mut conn = state.db_pool.get()?;
        importer::import(&mut conn, &client, &items, &ids, cpa::NAME_SUFFIX).await?
    };

    if summary.imported > 0 {
        let _ = app.emit(ENDPOINTS_CHANGED_EVENT, ());
    }
    Ok(summary)
}
