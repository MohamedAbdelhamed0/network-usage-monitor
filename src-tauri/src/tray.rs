use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

pub fn setup_tray(app: &AppHandle, is_elevated: bool) -> Result<(), Box<dyn std::error::Error>> {
    let title_item = MenuItem::with_id(
        app,
        "title",
        if is_elevated {
            "Network Usage Monitor [Admin]"
        } else {
            "Network Usage Monitor [Standard]"
        },
        false,
        None::<&str>,
    )?;

    let show_item = MenuItem::with_id(app, "show", "Show Dashboard", true, None::<&str>)?;
    let restart_admin_item = MenuItem::with_id(
        app,
        "restart_admin",
        "Restart as Administrator",
        !is_elevated,
        None::<&str>,
    )?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &title_item,
            &show_item,
            &restart_admin_item,
            &quit_item,
        ],
    )?;

    let icon = app.default_window_icon().cloned().ok_or("No default window icon found")?;

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .menu(&menu)
        .tooltip("Network Usage Monitor - Running")
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            "restart_admin" => {
                let _ = crate::monitor::NetworkCollector::restart_as_admin();
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

pub fn update_tray_speed(app: &AppHandle, down_bps: f64, up_bps: f64) {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let down_str = format_speed(down_bps);
        let up_str = format_speed(up_bps);
        let tooltip = format!("Network Usage Monitor\n↓ {}  ↑ {}", down_str, up_str);
        let _ = tray.set_tooltip(Some(tooltip));
    }
}

fn format_speed(bps: f64) -> String {
    if bps >= 1_048_576.0 {
        format!("{:.1} MB/s", bps / 1_048_576.0)
    } else if bps >= 1024.0 {
        format!("{:.0} KB/s", bps / 1024.0)
    } else {
        format!("{:.0} B/s", bps)
    }
}
