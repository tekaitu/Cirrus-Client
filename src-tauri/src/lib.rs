pub mod auth;
pub mod java;
pub mod runtime;
pub mod settings;
pub mod system;

use serde::Serialize;
use auth::SecretStore;
use settings::{FieldError, LoadStatus, Settings};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

/// Event the installer sends to the window while it works.
pub const INSTALL_PROGRESS_EVENT: &str = "java-install-progress";

/// Event that carries the Microsoft sign-in code to show.
pub const AUTH_CODE_EVENT: &str = "auth-device-code";

/// Signed-in session (kept in memory only) and the cancel flag of a running sign-in.
#[derive(Default)]
struct AuthState {
    session: Mutex<Option<auth::Session>>,
    cancel: Mutex<Option<Arc<AtomicBool>>>,
}

/// Cancel flag of the installation that is running right now, if any.
#[derive(Default)]
struct InstallState(Mutex<Option<Arc<AtomicBool>>>);

pub const TARGET_MINECRAFT: &str = "1.21.11";

#[derive(Serialize, Debug, PartialEq)]
pub struct AppInfo {
    pub name: &'static str,
    pub version: &'static str,
    pub target_minecraft: &'static str,
    /// False until real Minecraft launching has been implemented and verified.
    pub launcher_ready: bool,
}

pub fn app_info() -> AppInfo {
    AppInfo {
        name: "Limited FPS",
        version: env!("CARGO_PKG_VERSION"),
        target_minecraft: TARGET_MINECRAFT,
        launcher_ready: false,
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SettingsState {
    settings: Settings,
    status: LoadStatus,
    message: Option<String>,
    file_path: String,
    total_ram_mb: u64,
    min_memory_mb: u32,
    max_memory_mb: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveOutcome {
    ok: bool,
    errors: Vec<FieldError>,
    state: Option<SettingsState>,
}

fn settings_file(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join("settings.json"))
        .map_err(|e| format!("Could not find the settings folder: {e}"))
}

fn default_settings(app: &AppHandle, total_ram_mb: u64) -> Result<Settings, String> {
    let game_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not find the app data folder: {e}"))?
        .join("game");
    Ok(settings::defaults(total_ram_mb, &game_dir))
}

fn build_state(
    app: &AppHandle,
    loaded: settings::Loaded,
    total_ram_mb: u64,
) -> Result<SettingsState, String> {
    Ok(SettingsState {
        settings: loaded.settings,
        status: loaded.status,
        message: loaded.message,
        file_path: settings_file(app)?.display().to_string(),
        total_ram_mb,
        min_memory_mb: settings::MIN_MEMORY_MB,
        max_memory_mb: settings::max_memory_mb(total_ram_mb),
    })
}

#[tauri::command]
fn get_app_info() -> AppInfo {
    app_info()
}

#[tauri::command]
async fn get_system_info() -> Result<system::SystemInfo, String> {
    tauri::async_runtime::spawn_blocking(system::collect)
        .await
        .map_err(|e| format!("System information could not be read: {e}"))
}

fn runtime_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|dir| dir.join("runtime"))
        .map_err(|e| format!("Could not find the app data folder: {e}"))
}

#[tauri::command]
async fn detect_java(
    app: AppHandle,
    configured_path: Option<String>,
) -> Result<java::JavaDetection, String> {
    let roots = runtime::managed_roots(&runtime_dir(&app)?);
    tauri::async_runtime::spawn_blocking(move || java::detect(configured_path.as_deref(), &roots))
        .await
        .map_err(|e| format!("Java detection failed: {e}"))
}

