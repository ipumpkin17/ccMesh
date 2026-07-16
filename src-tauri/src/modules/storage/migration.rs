use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::error::AppResult;

/// 版本化迁移脚本。新增表/列时在末尾追加一条，`run_migrations` 会按当前版本幂等增量执行。
const MIGRATIONS: &[&str] = &[
    // v1：核心表 + 索引
    "CREATE TABLE IF NOT EXISTS endpoints (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        name         TEXT    NOT NULL UNIQUE,
        api_url      TEXT    NOT NULL,
        api_key      TEXT    NOT NULL DEFAULT '',
        auth_mode    TEXT    NOT NULL DEFAULT 'api_key',
        enabled      INTEGER NOT NULL DEFAULT 1,
        transformer  TEXT    NOT NULL DEFAULT 'claude',
        model        TEXT    NOT NULL DEFAULT '',
        remark       TEXT    NOT NULL DEFAULT '',
        sort_order   INTEGER NOT NULL DEFAULT 0,
        test_status  TEXT    NOT NULL DEFAULT 'unknown',
        created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS endpoint_credentials (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint_id  INTEGER NOT NULL,
        api_key      TEXT    NOT NULL,
        enabled      INTEGER NOT NULL DEFAULT 1,
        sort_order   INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint_name TEXT    NOT NULL,
        date          TEXT    NOT NULL,
        requests      INTEGER NOT NULL DEFAULT 0,
        errors        INTEGER NOT NULL DEFAULT 0,
        input_tokens  INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        device_id     TEXT    NOT NULL DEFAULT '',
        UNIQUE(endpoint_name, date, device_id)
    );
    CREATE INDEX IF NOT EXISTS idx_daily_stats_date     ON daily_stats(date);
    CREATE INDEX IF NOT EXISTS idx_daily_stats_endpoint ON daily_stats(endpoint_name);
    CREATE INDEX IF NOT EXISTS idx_daily_stats_device   ON daily_stats(device_id);

    CREATE TABLE IF NOT EXISTS credential_usage (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint_name    TEXT    NOT NULL,
        credential_index INTEGER NOT NULL DEFAULT 0,
        date             TEXT    NOT NULL,
        requests         INTEGER NOT NULL DEFAULT 0,
        errors           INTEGER NOT NULL DEFAULT 0,
        input_tokens     INTEGER NOT NULL DEFAULT 0,
        output_tokens    INTEGER NOT NULL DEFAULT 0,
        device_id        TEXT    NOT NULL DEFAULT '',
        UNIQUE(endpoint_name, credential_index, date, device_id)
    );

    CREATE TABLE IF NOT EXISTS app_config (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );",
    // v2：端点一对多模型清单 + 端点级代理开关
    "ALTER TABLE endpoints ADD COLUMN models    TEXT    NOT NULL DEFAULT '[]';
     ALTER TABLE endpoints ADD COLUMN use_proxy INTEGER NOT NULL DEFAULT 0;",
    // v3：daily_stats 增加缓存创建/读取 token 列；新增逐条请求明细表 request_logs
    "ALTER TABLE daily_stats ADD COLUMN cache_creation_tokens INTEGER NOT NULL DEFAULT 0;
     ALTER TABLE daily_stats ADD COLUMN cache_read_tokens     INTEGER NOT NULL DEFAULT 0;

     CREATE TABLE IF NOT EXISTS request_logs (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        ts                    INTEGER NOT NULL,
        endpoint_name         TEXT    NOT NULL,
        inbound_format        TEXT    NOT NULL DEFAULT '',
        upstream_url          TEXT    NOT NULL DEFAULT '',
        status_code           INTEGER,
        is_error              INTEGER NOT NULL DEFAULT 0,
        input_tokens          INTEGER NOT NULL DEFAULT 0,
        output_tokens         INTEGER NOT NULL DEFAULT 0,
        cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read_tokens     INTEGER NOT NULL DEFAULT 0,
        model                 TEXT,
        duration_ms           INTEGER,
        device_id             TEXT    NOT NULL DEFAULT ''
     );
     CREATE INDEX IF NOT EXISTS idx_request_logs_ts       ON request_logs(ts);
     CREATE INDEX IF NOT EXISTS idx_request_logs_endpoint ON request_logs(endpoint_name);",
    // v4：本机用量统计（Claude Code / Codex 会话 JSONL 增量同步）
    "CREATE TABLE IF NOT EXISTS usage_records (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        app_type              TEXT    NOT NULL,
        record_key            TEXT    NOT NULL,
        date                  TEXT    NOT NULL,
        model                 TEXT    NOT NULL DEFAULT '',
        requests              INTEGER NOT NULL DEFAULT 0,
        input_tokens          INTEGER NOT NULL DEFAULT 0,
        output_tokens         INTEGER NOT NULL DEFAULT 0,
        cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read_tokens     INTEGER NOT NULL DEFAULT 0,
        UNIQUE(app_type, record_key)
     );
     CREATE INDEX IF NOT EXISTS idx_usage_records_date ON usage_records(date);
     CREATE INDEX IF NOT EXISTS idx_usage_records_app  ON usage_records(app_type);

     CREATE TABLE IF NOT EXISTS usage_sync_state (
        file_path TEXT PRIMARY KEY,
        mtime_ns  INTEGER NOT NULL
     );",
    // v5：request_logs 记录真实入站/出站路由路径（监控"入站/出站"列展示用）。
    // 旧行默认空串，前端按 inbound_format 协议推断兜底。
    "ALTER TABLE request_logs ADD COLUMN inbound_path  TEXT NOT NULL DEFAULT '';
     ALTER TABLE request_logs ADD COLUMN upstream_path TEXT NOT NULL DEFAULT '';",
    // v6：request_logs 记录首字节延迟（首字）。流式取首个内容分片到达耗时，缓冲取响应头到达。
    // 旧行 / 无数据为 NULL，前端显示 —。
    "ALTER TABLE request_logs ADD COLUMN first_byte_ms INTEGER;",
    // v7：端点入站→出站模型映射（JSON 数组 [{from,to}]）。旧行默认空数组。
    "ALTER TABLE endpoints ADD COLUMN model_mappings TEXT NOT NULL DEFAULT '[]';",
    // v8：request_logs 记录实际(出站)模型。仅当映射/锁定改写后与请求模型不同才有值，旧行/透传为 NULL。
    "ALTER TABLE request_logs ADD COLUMN actual_model TEXT;",
    // v9：端点点亮（对外公布）模型子集（JSON 数组）。空数组=全部公布（向后兼容旧端点）。
    "ALTER TABLE endpoints ADD COLUMN active_models TEXT NOT NULL DEFAULT '[]';",
    // v10：request_logs 记录错误响应体。仅错误请求写入，旧行/无响应体为 NULL。
    "ALTER TABLE request_logs ADD COLUMN error_body TEXT;",
    // v11：request_logs 记录端点 transformer 快照（claude/openai/codex 等），用于前端按端点类型显示品牌图标。
    // 旧行为 NULL，前端回退 inbound_format 兜底。
    "ALTER TABLE request_logs ADD COLUMN transformer TEXT;",
    // v12：快速队列标记与快速队列独立排序。旧端点默认不进入快速队列。
    "ALTER TABLE endpoints ADD COLUMN fast INTEGER NOT NULL DEFAULT 0;
     ALTER TABLE endpoints ADD COLUMN fast_sort_order INTEGER NOT NULL DEFAULT 0;",
    // v13：归档标记。归档端点从主列表隐藏但保留配置，可还原或删除。
    "ALTER TABLE endpoints ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;",
    // v14：稳定端点唯一 ID。旧端点由 Rust 迁移逻辑补齐 UUID；空值仅用于迁移过渡。
    "ALTER TABLE endpoints ADD COLUMN uid TEXT NOT NULL DEFAULT '';
     CREATE UNIQUE INDEX idx_endpoints_uid ON endpoints(uid) WHERE uid <> '';",
    // v15：所有新统计改用稳定端点 ID。旧统计不回填，endpoint_id 保持空串等待用户清理。
    // daily_stats 需要重建以移除旧的 endpoint_name 唯一约束，避免端点改名/重建后继续按名称串线。
    "CREATE TABLE daily_stats_v15 (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint_id           TEXT    NOT NULL DEFAULT '',
        endpoint_name         TEXT    NOT NULL,
        date                  TEXT    NOT NULL,
        requests              INTEGER NOT NULL DEFAULT 0,
        errors                INTEGER NOT NULL DEFAULT 0,
        input_tokens          INTEGER NOT NULL DEFAULT 0,
        output_tokens         INTEGER NOT NULL DEFAULT 0,
        device_id             TEXT    NOT NULL DEFAULT '',
        cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read_tokens     INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO daily_stats_v15(
        id, endpoint_name, date, requests, errors, input_tokens, output_tokens, device_id,
        cache_creation_tokens, cache_read_tokens
    )
    SELECT id, endpoint_name, date, requests, errors, input_tokens, output_tokens, device_id,
           cache_creation_tokens, cache_read_tokens
    FROM daily_stats;
    DROP TABLE daily_stats;
    ALTER TABLE daily_stats_v15 RENAME TO daily_stats;
    CREATE INDEX idx_daily_stats_date ON daily_stats(date);
    CREATE INDEX idx_daily_stats_endpoint ON daily_stats(endpoint_name);
    CREATE INDEX idx_daily_stats_endpoint_id ON daily_stats(endpoint_id);
    CREATE INDEX idx_daily_stats_device ON daily_stats(device_id);
    CREATE UNIQUE INDEX idx_daily_stats_identity
        ON daily_stats(endpoint_id, date, device_id) WHERE endpoint_id <> '';

    ALTER TABLE request_logs ADD COLUMN endpoint_id TEXT NOT NULL DEFAULT '';
    CREATE INDEX idx_request_logs_endpoint_id ON request_logs(endpoint_id);",
    // v16：修复历史库结构不完整时缺失的多凭证表，保证旧版 WebDAV 备份可迁移后合并。
    "CREATE TABLE IF NOT EXISTS endpoint_credentials (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint_id  INTEGER NOT NULL,
        api_key      TEXT    NOT NULL,
        enabled      INTEGER NOT NULL DEFAULT 1,
        sort_order   INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
    );",
];

