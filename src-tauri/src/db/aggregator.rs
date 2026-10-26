use chrono::Local;
use rusqlite::Connection;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};
use sysinfo::System;

use super::repository::Repository;
use super::schema::get_database_path;
use crate::monitor::{LiveTrafficBuffer, ProcessResolver};

pub struct TimeSeriesAggregator {
    buffer: Arc<LiveTrafficBuffer>,
    resolver: ProcessResolver,
    is_running: Arc<AtomicBool>,
}

impl TimeSeriesAggregator {
    pub fn new(buffer: Arc<LiveTrafficBuffer>, resolver: ProcessResolver) -> Self {
        Self {
            buffer,
            resolver,
            is_running: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn start(&self) {
        if self.is_running.swap(true, Ordering::SeqCst) {
            return;
        }

        let buffer = self.buffer.clone();
        let resolver = self.resolver.clone();
        let is_running = self.is_running.clone();

        thread::spawn(move || {
            let db_path = get_database_path();
            let mut conn = match Connection::open(&db_path) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("[Aggregator] Failed to open database at {:?}: {}", db_path, e);
                    return;
                }
            };

            // Run initial 45-day cleanup on startup
            if let Ok((h, d)) = Repository::prune_old_records(&conn) {
                if h > 0 || d > 0 {
                    println!("[Aggregator] Pruned {} hourly and {} daily expired records.", h, d);
                }
            }

            let mut last_cleanup = Instant::now();
            let mut sys = System::new_all();

            while is_running.load(Ordering::SeqCst) {
                // Sleep for 60 seconds with responsive checks
                for _ in 0..60 {
                    if !is_running.load(Ordering::SeqCst) {
                        break;
                    }
                    thread::sleep(Duration::from_secs(1));
                }

                if !is_running.load(Ordering::SeqCst) {
                    break;
                }

                // Drain minute buffer
                let minute_items = buffer.drain_minute_aggregation();
                if !minute_items.is_empty() {
                    let now = Local::now();
                    let hour_str = now.format("%Y-%m-%d %H:00:00").to_string();
                    let date_str = now.format("%Y-%m-%d").to_string();

                    let tx_result = conn.transaction();
                    match tx_result {
                        Ok(tx) => {
                            for (pid, sent, recv) in minute_items {
                                let meta = resolver.resolve(pid, &mut sys);
                                if let Ok(app_id) = Repository::get_or_create_app(&tx, &meta) {
                                    let _ = Repository::upsert_hourly(&tx, app_id, &hour_str, sent, recv);
                                    let _ = Repository::upsert_daily(&tx, app_id, &date_str, sent, recv);
                                }
                            }
                            let _ = tx.commit();
                        }
                        Err(e) => {
                            eprintln!("[Aggregator] Transaction error: {}", e);
                        }
                    }
                }

                // Daily cleanup (once every 24h)
                if last_cleanup.elapsed() > Duration::from_secs(86400) {
                    let _ = Repository::prune_old_records(&conn);
                    last_cleanup = Instant::now();
                }
            }

            println!("[Aggregator] Background thread stopped.");
        });
    }

    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }
}