#[tauri::command]
async fn inspect_java(path: String) -> Result<java::JavaInstall, String> {
    tauri::async_runtime::spawn_blocking(move || {
        java::inspect_user_path(&path, java::SRC_CONFIGURED)
    })
    .await
    .map_err(|e| format!("Java check failed: {e}"))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InstallResult {
    /// "installed", "alreadyInstalled", "cancelled" or "failed"
    status: &'static str,
    message: Option<String>,
    java_path: Option<String>,
    version: Option<String>,
    source: Option<String>,
    /// True when Settings now points at the runtime.
    configured: bool,
    settings: Option<SettingsState>,
}

impl InstallResult {
    fn bare(status: &'static str, message: Option<String>) -> InstallResult {
        InstallResult {
            status,
            message,
            java_path: None,
            version: None,
            source: None,
            configured: false,
            settings: None,
        }
    }
}

/// Point Settings at `java_path`, changing nothing else in the file.
fn configure_java_path(app: &AppHandle, java_path: &str) -> Result<SettingsState, String> {
    let total = system::total_ram_mb();
    let defaults = default_settings(app, total)?;
    let file = settings_file(app)?;
    let mut loaded = settings::load(&file, &defaults);
    loaded.settings.java_path = Some(java_path.to_string());
    settings::save(&file, &loaded.settings)?;
    build_state(app, loaded, total)
}

#[tauri::command]
async fn install_java(app: AppHandle, state: State<'_, InstallState>) -> Result<InstallResult, String> {
    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut slot = state.0.lock().map_err(|_| "Installer state is unavailable.".to_string())?;
        if slot.is_some() {
            return Err("A Java installation is already running.".to_string());
        }
        *slot = Some(cancel.clone());
    }

    let dir = runtime_dir(&app);
    let configured = dir
        .as_ref()
        .ok()
        .and_then(|_| settings_file(&app).ok())
        .map(|file| {
            let total = system::total_ram_mb();
            let defaults = default_settings(&app, total).unwrap_or_default();
            settings::load(&file, &defaults).settings.java_path
        })
        .flatten();

    let emitter = app.clone();
    let flag = cancel.clone();
    let worker = tauri::async_runtime::spawn_blocking(move || {
        let dir = dir?;
        Ok::<_, String>(runtime::install_java(&dir, configured.as_deref(), &flag, &move |p| {
            let _ = emitter.emit(INSTALL_PROGRESS_EVENT, p);
        }))
    })
    .await;

    if let Ok(mut slot) = state.0.lock() {
        *slot = None;
    }

    let outcome = match worker {
        Err(e) => return Ok(InstallResult::bare("failed", Some(format!("The installer stopped unexpectedly: {e}")))),
        Ok(Err(e)) => return Ok(InstallResult::bare("failed", Some(e))),
        Ok(Ok(outcome)) => outcome,
    };
    match outcome {
        Err(runtime::InstallError::Cancelled) => Ok(InstallResult::bare("cancelled", None)),
        Err(runtime::InstallError::Failed(message)) => Ok(InstallResult::bare("failed", Some(message))),
        Ok(done) => {
            // Only Limited FPS' own copy is written to Settings; an existing
            // system Java is left alone and reported.
            let (configured, settings_state, note) = if done.managed {
                match configure_java_path(&app, &done.java_path) {
                    Ok(s) => (true, Some(s), None),
                    Err(e) => (false, None, Some(format!("Java is installed, but Settings could not be updated: {e}"))),
                }
            } else {
                (false, None, None)
            };
            Ok(InstallResult {
                status: done.status,
                message: note,
                java_path: Some(done.java_path),
                version: done.version,
                source: Some(done.source),
                configured,
                settings: settings_state,
            })
        }
    }
}

