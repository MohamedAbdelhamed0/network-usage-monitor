use chrono::Local;
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

use crate::monitor::ProcessMetadata;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyChartPoint {
    pub date: String,
    pub bytes_download: u64,
    pub bytes_upload: u64,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HourlyChartPoint {
    pub hour: u32,
    pub bytes_download: u64,
    pub bytes_upload: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopAppItem {
    pub app_id: i64,
    pub exe_name: String,
    pub display_name: String,
    pub icon_base64: Option<String>,
    pub is_system_component: bool,
    pub bytes_download: u64,
    pub bytes_upload: u64,
    pub total_bytes: u64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryBreakdown {
    pub user_apps_bytes: u64,
    pub windows_os_bytes: u64,
    pub total_bytes: u64,
    pub user_apps_percentage: f64,
    pub windows_os_percentage: f64,
}

pub struct Repository;

impl Repository {
    pub fn get_or_create_app(conn: &Connection, meta: &ProcessMetadata) -> Result<i64> {
        let path = if meta.exe_path.is_empty() {
            &meta.exe_name
        } else {
            &meta.exe_path
        };

        let mut stmt = conn.prepare("SELECT id FROM applications WHERE exe_path = ?1")?;
        let mut rows = stmt.query(params![path])?;

        if let Some(row) = rows.next()? {
            return Ok(row.get(0)?);
        }

        conn.execute(
            "INSERT INTO applications (exe_name, exe_path, display_name, icon_base64, is_system_component)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                meta.exe_name,
                path,
                meta.display_name,
                meta.icon_base64,
                meta.is_system_component
            ],
        )?;

        Ok(conn.last_insert_rowid())
    }

    pub fn upsert_hourly(
        conn: &Connection,
        app_id: i64,
        hour_timestamp: &str,
        sent: u64,
        recv: u64,
    ) -> Result<()> {
        conn.execute(
            "INSERT INTO hourly_usage (app_id, hour_timestamp, bytes_received, bytes_sent)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(app_id, hour_timestamp) DO UPDATE SET
               bytes_received = bytes_received + excluded.bytes_received,
               bytes_sent = bytes_sent + excluded.bytes_sent",
            params![app_id, hour_timestamp, recv as i64, sent as i64],
        )?;
        Ok(())
    }

    pub fn upsert_daily(
        conn: &Connection,
        app_id: i64,
        usage_date: &str,
        sent: u64,
        recv: u64,
    ) -> Result<()> {
        conn.execute(
            "INSERT INTO daily_usage (app_id, usage_date, bytes_received, bytes_sent)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(app_id, usage_date) DO UPDATE SET
               bytes_received = bytes_received + excluded.bytes_received,
               bytes_sent = bytes_sent + excluded.bytes_sent",
            params![app_id, usage_date, recv as i64, sent as i64],
        )?;
        Ok(())
    }

    pub fn get_today_totals(conn: &Connection) -> Result<(u64, u64)> {
        let today = Local::now().format("%Y-%m-%d").to_string();
        let mut stmt = conn.prepare(
            "SELECT COALESCE(SUM(bytes_sent), 0), COALESCE(SUM(bytes_received), 0)
             FROM daily_usage WHERE usage_date = ?1",
        )?;
        let mut rows = stmt.query(params![today])?;
        if let Some(row) = rows.next()? {
            let sent: i64 = row.get(0)?;
            let recv: i64 = row.get(1)?;
            Ok((sent as u64, recv as u64))
        } else {
            Ok((0, 0))
        }
    }

    pub fn get_daily_history(conn: &Connection, days: u32) -> Result<Vec<DailyChartPoint>> {
        let mut stmt = conn.prepare(
            "SELECT usage_date,
                    COALESCE(SUM(bytes_received), 0) AS recv,
                    COALESCE(SUM(bytes_sent), 0) AS sent
             FROM daily_usage
             WHERE usage_date >= date('now', ?1)
             GROUP BY usage_date
             ORDER BY usage_date ASC",
        )?;

        let modifier = format!("-{} days", days);
        let mut rows = stmt.query(params![modifier])?;
        let mut result = Vec::new();

        while let Some(row) = rows.next()? {
            let date: String = row.get(0)?;
            let recv: i64 = row.get(1)?;
            let sent: i64 = row.get(2)?;
            let recv_u = recv.max(0) as u64;
            let sent_u = sent.max(0) as u64;

            result.push(DailyChartPoint {
                date,
                bytes_download: recv_u,
                bytes_upload: sent_u,
                total_bytes: recv_u + sent_u,
            });
        }

        Ok(result)
    }

    pub fn get_top_apps(conn: &Connection, days: u32, limit: u32) -> Result<Vec<TopAppItem>> {
        let modifier = format!("-{} days", days);

        let mut stmt = conn.prepare(
            "SELECT a.id, a.exe_name, a.display_name, a.icon_base64, a.is_system_component,
                    COALESCE(SUM(d.bytes_received), 0) AS recv,
                    COALESCE(SUM(d.bytes_sent), 0) AS sent,
                    COALESCE(SUM(d.bytes_received + d.bytes_sent), 0) AS total
             FROM applications a
             INNER JOIN daily_usage d ON a.id = d.app_id
             WHERE d.usage_date >= date('now', ?1)
             GROUP BY a.id
             ORDER BY total DESC
             LIMIT ?2",
        )?;

        let mut rows = stmt.query(params![modifier, limit])?;
        let mut items = Vec::new();
        let mut overall_total: u64 = 0;

        while let Some(row) = rows.next()? {
            let app_id: i64 = row.get(0)?;
            let exe_name: String = row.get(1)?;
            let display_name: Option<String> = row.get(2)?;
            let icon_base64: Option<String> = row.get(3)?;
            let is_system_component: bool = row.get(4)?;
            let recv: i64 = row.get(5)?;
            let sent: i64 = row.get(6)?;
            let total: i64 = row.get(7)?;

            let recv_u = recv.max(0) as u64;
            let sent_u = sent.max(0) as u64;
            let total_u = total.max(0) as u64;
            overall_total += total_u;

            items.push(TopAppItem {
                app_id,
                exe_name: exe_name.clone(),
                display_name: display_name.unwrap_or(exe_name),
                icon_base64,
                is_system_component,
                bytes_download: recv_u,
                bytes_upload: sent_u,
                total_bytes: total_u,
                percentage: 0.0, // calculated below
            });
        }

        // Calculate percentage relative to overall total in range
        if overall_total > 0 {
            for item in items.iter_mut() {
                item.percentage = ((item.total_bytes as f64 / overall_total as f64) * 100.0 * 10.0).round() / 10.0;
            }
        }

        Ok(items)
    }

    pub fn get_os_breakdown(conn: &Connection, days: u32) -> Result<CategoryBreakdown> {
        let modifier = format!("-{} days", days);

        let mut stmt = conn.prepare(
            "SELECT a.is_system_component,
                    COALESCE(SUM(d.bytes_received + d.bytes_sent), 0) AS total
             FROM applications a
             INNER JOIN daily_usage d ON a.id = d.app_id
             WHERE d.usage_date >= date('now', ?1)
             GROUP BY a.is_system_component",
        )?;

        let mut rows = stmt.query(params![modifier])?;
        let mut user_total: u64 = 0;
        let mut os_total: u64 = 0;

        while let Some(row) = rows.next()? {
            let is_system: bool = row.get(0)?;
            let total: i64 = row.get(1)?;
            let total_u = total.max(0) as u64;
            if is_system {
                os_total += total_u;
            } else {
                user_total += total_u;
            }
        }

        let total = user_total + os_total;
        let (user_pct, os_pct) = if total > 0 {
            (
                ((user_total as f64 / total as f64) * 100.0 * 10.0).round() / 10.0,
                ((os_total as f64 / total as f64) * 100.0 * 10.0).round() / 10.0,
            )
        } else {
            (0.0, 0.0)
        };

        Ok(CategoryBreakdown {
            user_apps_bytes: user_total,
            windows_os_bytes: os_total,
            total_bytes: total,
            user_apps_percentage: user_pct,
            windows_os_percentage: os_pct,
        })
    }

    pub fn get_app_hourly(
        conn: &Connection,
        app_id: i64,
        date_str: &str,
    ) -> Result<Vec<HourlyChartPoint>> {
        let prefix = format!("{}%", date_str);
        let mut stmt = conn.prepare(
            "SELECT hour_timestamp, bytes_received, bytes_sent
             FROM hourly_usage
             WHERE app_id = ?1 AND hour_timestamp LIKE ?2
             ORDER BY hour_timestamp ASC",
        )?;

        let mut rows = stmt.query(params![app_id, prefix])?;
        let mut points: [HourlyChartPoint; 24] = std::array::from_fn(|i| HourlyChartPoint {
            hour: i as u32,
            bytes_download: 0,
            bytes_upload: 0,
        });

        while let Some(row) = rows.next()? {
            let ts: String = row.get(0)?;
            let recv: i64 = row.get(1)?;
            let sent: i64 = row.get(2)?;

            // Extract hour e.g. "2026-10-26 14:00:00" -> 14
            if let Some(hour_part) = ts.split_whitespace().nth(1) {
                if let Some(h_str) = hour_part.split(':').next() {
                    if let Ok(h) = h_str.parse::<usize>() {
                        if h < 24 {
                            points[h].bytes_download += recv.max(0) as u64;
                            points[h].bytes_upload += sent.max(0) as u64;
                        }
                    }
                }
            }
        }

        Ok(points.to_vec())
    }

    pub fn prune_old_records(conn: &Connection) -> Result<(usize, usize)> {
        let pruned_hourly = conn.execute(
            "DELETE FROM hourly_usage WHERE hour_timestamp < datetime('now', '-45 days')",
            [],
        )?;
        let pruned_daily = conn.execute(
            "DELETE FROM daily_usage WHERE usage_date < date('now', '-45 days')",
            [],
        )?;
        Ok((pruned_hourly, pruned_daily))
    }

    pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn set_setting(conn: &Connection, key: &str, val: &str) -> Result<()> {
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, val],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::initialize_database;

    fn setup_in_memory_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        initialize_database(&conn).unwrap();
        conn
    }

    #[test]
    fn test_schema_init_and_app_creation() {
        let conn = setup_in_memory_db();
        let meta = ProcessMetadata {
            pid: 1234,
            exe_name: "chrome.exe".to_string(),
            exe_path: "C:\\Program Files\\Google\\Chrome\\chrome.exe".to_string(),
            display_name: "Google Chrome".to_string(),
            is_system_component: false,
            icon_base64: None,
        };

        let app_id1 = Repository::get_or_create_app(&conn, &meta).unwrap();
        assert!(app_id1 > 0);

        // Fetching again should return identical ID (no duplicate)
        let app_id2 = Repository::get_or_create_app(&conn, &meta).unwrap();
        assert_eq!(app_id1, app_id2);
    }

    #[test]
    fn test_upsert_daily_and_history_query() {
        let conn = setup_in_memory_db();
        let meta = ProcessMetadata {
            pid: 4,
            exe_name: "System".to_string(),
            exe_path: "C:\\Windows\\System32\\ntoskrnl.exe".to_string(),
            display_name: "Windows Kernel System".to_string(),
            is_system_component: true,
            icon_base64: None,
        };

        let app_id = Repository::get_or_create_app(&conn, &meta).unwrap();
        let today = Local::now().format("%Y-%m-%d").to_string();

        // Initial write
        Repository::upsert_daily(&conn, app_id, &today, 1000, 5000).unwrap();
        // Additional accumulation in same day
        Repository::upsert_daily(&conn, app_id, &today, 500, 1500).unwrap();

        let history = Repository::get_daily_history(&conn, 7).unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].bytes_upload, 1500);
        assert_eq!(history[0].bytes_download, 6500);
        assert_eq!(history[0].total_bytes, 8000);
    }

    #[test]
    fn test_top_apps_and_os_breakdown() {
        let conn = setup_in_memory_db();
        let app_meta = ProcessMetadata {
            pid: 100,
            exe_name: "browser.exe".to_string(),
            exe_path: "C:\\Apps\\browser.exe".to_string(),
            display_name: "Browser".to_string(),
            is_system_component: false,
            icon_base64: None,
        };
        let sys_meta = ProcessMetadata {
            pid: 4,
            exe_name: "System".to_string(),
            exe_path: "C:\\Windows\\System32\\ntoskrnl.exe".to_string(),
            display_name: "System".to_string(),
            is_system_component: true,
            icon_base64: None,
        };

        let app_id = Repository::get_or_create_app(&conn, &app_meta).unwrap();
        let sys_id = Repository::get_or_create_app(&conn, &sys_meta).unwrap();
        let today = Local::now().format("%Y-%m-%d").to_string();

        Repository::upsert_daily(&conn, app_id, &today, 100, 900).unwrap();
        Repository::upsert_daily(&conn, sys_id, &today, 50, 450).unwrap();

        let top = Repository::get_top_apps(&conn, 7, 10).unwrap();
        assert_eq!(top.len(), 2);
        assert_eq!(top[0].app_id, app_id);
        assert_eq!(top[0].percentage, 66.7);
        assert_eq!(top[1].app_id, sys_id);
        assert_eq!(top[1].percentage, 33.3);

        let breakdown = Repository::get_os_breakdown(&conn, 7).unwrap();
        assert_eq!(breakdown.user_apps_bytes, 1000);
        assert_eq!(breakdown.windows_os_bytes, 500);
        assert_eq!(breakdown.user_apps_percentage, 66.7);
        assert_eq!(breakdown.windows_os_percentage, 33.3);
    }

    #[test]
    fn test_45_day_pruning() {
        let conn = setup_in_memory_db();
        let meta = ProcessMetadata {
            pid: 1,
            exe_name: "test.exe".to_string(),
            exe_path: "C:\\test.exe".to_string(),
            display_name: "Test".to_string(),
            is_system_component: false,
            icon_base64: None,
        };
        let app_id = Repository::get_or_create_app(&conn, &meta).unwrap();

        // Insert record from 50 days ago (expired)
        conn.execute(
            "INSERT INTO daily_usage (app_id, usage_date, bytes_received, bytes_sent)
             VALUES (?1, date('now', '-50 days'), 100, 100)",
            params![app_id],
        ).unwrap();

        // Insert record from 10 days ago (active)
        conn.execute(
            "INSERT INTO daily_usage (app_id, usage_date, bytes_received, bytes_sent)
             VALUES (?1, date('now', '-10 days'), 200, 200)",
            params![app_id],
        ).unwrap();

        let (hourly_pruned, daily_pruned) = Repository::prune_old_records(&conn).unwrap();
        assert_eq!(hourly_pruned, 0);
        assert_eq!(daily_pruned, 1);

        let remaining = Repository::get_daily_history(&conn, 60).unwrap();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].total_bytes, 400);
    }

    #[test]
    fn test_settings_storage() {
        let conn = setup_in_memory_db();
        Repository::set_setting(&conn, "cap_gb", "500").unwrap();
        let val = Repository::get_setting(&conn, "cap_gb").unwrap();
        assert_eq!(val, Some("500".to_string()));

        // Update existing setting
        Repository::set_setting(&conn, "cap_gb", "750").unwrap();
        let updated = Repository::get_setting(&conn, "cap_gb").unwrap();
        assert_eq!(updated, Some("750".to_string()));
    }
}

