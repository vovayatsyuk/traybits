use std::{
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager, tray::TrayIcon};

use crate::TrayState;

const WATCHER: &str = "org.kde.StatusNotifierWatcher";

// Block until a tray host owns the watcher name, or give up after `timeout`.
//
// libayatana-appindicator falls back to a legacy XEmbed GtkStatusIcon when the
// watcher is missing at the moment the indicator goes active, and does not
// reliably tear that fallback down once the watcher appears. The leftover is a
// second icon in the panel: opaque background, and no label, since XAyatanaLabel
// only exists on the D-Bus side. At login we race gnome-shell for this, so wait
// for the host before building the tray. Building anyway on timeout keeps the
// tray working on desktops that have no watcher at all.
pub fn wait_for_tray_host(timeout: Duration) -> bool {
    let Ok(connection) = zbus::blocking::Connection::session() else {
        return false;
    };
    let Ok(dbus) = zbus::blocking::fdo::DBusProxy::new(&connection) else {
        return false;
    };
    let Ok(watcher) = zbus::names::BusName::try_from(WATCHER) else {
        return false;
    };

    let deadline = Instant::now() + timeout;
    loop {
        if dbus.name_has_owner(watcher.clone()).unwrap_or(false) {
            return true;
        }
        if Instant::now() >= deadline {
            return false;
        }
        thread::sleep(Duration::from_millis(100));
    }
}

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
