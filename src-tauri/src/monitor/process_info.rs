use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use sysinfo::{Pid, System};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessMetadata {
    pub pid: u32,
    pub exe_name: String,
    pub exe_path: String,
    pub display_name: String,
    pub is_system_component: bool,
    pub icon_base64: Option<String>,
}

#[derive(Clone)]
pub struct ProcessResolver {
    cache: Arc<RwLock<HashMap<u32, ProcessMetadata>>>,
}

impl ProcessResolver {
    pub fn new() -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn resolve(&self, pid: u32, sys: &mut System) -> ProcessMetadata {
        {
            let cache_read = self.cache.read();
            if let Some(info) = cache_read.get(&pid) {
                return info.clone();
            }
        }

        let metadata = self.fetch_metadata(pid, sys);
        {
            let mut cache_write = self.cache.write();
            cache_write.insert(pid, metadata.clone());
        }
        metadata
    }

    fn fetch_metadata(&self, pid: u32, sys: &mut System) -> ProcessMetadata {
        if pid == 0 {
            return ProcessMetadata {
                pid: 0,
                exe_name: "System Idle".to_string(),
                exe_path: "C:\\Windows\\System32\\ntoskrnl.exe".to_string(),
                display_name: "System Idle Process".to_string(),
                is_system_component: true,
                icon_base64: None,
            };
        }

        if pid == 4 {
            return ProcessMetadata {
                pid: 4,
                exe_name: "System".to_string(),
                exe_path: "C:\\Windows\\System32\\ntoskrnl.exe".to_string(),
                display_name: "Windows Kernel System".to_string(),
                is_system_component: true,
                icon_base64: None,
            };
        }

        sys.refresh_processes(sysinfo::ProcessesToUpdate::Some(&[Pid::from_u32(pid)]));
        if let Some(proc) = sys.process(Pid::from_u32(pid)) {
            let exe_name = proc.name().to_string_lossy().to_string();
            let exe_path = proc
                .exe()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| exe_name.clone());

            let display_name = Self::generate_display_name(&exe_name);
            let is_system = Self::detect_system_component(&exe_name, &exe_path);
            let icon_base64 = Self::extract_icon_base64(&exe_path);

            return ProcessMetadata {
                pid,
                exe_name,
                exe_path,
                display_name,
                is_system_component: is_system,
                icon_base64,
            };
        }

