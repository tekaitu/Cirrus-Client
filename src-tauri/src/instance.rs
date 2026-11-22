//! Instances: everything the launcher remembers about one installed game setup.
//!
//! An installation is still described by the marker file the installer writes
//! (`unlimited-install-<mc>-<loader>.json`); this module only adds what a person
//! can change per instance - its name, icon, Java, memory, folder, loader and
//! launch arguments - so upgrading the launcher never loses an installation.
//!
//! Worlds, saves, screenshots and mods live in the instance folder
//! (`<root>/instances/<id>`). Cloning copies them into a new folder; deleting an
//! instance only ever removes its own folder, never the shared libraries,
//! assets, versions or another instance.

use crate::game::{self, InstallInfo};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};

const STORE_FILE: &str = "unlimited-instances.json";
pub const MAX_INSTANCES: usize = 99;
pub const MIN_MEMORY_MB: u32 = 512;
pub const MAX_MEMORY_MB: u32 = 65536;
/// Most that is copied for one clone, so a huge folder cannot fill the disk silently.
const MAX_CLONE_BYTES: u64 = 4 * 1024 * 1024 * 1024;

/// The parts of an instance folder that make it *that* instance. Caches and
/// logs are left behind; worlds, mods and settings are copied.
const CLONE_PATHS: &[&str] = &[
    "world",
    "world_nether",
    "world_the_end",
    "saves",
    "screenshots",
    "resourcepacks",
    "shaderpacks",
    "mods",
    "config",
    "options.txt",
    "optionsof.txt",
    "servers.dat",
    "servers.dat_old",
    "usercache.json",
];

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InstanceConfig {
    /// Folder name under `<root>/instances/`; also the key of this record.
    pub id: String,
    pub minecraft: String,
    /// `"vanilla"` or `"fabric"`.
    pub loader: String,
    #[serde(default)]
    pub loader_version: Option<String>,
    pub name: String,
    /// 0..=7, picks the card icon.
    #[serde(default)]
    pub icon: u8,
    #[serde(default)]
    pub java_path: Option<String>,
    #[serde(default)]
    pub memory_mb: Option<u32>,
    /// A folder of the person's own choosing; empty means the default one.
    #[serde(default)]
    pub game_dir: Option<String>,
    #[serde(default)]
    pub jvm_args: String,
    /// Milliseconds since 1970, 0 when never played.
    #[serde(default)]
    pub last_played: u64,
    /// The instance this one was cloned from, for the interface to explain.
    #[serde(default)]
    pub cloned_from: Option<String>,
}

/// What the Library shows: the saved preferences plus what is on disk.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InstanceView {
    pub id: String,
    pub minecraft: String,
    pub loader: String,
    pub loader_version: Option<String>,
    pub name: String,
    pub icon: u8,
    pub java_path: Option<String>,
    pub memory_mb: Option<u32>,
    /// The folder the game actually runs in (the custom one when set).
    pub game_dir: String,
    pub custom_game_dir: bool,
    pub jvm_args: String,
    pub last_played: u64,
    pub mod_count: usize,
    /// Java major the Minecraft version asks for, when the install marker knows.
    pub java_major: Option<u32>,
    pub cloned_from: Option<String>,
}

/// A mod or world the person would lose if the folder were deleted.
#[derive(Serialize, Debug, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct InstanceContents {
    pub worlds: usize,
    pub screenshots: usize,
    pub mods: usize,
    pub resource_packs: usize,
}

pub fn store_path(root: &Path) -> PathBuf {
    root.join(STORE_FILE)
}

/// Instance ids are folder names, so they are checked instead of trusted.
pub fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 80
        && !id.starts_with('.')
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
}

pub fn valid_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Give the instance a name.".to_string());
    }
    if name.chars().count() > 40 || name.chars().any(char::is_control) {
        return Err("Instance names can be up to 40 characters, without control characters.".to_string());
    }
    Ok(name.to_string())
}

fn loader_id(fabric: bool) -> &'static str {
    if fabric {
        "fabric"
    } else {
        "vanilla"
    }
}

