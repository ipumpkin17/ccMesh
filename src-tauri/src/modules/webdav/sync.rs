use std::path::Path;

use rusqlite::{params, params_from_iter, Connection};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::modules::storage::config_repo::SAFE_CONFIG_KEYS;
use crate::modules::storage::migration::run_migrations;

fn sql_quote(path: &Path) -> String {
    path.to_string_lossy().replace('\'', "''")
}

fn placeholders(n: usize) -> String {
    vec!["?"; n].join(",")
}

fn validate_backup_ids(conn: &Connection, table: &str, column: &str) -> AppResult<()> {
    let sql = format!("SELECT DISTINCT {column} FROM backup.{table} WHERE {column} <> ''");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    for value in rows {
        let value = value?;
        let canonical = Uuid::parse_str(&value)
            .map(|parsed| parsed.to_string() == value)
            .unwrap_or(false);
        if !canonical {
            return Err(AppError::InvalidArgument(format!(
                "WebDAV 备份包含无效或非规范的端点 ID: {value}"
            )));
        }
    }
    Ok(())
}

/// 生成可上传的数据库副本：VACUUM INTO 临时文件，并剔除设备特定配置（仅保留安全键）。
pub fn create_backup_copy(conn: &Connection, temp_path: &Path) -> AppResult<()> {
    if temp_path.exists() {
        let _ = std::fs::remove_file(temp_path);
    }
    conn.execute_batch(&format!("VACUUM INTO '{}'", sql_quote(temp_path)))?;

    let backup = Connection::open(temp_path)?;
    backup.execute(
        &format!(
            "DELETE FROM app_config WHERE key NOT IN ({})",
            placeholders(SAFE_CONFIG_KEYS.len())
        ),
        params_from_iter(SAFE_CONFIG_KEYS.iter()),
    )?;
    Ok(())
}

