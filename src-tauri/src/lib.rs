pub mod accounts;
pub mod base64;
pub mod auth;
pub mod crashfix;
pub mod crashlog;
pub mod discord;
pub mod game;
pub mod instance;
pub mod java;
pub mod mod_upload;
pub mod mods;
pub mod packs;
pub mod runtime;
pub mod settings;
pub mod skins;
pub mod system;
pub mod updater;

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
async fn install_java(
    app: AppHandle,
    state: State<'_, InstallState>,
    major: Option<u32>,
) -> Result<InstallResult, String> {
    let major = major.unwrap_or(runtime::REQUIRED_MAJOR);
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
        Ok::<_, String>(runtime::install_java_major(
            &dir,
            configured.as_deref(),
            major,
            &flag,
            &move |p| {
                let _ = emitter.emit(INSTALL_PROGRESS_EVENT, p);
            },
        ))
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
            // system Java is left alone and reported. A Java older than 21 is
            // installed for an older instance and never becomes the launcher-wide
            // choice, because 1.20.5+ cannot run on it.
            let (configured, settings_state, note) = if done.managed && major >= runtime::REQUIRED_MAJOR {
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
    /// True when this build has a usable Microsoft application ID.
    configured: bool,
    /// True when at least one login is saved in Windows Credential Manager.
    saved_login: bool,
    /// The account whose session is live right now. The interface shows this
    /// name and skin, never the profile id.
    profile: Option<auth::Profile>,
    message: Option<String>,
    /// Every account signed in on this PC, newest first.
    accounts: Vec<accounts::Account>,
    /// Which of them the session belongs to.
    active_id: Option<String>,
}

/// `accounts.json` sits next to settings.json in the app config folder.
fn accounts_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| accounts::accounts_file(&dir))
        .map_err(|e| format!("Could not find the account folder: {e}"))
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
    app: &AppHandle,
    state: &'static str,
    configured: bool,
    profile: Option<auth::Profile>,
    message: Option<String>,
) -> AuthStatus {
    let known = accounts_path(app).map(|path| accounts::load(&path)).unwrap_or_default();
    AuthStatus {
        state,
        configured,
        saved_login: !known.accounts.is_empty() || auth::KeyringStore::default().legacy_saved(),
        profile,
        message,
        accounts: known.accounts,
        active_id: known.active,
    }
}

/// Current state without any network traffic.
#[tauri::command]
fn auth_status(app: AppHandle, state: State<'_, AuthState>) -> AuthStatus {
    let configured = client_id_from_settings(&app).is_some();
    let session = state.session.lock().ok().and_then(|s| s.as_ref().map(|s| s.profile.clone()));
    match session {
        Some(profile) => status(&app, "signedIn", configured, Some(profile), None),
        None if configured => status(&app, "signedOut", true, None, None),
        None => status(&app, "notConfigured", false, None, None),
    }
}

/// Silent sign-in from the saved login (needs the network).
#[tauri::command]
async fn auth_restore(app: AppHandle, state: State<'_, AuthState>) -> Result<AuthStatus, String> {
    let Some(client_id) = client_id_from_settings(&app) else {
        return Ok(status(&app, "notConfigured", false, None, None));
    };
    let path = accounts_path(&app)?;
    let known = accounts::load(&path);
    let target = known.active.clone().or_else(|| known.accounts.first().map(|a| a.id.clone()));
    // A known account restores from its own Credential Manager entry. With no
    // list yet, the single entry written by an older version is used once and
    // then copied to the account it belongs to.
    let legacy = target.is_none();
    let store = match &target {
        Some(id) => auth::KeyringStore::for_account(id),
        None => auth::KeyringStore::default(),
    };
    let result = tauri::async_runtime::spawn_blocking(move || {
        auth::restore(&auth::Endpoints::production(), &client_id, &store)
    })
    .await
    .map_err(|e| format!("Sign-in check stopped unexpectedly: {e}"))?;
    Ok(match result {
        Ok(Some(session)) => adopt_session(&app, &state, &path, session, legacy)?,
        Ok(None) if legacy => status(&app, "signedOut", true, None, None),
        Ok(None) => status(
            &app,
            "signedOut",
            true,
            None,
            Some("This account's saved sign-in is missing. Sign in again to keep using it.".to_string()),
        ),
        Err(e) => {
            // A revoked or expired login is deleted so it cannot fail again on every
            // start; a network problem leaves it in place for the next attempt.
            if matches!(e, auth::AuthError::Rejected(_)) {
                match target.as_deref() {
                    Some(id) => {
                        let _ = auth::KeyringStore::for_account(id).clear();
                    }
                    None => {
                        let _ = auth::KeyringStore::default().clear();
                    }
                }
            }
            status(&app, "signedOut", true, None, Some(e.to_string()))
        }
    })
}