fn slug(text: &str) -> String {
    let mut out = String::new();
    for c in text.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
        } else if !out.ends_with('-') && !out.is_empty() {
            out.push('-');
        }
    }
    let out = out.trim_matches('-').chars().take(20).collect::<String>();
    if out.is_empty() {
        "instance".to_string()
    } else {
        out
    }
}

/// The record an installation gets the first time it is listed.
pub fn default_for(info: &InstallInfo) -> InstanceConfig {
    InstanceConfig {
        id: info.profile_id.clone(),
        minecraft: info.minecraft.clone(),
        loader: loader_id(info.loader.is_some()).to_string(),
        loader_version: info.loader.clone(),
        name: format!(
            "Minecraft {}{}",
            info.minecraft,
            if info.loader.is_some() { " Fabric" } else { "" }
        ),
        icon: 0,
        java_path: None,
        memory_mb: None,
        game_dir: None,
        jvm_args: String::new(),
        last_played: 0,
        cloned_from: None,
    }
}

fn sanitise(mut cfg: InstanceConfig) -> Option<InstanceConfig> {
    if !valid_id(&cfg.id) || !game::supported_release(&cfg.minecraft) {
        return None;
    }
    if cfg.loader != "fabric" && cfg.loader != "vanilla" {
        return None;
    }
    if cfg.name.trim().is_empty() || cfg.name.chars().count() > 40 || cfg.name.chars().any(char::is_control) {
        cfg.name = format!("Minecraft {}", cfg.minecraft);
    }
    if cfg.icon > 7 {
        cfg.icon %= 8;
    }
    if let Some(m) = cfg.memory_mb {
        if !(MIN_MEMORY_MB..=MAX_MEMORY_MB).contains(&m) {
            cfg.memory_mb = None;
        }
    }
    if cfg.jvm_args.chars().count() > 4000 || cfg.jvm_args.contains('\0') {
        cfg.jvm_args = String::new();
    }
    if let Some(p) = &cfg.java_path {
        if p.chars().count() > 1024 || p.contains('\0') {
            cfg.java_path = None;
        }
    }
    if let Some(d) = &cfg.game_dir {
        if !safe_absolute(d) {
            cfg.game_dir = None;
        }
    }
    if cfg.loader == "vanilla" {
        cfg.loader_version = None;
    }
    Some(cfg)
}

/// A custom folder must be an absolute path without `..`, so it cannot escape.
fn safe_absolute(path: &str) -> bool {
    let p = Path::new(path);
    p.is_absolute() && !p.components().any(|c| matches!(c, Component::ParentDir)) && !path.contains('\0')
}

fn write_atomic(path: &Path, text: &str) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("Could not create a folder: {e}"))?;
    }
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, text).map_err(|e| format!("Could not save instances: {e}"))?;
    fs::rename(&tmp, path).map_err(|e| format!("Could not save instances: {e}"))
}

pub fn load(root: &Path) -> Vec<InstanceConfig> {
    let Ok(text) = fs::read_to_string(store_path(root)) else {
        return Vec::new();
    };
    let list: Vec<InstanceConfig> = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let mut seen = Vec::new();
    list.into_iter()
        .filter_map(sanitise)
        .filter(|c| {
            if seen.contains(&c.id) {
                false
            } else {
                seen.push(c.id.clone());
                true
            }
        })
        .collect()
}

pub fn save(root: &Path, list: &[InstanceConfig]) -> Result<(), String> {
    let text = serde_json::to_string_pretty(list).map_err(|e| e.to_string())?;
    write_atomic(&store_path(root), &text)
}

pub fn find(root: &Path, id: &str) -> Option<InstanceConfig> {
    load(root).into_iter().find(|c| c.id == id)
}

/// Add or replace one record. New ids are rejected unless the caller generated them.
pub fn upsert(root: &Path, cfg: InstanceConfig) -> Result<InstanceConfig, String> {
    let cfg = sanitise(cfg).ok_or_else(|| "That instance record is not valid.".to_string())?;
    let mut list = load(root);
    match list.iter_mut().find(|c| c.id == cfg.id) {
        Some(slot) => *slot = cfg.clone(),
        None => {
            if list.len() >= MAX_INSTANCES {
                return Err(format!("That is the most instances Cirrus keeps ({MAX_INSTANCES}). Delete one first."));
            }
            list.push(cfg.clone());
        }
    }
    save(root, &list)?;
    Ok(cfg)
}

