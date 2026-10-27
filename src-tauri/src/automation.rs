//! Local control bridge for native macOS automation helpers.
//!
//! The socket is deliberately a per-user Unix-domain socket with 0600
//! permissions. It lets AutoTappo ask the native WuwaTappo window to perform
//! its own DOM/API-backed chest action without screen-wide blind clicks.

use serde::Deserialize;
use serde_json::json;
use std::fs;
use std::io::{BufRead, BufReader};
use std::os::unix::fs::PermissionsExt;
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

const SOCKET_NAME: &str = "autotappo.sock";
const EVENT_NAME: &str = "autotappo-auto-chest";

#[derive(Default)]
pub struct AutomationState {
    stop: Arc<AtomicBool>,
    enabled: Arc<AtomicBool>,
    path: Mutex<Option<PathBuf>>,
}

#[derive(Deserialize)]
struct AutomationCommand {
    command: String,
    enabled: Option<bool>,
    place: Option<String>,
}

fn socket_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join(SOCKET_NAME))
}

fn emit_enabled(app: &AppHandle, enabled: bool) {
    if let Err(error) = app.emit_to("main", EVENT_NAME, json!({ "enabled": enabled })) {
        eprintln!("[automation] could not notify main window: {error}");
    }
}

fn handle_stream(app: &AppHandle, enabled_state: &AtomicBool, stream: UnixStream) {
    let mut line = String::new();
    let mut reader = BufReader::new(stream);
    if reader.read_line(&mut line).is_err() || line.len() > 4096 {
        return;
    }
    let Ok(command) = serde_json::from_str::<AutomationCommand>(&line) else {
        return;
    };

    match command.command.as_str() {
        "set_auto_chest" => {
            let enabled = command.enabled.unwrap_or(false);
            enabled_state.store(enabled, Ordering::Release);
            emit_enabled(app, enabled);
        }
        "open_chest" => {
            // Kept as a narrow one-shot bridge for diagnostics and future
            // clients. The frontend still validates place and readiness.
            if matches!(command.place.as_deref(), Some("left" | "right")) {
                if let Err(error) = app.emit_to(
                    "main",
                    EVENT_NAME,
                    json!({ "enabled": true, "place": command.place }),
                ) {
                    eprintln!("[automation] could not notify one-shot chest action: {error}");
                }
            }
        }
        "ping" => {}
        _ => {}
    }
}

fn run_listener(
    app: AppHandle,
    stop: Arc<AtomicBool>,
    enabled_state: Arc<AtomicBool>,
    path: PathBuf,
) {
    let _ = fs::remove_file(&path);
    let Some(parent) = path.parent() else { return };
    if let Err(error) = fs::create_dir_all(parent) {
        eprintln!("[automation] could not create socket directory: {error}");
        return;
    }
    let listener = match UnixListener::bind(&path) {
        Ok(listener) => listener,
        Err(error) => {
            eprintln!("[automation] could not bind {}: {error}", path.display());
            return;
        }
    };
    if let Err(error) = fs::set_permissions(&path, fs::Permissions::from_mode(0o600)) {
        eprintln!("[automation] could not restrict socket permissions: {error}");
    }
    let _ = listener.set_nonblocking(true);

    while !stop.load(Ordering::Acquire) {
        match listener.accept() {
            Ok((stream, _)) => handle_stream(&app, &enabled_state, stream),
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(100));
            }
            Err(error) => {
                eprintln!("[automation] socket accept failed: {error}");
                thread::sleep(Duration::from_millis(250));
            }
        }
    }
    let _ = fs::remove_file(&path);
}

pub fn start(app: &AppHandle) -> Result<(), String> {
    let path = socket_path(app)?;
    let state = app.state::<AutomationState>();
    {
        let mut stored = state
            .path
            .lock()
            .map_err(|_| "Automation socket state is unavailable")?;
        if stored.is_some() {
            return Ok(());
        }
        *stored = Some(path.clone());
    }
    state.stop.store(false, Ordering::Release);
    let stop = Arc::clone(&state.stop);
    let enabled_state = Arc::clone(&state.enabled);
    let app = app.clone();
    thread::Builder::new()
        .name("wuwatappo-automation".into())
        .spawn(move || run_listener(app, stop, enabled_state, path))
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn shutdown(app: &AppHandle) {
    let state = app.state::<AutomationState>();
    state.stop.store(true, Ordering::Release);
    if let Ok(path) = socket_path(app) {
        let _ = UnixStream::connect(path);
    }
}

#[tauri::command]
pub fn auto_chest_state(state: State<'_, AutomationState>) -> bool {
    state.enabled.load(Ordering::Acquire)
}
