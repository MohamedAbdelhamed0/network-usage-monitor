pub mod commands;
pub mod db;
pub mod monitor;
pub mod tray;

use commands::AppState;
use db::{get_database_path, initialize_database, Repository, TimeSeriesAggregator};
use monitor::{LiveTrafficBuffer, NetworkCollector, ProcessResolver};
use parking_lot::Mutex;
use rusqlite::Connection;
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use sysinfo::System;
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let resolver = ProcessResolver::new();
    let buffer = Arc::new(LiveTrafficBuffer::new(resolver.clone()));

    // Initialize Database
    let db_path = get_database_path();
    if let Ok(conn) = Connection::open(&db_path) {
        let _ = initialize_database(&conn);
        if let Ok((today_sent, today_recv)) = Repository::get_today_totals(&conn) {
            buffer.set_today_baselines(today_sent, today_recv);
        }
    }

    let collector = Arc::new(NetworkCollector::new(buffer.clone()));
    let is_elevated = collector.is_elevated();

    // Start background monitoring and aggregator
    collector.start();
    let aggregator = TimeSeriesAggregator::new(buffer.clone(), resolver);
    aggregator.start();

    let buffer_for_timer = buffer.clone();
    let collector_for_timer = collector.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            buffer: buffer.clone(),
            collector: collector.clone(),
            sys: Mutex::new(System::new_all()),
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_live_snapshot,
            commands::get_analytics_summary,
            commands::get_app_hourly_breakdown,
            commands::get_elevation_status,
            commands::restart_as_admin,
            commands::get_data_cap_settings,
            commands::save_data_cap_settings,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();

            // Setup system tray
            let _ = tray::setup_tray(&handle, is_elevated);

            // 1-second live tick loop
            let buffer_tick = buffer_for_timer.clone();
            let collector_tick = collector_for_timer.clone();
            let handle_tick = handle.clone();

            thread::spawn(move || {
                let mut sys = System::new_all();
                loop {
                    thread::sleep(Duration::from_millis(1000));

                    // Calculate rates
                    let (send_bps, recv_bps) = buffer_tick.tick_rates();

                    // Update tray tooltip
                    tray::update_tray_speed(&handle_tick, recv_bps, send_bps);

                    // Emit event to frontend
                    let is_elevated = collector_tick.is_elevated();
                    let snapshot = buffer_tick.get_snapshot(&mut sys, is_elevated);
                    let _ = handle_tick.emit("network-tick", snapshot);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
