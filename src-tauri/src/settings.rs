//! Persisted user settings: validation, atomic save, and recovery from a
//! missing or damaged settings file.

use serde::{Deserialize, Serialize};
use std::path::Path;

pub const SETTINGS_VERSION: u32 = 2;
pub const MIN_MEMORY_MB: u32 = 1024;
pub const MIN_WINDOW_WIDTH: u32 = 640;
pub const MIN_WINDOW_HEIGHT: u32 = 480;
pub const MAX_WINDOW_SIZE: u32 = 7680;
pub const MAX_JVM_ARGS_CHARS: usize = 2000;
pub const MAX_MEMORY_CAP_MB: u32 = 32768;
pub const RESERVED_FOR_SYSTEM_MB: u64 = 2048;
pub const DEFAULT_MEMORY_MB: u32 = 4096;
const MEMORY_STEP_MB: u32 = 256;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub version: u32,
    /// Custom Java executable; `None` means "detect automatically".
    pub java_path: Option<String>,
    pub memory_mb: u32,
    pub game_dir: String,
    /// Window size Minecraft opens with (`--width` / `--height`).
    pub window_width: u32,
    pub window_height: u32,
    /// Extra JVM options, split on spaces when launching.
    pub jvm_args: String,
    pub reduce_motion: bool,
    /// Application (client) ID of the Azure app used for Microsoft sign-in.
    /// It is public information (not a secret); `None` means sign-in is not set up.
    pub ms_client_id: Option<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            version: SETTINGS_VERSION,
            java_path: None,
            memory_mb: DEFAULT_MEMORY_MB,
            game_dir: String::new(),
            window_width: 1280,
            window_height: 720,
            jvm_args: String::new(),
            reduce_motion: false,
            ms_client_id: None,
        }
    }
}