#[tauri::command]
fn cancel_java_install(state: State<'_, InstallState>) -> bool {
    match state.0.lock() {
        Ok(slot) => match slot.as_ref() {
            Some(flag) => {
                flag.store(true, Ordering::SeqCst);
                true
            }
            None => false,
        },
        Err(_) => false,
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthStatus {
    /// "notConfigured" | "signedOut" | "signedIn" | "cancelled" | "failed"
    state: &'static str,
    /// True when Settings holds a valid Azure client ID.
    configured: bool,
    /// True when a login is saved in Windows Credential Manager (or was just made).
    saved_login: bool,
    profile: Option<auth::Profile>,
    message: Option<String>,
}

/// The Settings override if there is one, otherwise the app ID built into this build.
fn client_id_from_settings(app: &AppHandle) -> Option<String> {
    let custom = (|| {
        let total = system::total_ram_mb();
        let defaults = default_settings(app, total).ok()?;
        let file = settings_file(app).ok()?;
        settings::load(&file, &defaults)
            .settings
            .ms_client_id
            .filter(|id| auth::is_valid_client_id(id))
    })();
    custom.or_else(|| auth::builtin_client_id().map(str::to_string))
}

fn status(
    state: &'static str,
    configured: bool,
    profile: Option<auth::Profile>,
    message: Option<String>,
) -> AuthStatus {
    AuthStatus {
        state,
        configured,
        saved_login: profile.is_some(),
        profile,
        message,
    }
}

/// Current state without any network traffic.
#[tauri::command]
fn auth_status(app: AppHandle, state: State<'_, AuthState>) -> AuthStatus {
    let configured = client_id_from_settings(&app).is_some();
    let session = state.session.lock().ok().and_then(|s| s.as_ref().map(|s| s.profile.clone()));
    match session {
        Some(profile) => status("signedIn", configured, Some(profile), None),
        None if configured => {
            let mut s = status("signedOut", true, None, None);
            s.saved_login = matches!(auth::KeyringStore.load(), Ok(Some(_)));
            s
        }
        None => status("notConfigured", false, None, None),
    }
}

/// Silent sign-in from the saved login (needs the network).
#[tauri::command]
async fn auth_restore(app: AppHandle, state: State<'_, AuthState>) -> Result<AuthStatus, String> {
    let Some(client_id) = client_id_from_settings(&app) else {
        return Ok(status("notConfigured", false, None, None));
    };
    let result = tauri::async_runtime::spawn_blocking(move || {
        auth::restore(&auth::Endpoints::production(), &client_id, &auth::KeyringStore)
    })
    .await
    .map_err(|e| format!("Sign-in check stopped unexpectedly: {e}"))?;
    Ok(match result {
        Ok(Some(session)) => {
            let profile = session.profile.clone();
            if let Ok(mut slot) = state.session.lock() {
                *slot = Some(session);
            }
            status("signedIn", true, Some(profile), None)
        }
        Ok(None) => status("signedOut", true, None, None),
        Err(e) => {
            let mut s = status("signedOut", true, None, Some(e.to_string()));
            s.saved_login = matches!(e, auth::AuthError::Failed(_));
            s
        }
    })
}

/// Interactive device-code sign-in. Emits `auth-device-code` with the code to show,
/// then returns when the person finishes, cancels, or it fails.
#[tauri::command]
async fn auth_sign_in(app: AppHandle, state: State<'_, AuthState>) -> Result<AuthStatus, String> {
    let Some(client_id) = client_id_from_settings(&app) else {
        return Ok(status(
            "notConfigured",
            false,
            None,
            Some("Enter your Azure Application (client) ID in Settings first.".to_string()),
        ));
    };
    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut slot = state.cancel.lock().map_err(|_| "Sign-in state is unavailable.".to_string())?;
        if slot.is_some() {
            return Err("A sign-in is already in progress.".to_string());
        }
        *slot = Some(cancel.clone());
    }
    let emitter = app.clone();
    let flag = cancel.clone();
    let worker = tauri::async_runtime::spawn_blocking(move || {
        auth::sign_in(&auth::Endpoints::production(), &client_id, &auth::KeyringStore, &flag, &move |info| {
            let _ = emitter.emit(AUTH_CODE_EVENT, info.clone());
        })
    })
    .await;
    if let Ok(mut slot) = state.cancel.lock() {
        *slot = None;
    }
    let result = worker.map_err(|e| format!("Sign-in stopped unexpectedly: {e}"))?;
    Ok(match result {
        Ok(session) => {
            let profile = session.profile.clone();
            let note = if session.persisted {
                None
            } else {
                Some("Signed in, but the login could not be saved, so you will need to sign in again next time.".to_string())
            };
            if let Ok(mut slot) = state.session.lock() {
                *slot = Some(session);
            }
            status("signedIn", true, Some(profile), note)
        }
        Err(auth::AuthError::Cancelled) => status("cancelled", true, None, None),
        Err(e) => status("failed", true, None, Some(e.to_string())),
    })
}

/// Sign in through Microsoft's own page in a pop-up window. The window can
/// only show Microsoft sign-in pages and has no access to the app's commands.
#[tauri::command]
async fn auth_sign_in_window(app: AppHandle, state: State<'_, AuthState>) -> Result<AuthStatus, String> {
    let Some(client_id) = client_id_from_settings(&app) else {
        return Ok(status(
            "notConfigured",
            false,
            None,
            Some("Sign-in is not set up in this build of Limited FPS.".to_string()),
        ));
    };
    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut slot = state.cancel.lock().map_err(|_| "Sign-in state is unavailable.".to_string())?;
        if slot.is_some() {
            return Err("A sign-in is already in progress.".to_string());
        }
        *slot = Some(cancel.clone());
    }
    let handle = app.clone();
    let flag = cancel.clone();
    let worker = tauri::async_runtime::spawn_blocking(move || {
        auth::sign_in_window(
            &auth::Endpoints::production(),
            &client_id,
            &auth::KeyringStore,
            &flag,
            &|url| show_login_window(&handle, url, &flag),
        )
    })
    .await;
    if let Ok(mut slot) = state.cancel.lock() {
        *slot = None;
    }
    let result = worker.map_err(|e| format!("Sign-in stopped unexpectedly: {e}"))?;
    Ok(match result {
        Ok(session) => {
            let profile = session.profile.clone();
            let note = if session.persisted {
                None
            } else {
                Some("Signed in, but the login could not be saved, so you will need to sign in again next time.".to_string())
            };
            if let Ok(mut slot) = state.session.lock() {
                *slot = Some(session);
            }
            status("signedIn", true, Some(profile), note)
        }
        Err(auth::AuthError::Cancelled) => status("cancelled", true, None, None),
        Err(e) => status("failed", true, None, Some(e.to_string())),
    })
}

