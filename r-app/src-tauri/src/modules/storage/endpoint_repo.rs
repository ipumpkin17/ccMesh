use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::error::{AppError, AppResult};
use crate::models::endpoint::{CreateEndpointRequest, Endpoint, UpdateEndpointRequest};

const COLS: &str = "id, name, api_url, api_key, auth_mode, enabled, transformer, model, remark, sort_order, test_status, created_at, updated_at";

fn row_to_endpoint(row: &Row) -> rusqlite::Result<Endpoint> {
    Ok(Endpoint {
        id: row.get("id")?,
        name: row.get("name")?,
        api_url: row.get("api_url")?,
        api_key: row.get("api_key")?,
        auth_mode: row.get("auth_mode")?,
        enabled: row.get::<_, i64>("enabled")? != 0,
        transformer: row.get("transformer")?,
        model: row.get("model")?,
        remark: row.get("remark")?,
        sort_order: row.get("sort_order")?,
        test_status: row.get("test_status")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn list_all(conn: &Connection) -> AppResult<Vec<Endpoint>> {
    let sql = format!("SELECT {COLS} FROM endpoints ORDER BY sort_order ASC, id ASC");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], row_to_endpoint)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn list_enabled(conn: &Connection) -> AppResult<Vec<Endpoint>> {
    let sql =
        format!("SELECT {COLS} FROM endpoints WHERE enabled = 1 ORDER BY sort_order ASC, id ASC");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], row_to_endpoint)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn get_by_id(conn: &Connection, id: i64) -> AppResult<Option<Endpoint>> {
    let sql = format!("SELECT {COLS} FROM endpoints WHERE id = ?1");
    Ok(conn
        .query_row(&sql, [id], row_to_endpoint)
        .optional()?)
}

pub fn get_by_name(conn: &Connection, name: &str) -> AppResult<Option<Endpoint>> {
    let sql = format!("SELECT {COLS} FROM endpoints WHERE name = ?1");
    Ok(conn
        .query_row(&sql, [name], row_to_endpoint)
        .optional()?)
}

fn require(conn: &Connection, id: i64) -> AppResult<Endpoint> {
    get_by_id(conn, id)?.ok_or_else(|| AppError::NotFound(format!("端点 #{id} 不存在")))
}

pub fn create(conn: &Connection, req: &CreateEndpointRequest) -> AppResult<Endpoint> {
    if req.name.trim().is_empty() {
        return Err(AppError::InvalidArgument("端点名称不能为空".into()));
    }
    if req.api_url.trim().is_empty() {
        return Err(AppError::InvalidArgument("API URL 不能为空".into()));
    }
    if get_by_name(conn, &req.name)?.is_some() {
        return Err(AppError::InvalidArgument(format!("端点名称已存在: {}", req.name)));
    }

    let next_order: i64 =
        conn.query_row("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM endpoints", [], |r| {
            r.get(0)
        })?;

    conn.execute(
        "INSERT INTO endpoints
            (name, api_url, api_key, auth_mode, enabled, transformer, model, remark, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            req.name,
            req.api_url,
            req.api_key,
            req.auth_mode,
            req.enabled as i64,
            req.transformer,
            req.model,
            req.remark,
            next_order,
        ],
    )?;
    require(conn, conn.last_insert_rowid())
}

pub fn update(conn: &Connection, id: i64, req: &UpdateEndpointRequest) -> AppResult<Endpoint> {
    let mut e = require(conn, id)?;

    if let Some(ref name) = req.name {
        if name.trim().is_empty() {
            return Err(AppError::InvalidArgument("端点名称不能为空".into()));
        }
        if let Some(other) = get_by_name(conn, name)? {
            if other.id != id {
                return Err(AppError::InvalidArgument(format!("端点名称已存在: {name}")));
            }
        }
        e.name = name.clone();
    }
    if let Some(ref v) = req.api_url {
        e.api_url = v.clone();
    }
    if let Some(ref v) = req.api_key {
        e.api_key = v.clone();
    }
    if let Some(ref v) = req.auth_mode {
        e.auth_mode = v.clone();
    }
    if let Some(v) = req.enabled {
        e.enabled = v;
    }
    if let Some(ref v) = req.transformer {
        e.transformer = v.clone();
    }
    if let Some(ref v) = req.model {
        e.model = v.clone();
    }
    if let Some(ref v) = req.remark {
        e.remark = v.clone();
    }

    conn.execute(
        "UPDATE endpoints SET
            name = ?1, api_url = ?2, api_key = ?3, auth_mode = ?4, enabled = ?5,
            transformer = ?6, model = ?7, remark = ?8, updated_at = datetime('now')
         WHERE id = ?9",
        params![
            e.name,
            e.api_url,
            e.api_key,
            e.auth_mode,
            e.enabled as i64,
            e.transformer,
            e.model,
            e.remark,
            id,
        ],
    )?;
    require(conn, id)
}

pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    let n = conn.execute("DELETE FROM endpoints WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(AppError::NotFound(format!("端点 #{id} 不存在")));
    }
    Ok(())
}

/// 按给定 id 顺序重写 sort_order（用于拖拽排序持久化）。
pub fn reorder(conn: &mut Connection, ordered_ids: &[i64]) -> AppResult<()> {
    let tx = conn.transaction()?;
    for (idx, id) in ordered_ids.iter().enumerate() {
        tx.execute(
            "UPDATE endpoints SET sort_order = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![idx as i64, id],
        )?;
    }
    tx.commit()?;
    Ok(())
}

/// 持久化测试状态：available / unavailable / unknown。
pub fn set_test_status(conn: &Connection, id: i64, status: &str) -> AppResult<()> {
    conn.execute(
        "UPDATE endpoints SET test_status = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![status, id],
    )?;
    Ok(())
}
