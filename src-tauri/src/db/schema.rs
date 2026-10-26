use rusqlite::{Connection, Result};
use std::fs;
use std::path::PathBuf;

pub fn get_database_path() -> PathBuf {
    let mut path = dirs_next::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("NetworkUsageMonitor");
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path.push("traffic.db");
    path
}

// Fallback dirs implementation without extra crate
mod dirs_next {
    use std::path::PathBuf;

    pub fn data_dir() -> Option<PathBuf> {
        #[cfg(target_os = "windows")]
        {
            std::env::var_os("APPDATA").map(PathBuf::from)
        }
        #[cfg(not(target_os = "windows"))]
        {
            std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local/share"))
        }
    }
}

pub fn initialize_database(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;

        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exe_name TEXT NOT NULL,
            exe_path TEXT UNIQUE NOT NULL,
            display_name TEXT,
            icon_base64 TEXT,
            is_system_component BOOLEAN DEFAULT 0,
            first_seen DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS hourly_usage (
            app_id INTEGER NOT NULL,
            hour_timestamp TEXT NOT NULL,
            bytes_received INTEGER DEFAULT 0,
            bytes_sent INTEGER DEFAULT 0,
            PRIMARY KEY (app_id, hour_timestamp),
            FOREIGN KEY (app_id) REFERENCES applications(id)
        );

        CREATE INDEX IF NOT EXISTS idx_hourly_timestamp ON hourly_usage(hour_timestamp);

        CREATE TABLE IF NOT EXISTS daily_usage (
            app_id INTEGER NOT NULL,
            usage_date TEXT NOT NULL,
            bytes_received INTEGER DEFAULT 0,
            bytes_sent INTEGER DEFAULT 0,
            PRIMARY KEY (app_id, usage_date),
            FOREIGN KEY (app_id) REFERENCES applications(id)
        );

        CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_usage(usage_date);

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        ",
    )?;

    Ok(())
}