fn backfill_endpoint_uids(conn: &Connection) -> AppResult<()> {
    let ids = {
        let mut stmt = conn.prepare("SELECT id FROM endpoints WHERE uid = '' ORDER BY id ASC")?;
        let rows = stmt.query_map([], |row| row.get::<_, i64>(0))?;
        rows.collect::<rusqlite::Result<Vec<_>>>()?
    };

    for id in ids {
        let uid = Uuid::new_v4().to_string();
        conn.execute(
            "UPDATE endpoints SET uid = ?1 WHERE id = ?2 AND uid = ''",
            params![uid, id],
        )?;
    }
    Ok(())
}

/// 幂等执行迁移：读取 `schema_version` 当前版本，仅应用尚未执行的脚本。
pub fn run_migrations(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version    INTEGER NOT NULL,
            applied_at TEXT    NOT NULL DEFAULT (datetime('now'))
        );",
    )?;

    let current: i64 = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_version",
        [],
        |row| row.get(0),
    )?;

    for (idx, script) in MIGRATIONS.iter().enumerate() {
        let version = (idx + 1) as i64;
        if version > current {
            conn.execute_batch("BEGIN IMMEDIATE")?;
            let result = (|| -> AppResult<()> {
                conn.execute_batch(script)?;
                conn.execute("INSERT INTO schema_version(version) VALUES (?1)", [version])?;
                Ok(())
            })();
            if let Err(error) = result {
                let _ = conn.execute_batch("ROLLBACK");
                return Err(error);
            }
            if let Err(error) = conn.execute_batch("COMMIT") {
                let _ = conn.execute_batch("ROLLBACK");
                return Err(error.into());
            }
            tracing::info!(version, "已应用数据库迁移");
        }
    }

    backfill_endpoint_uids(conn)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_idempotent() {
        let c = Connection::open_in_memory().unwrap();
        run_migrations(&c).unwrap();
        run_migrations(&c).unwrap(); // 第二次为空操作
        let version: i64 = c
            .query_row("SELECT MAX(version) FROM schema_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version, MIGRATIONS.len() as i64);
        // 关键表存在
        let n: i64 = c
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('endpoints','daily_stats','app_config')",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(n, 3);
    }

    #[test]
    fn latest_migration_restores_missing_endpoint_credentials_table() {
        let c = Connection::open_in_memory().unwrap();
        run_migrations(&c).unwrap();
        c.execute_batch("DROP TABLE endpoint_credentials;").unwrap();
        c.execute(
            "DELETE FROM schema_version WHERE version = ?1",
            [MIGRATIONS.len() as i64],
        )
        .unwrap();

        run_migrations(&c).unwrap();

        let has_table: i64 = c
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master
                 WHERE type = 'table' AND name = 'endpoint_credentials'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(has_table, 1);
    }

    #[test]
    fn v2_adds_models_and_use_proxy_columns() {
        let c = Connection::open_in_memory().unwrap();
        run_migrations(&c).unwrap();
        let cols: Vec<String> = {
            let mut stmt = c.prepare("PRAGMA table_info(endpoints)").unwrap();
            let rows = stmt.query_map([], |r| r.get::<_, String>(1)).unwrap();
            rows.filter_map(Result::ok).collect()
        };
        assert!(cols.contains(&"models".to_string()));
        assert!(cols.contains(&"use_proxy".to_string()));
    }

    #[test]
    fn v3_adds_cache_columns_and_request_logs() {
        let c = Connection::open_in_memory().unwrap();
        run_migrations(&c).unwrap();
        let daily_cols: Vec<String> = {
            let mut stmt = c.prepare("PRAGMA table_info(daily_stats)").unwrap();
            let rows = stmt.query_map([], |r| r.get::<_, String>(1)).unwrap();
            rows.filter_map(Result::ok).collect()
        };
        assert!(daily_cols.contains(&"cache_creation_tokens".to_string()));
        assert!(daily_cols.contains(&"cache_read_tokens".to_string()));
        let has_table: i64 = c
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='request_logs'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(has_table, 1);
    }

    #[test]
    fn v5_adds_request_log_path_columns() {
        let c = Connection::open_in_memory().unwrap();
        run_migrations(&c).unwrap();
        let cols: Vec<String> = {
            let mut stmt = c.prepare("PRAGMA table_info(request_logs)").unwrap();
            let rows = stmt.query_map([], |r| r.get::<_, String>(1)).unwrap();
            rows.filter_map(Result::ok).collect()
        };
        assert!(cols.contains(&"inbound_path".to_string()));
        assert!(cols.contains(&"upstream_path".to_string()));
    }

    #[test]
    fn v6_adds_first_byte_ms_column() {
        let c = Connection::open_in_memory().unwrap();
        run_migrations(&c).unwrap();
        let cols: Vec<String> = {
            let mut stmt = c.prepare("PRAGMA table_info(request_logs)").unwrap();
            let rows = stmt.query_map([], |r| r.get::<_, String>(1)).unwrap();
            rows.filter_map(Result::ok).collect()
        };
        assert!(cols.contains(&"first_byte_ms".to_string()));
    }

    #[test]
    fn v7_adds_model_mappings_column() {
        let c = Connection::open_in_memory().unwrap();
        run_migrations(&c).unwrap();
        let cols: Vec<String> = {
            let mut stmt = c.prepare("PRAGMA table_info(endpoints)").unwrap();
            let rows = stmt.query_map([], |r| r.get::<_, String>(1)).unwrap();
            rows.filter_map(Result::ok).collect()
        };
        assert!(cols.contains(&"model_mappings".to_string()));
    }

    #[test]
    fn v8_adds_actual_model_column() {
        let c = Connection::open_in_memory().unwrap();
        run_migrations(&c).unwrap();
        let cols: Vec<String> = {
            let mut stmt = c.prepare("PRAGMA table_info(request_logs)").unwrap();
            let rows = stmt.query_map([], |r| r.get::<_, String>(1)).unwrap();
            rows.filter_map(Result::ok).collect()
        };
        assert!(cols.contains(&"actual_model".to_string()));
    }

    #[test]
    fn v9_adds_active_models_column() {
        let c = Connection::open_in_memory().unwrap();
        run_migrations(&c).unwrap();
        let cols: Vec<String> = {
            let mut stmt = c.prepare("PRAGMA table_info(endpoints)").unwrap();
            let rows = stmt.query_map([], |r| r.get::<_, String>(1)).unwrap();
            rows.filter_map(Result::ok).collect()
        };
        assert!(cols.contains(&"active_models".to_string()));
    }

    #[test]
    fn v10_adds_error_body_column() {
        let c = Connection::open_in_memory().unwrap();
        run_migrations(&c).unwrap();
        let cols: Vec<String> = {
            let mut stmt = c.prepare("PRAGMA table_info(request_logs)").unwrap();
            let rows = stmt.query_map([], |r| r.get::<_, String>(1)).unwrap();
            rows.filter_map(Result::ok).collect()
        };
        assert!(cols.contains(&"error_body".to_string()));
    }

    #[test]
    fn v11_adds_transformer_column() {
        let c = Connection::open_in_memory().unwrap();
        run_migrations(&c).unwrap();
        let cols: Vec<String> = {
            let mut stmt = c.prepare("PRAGMA table_info(request_logs)").unwrap();
            let rows = stmt.query_map([], |r| r.get::<_, String>(1)).unwrap();
            rows.filter_map(Result::ok).collect()
        };
        assert!(cols.contains(&"transformer".to_string()));
    }

    #[test]
    fn v12_adds_fast_queue_columns() {
        let c = Connection::open_in_memory().unwrap();
        run_migrations(&c).unwrap();
        let cols: Vec<String> = {
            let mut stmt = c.prepare("PRAGMA table_info(endpoints)").unwrap();
            let rows = stmt.query_map([], |r| r.get::<_, String>(1)).unwrap();
            rows.filter_map(Result::ok).collect()
        };
        assert!(cols.contains(&"fast".to_string()));
        assert!(cols.contains(&"fast_sort_order".to_string()));
    }

    #[test]
    fn v13_adds_archived_column() {
        let c = Connection::open_in_memory().unwrap();
        run_migrations(&c).unwrap();
        let cols: Vec<String> = {
            let mut stmt = c.prepare("PRAGMA table_info(endpoints)").unwrap();
            let rows = stmt.query_map([], |r| r.get::<_, String>(1)).unwrap();
            rows.filter_map(Result::ok).collect()
        };
        assert!(cols.contains(&"archived".to_string()));
    }

    #[test]
    fn v14_adds_and_backfills_endpoint_uid() {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(
            "CREATE TABLE schema_version (
                version INTEGER NOT NULL,
                applied_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
        )
        .unwrap();
        for (idx, script) in MIGRATIONS.iter().take(13).enumerate() {
            c.execute_batch(script).unwrap();
            c.execute(
                "INSERT INTO schema_version(version) VALUES (?1)",
                [(idx + 1) as i64],
            )
            .unwrap();
        }
        c.execute(
            "INSERT INTO endpoints(name, api_url) VALUES('legacy', 'https://example.com')",
            [],
        )
        .unwrap();

        run_migrations(&c).unwrap();

        let uid: String = c
            .query_row(
                "SELECT uid FROM endpoints WHERE name = 'legacy'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(Uuid::parse_str(&uid).is_ok());
        let version: i64 = c
            .query_row("SELECT MAX(version) FROM schema_version", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(version, MIGRATIONS.len() as i64);
    }

    #[test]
    fn v15_keeps_legacy_stats_unidentified_and_indexes_new_ids() {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(
            "CREATE TABLE schema_version (
                version INTEGER NOT NULL,
                applied_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
        )
        .unwrap();
        for (idx, script) in MIGRATIONS.iter().take(14).enumerate() {
            c.execute_batch(script).unwrap();
            c.execute(
                "INSERT INTO schema_version(version) VALUES (?1)",
                [(idx + 1) as i64],
            )
            .unwrap();
        }
        c.execute(
            "INSERT INTO daily_stats(endpoint_name,date,requests,device_id)
             VALUES('legacy','2026-07-16',1,'dev')",
            [],
        )
        .unwrap();

        run_migrations(&c).unwrap();

        let endpoint_id: String = c
            .query_row("SELECT endpoint_id FROM daily_stats", [], |row| row.get(0))
            .unwrap();
        assert!(endpoint_id.is_empty());
        c.execute(
            "INSERT INTO daily_stats(endpoint_id,endpoint_name,date,device_id)
             VALUES('uid-1','renamed','2026-07-16','dev')",
            [],
        )
        .unwrap();
        assert!(c
            .execute(
                "INSERT INTO daily_stats(endpoint_id,endpoint_name,date,device_id)
                 VALUES('uid-1','another-name','2026-07-16','dev')",
                [],
            )
            .is_err());
    }

    #[test]
    fn failed_migration_rolls_back_schema_and_version_together() {
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch(
            "CREATE TABLE schema_version (
                version INTEGER NOT NULL,
                applied_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
        )
        .unwrap();
        for (idx, script) in MIGRATIONS.iter().take(14).enumerate() {
            c.execute_batch(script).unwrap();
            c.execute(
                "INSERT INTO schema_version(version) VALUES (?1)",
                [(idx + 1) as i64],
            )
            .unwrap();
        }
        c.execute_batch(
            "CREATE TABLE blocker(value TEXT);
             CREATE INDEX idx_daily_stats_endpoint_id ON blocker(value);",
        )
        .unwrap();

        assert!(run_migrations(&c).is_err());

        let version: i64 = c
            .query_row("SELECT MAX(version) FROM schema_version", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(version, 14);
        let columns: Vec<String> = {
            let mut stmt = c.prepare("PRAGMA table_info(daily_stats)").unwrap();
            stmt.query_map([], |row| row.get(1))
                .unwrap()
                .collect::<rusqlite::Result<Vec<_>>>()
                .unwrap()
        };
        assert!(!columns.contains(&"endpoint_id".to_string()));
        let staging_exists: i64 = c
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='daily_stats_v15'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(staging_exists, 0);
    }
}
