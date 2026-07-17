//! 导入编排：对勾选候选探测模型并写入 endpoints（与具体来源无关）。
//!
//! - 复用 `probe_models`；探测失败仍入库 `enabled=false`
//! - 同名按 `name_suffix` 重命名（`util::unique_name`）
//! - 写库后由命令层 emit endpoints-changed

use std::collections::HashSet;
use std::time::Duration;

use rusqlite::Connection;

use crate::error::AppResult;
use crate::models::endpoint::CreateEndpointRequest;
use crate::modules::external_migration::types::{ImportItem, ImportSummary, MappedEndpoint};
use crate::modules::external_migration::url_normalize::normalize_api_url_for_ccmesh;
use crate::modules::external_migration::util::unique_name;
use crate::modules::models_probe::probe_models;
use crate::modules::proxy::client::{build_client, should_use_proxy};
use crate::modules::storage::{config_repo, endpoint_repo};

/// 对已识别且被勾选的候选执行探测 + 写库。
///
/// `selected_ids` 为 `source_id` 集合；`name_suffix` 仅用于冲突重命名。
pub async fn import(
    conn: &mut Connection,
    client: &reqwest::Client,
    items: &[MappedEndpoint],
    selected_ids: &[String],
    name_suffix: &str,
) -> AppResult<ImportSummary> {
    let selected: HashSet<&str> = selected_ids.iter().map(String::as_str).collect();
    let mut used_names = existing_endpoint_names(conn)?;

    let mut out = Vec::new();
    let mut imported = 0usize;
    let mut enabled_count = 0usize;
    let mut disabled_no_models = 0usize;
    let mut skipped = 0usize;
    let mut total = 0usize;

    for candidate in items.iter().filter(|c| selected.contains(c.source_id.as_str())) {
        if !candidate.is_importable() {
            skipped += 1;
            out.push(ImportItem::skipped(
                candidate.name.clone(),
                candidate.skip_reason.clone(),
            ));
            continue;
        }
        total += 1;

        match import_one(conn, client, candidate, name_suffix, &mut used_names).await? {
            ImportOutcome::Skipped(item) => {
                skipped += 1;
                out.push(item);
            }
            ImportOutcome::Created { item, enabled } => {
                imported += 1;
                if enabled {
                    enabled_count += 1;
                } else {
                    disabled_no_models += 1;
                }
                out.push(item);
            }
        }
    }

    Ok(ImportSummary {
        total,
        imported,
        enabled_count,
        disabled_no_models,
        skipped,
        items: out,
    })
}

/// 构建迁移导入用的 HTTP client：默认直连，除非全局开启代理且地址非空。
pub fn build_import_client(conn: &Connection) -> AppResult<reqwest::Client> {
    let cfg = config_repo::get_config(conn)?;
    let want = should_use_proxy(false, cfg.proxy_enabled, &cfg.proxy_url);
    build_client(want, &cfg.proxy_url, Duration::from_secs(15))
}

enum ImportOutcome {
    Skipped(ImportItem),
    Created { item: ImportItem, enabled: bool },
}

async fn import_one(
    conn: &mut Connection,
    client: &reqwest::Client,
    candidate: &MappedEndpoint,
    name_suffix: &str,
    used_names: &mut HashSet<String>,
) -> AppResult<ImportOutcome> {
    let api_url = match normalize_api_url_for_ccmesh(&candidate.raw_url) {
        Ok(url) => url,
        Err(_) => {
            return Ok(ImportOutcome::Skipped(ImportItem::skipped(
                candidate.name.clone(),
                Some("invalid_api_url".into()),
            )));
        }
    };

    let model_ids =
        probe_models(client, &api_url, &candidate.api_key, &candidate.transformer).await;
    let enabled = !model_ids.is_empty();
    let name = unique_name(&candidate.name, name_suffix, |n| used_names.contains(n));
    used_names.insert(name.clone());

    endpoint_repo::create(
        conn,
        &CreateEndpointRequest {
            name: name.clone(),
            api_url,
            api_key: candidate.api_key.clone(),
            auth_mode: "api_key".into(),
            enabled,
            use_proxy: false,
            transformer: candidate.transformer.clone(),
            model: lock_model_if_hint_matches(&candidate.models_hint, &model_ids),
            models: model_ids.clone(),
            active_models: vec![],
            model_mappings: vec![],
            remark: candidate.remark.clone(),
            fast: false,
        },
    )?;

    Ok(ImportOutcome::Created {
        item: ImportItem::imported(name, model_ids.len(), enabled),
        enabled,
    })
}

fn existing_endpoint_names(conn: &Connection) -> AppResult<HashSet<String>> {
    let existing = endpoint_repo::list_all(conn)?;
    Ok(existing.into_iter().map(|e| e.name).collect())
}

/// hint 命中探测列表则锁定该模型，否则空（透传）。
fn lock_model_if_hint_matches(hints: &[String], probed: &[String]) -> String {
    hints
        .iter()
        .find(|h| probed.iter().any(|p| p == *h))
        .cloned()
        .unwrap_or_default()
}
