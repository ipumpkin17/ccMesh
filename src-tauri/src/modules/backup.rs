use std::collections::{BTreeMap, HashSet};

use rusqlite::{params, params_from_iter, Connection, OptionalExtension};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::backup::{ConfigBundle, CredentialItem, EndpointExport, ImportSummary};
use crate::modules::storage::{config_repo, endpoint_repo};

const BUNDLE_TYPE: &str = "ccmesh-config";
const BUNDLE_VERSION: u32 = 1;

/// 迁移用配置键：取 `SAFE_CONFIG_KEYS` 去掉 webdav_* 同步凭证（换机重填，避免明文外泄）。
const MIGRATION_CONFIG_KEYS: &[&str] = &[
    "port",
    "logLevel",
    "language",
    "theme",
    "themeAuto",
    "autoLightStart",
    "autoDarkStart",
    "closeWindowBehavior",
    "modelsCacheTtl",
    "update_autoCheck",
    "update_checkInterval",
    "openaiUa",
    "claudeCliUa",
];

fn read_credentials(conn: &Connection, endpoint_id: i64) -> AppResult<Vec<CredentialItem>> {
    let mut stmt = conn.prepare(
        "SELECT api_key, enabled, sort_order FROM endpoint_credentials
         WHERE endpoint_id = ?1 ORDER BY sort_order ASC, id ASC",
    )?;
    let rows = stmt.query_map([endpoint_id], |r| {
        Ok(CredentialItem {
            api_key: r.get(0)?,
            enabled: r.get::<_, i64>(1)? != 0,
            sort_order: r.get(2)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

/// 构造配置迁移包：所有端点（全字段 + 多凭证）+ 白名单配置键。
pub fn build_config_bundle(conn: &Connection) -> AppResult<ConfigBundle> {
    let mut endpoints = Vec::new();
    for e in endpoint_repo::list_all(conn)? {
        let credentials = read_credentials(conn, e.id)?;
        endpoints.push(EndpointExport {
            id: Some(e.uid),
            name: e.name,
            api_url: e.api_url,
            api_key: e.api_key,
            auth_mode: e.auth_mode,
            enabled: e.enabled,
            use_proxy: e.use_proxy,
            transformer: e.transformer,
            model: e.model,
            models: e.models,
            active_models: e.active_models,
            model_mappings: e.model_mappings,
            remark: e.remark,
            sort_order: e.sort_order,
            fast: e.fast,
            fast_sort_order: e.fast_sort_order,
            credentials,
        });
    }
    let mut config = BTreeMap::new();
    for &k in MIGRATION_CONFIG_KEYS {
        if let Some(v) = config_repo::get_value(conn, k)? {
            config.insert(k.to_string(), v);
        }
    }
    Ok(ConfigBundle {
        kind: BUNDLE_TYPE.to_string(),
        version: BUNDLE_VERSION,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        exported_at: chrono::Local::now().to_rfc3339(),
        endpoints,
        config,
    })
}

fn normalize_exported_endpoint_id(value: Option<&str>) -> AppResult<Option<String>> {
    let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    let uid = Uuid::parse_str(value)
        .map_err(|_| AppError::InvalidArgument(format!("配置包含无效的端点 ID: {value}")))?;
    Ok(Some(uid.to_string()))
}

/// 导入配置迁移包。新配置按稳定 ID 匹配，旧配置回退按名称匹配；
/// `overwrite` 为真时覆盖端点并重置凭证、配置键覆盖，否则保留本地记录。
pub fn import_config_bundle(
    conn: &mut Connection,
    bundle: &ConfigBundle,
    overwrite: bool,
) -> AppResult<ImportSummary> {
    if bundle.kind != BUNDLE_TYPE {
        return Err(AppError::InvalidArgument(
            "文件类型不是 ccmesh-config 配置导出".to_string(),
        ));
    }
    if bundle.version > BUNDLE_VERSION {
        return Err(AppError::InvalidArgument(format!(
            "配置版本 {} 高于当前支持的 {}，请升级应用",
            bundle.version, BUNDLE_VERSION
        )));
    }

    let mut imported_ids = HashSet::new();
    let mut imported_names = HashSet::new();
    for ep in &bundle.endpoints {
        if ep.name.trim().is_empty() || ep.api_url.trim().is_empty() {
            continue;
        }
        if !imported_names.insert(ep.name.clone()) {
            return Err(AppError::InvalidArgument(format!(
                "配置包含重复的端点名称: {}",
                ep.name
            )));
        }
        if let Some(uid) = normalize_exported_endpoint_id(ep.id.as_deref())? {
            if !imported_ids.insert(uid.clone()) {
                return Err(AppError::InvalidArgument(format!(
                    "配置包含重复的端点 ID: {uid}"
                )));
            }
        }
    }

    let tx = conn.transaction()?;
    let mut s = ImportSummary::default();

    for ep in &bundle.endpoints {
        if ep.name.trim().is_empty() || ep.api_url.trim().is_empty() {
            continue;
        }
        let imported_uid = normalize_exported_endpoint_id(ep.id.as_deref())?;
        let existing_by_uid: Option<(i64, String)> = match imported_uid.as_deref() {
            Some(uid) => tx
                .query_row(
                    "SELECT id, name FROM endpoints WHERE uid = ?1",
                    params![uid],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .optional()?,
            None => None,
        };
        let existing_by_name: Option<(i64, String)> = tx
            .query_row(
                "SELECT id, uid FROM endpoints WHERE name = ?1",
                params![ep.name],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;
        if let (Some((uid_id, _)), Some((name_id, _))) =
            (existing_by_uid.as_ref(), existing_by_name.as_ref())
        {
            if uid_id != name_id {
                return Err(AppError::InvalidArgument(format!(
                    "端点 '{}' 的 ID 与本地同名端点冲突",
                    ep.name
                )));
            }
        }
        let preserve_local_identity =
            imported_uid.is_some() && existing_by_uid.is_none() && existing_by_name.is_some();
        if preserve_local_identity {
            s.identities_preserved += 1;
        }
        let existing = match imported_uid.as_ref() {
            Some(_) if preserve_local_identity => existing_by_name.as_ref().map(|(id, _)| *id),
            Some(_) => existing_by_uid.as_ref().map(|(id, _)| *id),
            None => existing_by_name.as_ref().map(|(id, _)| *id),
        };

        let models_json = serde_json::to_string(&ep.models).unwrap_or_else(|_| "[]".to_string());
        // 点亮子集规整为 models 子集后再持久化，避免迁移包脏数据。
        let active: Vec<String> = ep
            .active_models
            .iter()
            .filter(|a| ep.models.iter().any(|m| m == *a))
            .cloned()
            .collect();
        let active_json = serde_json::to_string(&active).unwrap_or_else(|_| "[]".to_string());
        let mappings_json =
            serde_json::to_string(&ep.model_mappings).unwrap_or_else(|_| "[]".to_string());
        let id = match existing {
            Some(id) if overwrite => {
                tx.execute(
                    "UPDATE endpoints SET name=?1, api_url=?2, api_key=?3, auth_mode=?4, enabled=?5,
                        use_proxy=?6, transformer=?7, model=?8, models=?9, active_models=?10,
                        model_mappings=?11, remark=?12, sort_order=?13, fast=?14, fast_sort_order=?15,
                        updated_at=datetime('now') WHERE id=?16",
                    params![
                        ep.name,
                        ep.api_url,
                        ep.api_key,
                        ep.auth_mode,
                        ep.enabled as i64,
                        ep.use_proxy as i64,
                        ep.transformer,
                        ep.model,
                        models_json,
                        active_json,
                        mappings_json,
                        ep.remark,
                        ep.sort_order,
                        ep.fast as i64,
                        ep.fast_sort_order,
                        id,
                    ],
                )?;
                tx.execute(
                    "DELETE FROM endpoint_credentials WHERE endpoint_id=?1",
                    params![id],
                )?;
                s.endpoints_updated += 1;
                id
            }
            Some(_) => {
                s.endpoints_skipped += 1;
                continue;
            }
            None => {
                let uid = imported_uid.unwrap_or_else(endpoint_repo::new_endpoint_uid);
                tx.execute(
                    "INSERT INTO endpoints
                        (uid, name, api_url, api_key, auth_mode, enabled, use_proxy, transformer, model, models, active_models, model_mappings, remark, sort_order, fast, fast_sort_order)
                     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)",
                    params![
                        uid,
                        ep.name,
                        ep.api_url,
                        ep.api_key,
                        ep.auth_mode,
                        ep.enabled as i64,
                        ep.use_proxy as i64,
                        ep.transformer,
                        ep.model,
                        models_json,
                        active_json,
                        mappings_json,
                        ep.remark,
                        ep.sort_order,
                        ep.fast as i64,
                        ep.fast_sort_order,
                    ],
                )?;
                s.endpoints_added += 1;
                tx.last_insert_rowid()
            }
        };

        for c in &ep.credentials {
            tx.execute(
                "INSERT INTO endpoint_credentials(endpoint_id, api_key, enabled, sort_order)
                 VALUES(?1,?2,?3,?4)",
                params![id, c.api_key, c.enabled as i64, c.sort_order],
            )?;
            s.credentials += 1;
        }
    }

    for (k, v) in &bundle.config {
        if !MIGRATION_CONFIG_KEYS.contains(&k.as_str()) {
            continue; // 仅接受白名单键
        }
        let sql = if overwrite {
            "INSERT INTO app_config(key, value) VALUES(?1,?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        } else {
            "INSERT INTO app_config(key, value) VALUES(?1,?2) ON CONFLICT(key) DO NOTHING"
        };
        tx.execute(sql, params![k, v])?;
        s.config_keys += 1;
    }

    tx.commit()?;
    Ok(s)
}


/// 仅导出端点配置（不含应用设置）。
pub fn build_endpoints_only(conn: &Connection) -> AppResult<Vec<EndpointExport>> {
    let mut endpoints = Vec::new();
    for e in endpoint_repo::list_all(conn)? {
        let credentials = read_credentials(conn, e.id)?;
        endpoints.push(EndpointExport {
            id: Some(e.uid),
            name: e.name,
            api_url: e.api_url,
            api_key: e.api_key,
            auth_mode: e.auth_mode,
            enabled: e.enabled,
            use_proxy: e.use_proxy,
            transformer: e.transformer,
            model: e.model,
            models: e.models,
            active_models: e.active_models,
            model_mappings: e.model_mappings,
            remark: e.remark,
            sort_order: e.sort_order,
            fast: e.fast,
            fast_sort_order: e.fast_sort_order,
            credentials,
        });
    }
    Ok(endpoints)
}

/// 用端点列表全量覆盖本地（严格按稳定 ID 对齐，删除云端不存在的本地端点）。
pub fn replace_endpoints(
    conn: &mut Connection,
    endpoints: &[EndpointExport],
) -> AppResult<ImportSummary> {
    let mut imported_ids = HashSet::new();
    let mut imported_names = HashSet::new();
    let mut normalized = Vec::new();
    for ep in endpoints {
        if ep.name.trim().is_empty() || ep.api_url.trim().is_empty() {
            continue;
        }
        let uid = normalize_exported_endpoint_id(ep.id.as_deref())?
            .ok_or_else(|| AppError::InvalidArgument(format!("端点 '{}' 缺少稳定 ID", ep.name)))?;
        if !imported_ids.insert(uid.clone()) {
            return Err(AppError::InvalidArgument(format!("配置包含重复的端点 ID: {uid}")));
        }
        if !imported_names.insert(ep.name.clone()) {
            return Err(AppError::InvalidArgument(format!(
                "配置包含重复的端点名称: {}",
                ep.name
            )));
        }
        let mut item = ep.clone();
        item.id = Some(uid);
        normalized.push(item);
    }

    let tx = conn.transaction()?;
    let mut s = ImportSummary::default();

    for ep in &normalized {
        let uid = ep.id.as_deref().unwrap();
        let existing: Option<i64> = tx
            .query_row(
                "SELECT id FROM endpoints WHERE uid = ?1",
                params![uid],
                |row| row.get(0),
            )
            .optional()?;

        if let Some(conflict_id) = tx
            .query_row(
                "SELECT id FROM endpoints WHERE name = ?1 AND uid <> ?2",
                params![ep.name, uid],
                |row| row.get::<_, i64>(0),
            )
            .optional()?
        {
            let renamed = format!("{} (冲突)", ep.name);
            tx.execute(
                "UPDATE endpoints SET name=?1, updated_at=datetime('now') WHERE id=?2",
                params![renamed, conflict_id],
            )?;
        }

        let models_json = serde_json::to_string(&ep.models).unwrap_or_else(|_| "[]".to_string());
        let active: Vec<String> = ep
            .active_models
            .iter()
            .filter(|a| ep.models.iter().any(|m| m == *a))
            .cloned()
            .collect();
        let active_json = serde_json::to_string(&active).unwrap_or_else(|_| "[]".to_string());
        let mappings_json =
            serde_json::to_string(&ep.model_mappings).unwrap_or_else(|_| "[]".to_string());

        let id = if let Some(id) = existing {
            tx.execute(
                "UPDATE endpoints SET name=?1, api_url=?2, api_key=?3, auth_mode=?4, enabled=?5,
                    use_proxy=?6, transformer=?7, model=?8, models=?9, active_models=?10,
                    model_mappings=?11, remark=?12, sort_order=?13, fast=?14, fast_sort_order=?15,
                    archived=0, updated_at=datetime('now') WHERE id=?16",
                params![
                    ep.name,
                    ep.api_url,
                    ep.api_key,
                    ep.auth_mode,
                    ep.enabled as i64,
                    ep.use_proxy as i64,
                    ep.transformer,
                    ep.model,
                    models_json,
                    active_json,
                    mappings_json,
                    ep.remark,
                    ep.sort_order,
                    ep.fast as i64,
                    ep.fast_sort_order,
                    id,
                ],
            )?;
            s.endpoints_updated += 1;
            id
        } else {
            tx.execute(
                "INSERT INTO endpoints
                    (uid, name, api_url, api_key, auth_mode, enabled, use_proxy, transformer, model,
                     models, active_models, model_mappings, remark, sort_order, fast, fast_sort_order, archived)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,0)",
                params![
                    uid,
                    ep.name,
                    ep.api_url,
                    ep.api_key,
                    ep.auth_mode,
                    ep.enabled as i64,
                    ep.use_proxy as i64,
                    ep.transformer,
                    ep.model,
                    models_json,
                    active_json,
                    mappings_json,
                    ep.remark,
                    ep.sort_order,
                    ep.fast as i64,
                    ep.fast_sort_order,
                ],
            )?;
            s.endpoints_added += 1;
            tx.last_insert_rowid()
        };

        tx.execute(
            "DELETE FROM endpoint_credentials WHERE endpoint_id=?1",
            params![id],
        )?;
        for c in &ep.credentials {
            tx.execute(
                "INSERT INTO endpoint_credentials(endpoint_id, api_key, enabled, sort_order)
                 VALUES(?1,?2,?3,?4)",
                params![id, c.api_key, c.enabled as i64, c.sort_order],
            )?;
            s.credentials += 1;
        }
    }

    if imported_ids.is_empty() {
        let ids: Vec<i64> = {
            let mut stmt = tx.prepare("SELECT id FROM endpoints WHERE archived = 0")?;
            let rows = stmt.query_map([], |r| r.get(0))?;
            rows.collect::<rusqlite::Result<Vec<_>>>()?
        };
        for id in ids {
            tx.execute("DELETE FROM endpoints WHERE id=?1", params![id])?;
        }
    } else {
        let placeholders = vec!["?"; imported_ids.len()].join(",");
        let sql = format!(
            "SELECT id FROM endpoints WHERE archived = 0 AND uid NOT IN ({placeholders})"
        );
        let ids: Vec<i64> = {
            let mut stmt = tx.prepare(&sql)?;
            let rows = stmt.query_map(params_from_iter(imported_ids.iter()), |r| r.get(0))?;
            rows.collect::<rusqlite::Result<Vec<_>>>()?
        };
        for id in ids {
            tx.execute("DELETE FROM endpoints WHERE id=?1", params![id])?;
        }
    }

    tx.commit()?;
    Ok(s)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::storage::migration::run_migrations;

    fn db() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        run_migrations(&c).unwrap();
        c
    }

    fn seed(conn: &Connection) {
        conn.execute(
            "INSERT INTO endpoints(uid, name, api_url, api_key, enabled, use_proxy, transformer, model, models, remark)
             VALUES('11111111-1111-4111-8111-111111111111','ep1','https://a','k1',1,1,'openai','gpt', '[\"gpt\",\"o3\"]','r1')",
            [],
        )
        .unwrap();
        let id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO endpoint_credentials(endpoint_id, api_key, enabled, sort_order) VALUES(?1,'cred-a',1,0)",
            params![id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO app_config(key,value) VALUES('theme','dark')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO app_config(key,value) VALUES('webdav_password','secret')",
            [],
        )
        .unwrap();
    }

    #[test]
    fn export_includes_endpoints_credentials_and_whitelist_only() {
        let c = db();
        seed(&c);
        let bundle = build_config_bundle(&c).unwrap();
        assert_eq!(bundle.kind, "ccmesh-config");
        assert_eq!(bundle.endpoints.len(), 1);
        let ep = &bundle.endpoints[0];
        assert_eq!(
            ep.id.as_deref(),
            Some("11111111-1111-4111-8111-111111111111")
        );
        assert_eq!(ep.models, vec!["gpt".to_string(), "o3".to_string()]);
        assert!(ep.model_mappings.is_empty());
        assert!(ep.use_proxy);
        assert_eq!(ep.credentials.len(), 1);
        assert_eq!(ep.credentials[0].api_key, "cred-a");
        assert_eq!(bundle.config.get("theme").map(String::as_str), Some("dark"));
        // webdav_password 被排除
        assert!(!bundle.config.contains_key("webdav_password"));
    }

    #[test]
    fn import_adds_then_skips_or_overwrites() {
        let src = db();
        seed(&src);
        let bundle = build_config_bundle(&src).unwrap();

        // 导入到空库：新增
        let mut dst = db();
        let s1 = import_config_bundle(&mut dst, &bundle, false).unwrap();
        assert_eq!(s1.endpoints_added, 1);
        assert_eq!(s1.credentials, 1);
        assert_eq!(s1.config_keys, 1); // 仅 theme
        let imported_uid: String = dst
            .query_row("SELECT uid FROM endpoints WHERE name = 'ep1'", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(imported_uid, "11111111-1111-4111-8111-111111111111");

        // 再次非覆盖导入：跳过同名
        let s2 = import_config_bundle(&mut dst, &bundle, false).unwrap();
        assert_eq!(s2.endpoints_skipped, 1);
        assert_eq!(s2.endpoints_added, 0);

        // 覆盖导入：更新 + 重置凭证（仍为 1 条，不翻倍）
        let s3 = import_config_bundle(&mut dst, &bundle, true).unwrap();
        assert_eq!(s3.endpoints_updated, 1);
        let cred_count: i64 = dst
            .query_row("SELECT COUNT(*) FROM endpoint_credentials", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(cred_count, 1);
    }

    #[test]
    fn import_rejects_wrong_type() {
        let mut dst = db();
        let bad = ConfigBundle {
            kind: "something-else".to_string(),
            version: 1,
            app_version: "0".to_string(),
            exported_at: String::new(),
            endpoints: vec![],
            config: BTreeMap::new(),
        };
        assert!(import_config_bundle(&mut dst, &bad, false).is_err());
    }

    #[test]
    fn legacy_v1_import_generates_endpoint_id() {
        let bundle: ConfigBundle = serde_json::from_value(serde_json::json!({
            "type": "ccmesh-config",
            "version": 1,
            "appVersion": "0.2.1",
            "exportedAt": "2026-07-16T09:24:22+08:00",
            "endpoints": [{
                "name": "UF - grok",
                "apiUrl": "http://ssss",
                "apiKey": "sk-sss",
                "authMode": "api_key",
                "enabled": true,
                "useProxy": false,
                "transformer": "openai",
                "model": "",
                "models": [
                    "grok-build-0.1",
                    "grok-4.5",
                    "grok-4.3",
                    "grok-4.20-0309-reasoning",
                    "grok-4.20-0309-non-reasoning",
                    "grok-4.20-multi-agent-0309",
                    "grok-3-mini",
                    "grok-3-mini-fast",
                    "grok-composer-2.5-fast",
                    "gpt-image-2",
                    "grok-imagine-image",
                    "grok-imagine-image-quality",
                    "grok-imagine-video",
                    "grok-imagine-video-1.5-preview"
                ],
                "activeModels": [],
                "remark": "",
                "sortOrder": 0,
                "credentials": []
            }]
        }))
        .unwrap();
        let mut dst = db();

        import_config_bundle(&mut dst, &bundle, false).unwrap();

        let uid: String = dst
            .query_row(
                "SELECT uid FROM endpoints WHERE name = 'UF - grok'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(Uuid::parse_str(&uid).is_ok());
    }

    #[test]
    fn overwrite_matches_stable_id_after_rename() {
        let src = db();
        seed(&src);
        let mut bundle = build_config_bundle(&src).unwrap();
        bundle.endpoints[0].name = "renamed".into();
        let mut dst = db();
        import_config_bundle(&mut dst, &build_config_bundle(&src).unwrap(), false).unwrap();

        import_config_bundle(&mut dst, &bundle, true).unwrap();

        let count: i64 = dst
            .query_row("SELECT COUNT(*) FROM endpoints", [], |row| row.get(0))
            .unwrap();
        let uid: String = dst
            .query_row(
                "SELECT uid FROM endpoints WHERE name = 'renamed'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
        assert_eq!(uid, "11111111-1111-4111-8111-111111111111");
    }

    #[test]
    fn import_preserves_local_id_for_same_name_from_another_upgraded_device() {
        let src = db();
        seed(&src);
        let mut bundle = build_config_bundle(&src).unwrap();
        bundle.endpoints[0].id = Some("22222222-2222-4222-8222-222222222222".into());
        let mut dst = db();
        seed(&dst);

        bundle.endpoints[0].api_url = "https://remote.example.com".into();
        let summary = import_config_bundle(&mut dst, &bundle, true).unwrap();

        assert_eq!(summary.endpoints_updated, 1);
        assert_eq!(summary.identities_preserved, 1);
        let (uid, api_url): (String, String) = dst
            .query_row(
                "SELECT uid, api_url FROM endpoints WHERE name='ep1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(uid, "11111111-1111-4111-8111-111111111111");
        assert_eq!(api_url, "https://remote.example.com");
    }

    #[test]
    fn import_rejects_invalid_stable_id() {
        let src = db();
        seed(&src);
        let mut bundle = build_config_bundle(&src).unwrap();
        bundle.endpoints[0].id = Some("not-a-uuid".into());
        let mut dst = db();

        let err = import_config_bundle(&mut dst, &bundle, false).unwrap_err();

        assert!(err.to_string().contains("无效的端点 ID"));
    }

    #[test]
    fn import_rejects_duplicate_stable_ids_in_bundle() {
        let src = db();
        seed(&src);
        let mut bundle = build_config_bundle(&src).unwrap();
        let mut duplicate = bundle.endpoints[0].clone();
        duplicate.name = "duplicate".into();
        bundle.endpoints.push(duplicate);
        let mut dst = db();

        let err = import_config_bundle(&mut dst, &bundle, true).unwrap_err();

        assert!(err.to_string().contains("重复的端点 ID"));
        let count: i64 = dst
            .query_row("SELECT COUNT(*) FROM endpoints", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn model_mappings_roundtrip_via_import() {
        use crate::models::endpoint::ModelMapping;
        let src = db();
        seed(&src);
        let mut bundle = build_config_bundle(&src).unwrap();
        bundle.endpoints[0].model_mappings = vec![ModelMapping {
            from: "alias".into(),
            to: "gpt".into(),
        }];
        bundle.endpoints[0].active_models = vec!["gpt".into()];

        let mut dst = db();
        import_config_bundle(&mut dst, &bundle, true).unwrap();
        let ep = endpoint_repo::list_all(&dst).unwrap().into_iter().next().unwrap();
        assert_eq!(ep.models, vec!["gpt".to_string(), "o3".to_string()]);
        assert_eq!(ep.active_models, vec!["gpt".to_string()]);
        assert_eq!(ep.model_mappings.len(), 1);
        assert_eq!(ep.model_mappings[0].from, "alias");
        assert_eq!(ep.model_mappings[0].to, "gpt");
    }
}
