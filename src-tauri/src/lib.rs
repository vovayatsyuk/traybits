use std::process::Command;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconId},
    Manager, WindowEvent,
};

struct TrayState(TrayIconId);
struct UpdatedAtState(MenuItem<tauri::Wry>);

#[tauri::command]
fn set_tray_title(app: tauri::AppHandle, state: tauri::State<TrayState>, updated_at: tauri::State<UpdatedAtState>, title: String) {
    if let Some(tray) = app.tray_by_id(&state.0) {
        let _ = tray.set_title(Some(title));
    }
    let time = Command::new("date").arg("+%H:%M").output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();
    let _ = updated_at.0.set_text(format!("Updated at {}", time));
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
            let updated_at_i =
                MenuItem::with_id(app, "updated_at", "Updated at --:--", false, None::<&str>)?;
            let preferences_i =
                MenuItem::with_id(app, "preferences", "Preferences", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&updated_at_i, &preferences_i, &quit_i])?;

            let tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(true)
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "preferences" => {
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

            app.manage(TrayState(tray.id().clone()));
            app.manage(UpdatedAtState(updated_at_i));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![set_tray_title])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