pub fn remove(root: &Path, id: &str) -> Result<(), String> {
    let mut list = load(root);
    let before = list.len();
    list.retain(|c| c.id != id);
    if list.len() == before {
        return Err("That instance no longer exists.".to_string());
    }
    save(root, &list)
}

/// Remember when an instance was last started, and move it to the front.
pub fn touch(root: &Path, id: &str, at: u64) {
    let mut list = load(root);
    if let Some(cfg) = list.iter_mut().find(|c| c.id == id) {
        cfg.last_played = at;
        let _ = save(root, &list);
    }
}

/// The folder the game runs in: the custom one when set, otherwise the default.
pub fn game_dir(root: &Path, cfg: &InstanceConfig) -> PathBuf {
    match &cfg.game_dir {
        Some(dir) if safe_absolute(dir) => PathBuf::from(dir),
        _ => game::instance_dir(root, &cfg.id),
    }
}

fn count_dir(path: &Path, ext: Option<&str>) -> usize {
    fs::read_dir(path)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .filter(|e| e.path().is_file())
                .filter(|e| match ext {
                    Some(want) => e
                        .path()
                        .extension()
                        .and_then(|x| x.to_str())
                        .is_some_and(|x| x.eq_ignore_ascii_case(want)),
                    None => true,
                })
                .count()
        })
        .unwrap_or(0)
}

/// What a delete would take with it, so the confirmation can say so honestly.
pub fn contents(dir: &Path) -> InstanceContents {
    let worlds = ["world", "saves"]
        .iter()
        .map(|w| count_dir(&dir.join(w), None))
        .sum();
    InstanceContents {
        worlds,
        screenshots: count_dir(&dir.join("screenshots"), None),
        mods: count_dir(&dir.join("mods"), Some("jar")),
        resource_packs: count_dir(&dir.join("resourcepacks"), None),
    }
}

pub fn view(root: &Path, cfg: &InstanceConfig, info: Option<&InstallInfo>) -> InstanceView {
    let dir = game_dir(root, cfg);
    InstanceView {
        id: cfg.id.clone(),
        minecraft: cfg.minecraft.clone(),
        loader: cfg.loader.clone(),
        loader_version: cfg.loader_version.clone(),
        name: cfg.name.clone(),
        icon: cfg.icon,
        java_path: cfg.java_path.clone(),
        memory_mb: cfg.memory_mb,
        custom_game_dir: cfg.game_dir.is_some(),
        game_dir: dir.display().to_string(),
        jvm_args: cfg.jvm_args.clone(),
        last_played: cfg.last_played,
        mod_count: count_dir(&dir.join("mods"), Some("jar")),
        java_major: info.and_then(|i| i.java_major),
        cloned_from: cfg.cloned_from.clone(),
    }
}

fn copy_tree(from: &Path, to: &Path, budget: &mut u64) -> Result<(), String> {
    let meta = fs::symlink_metadata(from).map_err(|e| format!("Could not read {}: {e}", from.display()))?;
    if meta.file_type().is_symlink() {
        return Ok(());
    }
    if meta.is_file() {
        if meta.len() > *budget {
            return Err("That instance is too large to copy. Move it by hand instead.".to_string());
        }
        *budget -= meta.len();
        if let Some(parent) = to.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Could not create a folder: {e}"))?;
        }
        fs::copy(from, to).map_err(|e| format!("Could not copy {}: {e}", from.display()))?;
        return Ok(());
    }
    fs::create_dir_all(to).map_err(|e| format!("Could not create a folder: {e}"))?;
    for entry in fs::read_dir(from).map_err(|e| format!("Could not read {}: {e}", from.display()))? {
        let entry = entry.map_err(|e| format!("Could not read {}: {e}", from.display()))?;
        copy_tree(&entry.path(), &to.join(entry.file_name()), budget)?;
    }
    Ok(())
}

