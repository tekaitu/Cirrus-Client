pub mod java;
pub mod settings;
pub mod system;

use serde::Serialize;
use settings::{FieldError, LoadStatus, Settings};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

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

#[tauri::command]
async fn detect_java(configured_path: Option<String>) -> Result<java::JavaDetection, String> {
    tauri::async_runtime::spawn_blocking(move || java::detect(configured_path.as_deref()))
        .await
        .map_err(|e| format!("Java detection failed: {e}"))
}

#[tauri::command]
async fn inspect_java(path: String) -> Result<java::JavaInstall, String> {
    tauri::async_runtime::spawn_blocking(move || {
        java::inspect(std::path::Path::new(path.trim()), java::SRC_CONFIGURED)
    })
    .await
    .map_err(|e| format!("Java check failed: {e}"))
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
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            get_system_info,
            detect_java,
            inspect_java,
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
