//! 只读打开 cc-switch.db，读取 claude / codex 供应商行。
//!
//! 严格只读：`OpenFlags::SQLITE_OPEN_READ_ONLY | SQLITE_OPEN_NO_MUTEX`，绝不写源库。
//! `settings_config` / `meta` 是 TEXT 存 JSON 字符串，这里读出原始字符串交 mapper 弱类型解析。

use std::path::Path;

use rusqlite::OpenFlags;

use crate::error::{AppError, AppResult};

/// 一行 cc-switch providers 的原始数据（未解析 JSON）。
pub struct ProviderRow {
    pub id: String,
    pub app_type: String,
    pub name: String,
    pub settings_config: String,
    pub meta: String,
    pub notes: Option<String>,
}

const APP_TYPES: &[&str] = &["claude", "codex"];

/// 只读打开 cc-switch.db 并返回 claude/codex 供应商行（按 sort_index, id 排序）。
pub fn read_providers(db_path: &Path) -> AppResult<Vec<ProviderRow>> {
    if !db_path.exists() {
        return Err(AppError::NotFound(format!(
            "未找到 cc-switch 配置数据库: {}",
            db_path.display()
        )));
    }

    let conn = rusqlite::Connection::open_with_flags(
        db_path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| AppError::Db(format!("打开 cc-switch.db 失败: {e}")))?;

    let placeholders = APP_TYPES.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "SELECT id, app_type, name, settings_config, meta, notes
         FROM providers
         WHERE app_type IN ({placeholders})
         ORDER BY COALESCE(sort_index, 999999), id ASC"
    );

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(APP_TYPES.iter()), |row| {
        Ok(ProviderRow {
            id: row.get(0)?,
            app_type: row.get(1)?,
            name: row.get(2)?,
            settings_config: row.get(3)?,
            meta: row.get(4)?,
            notes: row.get(5)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}