/// Keeps a successful session: the token under this account's own entry, the
/// name in accounts.json, and the live session in memory. The interface never
/// receives the token, only the profile.
fn adopt_session(
    app: &AppHandle,
    state: &State<'_, AuthState>,
    path: &std::path::Path,
    session: auth::Session,
    clear_legacy: bool,
) -> Result<AuthStatus, String> {
    let id = session.profile.id.clone();
    let name = session.profile.name.clone();
    let saved = match session.refresh_token.as_deref() {
        Some(token) => auth::KeyringStore::for_account(&id).save(token).is_ok(),
        None => false,
    };
    if clear_legacy {
        let _ = auth::KeyringStore::default().clear();
    }
    accounts::upsert(path, &id, &name)?;
    let profile = session.profile.clone();
    if let Ok(mut slot) = state.session.lock() {
        *slot = Some(session);
    }
    let note = if saved {
        None
    } else {
        Some("Signed in, but the login could not be saved. You will need to sign in again next time.".to_string())
    };
    Ok(status(app, "signedIn", true, Some(profile), note))
}

/// Interactive device-code sign-in. Emits `auth-device-code` with the code to show,
/// then returns when the person finishes, cancels, or it fails.
#[tauri::command]
async fn auth_sign_in(app: AppHandle, state: State<'_, AuthState>) -> Result<AuthStatus, String> {
    let Some(client_id) = client_id_from_settings(&app) else {
        return Ok(status(
            &app,
            "notConfigured",
            false,
            None,
            Some("Sign-in is not available in this build of Cirrus Client.".to_string()),
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
        // The Minecraft profile (and so the account id) is only known once the
        // exchange finishes, so this first save goes to the unscoped entry old
        // versions used. `adopt_session` immediately copies it to the account's
        // own entry and clears the unscoped one.
        let store = auth::KeyringStore::default();
        auth::sign_in(&auth::Endpoints::production(), &client_id, &store, &flag, &move |info| {
            let _ = emitter.emit(AUTH_CODE_EVENT, info.clone());
        })
    })
    .await;
    if let Ok(mut slot) = state.cancel.lock() {
        *slot = None;
    }
    let result = worker.map_err(|e| format!("Sign-in stopped unexpectedly: {e}"))?;
    let path = accounts_path(&app)?;
    Ok(match result {
        Ok(session) => adopt_session(&app, &state, &path, session, true)?,
        Err(auth::AuthError::Cancelled) => status(&app, "cancelled", true, None, None),
        Err(e) => status(&app, "failed", true, None, Some(e.to_string())),
    })
}

/// Sign in through Microsoft's own page in a pop-up window. The window can
/// only show Microsoft sign-in pages and has no access to the app's commands.
#[tauri::command]
async fn auth_sign_in_window(app: AppHandle, state: State<'_, AuthState>) -> Result<AuthStatus, String> {
    let Some(client_id) = client_id_from_settings(&app) else {
        return Ok(status(
            &app,
            "notConfigured",
            false,
            None,
            Some("Sign-in is not available in this build of Cirrus Client.".to_string()),
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
        // As in `auth_sign_in`: no profile id exists yet, so the token is first
        // written to the unscoped entry and then moved to the account entry by
        // `adopt_session`.
        let store = auth::KeyringStore::default();
        auth::sign_in_window(
            &auth::Endpoints::production(),
            &client_id,
            &store,
            &flag,
            &|url| show_login_window(&handle, url, &flag),
        )
    })
    .await;
    if let Ok(mut slot) = state.cancel.lock() {
        *slot = None;
    }
    let result = worker.map_err(|e| format!("Sign-in stopped unexpectedly: {e}"))?;
    let path = accounts_path(&app)?;
    Ok(match result {
        Ok(session) => adopt_session(&app, &state, &path, session, true)?,
        Err(auth::AuthError::Cancelled) => status(&app, "cancelled", true, None, None),
        Err(e) => status(&app, "failed", true, None, Some(e.to_string())),
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

/// Switches to another saved account. The session is renewed from that
/// account's own token before it becomes active, so the name in the header and
/// the account the game launches with can never disagree.
#[tauri::command]
async fn auth_switch(app: AppHandle, state: State<'_, AuthState>, id: String) -> Result<AuthStatus, String> {
    let Some(client_id) = client_id_from_settings(&app) else {
        return Ok(status(&app, "notConfigured", false, None, None));
    };
    let path = accounts_path(&app)?;
    let known = accounts::load(&path);
    if !known.accounts.iter().any(|a| a.id == id) {
        return Err("That account is not signed in on this PC.".to_string());
    }
    accounts::set_active(&path, &id)?;
    let store = auth::KeyringStore::for_account(&id);
    let result = tauri::async_runtime::spawn_blocking(move || {
        auth::restore(&auth::Endpoints::production(), &client_id, &store)
    })
    .await
    .map_err(|e| format!("Switching accounts stopped unexpectedly: {e}"))?;
    Ok(match result {
        Ok(Some(session)) => adopt_session(&app, &state, &path, session, false)?,
        Ok(None) => status(
            &app,
            "signedOut",
            true,
            None,
            Some("That account has no saved sign-in left. Sign in again to use it.".to_string()),
        ),
        Err(e) => status(&app, "signedOut", true, None, Some(e.to_string())),
    })
}

/// Signs out one account (`id`), or the active account when no id is given.
/// Only that account's token and list entry are removed; other accounts stay.
#[tauri::command]
fn auth_sign_out(app: AppHandle, state: State<'_, AuthState>, id: Option<String>) -> AuthStatus {
    let configured = client_id_from_settings(&app).is_some();
    let path = accounts_path(&app).ok();
    let known = path.as_ref().map(|p| accounts::load(p)).unwrap_or_default();
    let target = id.or_else(|| known.active.clone());
    let session_id = state.session.lock().ok().and_then(|s| s.as_ref().map(|s| s.profile.id.clone()));
    if let Some(target) = target.as_deref() {
        let _ = auth::KeyringStore::for_account(target).clear();
        if let Some(path) = &path {
            let _ = accounts::remove(path, target);
        }
    } else {
        let _ = auth::KeyringStore::default().clear();
    }
    // Signing out the account that is actually in use (or the only one left)
    // ends the live session; removing another account must not.
    let ends_session = match (&target, &session_id) {
        (Some(target), Some(session)) => target == session,
        (_, None) => false,
        (None, _) => true,
    };
    if ends_session {
        if let Ok(mut slot) = state.session.lock() {
            *slot = None;
        }
    }
    status(&app, if configured { "signedOut" } else { "notConfigured" }, configured, None, None)
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

/// The newest official Cirrus Client release, compared with this build.
#[tauri::command]
async fn check_for_updates() -> Result<updater::UpdateCheck, String> {
    let fetched = tauri::async_runtime::spawn_blocking(|| updater::check(env!("CARGO_PKG_VERSION"))).await;
    match fetched {
        Ok(result) => result,
        Err(e) => Err(format!("The update check stopped unexpectedly: {e}")),
    }
}

/// Open a release page, but only the project's own pages.
#[tauri::command]
fn open_update_page(url: String) -> Result<(), String> {
    if !updater::allowed_page(&url) {
        return Err("Only official Cirrus Client release pages can be opened.".to_string());
    }
    open_in_browser(&url)
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

/// Mojang's whole version list, with snapshots and older releases marked as not
/// installable. Falls back to the built-in target when Mojang cannot be reached.
#[tauri::command]
async fn list_game_version_catalog() -> Result<Vec<game::VersionEntry>, String> {
    let fetched = tauri::async_runtime::spawn_blocking(game::list_catalog).await;
    Ok(match fetched {
        Ok(Ok(list)) if !list.is_empty() => list,
        _ => vec![game::VersionEntry {
            id: TARGET_MINECRAFT.to_string(),
            kind: "release".to_string(),
            released: None,
            supported: true,
            java_major: None,
        }],
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
fn list_instance_views(app: AppHandle) -> Result<Vec<instance::InstanceView>, String> {
    let (root, _) = game_root(&app)?;
    Ok(instance::list(&root))
}

#[tauri::command]
fn instance_contents(app: AppHandle, id: String) -> Result<instance::InstanceContents, String> {
    let (root, _) = game_root(&app)?;
    let cfg = instance::find(&root, &id).ok_or_else(|| "That instance no longer exists.".to_string())?;
    Ok(instance::contents(&instance::game_dir(&root, &cfg)))
}

/// Save the instance's own settings. The previous file is kept next to the store
/// so a change made by a suggested fix can be undone by hand.
#[tauri::command]
fn save_instance(app: AppHandle, config: instance::InstanceConfig) -> Result<instance::InstanceView, String> {
    let (root, _) = game_root(&app)?;
    let existing = instance::find(&root, &config.id);
    if let Some(previous) = &existing {
        let backup = root.join("unlimited-instances.backup.json");
        if let Ok(text) = serde_json::to_string_pretty(previous) {
            let _ = std::fs::write(backup, text);
        }
    }
    let saved = instance::upsert(&root, config)?;
    let info = game::installed_infos(&root).into_iter().find(|i| i.profile_id == saved.id);
    Ok(instance::view(&root, &saved, info.as_ref()))
}

#[tauri::command]
fn clone_instance(app: AppHandle, id: String, name: String, copy_data: bool) -> Result<instance::InstanceView, String> {
    let (root, _) = game_root(&app)?;
    let cloned = instance::clone_instance(&root, &id, &name, copy_data)?;
    let info = game::installed_infos(&root).into_iter().find(|i| i.profile_id == cloned.id);
    Ok(instance::view(&root, &cloned, info.as_ref()))
}

#[tauri::command]
fn delete_instance(app: AppHandle, id: String, delete_files: bool) -> Result<(), String> {
    let (root, _) = game_root(&app)?;
    instance::delete_instance(&root, &id, delete_files)
}

/// Fabric Loader versions Fabric lists for a Minecraft version, newest first.
#[tauri::command]
async fn fabric_loader_versions(version: String) -> Result<Vec<game::FabricLoader>, String> {
    check_version(&version)?;
    let fetched = tauri::async_runtime::spawn_blocking(move || game::fabric_loaders(&version)).await;
    match fetched {
        Ok(Ok(list)) => Ok(list),
        Ok(Err(game::GameError::Failed(m))) => Err(m),
        Ok(Err(game::GameError::Cancelled)) => Err("The request was cancelled.".to_string()),
        Err(e) => Err(format!("Could not reach Fabric: {e}")),
    }
}

/// Work out why the game stopped, with the evidence it is based on.
#[tauri::command]
fn diagnose_crash(
    app: AppHandle,
    log_tail: String,
    report: Option<String>,
    version: String,
    loader: String,
    java_major: Option<u32>,
    instance_id: Option<String>,
) -> Result<crashfix::Diagnosis, String> {
    let (root, memory) = game_root(&app)?;
    let cfg = instance_id.as_deref().and_then(|id| instance::find(&root, id));
    let required = game::installed(&root, &version, loader == "fabric").and_then(|i| i.java_major);
    let context = crashfix::Context {
        minecraft: version,
        required_java: required,
        java_major,
        memory_mb: cfg.as_ref().and_then(|c| c.memory_mb).or(Some(memory)),
        total_ram_mb: Some(system::total_ram_mb()),
        fabric: loader == "fabric",
        loader_version: cfg.as_ref().and_then(|c| c.loader_version.clone()),
    };
    Ok(crashfix::diagnose(report.as_deref(), &log_tail, &context))
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

/// Remembered appearances, so opening the account menu, the Accounts page and
/// the Skins page does not re-download the same skin three times. Bounded and
/// short-lived: a skin change shows up within five minutes.
const APPEARANCE_TTL: std::time::Duration = std::time::Duration::from_secs(300);

#[derive(Default)]
struct AppearanceCache(Mutex<std::collections::HashMap<String, (std::time::Instant, skins::Appearance)>>);

async fn appearance_for(cache: &AppearanceCache, player: String, force: bool) -> Result<skins::Appearance, String> {
    let key = player.trim().to_ascii_lowercase();
    if key.is_empty() {
        return Err("No player was given.".to_string());
    }
    if !force {
        if let Ok(map) = cache.0.lock() {
            if let Some((at, appearance)) = map.get(&key) {
                if at.elapsed() < APPEARANCE_TTL {
                    return Ok(appearance.clone());
                }
            }
        }
    }
    let lookup = player.clone();
    // Keep Mojang's reason (rate limit, rejected texture host, timeout) instead
    // of turning every failure into "could not be loaded".
    let appearance = tauri::async_runtime::spawn_blocking(move || {
        let client = skins::http_client()?;
        skins::fetch_appearance(&client, &skins::Endpoints::production(), &lookup)
    })
    .await
    .map_err(|e| e.to_string())??;
    if let Ok(mut map) = cache.0.lock() {
        if map.len() >= 32 {
            map.clear();
        }
        map.insert(key, (std::time::Instant::now(), appearance.clone()));
    }
    Ok(appearance)
}

/// A player's skin, arm model and own cape, ready to draw. The window never
/// talks to Mojang's image host: the PNGs arrive as data addresses.
#[tauri::command]
async fn player_appearance(
    state: State<'_, AppearanceCache>,
    player: String,
    force: Option<bool>,
) -> Result<skins::Appearance, String> {
    appearance_for(&state, player, force.unwrap_or(false)).await
}

/// The current skin of a player (by id or name) as a PNG data address, for
/// avatars. A missing skin is an error rather than an empty success, so the
/// avatar falls back to the player's initial instead of an unusable address.
#[tauri::command]
async fn player_skin(state: State<'_, AppearanceCache>, player: String) -> Result<Option<String>, String> {
    let appearance = appearance_for(&state, player, false).await?;
    if appearance.skin.is_empty() {
        return Err("That player has no skin to show.".to_string());
    }
    Ok(Some(appearance.skin))
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

/// Shared by a first install, a repair and a loader change: one download at a
/// time, real progress events, and a cancel flag the interface can set.
async fn start_install(
    app: AppHandle,
    state: &GameState,
    version: String,
    loader: String,
    loader_version: Option<String>,
) -> Result<GameInstallResult, String> {
    let failed = |m: String| GameInstallResult { status: "failed", message: Some(m), loader: None };
    check_version(&version)?;
    let fabric = parse_loader(&loader)?;
    let loader_version = loader_version.filter(|v| !v.trim().is_empty());
    if let Some(v) = &loader_version {
        if !v.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '+') {
            return Err("That Fabric Loader version does not look right.".to_string());
        }
    }
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
        game::install(&root, &version, fabric, loader_version.as_deref(), &flag, &move |p| {
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
async fn install_game(
    app: AppHandle,
    state: State<'_, GameState>,
    version: String,
    loader: String,
    loader_version: Option<String>,
) -> Result<GameInstallResult, String> {
    start_install(app, &state, version, loader, loader_version).await
}

/// Download anything missing or damaged again, keeping worlds, mods and settings.
#[tauri::command]
async fn repair_instance(
    app: AppHandle,
    state: State<'_, GameState>,
    id: String,
) -> Result<GameInstallResult, String> {
    let (root, _) = game_root(&app)?;
    let cfg = instance::find(&root, &id).ok_or_else(|| "That instance no longer exists.".to_string())?;
    start_install(app, &state, cfg.minecraft, cfg.loader, cfg.loader_version).await
}

/// Change the Fabric Loader of an instance without losing its worlds or mods.
#[tauri::command]
async fn switch_fabric_loader(
    app: AppHandle,
    state: State<'_, GameState>,
    id: String,
    loader_version: String,
) -> Result<GameInstallResult, String> {
    let (root, _) = game_root(&app)?;
    let cfg = instance::find(&root, &id).ok_or_else(|| "That instance no longer exists.".to_string())?;
    if cfg.loader != "fabric" {
        return Err("Only Fabric instances have a loader version.".to_string());
    }
    let old_dir = instance::game_dir(&root, &cfg);
    let result = start_install(
        app,
        &state,
        cfg.minecraft.clone(),
        "fabric".to_string(),
        Some(loader_version),
    )
    .await?;
    if result.status != "installed" {
        return Ok(result);
    }
    let Some(info) = game::installed(&root, &cfg.minecraft, true) else {
        return Ok(result);
    };
    let mut updated = cfg.clone();
    let new_dir = game::instance_dir(&root, &info.profile_id);
    if cfg.game_dir.is_none() && old_dir.is_dir() && old_dir != new_dir {
        // The game folder follows the loader profile so worlds and mods stay with it.
        if !new_dir.exists() {
            if std::fs::rename(&old_dir, &new_dir).is_err() {
                // A locked file (antivirus, a running game) keeps the old folder in use.
                updated.game_dir = Some(old_dir.display().to_string());
            }
        } else {
            updated.game_dir = Some(old_dir.display().to_string());
        }
    }
    updated.id = info.profile_id.clone();
    updated.loader_version = info.loader.clone();
    let _ = instance::remove(&root, &cfg.id);
    instance::upsert(&root, updated)?;
    Ok(result)
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
    instance_id: Option<String>,
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

    let mut java = PathBuf::from(java_path.trim());
    if !java.is_file() {
        return refuse("Java was not found at the saved location. Re-scan Java and try again.");
    }
    let (root, memory) = game_root(&app)?;
    // Per-instance choices win over the launcher-wide settings, and only when they
    // still match the install they belong to.
    let instance_cfg = match instance_id.as_deref().filter(|id| !id.is_empty()) {
        Some(id) => match instance::find(&root, id) {
            Some(cfg) if cfg.minecraft == version && cfg.loader == loader => Some(cfg),
            _ => return refuse("That instance no longer matches the selected game. Pick it again in the Library."),
        },
        None => None,
    };
    let mut memory = memory;
    if let Some(cfg) = &instance_cfg {
        if let Some(path) = cfg.java_path.as_deref().map(PathBuf::from) {
            if path.is_file() {
                java = path;
            }
        }
        if let Some(m) = cfg.memory_mb {
            memory = m;
        }
    }
    // Window size and extra JVM options come from the settings file. A settings
    // problem must not stop a launch, so defaults are used when loading fails.
    let stored = match default_settings(&app, system::total_ram_mb()) {
        Ok(defaults) => match settings_file(&app) {
            Ok(file) => settings::load(&file, &defaults).settings,
            Err(_) => defaults,
        },
        Err(_) => Settings::default(),
    };
    let mut jvm_args: Vec<String> = stored
        .jvm_args
        .split_whitespace()
        .filter(|a| a.len() <= 512 && !a.contains('\0'))
        .map(str::to_string)
        .collect();
    if let Some(cfg) = &instance_cfg {
        jvm_args.extend(
            cfg.jvm_args
                .split_whitespace()
                .filter(|a| a.len() <= 512 && !a.contains('\0'))
                .map(str::to_string),
        );
    }
    let launch_options = game::LaunchOptions {
        memory_mb: memory,
        window_width: stored.window_width,
        window_height: stored.window_height,
        jvm_args,
    };
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
    let game_dir = instance_cfg.as_ref().map(|cfg| instance::game_dir(&root, cfg));
    let spec = match game::build_launch(
        &root,
        &info,
        &java,
        &launch_options,
        &player,
        env!("CARGO_PKG_VERSION"),
        instance_cfg.as_ref().map(|cfg| cfg.id.as_str()),
        game_dir.as_deref(),
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
    if let Some(cfg) = &instance_cfg {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        instance::touch(&root, &cfg.id, now);
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
        "crash-reports" => instance.clone().unwrap_or_else(|| root.clone()).join("crash-reports"),
        "resourcepacks" => instance.clone().unwrap_or_else(|| root.clone()).join("resourcepacks"),
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

/// Open one instance's own game folder, not whichever ran last.
#[tauri::command]
fn open_instance_folder(app: AppHandle, id: String) -> Result<(), String> {
    let (root, _) = game_root(&app)?;
    let cfg = instance::find(&root, &id).ok_or_else(|| "That instance no longer exists.".to_string())?;
    let path = instance::game_dir(&root, &cfg);
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
    sort: Option<String>,
) -> Result<mods::SearchResult, String> {
    check_version(&version)?;
    let provider = mods::Provider::parse(&provider).ok_or("Unknown mod site.")?;
    tauri::async_runtime::spawn_blocking(move || {
        mods::search(provider, &query, &version, offset, category.as_deref(), sort.as_deref(), curseforge_key())
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

// ------------------------------------------------------- local mod files

/// Checks a chosen mod jar and reports what it is, without installing anything.
#[tauri::command]
fn inspect_mod_file(
    app: AppHandle,
    file_name: String,
    data_base64: String,
    version: String,
    profile: Option<String>,
) -> Result<mod_upload::ModInspection, String> {
    let dir = mods_folder(&app, &version, profile.as_deref())?;
    let bytes = base64::decode(&data_base64)?;
    let installed = mods::list_installed(&dir);
    Ok(mod_upload::inspect(&file_name, &bytes, &version, &installed))
}

/// Installs one chosen mod jar. `overwrite` is only true after the person
/// confirmed replacing an existing file or an already installed mod.
#[tauri::command]
async fn install_uploaded_mod(
    app: AppHandle,
    file_name: String,
    data_base64: String,
    version: String,
    profile: Option<String>,
    overwrite: bool,
) -> Result<mod_upload::UploadOutcome, String> {
    let dir = mods_folder(&app, &version, profile.as_deref())?;
    let bytes = base64::decode(&data_base64)?;
    tauri::async_runtime::spawn_blocking(move || {
        let installed = mods::list_installed(&dir);
        mod_upload::install_upload(&file_name, &bytes, &version, &dir, &installed, overwrite)
    })
    .await
    .map_err(|e| format!("The install stopped unexpectedly: {e}"))
}

// ---------------------------------------------------------- texture packs

/// The instance of `version` (any loader) and its `resourcepacks` folder.
fn pack_folders(
    app: &AppHandle,
    version: &str,
    profile: Option<&str>,
) -> Result<(PathBuf, PathBuf), String> {
    check_version(version)?;
    let (root, _) = game_root(app)?;
    let info = game::installed(&root, version, true)
        .or_else(|| game::installed(&root, version, false))
        .ok_or_else(|| format!("Install Minecraft {version} first (use Play on the Home page)."))?;
    let instance = match profile {
        Some(id) => game::list_profiles(&root)
            .into_iter()
            .find(|p| p.id == id && p.minecraft == version)
            .map(|p| p.id)
            .ok_or("That profile is not for this Minecraft version.")?,
        None => info.profile_id,
    };
    let instance_dir = game::instance_dir(&root, &instance);
    let packs = instance_dir.join("resourcepacks");
    std::fs::create_dir_all(&packs)
        .map_err(|e| format!("Could not create the resourcepacks folder: {e}"))?;
    Ok((instance_dir, packs))
}

#[tauri::command]
async fn search_resource_packs(
    provider: String,
    query: String,
    version: String,
    offset: u32,
    resolution: Option<String>,
    sort: Option<String>,
) -> Result<packs::PackSearchResult, String> {
    check_version(&version)?;
    let provider = mods::Provider::parse(&provider).ok_or("Unknown pack site.")?;
    tauri::async_runtime::spawn_blocking(move || {
        packs::search(
            provider,
            &query,
            &version,
            offset,
            resolution.as_deref(),
            sort.as_deref(),
            curseforge_key(),
        )
    })
    .await
    .map_err(|e| format!("The search stopped unexpectedly: {e}"))?
}

#[tauri::command]
async fn resource_pack_details(provider: String, id: String, version: String) -> Result<packs::PackDetails, String> {
    check_version(&version)?;
    let provider = mods::Provider::parse(&provider).ok_or("Unknown pack site.")?;
    tauri::async_runtime::spawn_blocking(move || packs::details(provider, &id, &version, curseforge_key()))
        .await
        .map_err(|e| format!("The request stopped unexpectedly: {e}"))?
}

#[tauri::command]
async fn install_resource_pack(
    app: AppHandle,
    provider: String,
    id: String,
    version: String,
    profile: Option<String>,
) -> Result<packs::InstalledPack, String> {
    let provider = mods::Provider::parse(&provider).ok_or("Unknown pack site.")?;
    let (_, dir) = pack_folders(&app, &version, profile.as_deref())?;
    tauri::async_runtime::spawn_blocking(move || packs::install(provider, &id, &version, &dir, curseforge_key()))
        .await
        .map_err(|e| format!("The install stopped unexpectedly: {e}"))?
}

#[tauri::command]
fn list_resource_packs(
    app: AppHandle,
    version: String,
    profile: Option<String>,
) -> Result<Vec<packs::InstalledPack>, String> {
    let (instance, dir) = pack_folders(&app, &version, profile.as_deref())?;
    Ok(packs::list_installed(&dir, &instance))
}

#[tauri::command]
fn set_resource_pack_enabled(
    app: AppHandle,
    version: String,
    file_name: String,
    enabled: bool,
    profile: Option<String>,
) -> Result<bool, String> {
    let (instance, dir) = pack_folders(&app, &version, profile.as_deref())?;
    packs::set_enabled(&dir, &instance, &file_name, enabled)
}

#[tauri::command]
fn remove_resource_pack(
    app: AppHandle,
    version: String,
    file_name: String,
    profile: Option<String>,
) -> Result<(), String> {
    let (_, dir) = pack_folders(&app, &version, profile.as_deref())?;
    packs::remove(&dir, &file_name)
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
        .manage(AppearanceCache::default())
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
            auth_switch,
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
            list_instance_views,
            instance_contents,
            save_instance,
            clone_instance,
            delete_instance,
            repair_instance,
            switch_fabric_loader,
            fabric_loader_versions,
            diagnose_crash,
            list_profiles,
            create_profile,
            delete_profile,
            open_community,
            open_github,
            check_for_updates,
            open_update_page,
            install_game,
            cancel_game_install,
            launch_game,
            read_game_log,
            open_game_folder,
            open_instance_folder,
            stop_game,
            quit_app,
            list_game_versions,
            list_game_version_catalog,
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
            player_appearance,
            set_mod_enabled,
            remove_mod,
            inspect_mod_file,
            install_uploaded_mod,
            search_resource_packs,
            resource_pack_details,
            install_resource_pack,
            list_resource_packs,
            set_resource_pack_enabled,
            remove_resource_pack
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
