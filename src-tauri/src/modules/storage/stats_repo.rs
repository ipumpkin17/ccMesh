use rusqlite::{params, Connection};

use crate::error::AppResult;
use crate::models::stats::{DailyStat, EndpointStat, PeriodStats};

/// 累加写入一行（UPSERT，按稳定 endpoint_id+date+device_id 累加）。
pub fn upsert(
    conn: &Connection,
    endpoint_id: &str,
    endpoint_name: &str,
    date: &str,
    device_id: &str,
    requests: i64,
    errors: i64,
    input_tokens: i64,
    output_tokens: i64,
    cache_creation_tokens: i64,
    cache_read_tokens: i64,
) -> AppResult<()> {
    conn.execute(
        "INSERT INTO daily_stats(endpoint_id,endpoint_name,date,requests,errors,input_tokens,output_tokens,cache_creation_tokens,cache_read_tokens,device_id)
         VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
         ON CONFLICT(endpoint_id,date,device_id) WHERE endpoint_id <> '' DO UPDATE SET
            endpoint_name         = excluded.endpoint_name,
            requests              = requests + excluded.requests,
            errors                = errors + excluded.errors,
            input_tokens          = input_tokens + excluded.input_tokens,
            output_tokens         = output_tokens + excluded.output_tokens,
            cache_creation_tokens = cache_creation_tokens + excluded.cache_creation_tokens,
            cache_read_tokens     = cache_read_tokens + excluded.cache_read_tokens",
        params![endpoint_id, endpoint_name, date, requests, errors, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, device_id],
    )?;
    Ok(())
}

/// 聚合某日期范围（闭区间）内每端点统计 + 周期总量。
pub fn period_stats(conn: &Connection, start: &str, end: &str) -> AppResult<PeriodStats> {
    let mut stmt = conn.prepare(
        "SELECT s.endpoint_id, COALESCE(e.name, MAX(s.endpoint_name)),
                SUM(s.requests), SUM(s.errors), SUM(s.input_tokens), SUM(s.output_tokens),
                SUM(s.cache_creation_tokens), SUM(s.cache_read_tokens)
         FROM daily_stats s LEFT JOIN endpoints e ON e.uid = s.endpoint_id
         WHERE s.date >= ?1 AND s.date <= ?2 AND s.endpoint_id <> ''
         GROUP BY s.endpoint_id ORDER BY COALESCE(e.name, MAX(s.endpoint_name))",
    )?;
    let rows = stmt.query_map(params![start, end], |r| {
        Ok(EndpointStat {
            endpoint_id: r.get(0)?,
            endpoint_name: r.get(1)?,
            requests: r.get::<_, Option<i64>>(2)?.unwrap_or(0),
            errors: r.get::<_, Option<i64>>(3)?.unwrap_or(0),
            input_tokens: r.get::<_, Option<i64>>(4)?.unwrap_or(0),
            output_tokens: r.get::<_, Option<i64>>(5)?.unwrap_or(0),
            cache_creation_tokens: r.get::<_, Option<i64>>(6)?.unwrap_or(0),
            cache_read_tokens: r.get::<_, Option<i64>>(7)?.unwrap_or(0),
        })
    })?;
    let mut ps = PeriodStats::default();
    for er in rows {
        let e = er?;
        ps.requests += e.requests;
        ps.errors += e.errors;
        ps.input_tokens += e.input_tokens;
        ps.output_tokens += e.output_tokens;
        ps.cache_creation_tokens += e.cache_creation_tokens;
        ps.cache_read_tokens += e.cache_read_tokens;
        ps.endpoints.push(e);
    }
    Ok(ps)
}

/// 行映射：daily_stats 聚合行 → DailyStat。
fn row_to_daily(r: &rusqlite::Row) -> rusqlite::Result<DailyStat> {
    Ok(DailyStat {
        endpoint_id: r.get(0)?,
        endpoint_name: r.get(1)?,
        date: r.get(2)?,
        requests: r.get::<_, Option<i64>>(3)?.unwrap_or(0),
        errors: r.get::<_, Option<i64>>(4)?.unwrap_or(0),
        input_tokens: r.get::<_, Option<i64>>(5)?.unwrap_or(0),
        output_tokens: r.get::<_, Option<i64>>(6)?.unwrap_or(0),
        cache_creation_tokens: r.get::<_, Option<i64>>(7)?.unwrap_or(0),
        cache_read_tokens: r.get::<_, Option<i64>>(8)?.unwrap_or(0),
    })
}

