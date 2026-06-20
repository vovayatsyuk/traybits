use std::{thread, time::Duration};
use tauri::{
    Emitter, Manager, WindowEvent,
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconId},
};

struct TrayState(TrayIconId);

#[tauri::command]
fn set_tray_title(app: tauri::AppHandle, state: tauri::State<TrayState>, title: String) {
    if let Some(tray) = app.tray_by_id(&state.0) {
        let _ = tray.set_title(Some(title));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let refresh_i = MenuItem::with_id(app, "refresh", "Refresh now", true, None::<&str>)?;
            let settings_i = MenuItem::with_id(app, "settings", "Settings...", true, Some("Cmd+,"))?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[
                &refresh_i,
                &settings_i,
                &quit_i
            ])?;

            let tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "refresh" => {
                        let _ = app.emit("refresh", ());
                    }
                    "settings" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            #[cfg(target_os = "linux")] {
                tray.set_icon(tauri::include_image!("icons/tray.png").into()).unwrap();
            }

            app.manage(TrayState(tray.id().clone()));

            let app = app.handle().clone();
            thread::spawn(move || {
                loop {
                    let _ = app.emit("tick", ());
                    std::thread::sleep(Duration::from_secs(1));
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![set_tray_title])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