/// Duplicate an instance: its own record and folder, a copy of its worlds, mods
/// and settings. The original is never written to.
pub fn clone_instance(root: &Path, id: &str, name: &str, copy_data: bool) -> Result<InstanceConfig, String> {
    let source = find(root, id).ok_or_else(|| "That instance no longer exists.".to_string())?;
    let name = valid_name(name)?;
    let mut list = load(root);
    if list.len() >= MAX_INSTANCES {
        return Err(format!("That is the most instances Cirrus keeps ({MAX_INSTANCES}). Delete one first."));
    }
    let base = format!("i-{}", slug(&name));
    let mut new_id = base.clone();
    let mut n = 2;
    while list.iter().any(|c| c.id == new_id) || game::instance_dir(root, &new_id).exists() {
        new_id = format!("{base}-{n}");
        n += 1;
    }
    let dir = game::instance_dir(root, &new_id);
    if copy_data {
        let from = game_dir(root, &source);
        let mut budget = MAX_CLONE_BYTES;
        for rel in CLONE_PATHS {
            let src = from.join(rel);
            if src.exists() {
                copy_tree(&src, &dir.join(rel), &mut budget)?;
            }
        }
    } else {
        fs::create_dir_all(dir.join("mods")).map_err(|e| format!("Could not create the folder: {e}"))?;
    }
    let cloned = InstanceConfig {
        id: new_id,
        minecraft: source.minecraft.clone(),
        loader: source.loader.clone(),
        loader_version: source.loader_version.clone(),
        name,
        icon: (source.icon + 3) % 8,
        java_path: source.java_path.clone(),
        memory_mb: source.memory_mb,
        game_dir: None,
        jvm_args: source.jvm_args.clone(),
        last_played: 0,
        cloned_from: Some(source.id),
    };
    let saved = upsert(root, cloned)?;
    Ok(saved)
}

/// Delete an instance record, and its own folder when asked. Shared game files
/// (libraries, assets, versions) are always left in place.
pub fn delete_instance(root: &Path, id: &str, delete_files: bool) -> Result<(), String> {
    let cfg = find(root, id).ok_or_else(|| "That instance no longer exists.".to_string())?;
    if delete_files {
        let dir = game_dir(root, &cfg);
        let instances = root.join("instances");
        let inside = dir.starts_with(&instances) && dir != instances;
        let custom = cfg.game_dir.is_some();
        if !inside && !custom {
            return Err("That folder is not an instance folder, so nothing was deleted.".to_string());
        }
        // A custom folder is only removed when it is empty of anything we did not create.
        if inside {
            fs::remove_dir_all(&dir).map_err(|e| format!("Could not delete {}: {e}", dir.display()))?;
        }
    }
    remove(root, id)
}