#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct FieldError {
    pub field: &'static str,
    pub message: String,
}

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum LoadStatus {
    Loaded,
    CreatedDefaults,
    RecoveredFromCorruption,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Loaded {
    pub settings: Settings,
    pub status: LoadStatus,
    pub message: Option<String>,
}

/// Half of installed RAM, rounded down to a 256 MB step, between 1 GB and 4 GB.
pub fn default_memory_mb(total_ram_mb: u64) -> u32 {
    if total_ram_mb == 0 {
        return DEFAULT_MEMORY_MB;
    }
    let half = (total_ram_mb / 2).min(u64::from(DEFAULT_MEMORY_MB)) as u32;
    (half / MEMORY_STEP_MB * MEMORY_STEP_MB).clamp(MIN_MEMORY_MB, DEFAULT_MEMORY_MB)
}

/// Upper limit that still leaves memory for Windows.
pub fn max_memory_mb(total_ram_mb: u64) -> u32 {
    if total_ram_mb == 0 {
        return MAX_MEMORY_CAP_MB;
    }
    let allowed = total_ram_mb
        .saturating_sub(RESERVED_FOR_SYSTEM_MB)
        .min(u64::from(MAX_MEMORY_CAP_MB)) as u32;
    (allowed / MEMORY_STEP_MB * MEMORY_STEP_MB).max(MIN_MEMORY_MB)
}

pub fn defaults(total_ram_mb: u64, default_game_dir: &Path) -> Settings {
    Settings {
        memory_mb: default_memory_mb(total_ram_mb),
        game_dir: default_game_dir.display().to_string(),
        ..Settings::default()
    }
}

/// Trim text fields, turn a blank Java path into `None`, stamp the version.
pub fn normalize(mut s: Settings) -> Settings {
    s.java_path = s
        .java_path
        .map(|p| {
            // Quotes, a Java folder or javaw.exe are turned into the java.exe to run.
            let cleaned = crate::java::strip_quotes(&p).to_string();
            if cleaned.is_empty() {
                cleaned
            } else {
                crate::java::resolve_user_input(&cleaned).display().to_string()
            }
        })
        .filter(|p| !p.is_empty());
    s.ms_client_id = s
        .ms_client_id
        .map(|c| c.trim().to_string())
        .filter(|c| !c.is_empty());
    s.game_dir = s.game_dir.trim().to_string();
    s.jvm_args = s.jvm_args.trim().to_string();
    s.version = SETTINGS_VERSION;
    s
}

pub fn validate(s: &Settings, total_ram_mb: u64) -> Vec<FieldError> {
    let mut errors = Vec::new();

    let max = max_memory_mb(total_ram_mb);
    if s.memory_mb < MIN_MEMORY_MB {
        errors.push(FieldError {
            field: "memoryMb",
            message: format!("Memory must be at least {MIN_MEMORY_MB} MB."),
        });
    } else if s.memory_mb > max {
        errors.push(FieldError {
            field: "memoryMb",
            message: format!(
                "Memory can't exceed {max} MB on this PC (the rest is left for Windows)."
            ),
        });
    }

    if let Some(p) = &s.java_path {
        if p.trim().is_empty() {
            errors.push(FieldError {
                field: "javaPath",
                message: "Java path can't be blank. Clear it to use automatic detection."
                    .to_string(),
            });
        } else if p.contains('\0') || !crate::java::resolve_user_input(p).is_file() {
            errors.push(FieldError {
                field: "javaPath",
                message: format!(
                    "No Java program found at {p}. Choose the java.exe file or the Java install folder."
                ),
            });
        }
    }

    if let Some(id) = &s.ms_client_id {
        if !crate::auth::is_valid_client_id(id) {
            errors.push(FieldError {
                field: "msClientId",
                message: "This should look like 00000000-0000-0000-0000-000000000000 (the Application (client) ID from Azure).".to_string(),
            });
        }
    }

    if !(MIN_WINDOW_WIDTH..=MAX_WINDOW_SIZE).contains(&s.window_width) {
        errors.push(FieldError {
            field: "windowWidth",
            message: format!(
                "Window width must be between {MIN_WINDOW_WIDTH} and {MAX_WINDOW_SIZE} pixels."
            ),
        });
    }
    if !(MIN_WINDOW_HEIGHT..=MAX_WINDOW_SIZE).contains(&s.window_height) {
        errors.push(FieldError {
            field: "windowHeight",
            message: format!(
                "Window height must be between {MIN_WINDOW_HEIGHT} and {MAX_WINDOW_SIZE} pixels."
            ),
        });
    }
    if s.jvm_args.chars().count() > MAX_JVM_ARGS_CHARS || s.jvm_args.contains('\0') {
        errors.push(FieldError {
            field: "jvmArgs",
            message: format!(
                "Extra JVM options can be at most {MAX_JVM_ARGS_CHARS} characters and must be plain text."
            ),
        });
    }

    let dir = s.game_dir.trim();
    if dir.is_empty() {
        errors.push(FieldError {
            field: "gameDir",
            message: "Game directory is required.".to_string(),
        });
    } else if dir.contains('\0') || !Path::new(dir).is_absolute() {
        errors.push(FieldError {
            field: "gameDir",
            message: "Use a full path, for example C:\\Users\\you\\MapleClient.".to_string(),
        });
    } else if Path::new(dir).exists() && !Path::new(dir).is_dir() {
        errors.push(FieldError {
            field: "gameDir",
            message: "That path is a file, not a folder.".to_string(),
        });
    }

    errors
}

fn recover(path: &Path, defaults: &Settings, reason: &str) -> Loaded {
    let backup = path.with_extension("json.corrupt");
    let message = match std::fs::rename(path, &backup) {
        Ok(()) => format!(
            "{reason} The old file was kept as {} and default settings were restored.",
            backup.display()
        ),
        Err(_) => format!("{reason} Default settings were restored."),
    };
    Loaded {
        settings: defaults.clone(),
        status: LoadStatus::RecoveredFromCorruption,
        message: Some(message),
    }
}

pub fn load(path: &Path, defaults: &Settings) -> Loaded {
    match std::fs::read_to_string(path) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Loaded {
            settings: defaults.clone(),
            status: LoadStatus::CreatedDefaults,
            message: None,
        },
        Err(e) => Loaded {
            settings: defaults.clone(),
            status: LoadStatus::RecoveredFromCorruption,
            message: Some(format!(
                "The settings file could not be read ({e}). Default settings are in use."
            )),
        },
        Ok(text) => match serde_json::from_str::<Settings>(&text) {
            Ok(mut s) if s.version <= SETTINGS_VERSION => {
                if s.game_dir.trim().is_empty() {
                    s.game_dir = defaults.game_dir.clone();
                }
                Loaded {
                    settings: s,
                    status: LoadStatus::Loaded,
                    message: None,
                }
            }
            Ok(_) => recover(
                path,
                defaults,
                "The settings file was saved by a newer version of Maple Client.",
            ),
            Err(e) => recover(path, defaults, &format!("The settings file was damaged ({e})."))
        },
    }
}

