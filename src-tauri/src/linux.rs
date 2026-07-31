use std::{thread, time::Duration};
use tauri::{AppHandle, Manager, tray::TrayIcon};

use crate::TrayState;

const WATCHER: &str = "org.kde.StatusNotifierWatcher";

pub fn setup_tray(app: &AppHandle, tray: &TrayIcon) -> tauri::Result<()> {
    tray.set_icon(tauri::include_image!("icons/tray.png").into())?;

    watch_tray_host(app.clone());

    // The host may already own its name while still being too busy to take our label —
    // the usual case at login, where it comes up seconds before us and no name change
    // follows for the watch above to react to.
    let app = app.clone();
    thread::spawn(move || {
        for delay in [2, 3, 5, 5, 10, 10] {
            thread::sleep(Duration::from_secs(delay));
            reassert_title(&app);
        }
    });

    Ok(())
}

fn reassert_title(app: &AppHandle) {
    let state = app.state::<TrayState>();
    let title = state.title.lock().unwrap().clone();
    if title.is_empty() {
        return;
    }
    if let Some(tray) = app.tray_by_id(&state.id) {
        let _ = tray.set_title(Some(format!("{title}\u{200b}")));
        let _ = tray.set_title(Some(&title));
    }
}

// Re-assert the title shortly after the tray restart
fn watch_tray_host(app: AppHandle) {
    thread::spawn(move || -> zbus::Result<()> {
        let connection = zbus::blocking::Connection::session()?;
        let dbus = zbus::blocking::fdo::DBusProxy::new(&connection)?;
        let owner_changes = dbus.receive_name_owner_changed_with_args(&[(0, WATCHER)])?;

        for change in owner_changes {
            if change.args()?.new_owner().is_some() {
                thread::sleep(Duration::from_secs(2));
                reassert_title(&app);
            }
        }

        Ok(())
    });
}
