use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

use super::process_info::ProcessResolver;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessLiveStats {
    pub pid: u32,
    pub exe_name: String,
    pub exe_path: String,
    pub display_name: String,
    pub is_system_component: bool,
    pub icon_base64: Option<String>,
    pub download_speed_bps: f64,
    pub upload_speed_bps: f64,
    pub session_download_bytes: u64,
    pub session_upload_bytes: u64,
    pub last_active_secs_ago: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveSnapshot {
    pub total_download_speed_bps: f64,
    pub total_upload_speed_bps: f64,
    pub today_download_bytes: u64,
    pub today_upload_bytes: u64,
    pub active_processes_count: usize,
    pub system_processes_count: usize,
    pub is_elevated: bool,
    pub processes: Vec<ProcessLiveStats>,
}

#[derive(Default)]
struct ProcessTrafficCounter {
    // Totals since app started
    session_sent: u64,
    session_recv: u64,

    // Values at previous 1s tick
    prev_tick_sent: u64,
    prev_tick_recv: u64,

    // Calculated speeds in bytes/sec
    current_send_bps: f64,
    current_recv_bps: f64,

    // Accumulated in current 60s bucket for DB persistence
    minute_sent: u64,
    minute_recv: u64,

    last_active_timestamp: u64,
}

pub struct LiveTrafficBuffer {
    counters: Arc<RwLock<HashMap<u32, ProcessTrafficCounter>>>,
    resolver: ProcessResolver,
    today_sent_baseline: Arc<RwLock<u64>>,
    today_recv_baseline: Arc<RwLock<u64>>,
    start_time: std::time::Instant,
}

impl LiveTrafficBuffer {
    pub fn new(resolver: ProcessResolver) -> Self {
        Self {
            counters: Arc::new(RwLock::new(HashMap::new())),
            resolver,
            today_sent_baseline: Arc::new(RwLock::new(0)),
            today_recv_baseline: Arc::new(RwLock::new(0)),
            start_time: std::time::Instant::now(),
        }
    }

    pub fn set_today_baselines(&self, sent: u64, recv: u64) {
        *self.today_sent_baseline.write() = sent;
        *self.today_recv_baseline.write() = recv;
    }

    pub fn record_traffic(&self, pid: u32, sent: u64, recv: u64) {
        if sent == 0 && recv == 0 {
            return;
        }

        let elapsed = self.start_time.elapsed().as_secs();
        let mut counters = self.counters.write();
        let entry = counters.entry(pid).or_default();

        entry.session_sent += sent;
        entry.session_recv += recv;
        entry.minute_sent += sent;
        entry.minute_recv += recv;
        entry.last_active_timestamp = elapsed;
    }

    pub fn tick_rates(&self) -> (f64, f64) {
        let mut counters = self.counters.write();
        let mut total_send_bps = 0.0;
        let mut total_recv_bps = 0.0;

        for counter in counters.values_mut() {
            let delta_sent = counter.session_sent.saturating_sub(counter.prev_tick_sent);
            let delta_recv = counter.session_recv.saturating_sub(counter.prev_tick_recv);

            // 1-second interval rate
            counter.current_send_bps = delta_sent as f64;
            counter.current_recv_bps = delta_recv as f64;

            counter.prev_tick_sent = counter.session_sent;
            counter.prev_tick_recv = counter.session_recv;

            total_send_bps += counter.current_send_bps;
            total_recv_bps += counter.current_recv_bps;
        }

        (total_send_bps, total_recv_bps)
    }

    pub fn drain_minute_aggregation(&self) -> Vec<(u32, u64, u64)> {
        let mut counters = self.counters.write();
        let mut result = Vec::new();

        for (&pid, counter) in counters.iter_mut() {
            if counter.minute_sent > 0 || counter.minute_recv > 0 {
                result.push((pid, counter.minute_sent, counter.minute_recv));
                counter.minute_sent = 0;
                counter.minute_recv = 0;
            }
        }

        result
    }

    pub fn get_snapshot(&self, sys: &mut sysinfo::System, is_elevated: bool) -> LiveSnapshot {
        let now = self.start_time.elapsed().as_secs();
        let (counters_snapshot, total_sent_bps, total_recv_bps, session_total_sent, session_total_recv) = {
            let counters = self.counters.read();
            let mut total_sent = 0.0;
            let mut total_recv = 0.0;
            let mut session_sent = 0;
            let mut session_recv = 0;

            let mut list = Vec::with_capacity(counters.len());
            for (&pid, c) in counters.iter() {
                total_sent += c.current_send_bps;
                total_recv += c.current_recv_bps;
                session_sent += c.session_sent;
                session_recv += c.session_recv;

                list.push((
                    pid,
                    c.current_send_bps,
                    c.current_recv_bps,
                    c.session_sent,
                    c.session_recv,
                    now.saturating_sub(c.last_active_timestamp),
                ));
            }
            (list, total_sent, total_recv, session_sent, session_recv)
        };

        let mut processes = Vec::new();
        let mut active_count = 0;
        let mut system_count = 0;

        for (pid, send_bps, recv_bps, s_sent, s_recv, last_active) in counters_snapshot {
            // Keep active processes or processes that used data in this session
            if s_sent == 0 && s_recv == 0 {
                continue;
            }

            let meta = self.resolver.resolve(pid, sys);
            if meta.is_system_component {
                system_count += 1;
            }
            if send_bps > 0.0 || recv_bps > 0.0 {
                active_count += 1;
            }

            processes.push(ProcessLiveStats {
                pid,
                exe_name: meta.exe_name,
                exe_path: meta.exe_path,
                display_name: meta.display_name,
                is_system_component: meta.is_system_component,
                icon_base64: meta.icon_base64,
                download_speed_bps: recv_bps,
                upload_speed_bps: send_bps,
                session_download_bytes: s_recv,
                session_upload_bytes: s_sent,
                last_active_secs_ago: last_active,
            });
        }

        // Sort: active speed first, then session total
        processes.sort_by(|a, b| {
            let speed_a = a.download_speed_bps + a.upload_speed_bps;
            let speed_b = b.download_speed_bps + b.upload_speed_bps;
            speed_b
                .partial_cmp(&speed_a)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| {
                    let total_a = a.session_download_bytes + a.session_upload_bytes;
                    let total_b = b.session_download_bytes + b.session_upload_bytes;
                    total_b.cmp(&total_a)
                })
        });

        let today_sent = *self.today_sent_baseline.read() + session_total_sent;
        let today_recv = *self.today_recv_baseline.read() + session_total_recv;

        LiveSnapshot {
            total_download_speed_bps: total_recv_bps,
            total_upload_speed_bps: total_sent_bps,
            today_download_bytes: today_recv,
            today_upload_bytes: today_sent,
            active_processes_count: active_count,
            system_processes_count: system_count,
            is_elevated,
            processes,
        }
    }
}