/// Write to a temporary file, then rename over the real one so a crash can't
/// leave a half-written settings file behind.
pub fn save(path: &Path, settings: &Settings) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Could not create the settings folder: {e}"))?;
    }
    let json = serde_json::to_vec_pretty(settings)
        .map_err(|e| format!("Could not encode settings: {e}"))?;
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, json).map_err(|e| format!("Could not write settings: {e}"))?;
    std::fs::rename(&tmp, path).map_err(|e| format!("Could not save settings: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn defaults_for_tests() -> Settings {
        let dir = if cfg!(windows) { "C:\\MapleClient\\game" } else { "/tmp/cirrus-client-game" };
        defaults(16384, Path::new(dir))
    }

    fn game_dir_ok() -> String {
        if cfg!(windows) { "C:\\MapleClient\\game".into() } else { "/tmp/cirrus-client-game".into() }
    }

    #[test]
    fn default_memory_scales_with_installed_ram() {
        assert_eq!(default_memory_mb(16384), 4096);
        assert_eq!(default_memory_mb(8192), 4096);
        assert_eq!(default_memory_mb(4096), 2048);
        assert_eq!(default_memory_mb(1500), 1024);
        assert_eq!(default_memory_mb(0), 4096);
    }

    #[test]
    fn max_memory_leaves_room_for_the_system() {
        assert_eq!(max_memory_mb(16384), 14336);
        assert_eq!(max_memory_mb(4096), 2048);
        assert_eq!(max_memory_mb(2048), 1024);
        assert_eq!(max_memory_mb(0), 32768);
        assert_eq!(max_memory_mb(1_000_000), 32768);
    }

    #[test]
    fn valid_settings_have_no_errors() {
        let s = Settings { game_dir: game_dir_ok(), ..defaults_for_tests() };
        assert!(validate(&s, 16384).is_empty());
    }

    #[test]
    fn memory_bounds_are_enforced() {
        let low = Settings { memory_mb: 512, game_dir: game_dir_ok(), ..Settings::default() };
        let high = Settings { memory_mb: 15000, game_dir: game_dir_ok(), ..Settings::default() };
        assert_eq!(validate(&low, 16384)[0].field, "memoryMb");
        assert_eq!(validate(&high, 16384)[0].field, "memoryMb");
    }

    #[test]
    fn game_dir_must_be_present_and_absolute() {
        let blank = Settings { game_dir: "  ".into(), ..Settings::default() };
        let relative = Settings { game_dir: "relative/dir".into(), ..Settings::default() };
        assert_eq!(validate(&blank, 16384)[0].field, "gameDir");
        assert_eq!(validate(&relative, 16384)[0].field, "gameDir");
    }

    #[test]
    fn missing_java_file_is_rejected() {
        let s = Settings {
            java_path: Some("definitely/not/a/real/java".into()),
            game_dir: game_dir_ok(),
            ..Settings::default()
        };
        let errors = validate(&s, 16384);
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].field, "javaPath");
    }

    #[test]
    fn java_path_with_quotes_spaces_and_folders_is_normalized() {
        let dir = tempfile::tempdir().unwrap();
        let home = dir.path().join("Program Files").join("Java 21");
        let exe = home.join("bin").join(crate::java::JAVA_EXE);
        fs::create_dir_all(exe.parent().unwrap()).unwrap();
        fs::write(&exe, b"stub").unwrap();
        for raw in [
            format!("\"{}\"", exe.display()),
            home.display().to_string(),
            format!("  \"{}\"  ", home.display()),
        ] {
            let s = normalize(Settings { java_path: Some(raw), ..Settings::default() });
            assert_eq!(s.java_path.as_deref(), Some(exe.display().to_string().as_str()));
        }
    }

    #[test]
    fn existing_java_file_is_accepted() {
        let dir = tempfile::tempdir().unwrap();
        let java = dir.path().join("java-stub");
        fs::write(&java, b"stub").unwrap();
        let s = Settings {
            java_path: Some(java.display().to_string()),
            game_dir: game_dir_ok(),
            ..Settings::default()
        };
        assert!(validate(&s, 16384).is_empty());
    }

    #[test]
    fn window_size_must_be_usable_and_within_limits() {
        let ok = Settings { game_dir: game_dir_ok(), ..defaults_for_tests() };
        assert!(validate(&ok, 16384).is_empty());
        let tiny = Settings { window_width: 320, ..ok.clone() };
        assert_eq!(validate(&tiny, 16384)[0].field, "windowWidth");
        let tall = Settings { window_height: 9000, ..ok.clone() };
        assert_eq!(validate(&tall, 16384)[0].field, "windowHeight");
        let enormous = Settings { jvm_args: "x".repeat(MAX_JVM_ARGS_CHARS + 1), ..ok };
        assert_eq!(validate(&enormous, 16384)[0].field, "jvmArgs");
    }

    #[test]
    fn jvm_options_are_trimmed_and_kept() {
        let s = normalize(Settings {
            jvm_args: "  -XX:+UseG1GC  ".into(),
            ..Settings::default()
        });
        assert_eq!(s.jvm_args, "-XX:+UseG1GC");
        assert_eq!(Settings::default().window_width, 1280);
        assert_eq!(Settings::default().window_height, 720);
    }

    #[test]
    fn microsoft_client_id_must_be_a_guid_or_blank() {
        let ok = Settings {
            ms_client_id: Some("12345678-90ab-cdef-1234-567890abcdef".into()),
            game_dir: game_dir_ok(),
            ..Settings::default()
        };
        assert!(validate(&ok, 16384).is_empty());
        let bad = Settings { ms_client_id: Some("not-a-guid".into()), ..ok.clone() };
        let errors = validate(&bad, 16384);
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].field, "msClientId");
        let blank = normalize(Settings { ms_client_id: Some("  ".into()), ..ok });
        assert_eq!(blank.ms_client_id, None);
    }

    #[test]
    fn normalize_trims_and_clears_blank_java_path() {
        let s = normalize(Settings {
            java_path: Some("   ".into()),
            game_dir: "  C:\\x  ".into(),
            version: 0,
            ..Settings::default()
        });
        assert_eq!(s.java_path, None);
        assert_eq!(s.game_dir, "C:\\x");
        assert_eq!(s.version, SETTINGS_VERSION);
    }

    #[test]
    fn missing_file_yields_defaults() {
        let dir = tempfile::tempdir().unwrap();
        let loaded = load(&dir.path().join("settings.json"), &defaults_for_tests());
        assert_eq!(loaded.status, LoadStatus::CreatedDefaults);
        assert_eq!(loaded.settings, defaults_for_tests());
    }

    #[test]
    fn save_then_load_round_trips() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested").join("settings.json");
        let s = Settings { memory_mb: 6144, reduce_motion: true, ..defaults_for_tests() };
        save(&path, &s).unwrap();
        let loaded = load(&path, &defaults_for_tests());
        assert_eq!(loaded.status, LoadStatus::Loaded);
        assert_eq!(loaded.settings, s);
        assert!(!path.with_extension("json.tmp").exists());
    }

    #[test]
    fn saving_twice_replaces_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        save(&path, &Settings { memory_mb: 2048, ..defaults_for_tests() }).unwrap();
        save(&path, &Settings { memory_mb: 3072, ..defaults_for_tests() }).unwrap();
        assert_eq!(load(&path, &defaults_for_tests()).settings.memory_mb, 3072);
    }

    #[test]
    fn corrupt_file_is_backed_up_and_defaults_restored() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        fs::write(&path, b"{ this is not json").unwrap();
        let loaded = load(&path, &defaults_for_tests());
        assert_eq!(loaded.status, LoadStatus::RecoveredFromCorruption);
        assert_eq!(loaded.settings, defaults_for_tests());
        assert!(loaded.message.unwrap().contains("damaged"));
        assert!(dir.path().join("settings.json.corrupt").exists());
        assert!(!path.exists());
    }

    #[test]
    fn newer_settings_version_is_treated_as_unusable() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        fs::write(&path, br#"{"version": 99, "memoryMb": 2048}"#).unwrap();
        let loaded = load(&path, &defaults_for_tests());
        assert_eq!(loaded.status, LoadStatus::RecoveredFromCorruption);
    }

    #[test]
    fn partial_file_is_filled_in_with_defaults() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        fs::write(&path, br#"{"memoryMb": 2048}"#).unwrap();
        let loaded = load(&path, &defaults_for_tests());
        assert_eq!(loaded.status, LoadStatus::Loaded);
        assert_eq!(loaded.settings.memory_mb, 2048);
        assert_eq!(loaded.settings.game_dir, defaults_for_tests().game_dir);
        assert!(!loaded.settings.reduce_motion);
    }
}
