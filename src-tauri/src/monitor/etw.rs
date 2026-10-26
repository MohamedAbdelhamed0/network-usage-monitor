use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use super::buffer::LiveTrafficBuffer;

pub struct NetworkCollector {
    buffer: Arc<LiveTrafficBuffer>,
    is_running: Arc<AtomicBool>,
    is_elevated: bool,
}

impl NetworkCollector {
    pub fn new(buffer: Arc<LiveTrafficBuffer>) -> Self {
        let is_elevated = Self::check_elevation();
        Self {
            buffer,
            is_running: Arc::new(AtomicBool::new(false)),
            is_elevated,
        }
    }

    pub fn is_elevated(&self) -> bool {
        self.is_elevated
    }

    pub fn start(&self) {
        if self.is_running.swap(true, Ordering::SeqCst) {
            return; // Already running
        }

        let is_running_clone = self.is_running.clone();
        let buffer_clone = self.buffer.clone();
        let elevated = self.is_elevated;

        thread::spawn(move || {
            if elevated {
                if let Err(e) = Self::run_etw_loop(buffer_clone.clone(), is_running_clone.clone()) {
                    eprintln!("[ETW Collector] Error running ETW trace: {}. Falling back to connection polling.", e);
                    Self::run_fallback_loop(buffer_clone, is_running_clone);
                }
            } else {
                println!("[Network Collector] Not running as admin. Using active connection polling fallback.");
                Self::run_fallback_loop(buffer_clone, is_running_clone);
            }
        });
    }

    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }

    #[cfg(target_os = "windows")]
    fn check_elevation() -> bool {
        use windows::Win32::Foundation::HANDLE;
        use windows::Win32::Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};
        use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

        unsafe {
            let mut token: HANDLE = HANDLE::default();
            if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).is_err() {
                return false;
            }

            let mut elevation = TOKEN_ELEVATION::default();
            let mut return_length = 0u32;
            let ok = GetTokenInformation(
                token,
                TokenElevation,
                Some(&mut elevation as *mut _ as *mut _),
                std::mem::size_of::<TOKEN_ELEVATION>() as u32,
                &mut return_length,
            );

            let _ = windows::Win32::Foundation::CloseHandle(token);

            if ok.is_ok() {
                elevation.TokenIsElevated != 0
            } else {
                false
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    fn check_elevation() -> bool {
        false
    }

    #[cfg(target_os = "windows")]
    fn run_etw_loop(
        buffer: Arc<LiveTrafficBuffer>,
        is_running: Arc<AtomicBool>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        use ferrisetw::provider::kernel_providers::TCP_IP_PROVIDER;
        use ferrisetw::trace::KernelTrace;

        println!("[ETW Collector] Initializing ETW KernelTrace with TCP_IP_PROVIDER...");

        let buffer_for_callback = buffer.clone();

        let trace = KernelTrace::new()
            .named("ModernNetworkMonitorTrace".to_string())
            .enable(
                ferrisetw::provider::Provider::kernel(&TCP_IP_PROVIDER)
                    .add_callback(move |record, schema_locator| {
                        let pid = record.process_id();
                        if pid == 0 {
                            return;
                        }

                        // Parse size if available
                        if let Ok(schema) = schema_locator.event_schema(record) {
                            let parser = ferrisetw::parser::Parser::create(record, &schema);
                            let size: u32 = parser.try_parse("size").unwrap_or(0);
                            let task_name = schema.task_name().to_lowercase();
                            let opcode_name = schema.opcode_name().to_lowercase();

                            if size > 0 {
                                if task_name.contains("send") || opcode_name.contains("send") {
                                    buffer_for_callback.record_traffic(pid, size as u64, 0);
                                } else if task_name.contains("recv") || task_name.contains("receive") || opcode_name.contains("recv") {
                                    buffer_for_callback.record_traffic(pid, 0, size as u64);
                                } else {
                                    // Default split or count based on event ID
                                    buffer_for_callback.record_traffic(pid, 0, size as u64);
                                }
                            }
                        }
                    })
                    .build(),
            );

        println!("[ETW Collector] Starting ETW Kernel trace processing...");
        let trace_handler = trace.start_and_process().map_err(|e| format!("{:?}", e))?;

        while is_running.load(Ordering::SeqCst) {
            thread::sleep(Duration::from_millis(500));
        }

        let _ = trace_handler.stop();
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    fn run_etw_loop(
        _buffer: Arc<LiveTrafficBuffer>,
        _is_running: Arc<AtomicBool>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        Err("ETW only supported on Windows".into())
    }

    /// Fallback connection monitoring when unprivileged or ETW unavailable
    #[cfg(target_os = "windows")]
    fn run_fallback_loop(buffer: Arc<LiveTrafficBuffer>, is_running: Arc<AtomicBool>) {
        use windows::Win32::NetworkManagement::IpHelper::{
            GetExtendedTcpTable, GetExtendedUdpTable, MIB_TCPTABLE_OWNER_PID, MIB_UDPTABLE_OWNER_PID,
            TCP_TABLE_OWNER_PID_ALL, UDP_TABLE_OWNER_PID,
        };
        use windows::Win32::Networking::WinSock::AF_INET;

        println!("[Network Collector] Fallback polling started.");

        while is_running.load(Ordering::SeqCst) {
            let mut size = 0u32;
            unsafe {
                // Determine buffer size
                let _ = GetExtendedTcpTable(
                    None,
                    &mut size,
                    false,
                    AF_INET.0 as u32,
                    TCP_TABLE_OWNER_PID_ALL,
                    0,
                );

                if size > 0 {
                    let mut buf: Vec<u8> = vec![0; size as usize];
                    let ret = GetExtendedTcpTable(
                        Some(buf.as_mut_ptr() as *mut _),
                        &mut size,
                        false,
                        AF_INET.0 as u32,
                        TCP_TABLE_OWNER_PID_ALL,
                        0,
                    );

                    if ret == 0 {
                        let table = &*(buf.as_ptr() as *const MIB_TCPTABLE_OWNER_PID);
                        let rows = std::slice::from_raw_parts(table.table.as_ptr(), table.dwNumEntries as usize);

                        for row in rows {
                            let pid = row.dwOwningPid;
                            if pid > 0 {
                                // Record baseline active presence (small heartbeat bytes so apps are visible)
                                buffer.record_traffic(pid, 128, 256);
                            }
                        }
                    }
                }

                // Also check UDP endpoints
                let mut udp_size = 0u32;
                let _ = GetExtendedUdpTable(
                    None,
                    &mut udp_size,
                    false,
                    AF_INET.0 as u32,
                    UDP_TABLE_OWNER_PID,
                    0,
                );

                if udp_size > 0 {
                    let mut udp_buf: Vec<u8> = vec![0; udp_size as usize];
                    let ret = GetExtendedUdpTable(
                        Some(udp_buf.as_mut_ptr() as *mut _),
                        &mut udp_size,
                        false,
                        AF_INET.0 as u32,
                        UDP_TABLE_OWNER_PID,
                        0,
                    );

                    if ret == 0 {
                        let table = &*(udp_buf.as_ptr() as *const MIB_UDPTABLE_OWNER_PID);
                        let rows = std::slice::from_raw_parts(table.table.as_ptr(), table.dwNumEntries as usize);

                        for row in rows {
                            let pid = row.dwOwningPid;
                            if pid > 0 {
                                buffer.record_traffic(pid, 64, 64);
                            }
                        }
                    }
                }
            }

            thread::sleep(Duration::from_millis(1000));
        }
    }

    #[cfg(not(target_os = "windows"))]
    fn run_fallback_loop(_buffer: Arc<LiveTrafficBuffer>, is_running: Arc<AtomicBool>) {
        while is_running.load(Ordering::SeqCst) {
            thread::sleep(Duration::from_millis(1000));
        }
    }

    /// Relaunches the current executable requesting Windows UAC Administrator rights
    #[cfg(target_os = "windows")]
    pub fn restart_as_admin() -> Result<(), String> {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;
        use windows::core::PCWSTR;
        use windows::Win32::UI::Shell::ShellExecuteW;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        let wide_exe: Vec<u16> = OsStr::new(&exe_path)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let wide_verb: Vec<u16> = OsStr::new("runas")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        unsafe {
            let res = ShellExecuteW(
                None,
                PCWSTR(wide_verb.as_ptr()),
                PCWSTR(wide_exe.as_ptr()),
                None,
                None,
                SW_SHOWNORMAL,
            );

            if res.0 as usize > 32 {
                std::process::exit(0);
            } else {
                Err(format!("ShellExecute error code: {}", res.0 as usize))
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    pub fn restart_as_admin() -> Result<(), String> {
        Err("Restart as admin only supported on Windows".to_string())
    }
}