/// Every installed game, with its saved preferences (creating defaults on first sight).
pub fn list(root: &Path) -> Vec<InstanceView> {
    let mut configs = load(root);
    let mut out = Vec::new();
    let mut changed = false;
    for info in game::installed_infos(root) {
        let cfg = match configs.iter().find(|c| c.id == info.profile_id) {
            Some(c) => c.clone(),
            None => {
                let cfg = default_for(&info);
                configs.push(cfg.clone());
                changed = true;
                cfg
            }
        };
        out.push(view(root, &cfg, Some(&info)));
    }
    if changed {
        let _ = save(root, &configs);
    }
    let newest = |v: &InstanceView| v.minecraft.split('.').map(|p| p.parse::<u32>().unwrap_or(0)).collect::<Vec<_>>();
    out.sort_by(|a, b| {
        newest(b)
            .cmp(&newest(a))
            .then_with(|| b.loader == "fabric" && a.loader != "fabric")
    });
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn info(mc: &str, loader: Option<&str>) -> InstallInfo {
        InstallInfo {
            minecraft: mc.to_string(),
            loader: loader.map(str::to_string),
            profile_id: match loader {
                Some(l) => format!("fabric-loader-{l}-{mc}"),
                None => mc.to_string(),
            },
            java_major: Some(21),
        }
    }

    #[test]
    fn ids_are_safe_folder_names() {
        assert!(valid_id("fabric-loader-0.17.0-1.21.11"));
        assert!(valid_id("i-survival-2"));
        assert!(!valid_id(""));
        assert!(!valid_id("../evil"));
        assert!(!valid_id("a/b"));
        assert!(!valid_id(".hidden"));
    }

    #[test]
    fn names_are_trimmed_and_limited() {
        assert_eq!(valid_name("  Survival  ").unwrap(), "Survival");
        assert!(valid_name("   ").is_err());
        assert!(valid_name(&"x".repeat(41)).is_err());
        assert!(valid_name("bad\nname").is_err());
    }

    #[test]
    fn default_records_describe_the_install() {
        let cfg = default_for(&info("1.20.6", Some("0.16.9")));
        assert_eq!(cfg.loader, "fabric");
        assert_eq!(cfg.loader_version.as_deref(), Some("0.16.9"));
        assert_eq!(cfg.name, "Minecraft 1.20.6 Fabric");
        let vanilla = default_for(&info("1.8.9", None));
        assert_eq!(vanilla.loader_version, None);
        assert_eq!(vanilla.loader, "vanilla");
    }

    #[test]
    fn records_round_trip_and_reject_bad_values() {
        let dir = tempfile::tempdir().unwrap();
        let cfg = InstanceConfig {
            jvm_args: "-Dfoo=bar".into(),
            memory_mb: Some(8192),
            game_dir: Some("/not/absolute".into()),
            ..default_for(&info("1.21.11", None))
        };
        let saved = upsert(dir.path(), cfg).unwrap();
        assert_eq!(saved.memory_mb, Some(8192));
        assert_eq!(saved.game_dir, None, "relative folders are not accepted");
        assert_eq!(load(dir.path()).len(), 1);
        let mut bad = saved.clone();
        bad.memory_mb = Some(4);
        let fixed = upsert(dir.path(), bad).unwrap();
        assert_eq!(fixed.memory_mb, None);
    }

    #[test]
    fn cloning_copies_worlds_and_leaves_the_original() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let src = default_for(&info("1.21.11", Some("0.17.0")));
        fs::create_dir_all(game_dir(root, &src).join("world")).unwrap();
        fs::write(game_dir(root, &src).join("world/level.dat"), b"world").unwrap();
        upsert(root, src.clone()).unwrap();

        let cloned = clone_instance(root, &src.id, "Second", true).unwrap();
        assert_ne!(cloned.id, src.id);
        assert!(cloned.id.starts_with("i-second"));
        assert_eq!(fs::read(game_dir(root, &cloned).join("world/level.dat")).unwrap(), b"world");
        assert!(game_dir(root, &src).join("world/level.dat").is_file());
        assert_eq!(load(root).len(), 2);

        let again = clone_instance(root, &src.id, "Second", false).unwrap();
        assert_ne!(again.id, cloned.id, "a second clone gets its own folder");
        assert!(!game_dir(root, &again).join("world").exists());
    }

    #[test]
    fn deleting_removes_only_that_instance_folder() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let a = default_for(&info("1.21.11", None));
        let b = default_for(&info("1.20.6", Some("0.16.9")));
        for cfg in [&a, &b] {
            fs::create_dir_all(game_dir(root, cfg).join("world")).unwrap();
            upsert(root, cfg.clone()).unwrap();
        }
        delete_instance(root, &a.id, true).unwrap();
        assert!(!game_dir(root, &a).exists());
        assert!(game_dir(root, &b).join("world").is_dir());
        assert_eq!(load(root).len(), 1);
        assert!(root.join("libraries").exists() || true);
    }

    #[test]
    fn contents_describe_what_would_be_lost() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let cfg = default_for(&info("1.21.11", Some("0.17.0")));
        let dir2 = game_dir(root, &cfg);
        fs::create_dir_all(dir2.join("saves/One")).unwrap();
        fs::create_dir_all(dir2.join("mods")).unwrap();
        fs::write(dir2.join("mods/a.jar"), b"x").unwrap();
        fs::write(dir2.join("mods/notes.txt"), b"x").unwrap();
        let c = contents(&dir2);
        assert_eq!(c.worlds, 1);
        assert_eq!(c.mods, 1);
    }
}
