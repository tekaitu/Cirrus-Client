use serde::Serialize;

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

#[tauri::command]
fn get_app_info() -> AppInfo {
    app_info()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_app_info])
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
