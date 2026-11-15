pub mod auth;
pub mod crashlog;
pub mod discord;
pub mod game;
pub mod java;
pub mod mods;
pub mod runtime;
pub mod settings;
pub mod skins;
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

/// Progress of the Minecraft download, and the end of a game session.
pub const GAME_PROGRESS_EVENT: &str = "game-install-progress";
pub const GAME_EXITED_EVENT: &str = "game-exited";

/// Event that carries the Microsoft sign-in code to show.
pub const AUTH_CODE_EVENT: &str = "auth-device-code";

/// Signed-in session (kept in memory only) and the cancel flag of a running sign-in.
#[derive(Default)]
struct AuthState {
    session: Mutex<Option<auth::Session>>,
    cancel: Mutex<Option<Arc<AtomicBool>>>,
}

/// The Minecraft download that is running, and the game process, if any.
#[derive(Default)]
struct GameState {
    install_cancel: Mutex<Option<Arc<AtomicBool>>>,
    child: Arc<Mutex<Option<std::process::Child>>>,
    /// Set when the person pressed Stop, so that ending the game is not reported as a crash.
    stopped: Arc<AtomicBool>,
    /// The game folder of the last launch (where `crash-reports` lives).
    instance: Mutex<Option<PathBuf>>,
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
        name: "Cirrus Client",
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
            // Only Cirrus Client' own copy is written to Settings; an existing
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
            Some("Sign-in is not set up in this build of Cirrus Client.".to_string()),
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
    // A sign-in window left over from a crashed or interrupted attempt would make
    // building a new one fail with "a window with this label already exists".
    if let Some(stale) = app.get_webview_window("ms-login") {
        let _ = stale.destroy();
    }
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
/// The one non-Microsoft page the app can open: the Cirrus Client community server.
const COMMUNITY_URL: &str = "https://discord.gg/tWmvXNP7Af";

fn open_in_browser(url: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", url])
            .creation_flags(0x0800_0000)
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Could not open the browser: {e}"))
    }
    #[cfg(not(windows))]
    {
        let _ = url;
        Err("Opening the browser is only supported on Windows.".to_string())
    }
}

#[tauri::command]
fn open_microsoft_link(url: String) -> Result<(), String> {
    if !auth::is_allowed_link(&url) {
        return Err("Only Microsoft sign-in pages can be opened from here.".to_string());
    }
    open_in_browser(&url)
}

#[tauri::command]
fn open_community() -> Result<(), String> {
    open_in_browser(COMMUNITY_URL)
}

/// The project page on GitHub (the repository was renamed to Cirrus-Client; GitHub redirects the old name).
const GITHUB_URL: &str = "https://github.com/tekaitu/Cirrus-Client";

