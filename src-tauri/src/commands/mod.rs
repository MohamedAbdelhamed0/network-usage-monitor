use parking_lot::Mutex;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use sysinfo::System;
use tauri::State;

use crate::db::{
    get_database_path, CategoryBreakdown, DailyChartPoint, HourlyChartPoint, Repository, TopAppItem,
};
use crate::monitor::{LiveSnapshot, LiveTrafficBuffer, NetworkCollector};

pub struct AppState {
    pub buffer: Arc<LiveTrafficBuffer>,
    pub collector: Arc<NetworkCollector>,
    pub sys: Mutex<System>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnalyticsSummary {
    pub daily_history: Vec<DailyChartPoint>,
    pub top_apps: Vec<TopAppItem>,
    pub breakdown: CategoryBreakdown,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DataCapSettings {
    pub cap_gb: Option<f64>,
    pub alert_at_percent: f64,
    pub spike_alert: bool,
    pub current_month_bytes: u64,
}

#[tauri::command]
pub fn get_live_snapshot(state: State<'_, AppState>) -> Result<LiveSnapshot, String> {
    let mut sys = state.sys.lock();
    let is_elevated = state.collector.is_elevated();
    Ok(state.buffer.get_snapshot(&mut sys, is_elevated))
}

#[tauri::command]
pub fn get_analytics_summary(
    days: u32,
    _state: State<'_, AppState>,
) -> Result<AnalyticsSummary, String> {
    let db_path = get_database_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let daily_history = Repository::get_daily_history(&conn, days).map_err(|e| e.to_string())?;
    let top_apps = Repository::get_top_apps(&conn, days, 50).map_err(|e| e.to_string())?;
    let breakdown = Repository::get_os_breakdown(&conn, days).map_err(|e| e.to_string())?;

    Ok(AnalyticsSummary {
        daily_history,
        top_apps,
        breakdown,
    })
}

#[tauri::command]
pub fn get_app_hourly_breakdown(
    app_id: i64,
    date: String,
    _state: State<'_, AppState>,
) -> Result<Vec<HourlyChartPoint>, String> {
    let db_path = get_database_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    Repository::get_app_hourly(&conn, app_id, &date).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_elevation_status(state: State<'_, AppState>) -> bool {
    state.collector.is_elevated()
}

#[tauri::command]
pub fn restart_as_admin() -> Result<(), String> {
    NetworkCollector::restart_as_admin()
}

#[tauri::command]
pub fn get_data_cap_settings(_state: State<'_, AppState>) -> Result<DataCapSettings, String> {
    let db_path = get_database_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    let cap_val = Repository::get_setting(&conn, "cap_gb").unwrap_or(None);
    let alert_val = Repository::get_setting(&conn, "alert_at_percent").unwrap_or(None);
    let spike_val = Repository::get_setting(&conn, "spike_alert").unwrap_or(None);

    let cap_gb = cap_val.and_then(|v| v.parse::<f64>().ok());
    let alert_at_percent = alert_val
        .and_then(|v| v.parse::<f64>().ok())
        .unwrap_or(80.0);
    let spike_alert = spike_val.map(|v| v == "true").unwrap_or(true);

    // Sum usage in last 30 days for month usage
    let history = Repository::get_daily_history(&conn, 30).unwrap_or_default();
    let current_month_bytes: u64 = history.iter().map(|p| p.total_bytes).sum();

    Ok(DataCapSettings {
        cap_gb,
        alert_at_percent,
        spike_alert,
        current_month_bytes,
    })
}

#[tauri::command]
pub fn save_data_cap_settings(
    cap_gb: Option<f64>,
    alert_at_percent: f64,
    spike_alert: bool,
    _state: State<'_, AppState>,
) -> Result<(), String> {
    let db_path = get_database_path();
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    if let Some(cap) = cap_gb {
        Repository::set_setting(&conn, "cap_gb", &cap.to_string()).map_err(|e| e.to_string())?;
    } else {
        Repository::set_setting(&conn, "cap_gb", "").map_err(|e| e.to_string())?;
    }

    Repository::set_setting(&conn, "alert_at_percent", &alert_at_percent.to_string())
        .map_err(|e| e.to_string())?;
    Repository::set_setting(&conn, "spike_alert", if spike_alert { "true" } else { "false" })
        .map_err(|e| e.to_string())?;

    Ok(())
}