/// 跨全时间分页历史明细（按端点×日聚合行，date 倒序）。返回 (当前页, 分组总数)。
pub fn history_page(
    conn: &Connection,
    limit: i64,
    offset: i64,
) -> AppResult<(Vec<DailyStat>, i64)> {
    let total: i64 = conn.query_row(
        "SELECT COUNT(*) FROM (SELECT 1 FROM daily_stats WHERE endpoint_id <> '' GROUP BY endpoint_id, date)",
        [],
        |r| r.get(0),
    )?;
    let mut stmt = conn.prepare(
        "SELECT s.endpoint_id, COALESCE(e.name, MAX(s.endpoint_name)), s.date,
                SUM(s.requests), SUM(s.errors), SUM(s.input_tokens), SUM(s.output_tokens),
                SUM(s.cache_creation_tokens), SUM(s.cache_read_tokens)
         FROM daily_stats s LEFT JOIN endpoints e ON e.uid = s.endpoint_id
         WHERE s.endpoint_id <> ''
         GROUP BY s.endpoint_id, s.date
         ORDER BY s.date DESC, COALESCE(e.name, MAX(s.endpoint_name)) LIMIT ?1 OFFSET ?2",
    )?;
    let rows = stmt.query_map(params![limit, offset], row_to_daily)?;
    let mut items = Vec::new();
    for r in rows {
        items.push(r?);
    }
    Ok((items, total))
}

/// 删除单端点单日的统计行。返回删除行数。
pub fn delete_row(conn: &Connection, endpoint_id: &str, date: &str) -> AppResult<usize> {
    let n = conn.execute(
        "DELETE FROM daily_stats WHERE endpoint_id <> '' AND endpoint_id = ?1 AND date = ?2",
        params![endpoint_id, date],
    )?;
    Ok(n)
}

/// 删除某一天全部端点的统计行。返回删除行数。
pub fn delete_by_date(conn: &Connection, date: &str) -> AppResult<usize> {
    let n = conn.execute("DELETE FROM daily_stats WHERE date = ?1", params![date])?;
    Ok(n)
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

    #[test]
    fn upsert_accumulates_and_period_sums() {
        let c = db();
        upsert(&c, "uid-ep", "ep", "2026-06-05", "dev", 1, 0, 10, 5, 2, 3).unwrap();
        upsert(
            &c,
            "uid-ep",
            "renamed",
            "2026-06-05",
            "dev",
            2,
            1,
            20,
            10,
            4,
            6,
        )
        .unwrap();
        let ps = period_stats(&c, "2026-06-05", "2026-06-05").unwrap();
        assert_eq!(ps.requests, 3);
        assert_eq!(ps.errors, 1);
        assert_eq!(ps.input_tokens, 30);
        assert_eq!(ps.output_tokens, 15);
        assert_eq!(ps.cache_creation_tokens, 6);
        assert_eq!(ps.cache_read_tokens, 9);
        assert_eq!(ps.endpoints.len(), 1);
        assert_eq!(ps.endpoints[0].endpoint_id, "uid-ep");
        assert_eq!(ps.endpoints[0].endpoint_name, "renamed");
    }

    #[test]
    fn history_paginates_and_row_delete() {
        let c = db();
        upsert(&c, "uid-a", "a", "2026-06-01", "dev", 1, 0, 0, 0, 0, 0).unwrap();
        upsert(&c, "uid-b", "b", "2026-06-02", "dev", 1, 0, 0, 0, 0, 0).unwrap();
        upsert(&c, "uid-a", "a", "2026-06-03", "dev", 1, 0, 0, 0, 0, 0).unwrap();
        let (page1, total) = history_page(&c, 2, 0).unwrap();
        assert_eq!(total, 3);
        assert_eq!(page1.len(), 2);
        assert_eq!(page1[0].date, "2026-06-03"); // date 倒序
        assert_eq!(delete_row(&c, "uid-a", "2026-06-03").unwrap(), 1);
        assert_eq!(history_page(&c, 50, 0).unwrap().1, 2);
        assert_eq!(delete_by_date(&c, "2026-06-02").unwrap(), 1);
        assert_eq!(history_page(&c, 50, 0).unwrap().1, 1);
    }

    #[test]
    fn empty_endpoint_id_cannot_delete_legacy_rows() {
        let c = db();
        c.execute(
            "INSERT INTO daily_stats(endpoint_name,date,requests,device_id)
             VALUES('legacy-a','2026-06-01',1,'dev'),('legacy-b','2026-06-01',1,'dev')",
            [],
        )
        .unwrap();

        assert_eq!(delete_row(&c, "", "2026-06-01").unwrap(), 0);
        let count: i64 = c
            .query_row("SELECT COUNT(*) FROM daily_stats", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 2);
    }
}