/// Show `url` in a window and wait for the redirect that ends sign-in.
fn show_login_window(app: &AppHandle, url: &str, cancel: &AtomicBool) -> Result<String, auth::AuthError> {
    use std::sync::mpsc;
    let parsed: tauri::Url = url
        .parse()
        .map_err(|_| auth::AuthError::Failed("Could not build the sign-in address.".to_string()))?;
    let (tx, rx) = mpsc::channel::<Result<String, auth::AuthError>>();
    let nav_tx = tx.clone();
    let window = tauri::WebviewWindowBuilder::new(app, "ms-login", tauri::WebviewUrl::External(parsed))
        .title("Sign in with Microsoft")
        .inner_size(480.0, 680.0)
        .center()
        .on_navigation(move |next| {
            if auth::is_redirect(next.as_str()) {
                let _ = nav_tx.send(Ok(next.to_string()));
                false
            } else {
                auth::is_login_page(next)
            }
        })
        .build()
        .map_err(|e| auth::AuthError::Failed(format!("Could not open the sign-in window: {e}")))?;
    let close_tx = tx;
    window.on_window_event(move |event| {
        if matches!(event, tauri::WindowEvent::Destroyed) {
            let _ = close_tx.send(Err(auth::AuthError::Cancelled));
        }
    });
    let outcome = loop {
        if cancel.load(Ordering::SeqCst) {
            break Err(auth::AuthError::Cancelled);
        }
        match rx.recv_timeout(std::time::Duration::from_millis(200)) {
            Ok(result) => break result,
            Err(mpsc::RecvTimeoutError::Timeout) => continue,
            Err(mpsc::RecvTimeoutError::Disconnected) => break Err(auth::AuthError::Cancelled),
        }
    };
    let _ = window.close();
    outcome
}