/// 将备份库 ATTACH 后合并到本地：
/// - app_config：仅安全键；overwrite=REPLACE / keep=IGNORE
/// - endpoints：按稳定 uid；名称仅作为可更新展示字段
/// - daily_stats：仅同步带 endpoint_id 的新统计，重打本地 device_id；旧名称统计忽略
pub fn merge_from_backup(
    conn: &mut Connection,
    backup_path: &Path,
    overwrite: bool,
    device_id: &str,
) -> AppResult<()> {
    // WebDAV 下载文件是临时副本，可先迁移到当前结构；旧统计 ID 保持空串并在合并时忽略。
    // 这样 v13 及更早备份仍能恢复端点配置，而不会把名称历史强行映射成统计身份。
    {
        let backup = Connection::open(backup_path)?;
        run_migrations(&backup)?;
    }
    conn.execute_batch(&format!(
        "ATTACH DATABASE '{}' AS backup",
        sql_quote(backup_path)
    ))?;

    let result = (|| -> AppResult<()> {
        validate_backup_ids(conn, "endpoints", "uid")?;
        validate_backup_ids(conn, "daily_stats", "endpoint_id")?;
        let mode = if overwrite { "OR REPLACE" } else { "OR IGNORE" };
        let tx = conn.transaction()?;

        tx.execute(
            &format!(
                "INSERT {mode} INTO app_config(key, value)
                 SELECT key, value FROM backup.app_config WHERE key IN ({})",
                placeholders(SAFE_CONFIG_KEYS.len())
            ),
            params_from_iter(SAFE_CONFIG_KEYS.iter()),
        )?;

        if overwrite {
            tx.execute(
                "INSERT INTO endpoints(
                    uid, name, api_url, api_key, auth_mode, enabled, use_proxy, transformer, model,
                    models, active_models, model_mappings, remark, sort_order, fast, fast_sort_order,
                    test_status, archived
                 )
                 SELECT COALESCE(local_by_uid.uid, local_by_name.uid, remote.uid),
                        remote.name, remote.api_url, remote.api_key, remote.auth_mode,
                        remote.enabled, remote.use_proxy, remote.transformer, remote.model,
                        remote.models, remote.active_models, remote.model_mappings, remote.remark,
                        remote.sort_order, remote.fast, remote.fast_sort_order,
                        remote.test_status, remote.archived
                 FROM backup.endpoints remote
                 LEFT JOIN endpoints local_by_uid ON local_by_uid.uid = remote.uid
                 LEFT JOIN endpoints local_by_name ON local_by_name.name = remote.name
                 WHERE remote.uid <> ''
                 ON CONFLICT(uid) WHERE uid <> '' DO UPDATE SET
                    name=excluded.name, api_url=excluded.api_url, api_key=excluded.api_key,
                    auth_mode=excluded.auth_mode, enabled=excluded.enabled,
                    use_proxy=excluded.use_proxy, transformer=excluded.transformer, model=excluded.model,
                    models=excluded.models, active_models=excluded.active_models,
                    model_mappings=excluded.model_mappings, remark=excluded.remark,
                    sort_order=excluded.sort_order, fast=excluded.fast,
                    fast_sort_order=excluded.fast_sort_order, test_status=excluded.test_status,
                    archived=excluded.archived, updated_at=datetime('now')",
                [],
            )?;
        } else {
            tx.execute(
                "INSERT OR IGNORE INTO endpoints(
                    uid, name, api_url, api_key, auth_mode, enabled, use_proxy, transformer, model,
                    models, active_models, model_mappings, remark, sort_order, fast, fast_sort_order,
                    test_status, archived
                 )
                 SELECT COALESCE(local_by_uid.uid, local_by_name.uid, remote.uid),
                        remote.name, remote.api_url, remote.api_key, remote.auth_mode,
                        remote.enabled, remote.use_proxy, remote.transformer, remote.model,
                        remote.models, remote.active_models, remote.model_mappings, remote.remark,
                        remote.sort_order, remote.fast, remote.fast_sort_order,
                        remote.test_status, remote.archived
                 FROM backup.endpoints remote
                 LEFT JOIN endpoints local_by_uid ON local_by_uid.uid = remote.uid
                 LEFT JOIN endpoints local_by_name ON local_by_name.name = remote.name
                 WHERE remote.uid <> ''",
                [],
            )?;
        }


        // 同步端点多凭证：按远端 endpoint.uid 对齐到本地 endpoint 行 id。
        // overwrite 时先清本地相关凭证再重建；keep 时仅补本地尚无凭证的端点。
        if overwrite {
            tx.execute(
                "DELETE FROM endpoint_credentials
                 WHERE endpoint_id IN (
                    SELECT local.id
                    FROM endpoints local
                    JOIN backup.endpoints remote
                      ON remote.uid = local.uid
                     OR (remote.uid <> '' AND local.name = remote.name)
                 )",
                [],
            )?;
            tx.execute(
                "INSERT INTO endpoint_credentials(endpoint_id, api_key, enabled, sort_order)
                 SELECT local.id, remote_cred.api_key, remote_cred.enabled, remote_cred.sort_order
                 FROM backup.endpoint_credentials remote_cred
                 JOIN backup.endpoints remote ON remote.id = remote_cred.endpoint_id
                 JOIN endpoints local
                   ON local.uid = remote.uid
                   OR (remote.uid <> '' AND local.name = remote.name)
                 WHERE remote.uid <> ''",
                [],
            )?;
        } else {
            tx.execute(
                "INSERT INTO endpoint_credentials(endpoint_id, api_key, enabled, sort_order)
                 SELECT local.id, remote_cred.api_key, remote_cred.enabled, remote_cred.sort_order
                 FROM backup.endpoint_credentials remote_cred
                 JOIN backup.endpoints remote ON remote.id = remote_cred.endpoint_id
                 JOIN endpoints local
                   ON local.uid = remote.uid
                   OR (remote.uid <> '' AND local.name = remote.name)
                 WHERE remote.uid <> ''
                   AND NOT EXISTS (
                        SELECT 1 FROM endpoint_credentials existing
                        WHERE existing.endpoint_id = local.id
                   )",
                [],
            )?;
        }

        if overwrite {
            tx.execute(
                "DELETE FROM daily_stats WHERE EXISTS (
                    SELECT 1
                    FROM backup.daily_stats remote_stat
                    LEFT JOIN backup.endpoints remote_endpoint
                      ON remote_endpoint.uid = remote_stat.endpoint_id
                    LEFT JOIN endpoints local_by_uid
                      ON local_by_uid.uid = remote_stat.endpoint_id
                    LEFT JOIN endpoints local_by_name
                      ON local_by_name.name = remote_endpoint.name
                    WHERE remote_stat.endpoint_id <> ''
                      AND COALESCE(local_by_uid.uid, local_by_name.uid, remote_stat.endpoint_id)
                          = daily_stats.endpoint_id
                      AND remote_stat.date = daily_stats.date
                 )",
                [],
            )?;
        }
        tx.execute(
            &format!(
                "WITH normalized AS (
                    SELECT COALESCE(local_by_uid.uid, local_by_name.uid, remote_stat.endpoint_id)
                               AS endpoint_id,
                           remote_stat.endpoint_name, remote_stat.date, remote_stat.requests,
                           remote_stat.errors, remote_stat.input_tokens, remote_stat.output_tokens,
                           remote_stat.cache_creation_tokens, remote_stat.cache_read_tokens
                    FROM backup.daily_stats remote_stat
                    LEFT JOIN backup.endpoints remote_endpoint
                      ON remote_endpoint.uid = remote_stat.endpoint_id
                    LEFT JOIN endpoints local_by_uid
                      ON local_by_uid.uid = remote_stat.endpoint_id
                    LEFT JOIN endpoints local_by_name
                      ON local_by_name.name = remote_endpoint.name
                    WHERE remote_stat.endpoint_id <> ''
                 )
                 INSERT {mode} INTO daily_stats
                    (endpoint_id, endpoint_name, date, requests, errors, input_tokens, output_tokens,
                     cache_creation_tokens, cache_read_tokens, device_id)
                 SELECT endpoint_id, MAX(endpoint_name), date, SUM(requests), SUM(errors),
                        SUM(input_tokens), SUM(output_tokens), SUM(cache_creation_tokens),
                        SUM(cache_read_tokens), ?1
                 FROM normalized GROUP BY endpoint_id, date"
            ),
            params![device_id],
        )?;

        tx.commit()?;
        Ok(())
    })();

    let _ = conn.execute_batch("DETACH DATABASE backup");
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::storage::migration::run_migrations;
    use rusqlite::Connection;

    #[test]
    fn rejects_invalid_endpoint_id_from_backup() {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(
            "ATTACH DATABASE ':memory:' AS backup;
             CREATE TABLE backup.endpoints(uid TEXT NOT NULL);
             INSERT INTO backup.endpoints(uid) VALUES('not-a-uuid');",
        )
        .unwrap();

        let err = validate_backup_ids(&c, "endpoints", "uid").unwrap_err();

        assert!(err.to_string().contains("无效或非规范的端点 ID"));
    }

    #[test]
    fn rejects_noncanonical_endpoint_id_from_backup() {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(
            "ATTACH DATABASE ':memory:' AS backup;
             CREATE TABLE backup.endpoints(uid TEXT NOT NULL);
             INSERT INTO backup.endpoints(uid)
             VALUES('AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA');",
        )
        .unwrap();

        let err = validate_backup_ids(&c, "endpoints", "uid").unwrap_err();

        assert!(err.to_string().contains("非规范的端点 ID"));
    }

    #[test]
    fn merge_upgrades_v13_backup_and_keeps_legacy_stats_unidentified() {
        let dir = std::env::temp_dir();
        let pid = std::process::id();
        let backup_path = dir.join(format!("ccx_v13_{pid}.db"));
        let target_path = dir.join(format!("ccx_v15_target_{pid}.db"));
        for path in [&backup_path, &target_path] {
            let _ = std::fs::remove_file(path);
        }
        let legacy = Connection::open(&backup_path).unwrap();
        legacy
            .execute_batch(
                "CREATE TABLE schema_version(version INTEGER NOT NULL);
                 INSERT INTO schema_version(version) VALUES(13);
                 CREATE TABLE app_config(key TEXT PRIMARY KEY, value TEXT NOT NULL);
                 CREATE TABLE endpoints(
                    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
                    api_url TEXT NOT NULL, api_key TEXT NOT NULL DEFAULT '',
                    auth_mode TEXT NOT NULL DEFAULT 'api_key', enabled INTEGER NOT NULL DEFAULT 1,
                    transformer TEXT NOT NULL DEFAULT 'claude', model TEXT NOT NULL DEFAULT '',
                    remark TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0,
                    test_status TEXT NOT NULL DEFAULT 'unknown', created_at TEXT NOT NULL DEFAULT '',
                    updated_at TEXT NOT NULL DEFAULT '', models TEXT NOT NULL DEFAULT '[]',
                    use_proxy INTEGER NOT NULL DEFAULT 0, model_mappings TEXT NOT NULL DEFAULT '[]',
                    active_models TEXT NOT NULL DEFAULT '[]', fast INTEGER NOT NULL DEFAULT 0,
                    fast_sort_order INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0
                 );
                 CREATE TABLE daily_stats(
                    id INTEGER PRIMARY KEY AUTOINCREMENT, endpoint_name TEXT NOT NULL,
                    date TEXT NOT NULL, requests INTEGER NOT NULL DEFAULT 0,
                    errors INTEGER NOT NULL DEFAULT 0, input_tokens INTEGER NOT NULL DEFAULT 0,
                    output_tokens INTEGER NOT NULL DEFAULT 0, device_id TEXT NOT NULL DEFAULT '',
                    cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
                    cache_read_tokens INTEGER NOT NULL DEFAULT 0,
                    UNIQUE(endpoint_name,date,device_id)
                 );
                 CREATE TABLE request_logs(id INTEGER PRIMARY KEY AUTOINCREMENT);
                 INSERT INTO endpoints(name,api_url) VALUES('legacy','https://legacy.example.com');
                 INSERT INTO daily_stats(endpoint_name,date,requests,device_id)
                    VALUES('legacy','2026-07-01',3,'OLD');",
            )
            .unwrap();
        drop(legacy);

        let mut target = Connection::open(&target_path).unwrap();
        run_migrations(&target).unwrap();
        merge_from_backup(&mut target, &backup_path, true, "LOCAL").unwrap();

        let uid: String = target
            .query_row("SELECT uid FROM endpoints WHERE name='legacy'", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert!(Uuid::parse_str(&uid).is_ok());
        let stats_count: i64 = target
            .query_row("SELECT COUNT(*) FROM daily_stats", [], |row| row.get(0))
            .unwrap();
        assert_eq!(stats_count, 0);

        drop(target);
        for path in [&backup_path, &target_path] {
            let _ = std::fs::remove_file(path);
        }
    }

    #[test]
    fn backup_strips_device_config_and_merge_restamps_device() {
        let dir = std::env::temp_dir();
        let pid = std::process::id();
        let src_path = dir.join(format!("ccx_src_{pid}.db"));
        let bk_path = dir.join(format!("ccx_bk_{pid}.db"));
        let tgt_path = dir.join(format!("ccx_tgt_{pid}.db"));
        for p in [&src_path, &bk_path, &tgt_path] {
            let _ = std::fs::remove_file(p);
        }

        // 源库：安全键 theme + 设备键 device_id + 稳定 ID 端点和统计（设备 SRC）
        let src = Connection::open(&src_path).unwrap();
        run_migrations(&src).unwrap();
        src.execute(
            "INSERT INTO app_config(key,value) VALUES('theme','dark'),('device_id','SRC')",
            [],
        )
        .unwrap();
        src.execute(
            "INSERT INTO endpoints(uid,name,api_url)
             VALUES('11111111-1111-4111-8111-111111111111','ep','https://example.com')",
            [],
        )
        .unwrap();
        src.execute(
            "INSERT INTO daily_stats(endpoint_id,endpoint_name,date,requests,errors,input_tokens,output_tokens,device_id)
             VALUES('11111111-1111-4111-8111-111111111111','ep','2026-06-05',5,0,0,0,'SRC')",
            [],
        )
        .unwrap();

        create_backup_copy(&src, &bk_path).unwrap();

        // 备份副本：theme 保留，device_id 被剔除
        let bk = Connection::open(&bk_path).unwrap();
        let theme: Option<String> = bk
            .query_row("SELECT value FROM app_config WHERE key='theme'", [], |r| {
                r.get(0)
            })
            .ok();
        assert_eq!(theme.as_deref(), Some("dark"));
        let dev: Option<String> = bk
            .query_row(
                "SELECT value FROM app_config WHERE key='device_id'",
                [],
                |r| r.get(0),
            )
            .ok();
        assert!(dev.is_none());
        drop(bk);

        // 目标库合并（overwrite）：daily_stats 重打本地 device_id
        let mut tgt = Connection::open(&tgt_path).unwrap();
        run_migrations(&tgt).unwrap();
        tgt.execute(
            "INSERT INTO endpoints(uid,name,api_url)
             VALUES('22222222-2222-4222-8222-222222222222','ep','https://local.example.com')",
            [],
        )
        .unwrap();
        merge_from_backup(&mut tgt, &bk_path, true, "LOCAL").unwrap();

        let dev: String = tgt
            .query_row(
                "SELECT device_id FROM daily_stats
                 WHERE endpoint_id='22222222-2222-4222-8222-222222222222'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(dev, "LOCAL");
        let reqs: i64 = tgt
            .query_row(
                "SELECT requests FROM daily_stats
                 WHERE endpoint_id='22222222-2222-4222-8222-222222222222'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(reqs, 5);
        let endpoint_uid: String = tgt
            .query_row("SELECT uid FROM endpoints WHERE name='ep'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(endpoint_uid, "22222222-2222-4222-8222-222222222222");
        let theme: String = tgt
            .query_row("SELECT value FROM app_config WHERE key='theme'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(theme, "dark");

        drop(tgt);
        for p in [&src_path, &bk_path, &tgt_path] {
            let _ = std::fs::remove_file(p);
        }
    }

    #[test]
    fn merge_preserves_models_mappings_and_credentials() {
        let dir = std::env::temp_dir();
        let pid = std::process::id();
        let src_path = dir.join(format!("ccx_models_src_{pid}.db"));
        let bk_path = dir.join(format!("ccx_models_bk_{pid}.db"));
        let tgt_path = dir.join(format!("ccx_models_tgt_{pid}.db"));
        for p in [&src_path, &bk_path, &tgt_path] {
            let _ = std::fs::remove_file(p);
        }

        let src = Connection::open(&src_path).unwrap();
        run_migrations(&src).unwrap();
        src.execute(
            "INSERT INTO endpoints(
                uid,name,api_url,api_key,enabled,use_proxy,transformer,model,models,active_models,model_mappings,remark
             ) VALUES(
                '11111111-1111-4111-8111-111111111111','ep','https://example.com','k1',1,0,'openai','',
                ?1,?2,?3,'r'
             )",
            rusqlite::params![
                r#"["gpt","o3"]"#,
                r#"["gpt"]"#,
                r#"[{"from":"gpt-alias","to":"gpt"}]"#,
            ],
        )
        .unwrap();
        let src_id = src.last_insert_rowid();
        src.execute(
            "INSERT INTO endpoint_credentials(endpoint_id, api_key, enabled, sort_order)
             VALUES(?1, 'cred-a', 1, 0), (?1, 'cred-b', 1, 1)",
            rusqlite::params![src_id],
        )
        .unwrap();

        create_backup_copy(&src, &bk_path).unwrap();

        let mut tgt = Connection::open(&tgt_path).unwrap();
        run_migrations(&tgt).unwrap();
        tgt.execute(
            "INSERT INTO endpoints(uid,name,api_url,api_key,models,active_models,model_mappings)
             VALUES('11111111-1111-4111-8111-111111111111','ep','https://local.example.com','old',
                    '[]','[]','[]')",
            [],
        )
        .unwrap();
        let tgt_id = tgt.last_insert_rowid();
        tgt.execute(
            "INSERT INTO endpoint_credentials(endpoint_id, api_key, enabled, sort_order)
             VALUES(?1, 'old-cred', 1, 0)",
            rusqlite::params![tgt_id],
        )
        .unwrap();

        merge_from_backup(&mut tgt, &bk_path, true, "LOCAL").unwrap();

        let models: String = tgt
            .query_row(
                "SELECT models FROM endpoints WHERE uid='11111111-1111-4111-8111-111111111111'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let active: String = tgt
            .query_row(
                "SELECT active_models FROM endpoints WHERE uid='11111111-1111-4111-8111-111111111111'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let mappings: String = tgt
            .query_row(
                "SELECT model_mappings FROM endpoints WHERE uid='11111111-1111-4111-8111-111111111111'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(models, r#"["gpt","o3"]"#);
        assert_eq!(active, r#"["gpt"]"#);
        assert!(mappings.contains("gpt-alias"));

        let cred_count: i64 = tgt
            .query_row(
                "SELECT COUNT(*) FROM endpoint_credentials c
                 JOIN endpoints e ON e.id = c.endpoint_id
                 WHERE e.uid='11111111-1111-4111-8111-111111111111'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(cred_count, 2);
        let has_old: i64 = tgt
            .query_row(
                "SELECT COUNT(*) FROM endpoint_credentials WHERE api_key='old-cred'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(has_old, 0);

        drop(tgt);
        for p in [&src_path, &bk_path, &tgt_path] {
            let _ = std::fs::remove_file(p);
        }
    }
}