        // Fallback for terminating or unknown processes
        let is_system = pid < 1000;
        ProcessMetadata {
            pid,
            exe_name: format!("PID:{}", pid),
            exe_path: "".to_string(),
            display_name: if pid < 1000 {
                "Windows System Service".to_string()
            } else {
                format!("Process ({})", pid)
            },
            is_system_component: is_system,
            icon_base64: None,
        }
    }

    fn generate_display_name(exe_name: &str) -> String {
        let lower = exe_name.to_lowercase();
        match lower.as_str() {
            "chrome.exe" => "Google Chrome".to_string(),
            "msedge.exe" => "Microsoft Edge".to_string(),
            "firefox.exe" => "Mozilla Firefox".to_string(),
            "brave.exe" => "Brave Browser".to_string(),
            "discord.exe" => "Discord".to_string(),
            "steam.exe" => "Steam".to_string(),
            "spotify.exe" => "Spotify".to_string(),
            "code.exe" => "Visual Studio Code".to_string(),
            "devenv.exe" => "Visual Studio".to_string(),
            "svchost.exe" => "Windows Service Host".to_string(),
            "explorer.exe" => "Windows Explorer".to_string(),
            "searchhost.exe" => "Windows Search Host".to_string(),
            "startmenuexperiencehost.exe" => "Start Menu Experience".to_string(),
            "dwm.exe" => "Desktop Window Manager".to_string(),
            "lsass.exe" => "Local Security Authority".to_string(),
            "spoolsv.exe" => "Print Spooler Service".to_string(),
            "runtimebroker.exe" => "Runtime Broker".to_string(),
            "onedrive.exe" => "Microsoft OneDrive".to_string(),
            "slack.exe" => "Slack".to_string(),
            "telegram.exe" => "Telegram".to_string(),
            "epicgameslauncher.exe" => "Epic Games Launcher".to_string(),
            _ => {
                let stem = Path::new(exe_name)
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or(exe_name);
                // Capitalize first letter
                let mut chars = stem.chars();
                match chars.next() {
                    None => stem.to_string(),
                    Some(f) => f.to_uppercase().collect::<String>() + chars.as_str(),
                }
            }
        }
    }

    fn detect_system_component(exe_name: &str, exe_path: &str) -> bool {
        let lower_path = exe_path.to_lowercase();
        let lower_name = exe_name.to_lowercase();

        if lower_path.contains("\\windows\\system32\\")
            || lower_path.contains("\\windows\\syswow64\\")
            || lower_path.contains("\\windows\\servicing\\")
            || lower_path.contains("\\windows\\systemapps\\")
        {
            return true;
        }

        matches!(
            lower_name.as_str(),
            "system"
                | "svchost.exe"
                | "services.exe"
                | "lsass.exe"
                | "csrss.exe"
                | "wininit.exe"
                | "dwm.exe"
                | "explorer.exe"
                | "taskhostw.exe"
                | "sihost.exe"
                | "fontdrvhost.exe"
                | "spoolsv.exe"
                | "wmiprvse.exe"
        )
    }

    #[cfg(target_os = "windows")]
    fn extract_icon_base64(exe_path: &str) -> Option<String> {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;
        use windows::Win32::Graphics::Gdi::{
            CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits,
            ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
        };
        use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_SMALLICON};
        use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, DrawIconEx, DI_NORMAL};

        if exe_path.is_empty() || !Path::new(exe_path).exists() {
            return None;
        }

        let wide_path: Vec<u16> = OsStr::new(exe_path)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        unsafe {
            let mut shfi: SHFILEINFOW = std::mem::zeroed();
            let res = SHGetFileInfoW(
                windows::core::PCWSTR(wide_path.as_ptr()),
                windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES(0),
                Some(&mut shfi),
                std::mem::size_of::<SHFILEINFOW>() as u32,
                SHGFI_ICON | SHGFI_SMALLICON,
            );

            if res == 0 || shfi.hIcon.is_invalid() {
                return None;
            }

            let hicon = shfi.hIcon;
            let width = 32;
            let height = 32;

            let hdc_screen = GetDC(None);
            let hdc_mem = CreateCompatibleDC(hdc_screen);
            let hbm = CreateCompatibleBitmap(hdc_screen, width, height);
            let old_bm = SelectObject(hdc_mem, hbm);

            let _ = DrawIconEx(
                hdc_mem,
                0,
                0,
                hicon,
                width,
                height,
                0,
                None,
                DI_NORMAL,
            );

            let mut bmi = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: width,
                    biHeight: -height, // top-down
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0,
                    biSizeImage: (width * height * 4) as u32,
                    biXPelsPerMeter: 0,
                    biYPelsPerMeter: 0,
                    biClrUsed: 0,
                    biClrImportant: 0,
                },
                bmiColors: [windows::Win32::Graphics::Gdi::RGBQUAD::default()],
            };

            let mut buffer: Vec<u8> = vec![0; (width * height * 4) as usize];
            GetDIBits(
                hdc_mem,
                hbm,
                0,
                height as u32,
                Some(buffer.as_mut_ptr() as *mut _),
                &mut bmi,
                DIB_RGB_COLORS,
            );

            // Clean up GDI handles
            SelectObject(hdc_mem, old_bm);
            let _ = DeleteObject(hbm);
            let _ = DeleteDC(hdc_mem);
            ReleaseDC(None, hdc_screen);
            let _ = DestroyIcon(hicon);

            // Convert BGRA to RGBA and check if not empty
            let mut has_non_transparent = false;
            for chunk in buffer.chunks_exact_mut(4) {
                let b = chunk[0];
                let r = chunk[2];
                let a = chunk[3];
                chunk[0] = r;
                chunk[2] = b;
                if a > 0 {
                    has_non_transparent = true;
                }
            }

            if !has_non_transparent {
                // If alpha was 0 everywhere, set alpha to 255 if color is present
                for chunk in buffer.chunks_exact_mut(4) {
                    if chunk[0] != 0 || chunk[1] != 0 || chunk[2] != 0 {
                        chunk[3] = 255;
                    }
                }
            }

            // Encode simple BMP/PNG or Base64 data
            // For simplicity and speed, encode as raw RGBA or minimal BMP data URI
            let bmp_bytes = Self::rgba_to_bmp(&buffer, width as u32, height as u32);
            use base64::Engine;
            let b64 = base64::engine::general_purpose::STANDARD.encode(&bmp_bytes);
            Some(format!("data:image/bmp;base64,{}", b64))
        }
    }

    #[cfg(not(target_os = "windows"))]
    fn extract_icon_base64(_exe_path: &str) -> Option<String> {
        None
    }

    fn rgba_to_bmp(rgba: &[u8], width: u32, height: u32) -> Vec<u8> {
        let row_size = width * 4;
        let image_size = row_size * height;
        let file_size = 54 + image_size;

        let mut bmp = Vec::with_capacity(file_size as usize);
        // Header
        bmp.extend_from_slice(b"BM");
        bmp.extend_from_slice(&file_size.to_le_bytes());
        bmp.extend_from_slice(&0u32.to_le_bytes()); // Reserved
        bmp.extend_from_slice(&54u32.to_le_bytes()); // Offset to pixel data

        // DIB Header
        bmp.extend_from_slice(&40u32.to_le_bytes()); // DIB Header size
        bmp.extend_from_slice(&(width as i32).to_le_bytes());
        bmp.extend_from_slice(&(-(height as i32)).to_le_bytes()); // Top-down
        bmp.extend_from_slice(&1u16.to_le_bytes()); // Planes
        bmp.extend_from_slice(&32u16.to_le_bytes()); // Bits per pixel
        bmp.extend_from_slice(&0u32.to_le_bytes()); // Compression (BI_RGB)
        bmp.extend_from_slice(&image_size.to_le_bytes());
        bmp.extend_from_slice(&2835u32.to_le_bytes()); // XPPM
        bmp.extend_from_slice(&2835u32.to_le_bytes()); // YPPM
        bmp.extend_from_slice(&0u32.to_le_bytes());
        bmp.extend_from_slice(&0u32.to_le_bytes());

        // Pixels (BGRA)
        for chunk in rgba.chunks_exact(4) {
            bmp.push(chunk[2]); // B
            bmp.push(chunk[1]); // G
            bmp.push(chunk[0]); // R
            bmp.push(chunk[3]); // A
        }

        bmp
    }
}