#[tauri::command]
fn auth_cancel(state: State<'_, AuthState>) -> bool {
    match state.cancel.lock() {
        Ok(slot) => match slot.as_ref() {
            Some(flag) => {
                flag.store(true, Ordering::SeqCst);
                true
            }
            None => false,
        },
        Err(_) => false,
    }
}

#[tauri::command]
fn auth_sign_out(app: AppHandle, state: State<'_, AuthState>) -> AuthStatus {
    if let Ok(mut slot) = state.session.lock() {
        *slot = None;
    }
    let configured = client_id_from_settings(&app).is_some();
    match auth::sign_out(&auth::KeyringStore) {
        Ok(()) => status(if configured { "signedOut" } else { "notConfigured" }, configured, None, None),
        Err(e) => status("failed", configured, None, Some(e)),
    }
}

/// Open the Microsoft sign-in page in the default browser. Only Microsoft
/// pages are accepted, and no shell is involved.
#[tauri::command]
fn open_microsoft_link(url: String) -> Result<(), String> {
    if !auth::is_allowed_link(&url) {
        return Err("Only Microsoft sign-in pages can be opened from here.".to_string());
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", &url])
            .creation_flags(0x0800_0000)
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Could not open the browser: {e}"))
    }
    #[cfg(not(windows))]
    {
        Err("Opening the browser is only supported on Windows.".to_string())
    }
}

#[tauri::command]
async fn load_settings(app: AppHandle) -> Result<SettingsState, String> {
    let total = system::total_ram_mb();
    let defaults = default_settings(&app, total)?;
    let loaded = settings::load(&settings_file(&app)?, &defaults);
    build_state(&app, loaded, total)
}

#[tauri::command]
async fn save_settings(app: AppHandle, settings: Settings) -> Result<SaveOutcome, String> {
    let total = system::total_ram_mb();
    let cleaned = settings::normalize(settings);
    let errors = settings::validate(&cleaned, total);
    if !errors.is_empty() {
        return Ok(SaveOutcome {
            ok: false,
            errors,
            state: None,
        });
    }
    settings::save(&settings_file(&app)?, &cleaned)?;
    let loaded = settings::Loaded {
        settings: cleaned,
        status: LoadStatus::Loaded,
        message: None,
    };
    Ok(SaveOutcome {
        ok: true,
        errors: Vec::new(),
        state: Some(build_state(&app, loaded, total)?),
    })
}

#[tauri::command]
async fn reset_settings(app: AppHandle) -> Result<SettingsState, String> {
    let total = system::total_ram_mb();
    let defaults = default_settings(&app, total)?;
    settings::save(&settings_file(&app)?, &defaults)?;
    let loaded = settings::Loaded {
        settings: defaults,
        status: LoadStatus::Loaded,
        message: None,
    };
    build_state(&app, loaded, total)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(InstallState::default())
        .manage(AuthState::default())
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            get_system_info,
            detect_java,
            inspect_java,
            install_java,
            cancel_java_install,
            auth_status,
            auth_restore,
            auth_sign_in,
            auth_sign_in_window,
            auth_cancel,
            auth_sign_out,
            open_microsoft_link,
            load_settings,
            save_settings,
            reset_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running Limited FPS");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_info_reports_target_version() {
        assert_eq!(app_info().target_minecraft, "1.21.11");
    }

    #[test]
    fn launcher_is_not_marked_ready_yet() {
        assert!(!app_info().launcher_ready);
    }

    #[test]
    fn version_comes_from_cargo() {
        assert!(!app_info().version.is_empty());
    }
}