#[tauri::command]
fn open_github() -> Result<(), String> {
    open_in_browser(GITHUB_URL)
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


// ---------------------------------------------------------------- game

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GameStatus {
    installed: bool,
    minecraft: String,
    loader: Option<String>,
    game_dir: String,
    running: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GameInstallResult {
    /// "installed", "cancelled" or "failed"
    status: &'static str,
    message: Option<String>,
    loader: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LaunchResult {
    started: bool,
    message: Option<String>,
    log_path: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GameExit {
    code: Option<i32>,
    log_path: String,
    /// The person pressed Stop.
    stopped: bool,
    /// Set when the game ended unexpectedly: the end of the log, the crash report and a likely cause.
    crash: Option<crashlog::CrashInfo>,
}

fn game_root(app: &AppHandle) -> Result<(PathBuf, u32), String> {
    let total = system::total_ram_mb();
    let defaults = default_settings(app, total)?;
    let file = settings_file(app)?;
    let loaded = settings::load(&file, &defaults).settings;
    let dir = if loaded.game_dir.trim().is_empty() { defaults.game_dir } else { loaded.game_dir };
    Ok((PathBuf::from(dir), loaded.memory_mb))
}

/// "fabric" or "vanilla"; anything else is refused so a bad value never reaches a file path.
fn parse_loader(loader: &str) -> Result<bool, String> {
    match loader {
        "fabric" => Ok(true),
        "vanilla" => Ok(false),
        _ => Err("Unknown loader.".to_string()),
    }
}

fn check_version(version: &str) -> Result<(), String> {
    if game::supported_release(version) {
        Ok(())
    } else {
        Err(format!("Minecraft {version} is not supported by this launcher."))
    }
}

fn game_running(state: &GameState) -> bool {
    match state.child.lock() {
        Ok(mut slot) => match slot.as_mut() {
            Some(child) => matches!(child.try_wait(), Ok(None)),
            None => false,
        },
        Err(_) => false,
    }
}

/// Minecraft releases the launcher can set up, newest first. Falls back to the
/// built-in target when Mojang's list cannot be reached.
#[tauri::command]
async fn list_game_versions() -> Result<Vec<String>, String> {
    let fetched = tauri::async_runtime::spawn_blocking(game::list_versions).await;
    Ok(match fetched {
        Ok(Ok(list)) if !list.is_empty() => list,
        _ => vec![TARGET_MINECRAFT.to_string()],
    })
}

#[tauri::command]
fn game_status(
    app: AppHandle,
    state: State<'_, GameState>,
    version: String,
    loader: String,
) -> Result<GameStatus, String> {
    check_version(&version)?;
    let fabric = parse_loader(&loader)?;
    let (root, _) = game_root(&app)?;
    let info = game::installed(&root, &version, fabric);
    Ok(GameStatus {
        installed: info.is_some(),
        minecraft: version,
        loader: info.and_then(|i| i.loader),
        game_dir: root.display().to_string(),
        running: game_running(&state),
    })
}

#[tauri::command]
fn list_instances(app: AppHandle) -> Result<Vec<game::InstanceSummary>, String> {
    let (root, _) = game_root(&app)?;
    Ok(game::list_instances(&root))
}

#[tauri::command]
fn list_skins(app: AppHandle) -> Result<Vec<skins::SkinView>, String> {
    let (root, _) = game_root(&app)?;
    Ok(skins::list(&root))
}

#[tauri::command]
fn add_skin_file(app: AppHandle, name: String, model: String, data_base64: String) -> Result<skins::SkinView, String> {
    let (root, _) = game_root(&app)?;
    let bytes = skins::b64_decode(&data_base64).ok_or("The skin file could not be read.")?;
    skins::add(&root, &name, &model, "file", &bytes)
}

#[tauri::command]
async fn add_skin_player(app: AppHandle, player: String) -> Result<skins::SkinView, String> {
    let (root, _) = game_root(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let client = skins::http_client()?;
        let (name, png, model) = skins::fetch_player_skin(&client, &skins::Endpoints::production(), &player)?;
        skins::add(&root, &format!("{name}'s skin"), &model, &format!("player:{name}"), &png)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn add_skin_url(app: AppHandle, url: String, name: String, model: String) -> Result<skins::SkinView, String> {
    let (root, _) = game_root(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let client = skins::http_client()?;
        let png = skins::download_texture(&client, url.trim())?;
        skins::add(&root, &name, &model, "url", &png)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn set_skin_model(app: AppHandle, id: String, model: String) -> Result<skins::SkinView, String> {
    let (root, _) = game_root(&app)?;
    skins::set_model(&root, &id, &model)
}

#[tauri::command]
fn remove_skin(app: AppHandle, id: String) -> Result<(), String> {
    let (root, _) = game_root(&app)?;
    skins::remove(&root, &id)
}

/// Uploads a library skin to the signed-in Minecraft account.
#[tauri::command]
async fn apply_skin(app: AppHandle, auth: State<'_, AuthState>, id: String) -> Result<(), String> {
    let token = auth
        .session
        .lock()
        .ok()
        .and_then(|s| s.as_ref().map(|s| s.mc_token.clone()))
        .ok_or("Sign in with Microsoft first. Offline players have no account to change.")?;
    let (root, _) = game_root(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let (stored, png) = skins::get(&root, &id)?;
        let client = skins::http_client()?;
        skins::apply(&client, &skins::Endpoints::production(), &token, &stored.model, &png)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// The current skin of a player (by id or name) as a PNG data address, for avatars. `None` when unavailable.
#[tauri::command]
async fn player_skin(player: String) -> Option<String> {
    tauri::async_runtime::spawn_blocking(move || {
        let client = skins::http_client().ok()?;
        let (_, png, _) = skins::fetch_player_skin(&client, &skins::Endpoints::production(), &player).ok()?;
        Some(skins::png_data_url(&png))
    })
    .await
    .ok()
    .flatten()
}

#[tauri::command]
fn list_profiles(app: AppHandle) -> Result<Vec<game::Profile>, String> {
    let (root, _) = game_root(&app)?;
    Ok(game::list_profiles(&root))
}

#[tauri::command]
fn create_profile(app: AppHandle, name: String, version: String, loader: String) -> Result<game::Profile, String> {
    check_version(&version)?;
    let fabric = parse_loader(&loader)?;
    let (root, _) = game_root(&app)?;
    game::create_profile(&root, &name, &version, fabric)
}

#[tauri::command]
fn delete_profile(app: AppHandle, id: String) -> Result<(), String> {
    let (root, _) = game_root(&app)?;
    game::delete_profile(&root, &id)
}

#[tauri::command]
async fn install_game(
    app: AppHandle,
    state: State<'_, GameState>,
    version: String,
    loader: String,
) -> Result<GameInstallResult, String> {
    let failed = |m: String| GameInstallResult { status: "failed", message: Some(m), loader: None };
    check_version(&version)?;
    let fabric = parse_loader(&loader)?;
    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut slot = state.install_cancel.lock().map_err(|_| "Installer state is unavailable.".to_string())?;
        if slot.is_some() {
            return Err("The game files are already being downloaded.".to_string());
        }
        *slot = Some(cancel.clone());
    }
    let (root, _) = match game_root(&app) {
        Ok(v) => v,
        Err(e) => {
            if let Ok(mut slot) = state.install_cancel.lock() {
                *slot = None;
            }
            return Ok(failed(e));
        }
    };

    let emitter = app.clone();
    let flag = cancel.clone();
    let worker = tauri::async_runtime::spawn_blocking(move || {
        game::install(&root, &version, fabric, &flag, &move |p| {
            let _ = emitter.emit(GAME_PROGRESS_EVENT, p);
        })
    })
    .await;

    if let Ok(mut slot) = state.install_cancel.lock() {
        *slot = None;
    }
    Ok(match worker {
        Err(e) => failed(format!("The download stopped unexpectedly: {e}")),
        Ok(Err(game::GameError::Cancelled)) => GameInstallResult { status: "cancelled", message: None, loader: None },
        Ok(Err(game::GameError::Failed(m))) => failed(m),
        Ok(Ok(info)) => GameInstallResult { status: "installed", message: None, loader: info.loader },
    })
}

#[tauri::command]
fn cancel_game_install(state: State<'_, GameState>) -> bool {
    match state.install_cancel.lock() {
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

/// Start Minecraft. `mode` is "offline" (needs `username`) or "microsoft"
/// (uses the account that is signed in right now). Offline play needs no
/// sign-in; it relies on the player owning the game (see the license).
#[tauri::command]
async fn launch_game(
    app: AppHandle,
    state: State<'_, GameState>,
    auth: State<'_, AuthState>,
    java_path: String,
    mode: String,
    username: Option<String>,
    version: String,
    loader: String,
    profile: Option<String>,
) -> Result<LaunchResult, String> {
    let refuse = |m: &str| Ok(LaunchResult { started: false, message: Some(m.to_string()), log_path: None });
    check_version(&version)?;
    let fabric = parse_loader(&loader)?;
    if game_running(&state) {
        return refuse("Minecraft is already running.");
    }
    let session = auth.session.lock().ok().and_then(|s| s.clone());
    let player = match mode.as_str() {
        "offline" => match game::Player::offline(username.as_deref().unwrap_or("").trim()) {
            Ok(p) => p,
            Err(m) => return refuse(&m),
        },
        "microsoft" => match session {
            Some(s) => game::Player {
                name: s.profile.name.clone(),
                uuid: s.profile.id.clone(),
                access_token: s.mc_token.clone(),
                user_type: "msa",
            },
            None => return refuse("Sign in with Microsoft first, or play offline."),
        },
        _ => return refuse("Unknown play mode."),
    };

    let java = PathBuf::from(java_path.trim());
    if !java.is_file() {
        return refuse("Java was not found at the saved location. Re-scan Java and try again.");
    }
    let (root, memory) = game_root(&app)?;
    let Some(info) = game::installed(&root, &version, fabric) else {
        return refuse("The game files are not installed yet.");
    };

    let instance_id = match profile.as_deref() {
        Some(id) => match game::list_profiles(&root).into_iter().find(|p| p.id == id) {
            Some(p) if p.minecraft == version && p.fabric == fabric => Some(p.id),
            _ => return refuse("That profile no longer matches the selected game. Pick it again in the Library."),
        },
        None => None,
    };
    let spec = match game::build_launch(
        &root,
        &info,
        &java,
        memory,
        &player,
        env!("CARGO_PKG_VERSION"),
        instance_id.as_deref(),
    ) {
        Ok(s) => s,
        Err(m) => return refuse(&m),
    };

    let log_dir = root.join("logs");
    let _ = std::fs::create_dir_all(&log_dir);
    let log_path = log_dir.join(crashlog::LAUNCH_LOG);
    let (out, err) = match std::fs::File::create(&log_path).and_then(|f| f.try_clone().map(|g| (f, g))) {
        Ok(pair) => pair,
        Err(e) => return refuse(&format!("Could not create the log file: {e}")),
    };
    {
        // The first lines say what is being started. The access token is never written here.
        use std::io::Write;
        let mut head = &out;
        let _ = writeln!(
            head,
            "[Cirrus Client {}] Starting Minecraft {} ({})",
            env!("CARGO_PKG_VERSION"),
            version,
            if fabric { "Fabric" } else { "Vanilla" }
        );
        let _ = writeln!(head, "[Cirrus Client] Java: {}", java.display());
        let _ = writeln!(head, "[Cirrus Client] Memory: {memory} MB");
        let _ = writeln!(head, "[Cirrus Client] Player: {} ({})", player.name, mode);
        let _ = writeln!(head, "[Cirrus Client] Game folder: {}", spec.cwd.display());
        let _ = writeln!(head, "----------------------------------------");
    }
    let started_at = std::time::SystemTime::now();
    let token = player.access_token.clone();
    let instance_dir = spec.cwd.clone();
    state.stopped.store(false, Ordering::SeqCst);
    if let Ok(mut slot) = state.instance.lock() {
        *slot = Some(instance_dir.clone());
    }

    let mut command = std::process::Command::new(&spec.program);
    command
        .args(&spec.args)
        .current_dir(&spec.cwd)
        .stdin(std::process::Stdio::null())
        .stdout(out)
        .stderr(err);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000); // no console window
    }
    let child = match command.spawn() {
        Ok(c) => c,
        Err(e) => return refuse(&format!("Minecraft could not be started: {e}")),
    };
    if let Ok(mut slot) = state.child.lock() {
        *slot = Some(child);
    }

    // Report when the game closes.
    let handle = app.clone();
    let slot = state.child.clone();
    let stopped = state.stopped.clone();
    let log_text = log_path.display().to_string();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_millis(700));
        let finished = match slot.lock() {
            Ok(mut guard) => match guard.as_mut() {
                Some(child) => match child.try_wait() {
                    Ok(Some(status)) => Some(status.code()),
                    Ok(None) => None,
                    Err(_) => Some(None),
                },
                None => Some(None), // stopped from the app
            },
            Err(_) => Some(None),
        };
        if let Some(code) = finished {
            if let Ok(mut guard) = slot.lock() {
                *guard = None;
            }
            let was_stopped = stopped.load(Ordering::SeqCst);
            let crash = (!was_stopped && code != Some(0)).then(|| {
                crashlog::collect(&instance_dir, std::path::Path::new(&log_text), started_at, &[token.as_str()])
            });
            let _ = handle.emit(
                GAME_EXITED_EVENT,
                GameExit { code, log_path: log_text, stopped: was_stopped, crash },
            );
            return;
        }
    });

    Ok(LaunchResult { started: true, message: None, log_path: Some(log_path.display().to_string()) })
}

#[tauri::command]
fn stop_game(state: State<'_, GameState>) -> bool {
    state.stopped.store(true, Ordering::SeqCst);
    match state.child.lock() {
        Ok(mut slot) => match slot.as_mut() {
            Some(child) => child.kill().is_ok(),
            None => false,
        },
        Err(_) => false,
    }
}

/// New text of the game's launch log, from `offset` on (0 at the start). Access tokens are hidden.
#[tauri::command]
fn read_game_log(app: AppHandle, auth: State<'_, AuthState>, offset: u64) -> Result<crashlog::LogChunk, String> {
    let (root, _) = game_root(&app)?;
    let token = auth.session.lock().ok().and_then(|s| s.as_ref().map(|x| x.mc_token.clone()));
    let secrets: Vec<&str> = token.iter().map(String::as_str).collect();
    Ok(crashlog::read_chunk(&root.join("logs").join(crashlog::LAUNCH_LOG), offset, &secrets))
}

/// Opens one of the game's folders in the file explorer: "logs", "crash-reports" or "game".
#[tauri::command]
fn open_game_folder(app: AppHandle, state: State<'_, GameState>, kind: String) -> Result<(), String> {
    let (root, _) = game_root(&app)?;
    let instance = state.instance.lock().ok().and_then(|g| g.clone());
    let path = match kind.as_str() {
        "logs" => root.join("logs"),
        "crash-reports" => instance.unwrap_or_else(|| root.clone()).join("crash-reports"),
        "game" => instance.unwrap_or(root),
        _ => return Err("Unknown folder.".to_string()),
    };
    std::fs::create_dir_all(&path).map_err(|e| format!("Could not create the folder: {e}"))?;
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("explorer.exe")
            .arg(&path)
            .creation_flags(0x0800_0000)
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("Could not open the folder: {e}"))
    }
    #[cfg(not(windows))]
    {
        Err(format!("Opening folders is only supported on Windows ({}).", path.display()))
    }
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

// ---------------------------------------------------------------- mods

/// CurseForge's API needs a key; it is supplied when the launcher is built.
fn curseforge_key() -> Option<&'static str> {
    option_env!("LIMITEDFPS_CF_API_KEY").filter(|k| !k.trim().is_empty())
}

#[tauri::command]
fn curseforge_available() -> bool {
    curseforge_key().is_some()
}

/// The mods folder of the Fabric profile for `version`. Mods only apply to
/// Fabric, so the game has to be installed with Fabric first.
fn mods_folder(app: &AppHandle, version: &str, profile: Option<&str>) -> Result<PathBuf, String> {
    check_version(version)?;
    let (root, _) = game_root(app)?;
    let info = game::installed(&root, version, true)
        .ok_or_else(|| format!("Install Minecraft {version} with Fabric first (use Play on the Home page)."))?;
    let instance = match profile {
        Some(id) => game::list_profiles(&root)
            .into_iter()
            .find(|p| p.id == id && p.minecraft == version && p.fabric)
            .map(|p| p.id)
            .ok_or("That profile does not use Fabric for this version.")?,
        None => info.profile_id,
    };
    let dir = game::instance_dir(&root, &instance).join("mods");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create the mods folder: {e}"))?;
    Ok(dir)
}

#[tauri::command]
async fn search_mods(
    provider: String,
    query: String,
    version: String,
    offset: u32,
    category: Option<String>,
) -> Result<mods::SearchResult, String> {
    check_version(&version)?;
    let provider = mods::Provider::parse(&provider).ok_or("Unknown mod site.")?;
    tauri::async_runtime::spawn_blocking(move || {
        mods::search(provider, &query, &version, offset, category.as_deref(), curseforge_key())
    })
        .await
        .map_err(|e| format!("The search stopped unexpectedly: {e}"))?
}

#[tauri::command]
async fn install_mod(
    app: AppHandle,
    provider: String,
    id: String,
    version: String,
    profile: Option<String>,
) -> Result<mods::InstallReport, String> {
    let provider = mods::Provider::parse(&provider).ok_or("Unknown mod site.")?;
    let dir = mods_folder(&app, &version, profile.as_deref())?;
    tauri::async_runtime::spawn_blocking(move || mods::install(provider, &id, &version, &dir, curseforge_key()))
        .await
        .map_err(|e| format!("The install stopped unexpectedly: {e}"))?
}

#[tauri::command]
fn list_mods(app: AppHandle, version: String, profile: Option<String>) -> Result<Vec<mods::InstalledMod>, String> {
    let dir = mods_folder(&app, &version, profile.as_deref())?;
    Ok(mods::list_installed(&dir))
}

#[tauri::command]
fn set_mod_enabled(
    app: AppHandle,
    version: String,
    file_name: String,
    enabled: bool,
    profile: Option<String>,
) -> Result<String, String> {
    let dir = mods_folder(&app, &version, profile.as_deref())?;
    mods::set_enabled(&dir, &file_name, enabled)
}

#[tauri::command]
fn remove_mod(app: AppHandle, version: String, file_name: String, profile: Option<String>) -> Result<(), String> {
    let dir = mods_folder(&app, &version, profile.as_deref())?;
    mods::remove(&dir, &file_name)
}

/// Show (or update) the Discord status. Returns "shown", "notConfigured" (this
/// build has no Discord application ID) or "discordClosed" (Discord is not running).
#[tauri::command]
async fn discord_set_presence(
    state: State<'_, discord::DiscordState>,
    presence: discord::Presence,
) -> Result<String, String> {
    let Some(app_id) = discord::builtin_app_id() else {
        return Ok("notConfigured".to_string());
    };
    let shown = state.set(app_id, &presence)?;
    Ok(if shown { "shown".to_string() } else { "discordClosed".to_string() })
}

/// Remove the Discord status (the person switched it off).
#[tauri::command]
fn discord_clear_presence(state: State<'_, discord::DiscordState>) {
    state.clear();
}

/// True when this build has a Discord application ID, i.e. the status can work.
#[tauri::command]
fn discord_available() -> bool {
    discord::builtin_app_id().is_some()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(InstallState::default())
        .manage(AuthState::default())
        .manage(GameState::default())
        .manage(discord::DiscordState::default())
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
            discord_set_presence,
            discord_clear_presence,
            discord_available,
            open_microsoft_link,
            load_settings,
            save_settings,
            reset_settings,
            game_status,
            list_instances,
            list_profiles,
            create_profile,
            delete_profile,
            open_community,
            open_github,
            install_game,
            cancel_game_install,
            launch_game,
            read_game_log,
            open_game_folder,
            stop_game,
            quit_app,
            list_game_versions,
            curseforge_available,
            search_mods,
            install_mod,
            list_mods,
            list_skins,
            add_skin_file,
            add_skin_player,
            add_skin_url,
            set_skin_model,
            remove_skin,
            apply_skin,
            player_skin,
            set_mod_enabled,
            remove_mod
        ])
        .run(tauri::generate_context!())
        .expect("error while running Cirrus Client");
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
