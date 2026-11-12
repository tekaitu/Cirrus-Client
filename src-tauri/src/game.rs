//! Minecraft + Fabric: installing the game files and building the launch command.
//!
//! Everything here follows Mojang's public launcher format (version manifest,
//! version JSON, asset index) and Fabric's public meta service. Downloads are
//! limited to a fixed list of official hosts and are checked against the
//! SHA-1 values those services publish. Nothing is installed or run silently:
//! the caller shows progress and can cancel.

use reqwest::Url;
use serde::Serialize;
use serde_json::Value;
use sha1::{Digest, Sha1};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Mutex;
use std::time::Duration;

pub const MANIFEST_URL: &str = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
pub const FABRIC_META: &str = "https://meta.fabricmc.net/v2/versions/loader";
const ASSET_HOST: &str = "https://resources.download.minecraft.net";
const MARKER_FILE: &str = "unlimited-install";
const MAX_JSON_BYTES: u64 = 32 * 1024 * 1024;
const MAX_FILE_BYTES: u64 = 512 * 1024 * 1024;
const WORKERS: usize = 12;

const ALLOWED_HOSTS: &[&str] = &[
    "piston-meta.mojang.com",
    "piston-data.mojang.com",
    "launchermeta.mojang.com",
    "libraries.minecraft.net",
    "resources.download.minecraft.net",
    "meta.fabricmc.net",
    "maven.fabricmc.net",
];

// ------------------------------------------------------------------ types

#[derive(Debug, Clone, PartialEq)]
pub enum GameError {
    Cancelled,
    Failed(String),
}

impl GameError {
    fn failed(msg: impl Into<String>) -> GameError {
        GameError::Failed(msg.into())
    }
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameProgress {
    /// "metadata" | "downloading" | "finishing"
    pub stage: &'static str,
    pub done: u64,
    pub total: u64,
    pub message: String,
}

pub type ProgressFn<'a> = &'a (dyn Fn(GameProgress) + Sync);

#[derive(Debug, Clone, PartialEq)]
pub struct Download {
    pub url: String,
    pub path: PathBuf,
    pub sha1: Option<String>,
    pub size: Option<u64>,
    /// Assets are only size-checked when they already exist (there are thousands).
    pub quick_check: bool,
}

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InstallInfo {
    pub minecraft: String,
    /// Fabric loader version, or `None` for plain Minecraft.
    pub loader: Option<String>,
    /// Folder name of the profile under `versions/` (the Minecraft version for plain Minecraft).
    pub profile_id: String,
}

/// Newest releases the launcher can set up: Minecraft 1.20.5 and later all use Java 21,
/// which is the Java the launcher knows how to install.
pub fn supported_release(id: &str) -> bool {
    let parts: Vec<&str> = id.split('.').collect();
    if parts.len() < 2 || parts.len() > 3 || parts[0] != "1" {
        return false;
    }
    let Ok(minor) = parts[1].parse::<u32>() else { return false };
    let patch = match parts.get(2) {
        Some(p) => match p.parse::<u32>() {
            Ok(v) => v,
            Err(_) => return false,
        },
        None => 0,
    };
    minor > 20 || (minor == 20 && patch >= 5)
}

/// Release versions from Mojang's list that the launcher supports, newest first.
pub fn list_versions() -> Result<Vec<String>, GameError> {
    let c = client().map_err(GameError::Failed)?;
    let manifest = parse_json(&fetch_text(&c, MANIFEST_URL)?, "Minecraft version list")?;
    Ok(releases_from_manifest(&manifest))
}

pub fn releases_from_manifest(manifest: &Value) -> Vec<String> {
    manifest
        .get("versions")
        .and_then(Value::as_array)
        .map(|list| {
            list.iter()
                .filter(|v| v.get("type").and_then(Value::as_str) == Some("release"))
                .filter_map(|v| v.get("id").and_then(Value::as_str))
                .filter(|id| supported_release(id))
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

/// Each profile gets its own folder for worlds, options and mods, so mods
/// for one version never end up in another. Libraries and assets are shared.
pub fn instance_dir(root: &Path, profile_id: &str) -> PathBuf {
    root.join("instances").join(profile_id)
}

// ------------------------------------------------------------ identities

/// Rules for an offline player name: what Minecraft itself accepts.
pub fn validate_username(name: &str) -> Result<(), String> {
    let len = name.chars().count();
    if len < 3 || len > 16 {
        return Err("A player name must be 3 to 16 characters long.".to_string());
    }
    if !name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return Err("Use only letters, numbers and underscores in a player name.".to_string());
    }
    Ok(())
}

/// The UUID Minecraft itself gives an offline player: a version-3 UUID of
/// "OfflinePlayer:<name>". Returned without dashes.
pub fn offline_uuid(name: &str) -> String {
    use md5::Md5;
    let mut hasher = Md5::new();
    hasher.update(format!("OfflinePlayer:{name}").as_bytes());
    let mut bytes: [u8; 16] = hasher.finalize().into();
    bytes[6] = (bytes[6] & 0x0f) | 0x30;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

#[derive(Clone)]
pub struct Player {
    pub name: String,
    pub uuid: String,
    pub access_token: String,
    /// "msa" for a Microsoft account, "legacy" for offline play.
    pub user_type: &'static str,
}

impl Player {
    pub fn offline(name: &str) -> Result<Player, String> {
        validate_username(name)?;
        Ok(Player {
            name: name.to_string(),
            uuid: offline_uuid(name),
            access_token: "0".to_string(),
            user_type: "legacy",
        })
    }
}

// --------------------------------------------------------------- web access

pub fn is_allowed_url(url: &Url) -> bool {
    url.scheme() == "https" && url.host_str().map(|h| ALLOWED_HOSTS.contains(&h)).unwrap_or(false)
}

fn client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .user_agent(concat!("Unlimited/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(10 * 60))
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= 5 || !is_allowed_url(attempt.url()) {
                attempt.stop()
            } else {
                attempt.follow()
            }
        }))
        .build()
        .map_err(|e| format!("Could not start the network client: {e}"))
}

fn net_error(e: &reqwest::Error) -> String {
    if e.is_timeout() {
        "The connection timed out. Check your internet connection and try again.".to_string()
    } else if e.is_connect() {
        "Could not connect. Check your internet connection and try again.".to_string()
    } else {
        format!("The download failed: {e}")
    }
}

fn check_cancel(cancel: &AtomicBool) -> Result<(), GameError> {
    if cancel.load(Ordering::SeqCst) {
        Err(GameError::Cancelled)
    } else {
        Ok(())
    }
}

fn sha1_hex(bytes: &[u8]) -> String {
    let mut h = Sha1::new();
    h.update(bytes);
    h.finalize().iter().map(|b| format!("{b:02x}")).collect()
}

fn sha1_file(path: &Path) -> std::io::Result<String> {
    let mut f = File::open(path)?;
    let mut h = Sha1::new();
    let mut buf = vec![0u8; 64 * 1024];
    loop {
        let n = f.read(&mut buf)?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
    }
    Ok(h.finalize().iter().map(|b| format!("{b:02x}")).collect())
}

/// Download a small JSON document from an allowed host.
fn fetch_text(c: &reqwest::blocking::Client, url: &str) -> Result<String, GameError> {
    let parsed = Url::parse(url).map_err(|e| GameError::failed(format!("Bad address: {e}")))?;
    if !is_allowed_url(&parsed) {
        return Err(GameError::failed("Refused to download from an address that is not an official Minecraft or Fabric server."));
    }
    let resp = c.get(parsed).send().map_err(|e| GameError::failed(net_error(&e)))?;
    if !resp.status().is_success() {
        return Err(GameError::failed(format!("The server answered with an error ({}).", resp.status())));
    }
    if !is_allowed_url(resp.url()) {
        return Err(GameError::failed("The server redirected somewhere that is not allowed."));
    }
    if resp.content_length().map(|n| n > MAX_JSON_BYTES).unwrap_or(false) {
        return Err(GameError::failed("A metadata file was larger than expected."));
    }
    let mut body = String::new();
    resp.take(MAX_JSON_BYTES)
        .read_to_string(&mut body)
        .map_err(|e| GameError::failed(format!("The download was interrupted: {e}")))?;
    Ok(body)
}

fn parse_json(text: &str, what: &str) -> Result<Value, GameError> {
    serde_json::from_str(text).map_err(|e| GameError::failed(format!("The {what} could not be read: {e}")))
}

/// Download one file to `dl.path` through a `.part` file, checking SHA-1 and size.
fn download_file(c: &reqwest::blocking::Client, dl: &Download, cancel: &AtomicBool) -> Result<(), GameError> {
    check_cancel(cancel)?;
    // Already present and good?
    if let Ok(meta) = fs::metadata(&dl.path) {
        let size_ok = dl.size.map(|s| s == meta.len()).unwrap_or(true);
        if size_ok {
            if dl.quick_check && dl.size.is_some() {
                return Ok(());
            }
            match &dl.sha1 {
                Some(expected) => {
                    if sha1_file(&dl.path).map(|a| a.eq_ignore_ascii_case(expected)).unwrap_or(false) {
                        return Ok(());
                    }
                }
                None => return Ok(()),
            }
        }
    }

    let parsed = Url::parse(&dl.url).map_err(|e| GameError::failed(format!("Bad address: {e}")))?;
    if !is_allowed_url(&parsed) {
        return Err(GameError::failed("Refused to download from an address that is not an official Minecraft or Fabric server."));
    }
    if let Some(dir) = dl.path.parent() {
        fs::create_dir_all(dir).map_err(|e| GameError::failed(format!("Could not create a folder: {e}")))?;
    }
    let part = dl.path.with_extension("part");

    let mut last_err = GameError::failed("The download failed.");
    for _attempt in 0..3 {
        check_cancel(cancel)?;
        let _ = fs::remove_file(&part);
        let attempt = (|| -> Result<(), GameError> {
            let resp = c.get(parsed.clone()).send().map_err(|e| GameError::failed(net_error(&e)))?;
            if !resp.status().is_success() {
                return Err(GameError::failed(format!("The server answered with an error ({}).", resp.status())));
            }
            if !is_allowed_url(resp.url()) {
                return Err(GameError::failed("The server redirected somewhere that is not allowed."));
            }
            let mut out = File::create(&part).map_err(|e| GameError::failed(format!("Could not create a file: {e}")))?;
            let mut resp = resp.take(MAX_FILE_BYTES);
            let mut hasher = Sha1::new();
            let mut buf = vec![0u8; 64 * 1024];
            let mut total: u64 = 0;
            loop {
                check_cancel(cancel)?;
                let n = resp.read(&mut buf).map_err(|e| GameError::failed(format!("The download was interrupted: {e}")))?;
                if n == 0 {
                    break;
                }
                total += n as u64;
                hasher.update(&buf[..n]);
                out.write_all(&buf[..n]).map_err(|e| GameError::failed(format!("Could not save a file: {e}")))?;
            }
            out.flush().map_err(|e| GameError::failed(format!("Could not save a file: {e}")))?;
            drop(out);
            if let Some(size) = dl.size {
                if size != total {
                    return Err(GameError::failed("A downloaded file was incomplete."));
                }
            }
            if let Some(expected) = &dl.sha1 {
                let actual: String = hasher.finalize().iter().map(|b| format!("{b:02x}")).collect();
                if !actual.eq_ignore_ascii_case(expected) {
                    return Err(GameError::failed("A downloaded file did not match its checksum, so it was not used."));
                }
            }
            fs::rename(&part, &dl.path).map_err(|e| GameError::failed(format!("Could not finish saving a file: {e}")))
        })();
        match attempt {
            Ok(()) => return Ok(()),
            Err(GameError::Cancelled) => {
                let _ = fs::remove_file(&part);
                return Err(GameError::Cancelled);
            }
            Err(e) => last_err = e,
        }
    }
    let _ = fs::remove_file(&part);
    Err(last_err)
}

// ----------------------------------------------------- version JSON logic

fn os_rule_matches(os: &Value) -> bool {
    if let Some(name) = os.get("name").and_then(Value::as_str) {
        if name != "windows" {
            return false;
        }
    }
    if let Some(arch) = os.get("arch").and_then(Value::as_str) {
        // This launcher only targets 64-bit Windows.
        if arch == "x86" || arch == "arm64" {
            return false;
        }
    }
    true
}

/// Mojang's rule list: no rules means allowed; otherwise the last matching
/// rule decides. Rules that depend on launcher features never match.
pub fn rules_allow(rules: Option<&Value>) -> bool {
    let Some(list) = rules.and_then(Value::as_array) else {
        return true;
    };
    if list.is_empty() {
        return true;
    }
    let mut allowed = false;
    for rule in list {
        let matches = rule.get("features").is_none() && rule.get("os").map(os_rule_matches).unwrap_or(true);
        if matches {
            allowed = rule.get("action").and_then(Value::as_str) == Some("allow");
        }
    }
    allowed
}

/// "group:artifact:version[:classifier][@ext]" to its repository path.
pub fn maven_path(name: &str) -> Option<String> {
    let (coords, ext) = match name.split_once('@') {
        Some((c, e)) => (c, e),
        None => (name, "jar"),
    };
    let parts: Vec<&str> = coords.split(':').collect();
    if parts.len() < 3 || parts.iter().any(|p| p.is_empty() || p.contains('/') || p.contains("..")) {
        return None;
    }
    let (group, artifact, version) = (parts[0], parts[1], parts[2]);
    let file = match parts.get(3) {
        Some(classifier) => format!("{artifact}-{version}-{classifier}.{ext}"),
        None => format!("{artifact}-{version}.{ext}"),
    };
    Some(format!("{}/{artifact}/{version}/{file}", group.replace('.', "/")))
}

/// Files must stay inside the game folder: no absolute paths, no `..`.
fn safe_relative(path: &str) -> Option<PathBuf> {
    let p = Path::new(path);
    if path.is_empty() || p.is_absolute() || path.contains('\\') || path.contains(':') {
        return None;
    }
    if p.components().any(|c| !matches!(c, std::path::Component::Normal(_))) {
        return None;
    }
    Some(p.to_path_buf())
}

/// One library the game needs: where it goes (relative to `libraries/`) and where it comes from.
#[derive(Debug, Clone, PartialEq)]
pub struct Library {
    pub key: String,
    pub rel_path: String,
    pub url: String,
    pub sha1: Option<String>,
    pub size: Option<u64>,
}

pub fn libraries_of(version: &Value) -> Vec<Library> {
    let mut out = Vec::new();
    let Some(list) = version.get("libraries").and_then(Value::as_array) else {
        return out;
    };
    for lib in list {
        if !rules_allow(lib.get("rules")) {
            continue;
        }
        let name = lib.get("name").and_then(Value::as_str).unwrap_or("");
        let artifact = lib.get("downloads").and_then(|d| d.get("artifact"));
        let (rel_path, url, sha1, size) = if let Some(a) = artifact {
            let path = a.get("path").and_then(Value::as_str).map(str::to_string).or_else(|| maven_path(name));
            let url = a.get("url").and_then(Value::as_str);
            match (path, url) {
                (Some(p), Some(u)) if !u.is_empty() => (
                    p,
                    u.to_string(),
                    a.get("sha1").and_then(Value::as_str).map(str::to_string),
                    a.get("size").and_then(Value::as_u64),
                ),
                _ => continue,
            }
        } else if let (Some(base), Some(path)) = (lib.get("url").and_then(Value::as_str), maven_path(name)) {
            (
                path.clone(),
                format!("{}/{}", base.trim_end_matches('/'), path),
                lib.get("sha1").and_then(Value::as_str).map(str::to_string),
                lib.get("size").and_then(Value::as_u64),
            )
        } else {
            continue;
        };
        if safe_relative(&rel_path).is_none() {
            continue;
        }
        // "group:artifact[:classifier]" identifies the library regardless of version,
        // so a later profile (Fabric) can replace an earlier version.
        let parts: Vec<&str> = name.split(':').collect();
        let key = match parts.len() {
            0..=2 => name.to_string(),
            3 => format!("{}:{}", parts[0], parts[1]),
            _ => format!("{}:{}:{}", parts[0], parts[1], parts[3]),
        };
        out.push(Library { key, rel_path, url, sha1, size });
    }
    out
}

/// Vanilla libraries first, then Fabric's; a later entry with the same key wins.
pub fn merge_libraries(vanilla: &Value, fabric: &Value) -> Vec<Library> {
    let mut merged: Vec<Library> = Vec::new();
    for lib in libraries_of(vanilla).into_iter().chain(libraries_of(fabric)) {
        if let Some(existing) = merged.iter_mut().find(|l| l.key == lib.key) {
            *existing = lib;
        } else {
            merged.push(lib);
        }
    }
    merged
}

/// Arguments from `arguments.game` or `arguments.jvm`, with rules applied.
pub fn resolve_args(list: Option<&Value>) -> Vec<String> {
    let mut out = Vec::new();
    let Some(items) = list.and_then(Value::as_array) else {
        return out;
    };
    for item in items {
        match item {
            Value::String(s) => out.push(s.clone()),
            Value::Object(_) => {
                if !rules_allow(item.get("rules")) {
                    continue;
                }
                match item.get("value") {
                    Some(Value::String(s)) => out.push(s.clone()),
                    Some(Value::Array(vals)) => {
                        out.extend(vals.iter().filter_map(Value::as_str).map(str::to_string))
                    }
                    _ => {}
                }
            }
            _ => {}
        }
    }
    out
}

pub fn substitute(arg: &str, vars: &HashMap<&str, String>) -> String {
    let mut out = arg.to_string();
    for (key, value) in vars {
        out = out.replace(&format!("${{{key}}}"), value);
    }
    out
}

// ------------------------------------------------------------- install

fn versions_dir(root: &Path) -> PathBuf {
    root.join("versions")
}

fn marker_path(root: &Path, mc: &str, fabric: bool) -> PathBuf {
    root.join(format!("{MARKER_FILE}-{mc}-{}.json", if fabric { "fabric" } else { "vanilla" }))
}

fn vanilla_json_path(root: &Path, mc: &str) -> PathBuf {
    versions_dir(root).join(mc).join(format!("{mc}.json"))
}

fn client_jar_path(root: &Path, mc: &str) -> PathBuf {
    versions_dir(root).join(mc).join(format!("{mc}.jar"))
}

fn fabric_json_path(root: &Path, profile_id: &str) -> PathBuf {
    versions_dir(root).join(profile_id).join(format!("{profile_id}.json"))
}

fn write_atomic(path: &Path, text: &str) -> Result<(), GameError> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| GameError::failed(format!("Could not create a folder: {e}")))?;
    }
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, text).map_err(|e| GameError::failed(format!("Could not save a file: {e}")))?;
    fs::rename(&tmp, path).map_err(|e| GameError::failed(format!("Could not save a file: {e}")))
}

/// Picks the entry for `mc` in Mojang's version manifest: (json url, sha1).
pub fn find_version(manifest: &Value, mc: &str) -> Option<(String, String)> {
    manifest.get("versions")?.as_array()?.iter().find_map(|v| {
        if v.get("id").and_then(Value::as_str) == Some(mc) {
            Some((
                v.get("url")?.as_str()?.to_string(),
                v.get("sha1")?.as_str()?.to_string(),
            ))
        } else {
            None
        }
    })
}

/// The newest stable Fabric loader listed for `mc`.
pub fn pick_loader(list: &Value) -> Option<String> {
    let items = list.as_array()?;
    let stable = items
        .iter()
        .find(|i| i.get("loader").and_then(|l| l.get("stable")).and_then(Value::as_bool) == Some(true));
    let chosen = stable.or_else(|| items.first())?;
    chosen.get("loader")?.get("version")?.as_str().map(str::to_string)
}

fn asset_downloads(root: &Path, index: &Value) -> Vec<Download> {
    let mut out = Vec::new();
    if let Some(objects) = index.get("objects").and_then(Value::as_object) {
        for entry in objects.values() {
            let Some(hash) = entry.get("hash").and_then(Value::as_str) else { continue };
            if hash.len() < 2 || !hash.chars().all(|c| c.is_ascii_hexdigit()) {
                continue;
            }
            let prefix = &hash[..2];
            out.push(Download {
                url: format!("{ASSET_HOST}/{prefix}/{hash}"),
                path: root.join("assets").join("objects").join(prefix).join(hash),
                sha1: Some(hash.to_string()),
                size: entry.get("size").and_then(Value::as_u64),
                quick_check: true,
            });
        }
    }
    out
}

fn run_downloads(
    c: &reqwest::blocking::Client,
    downloads: &[Download],
    cancel: &AtomicBool,
    on_progress: ProgressFn<'_>,
) -> Result<(), GameError> {
    let total = downloads.len();
    let next = AtomicUsize::new(0);
    let done = AtomicUsize::new(0);
    let failure: Mutex<Option<GameError>> = Mutex::new(None);
    let stop = AtomicBool::new(false);

    std::thread::scope(|scope| {
        for _ in 0..WORKERS.min(total.max(1)) {
            scope.spawn(|| loop {
                if stop.load(Ordering::SeqCst) {
                    return;
                }
                let i = next.fetch_add(1, Ordering::SeqCst);
                if i >= total {
                    return;
                }
                match download_file(c, &downloads[i], cancel) {
                    Ok(()) => {
                        let n = done.fetch_add(1, Ordering::SeqCst) + 1;
                        if n % 8 == 0 || n == total {
                            on_progress(GameProgress {
                                stage: "downloading",
                                done: n as u64,
                                total: total as u64,
                                message: format!("Downloading game files ({n} of {total})"),
                            });
                        }
                    }
                    Err(e) => {
                        stop.store(true, Ordering::SeqCst);
                        if let Ok(mut slot) = failure.lock() {
                            // A real failure is more useful than a cancel that follows it.
                            if slot.is_none() || matches!(slot.as_ref(), Some(GameError::Cancelled)) {
                                *slot = Some(e);
                            }
                        }
                        return;
                    }
                }
            });
        }
    });

    match failure.into_inner().ok().flatten() {
        Some(e) => Err(e),
        None => check_cancel(cancel),
    }
}

/// Download Minecraft `mc` and the newest stable Fabric loader into `root`.
pub fn install(
    root: &Path,
    mc: &str,
    fabric_wanted: bool,
    cancel: &AtomicBool,
    on_progress: ProgressFn<'_>,
) -> Result<InstallInfo, GameError> {
    let meta = |message: &str| {
        on_progress(GameProgress { stage: "metadata", done: 0, total: 0, message: message.to_string() })
    };
    fs::create_dir_all(root).map_err(|e| GameError::failed(format!("Could not create the game folder: {e}")))?;
    let c = client().map_err(GameError::Failed)?;

    meta("Looking up Minecraft…");
    check_cancel(cancel)?;
    let manifest = parse_json(&fetch_text(&c, MANIFEST_URL)?, "Minecraft version list")?;
    let (version_url, version_sha1) = find_version(&manifest, mc)
        .ok_or_else(|| GameError::failed(format!("Minecraft {mc} was not found in Mojang's version list.")))?;
    let version_text = fetch_text(&c, &version_url)?;
    if !sha1_hex(version_text.as_bytes()).eq_ignore_ascii_case(&version_sha1) {
        return Err(GameError::failed("Minecraft's version file did not match its checksum, so it was not used."));
    }
    let vanilla = parse_json(&version_text, "Minecraft version file")?;

    let java_major = vanilla
        .get("javaVersion")
        .and_then(|j| j.get("majorVersion"))
        .and_then(Value::as_u64)
        .unwrap_or(21);
    if java_major != 21 {
        return Err(GameError::failed(format!(
            "Minecraft {mc} needs Java {java_major}, which the launcher cannot install yet."
        )));
    }

    let mut loader: Option<String> = None;
    let mut fabric_text = String::new();
    let mut fabric = serde_json::json!({});
    let mut profile_id = mc.to_string();
    if fabric_wanted {
        meta("Looking up Fabric…");
        check_cancel(cancel)?;
        let loaders = parse_json(&fetch_text(&c, &format!("{FABRIC_META}/{mc}"))?, "Fabric loader list")?;
        let version = pick_loader(&loaders)
            .ok_or_else(|| GameError::failed(format!("Fabric does not list a loader for Minecraft {mc} yet.")))?;
        if version.is_empty() || !version.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '.' || ch == '-' || ch == '+') {
            return Err(GameError::failed("Fabric returned a loader version that looks wrong, so it was not used."));
        }
        fabric_text = fetch_text(&c, &format!("{FABRIC_META}/{mc}/{version}/profile/json"))?;
        fabric = parse_json(&fabric_text, "Fabric profile")?;
        profile_id = format!("fabric-loader-{version}-{mc}");
        loader = Some(version);
    }

    // Everything to download.
    let mut downloads: Vec<Download> = Vec::new();
    let client_dl = vanilla
        .get("downloads")
        .and_then(|d| d.get("client"))
        .ok_or_else(|| GameError::failed("Minecraft's version file has no game download."))?;
    downloads.push(Download {
        url: client_dl.get("url").and_then(Value::as_str).unwrap_or("").to_string(),
        path: client_jar_path(root, mc),
        sha1: client_dl.get("sha1").and_then(Value::as_str).map(str::to_string),
        size: client_dl.get("size").and_then(Value::as_u64),
        quick_check: false,
    });
    for lib in merge_libraries(&vanilla, &fabric) {
        downloads.push(Download {
            url: lib.url,
            path: root.join("libraries").join(&lib.rel_path),
            sha1: lib.sha1,
            size: lib.size,
            quick_check: false,
        });
    }

    let index_info = vanilla
        .get("assetIndex")
        .ok_or_else(|| GameError::failed("Minecraft's version file has no asset list."))?;
    let index_id = index_info.get("id").and_then(Value::as_str).unwrap_or("");
    if safe_relative(&format!("{index_id}.json")).is_none() {
        return Err(GameError::failed("Minecraft's asset list has an unexpected name."));
    }
    let index_download = Download {
        url: index_info.get("url").and_then(Value::as_str).unwrap_or("").to_string(),
        path: root.join("assets").join("indexes").join(format!("{index_id}.json")),
        sha1: index_info.get("sha1").and_then(Value::as_str).map(str::to_string),
        size: index_info.get("size").and_then(Value::as_u64),
        quick_check: false,
    };
    meta("Downloading the asset list…");
    download_file(&c, &index_download, cancel)?;
    let index_text = fs::read_to_string(&index_download.path)
        .map_err(|e| GameError::failed(format!("Could not read the asset list: {e}")))?;
    let index = parse_json(&index_text, "asset list")?;
    downloads.extend(asset_downloads(root, &index));

    if downloads.iter().any(|d| d.url.is_empty()) {
        return Err(GameError::failed("Minecraft's version file contains a download without an address."));
    }

    on_progress(GameProgress {
        stage: "downloading",
        done: 0,
        total: downloads.len() as u64,
        message: format!("Downloading game files (0 of {})", downloads.len()),
    });
    run_downloads(&c, &downloads, cancel, on_progress)?;

    on_progress(GameProgress { stage: "finishing", done: 0, total: 0, message: "Finishing…".to_string() });
    write_atomic(&vanilla_json_path(root, mc), &version_text)?;
    if fabric_wanted {
        write_atomic(&fabric_json_path(root, &profile_id), &fabric_text)?;
    }
    fs::create_dir_all(instance_dir(root, &profile_id).join("mods"))
        .map_err(|e| GameError::failed(format!("Could not create the mods folder: {e}")))?;
    let info = InstallInfo { minecraft: mc.to_string(), loader, profile_id };
    let marker = serde_json::to_string_pretty(&info).map_err(|e| GameError::failed(e.to_string()))?;
    write_atomic(&marker_path(root, mc, fabric_wanted), &marker)?;
    Ok(info)
}

/// The installed game, if the marker and the main files are all there.
pub fn installed(root: &Path, mc: &str, fabric: bool) -> Option<InstallInfo> {
    let text = fs::read_to_string(marker_path(root, mc, fabric)).ok()?;
    let v: Value = serde_json::from_str(&text).ok()?;
    let info = InstallInfo {
        minecraft: v.get("minecraft")?.as_str()?.to_string(),
        loader: v.get("loader").and_then(Value::as_str).map(str::to_string),
        profile_id: v.get("profileId")?.as_str()?.to_string(),
    };
    if info.minecraft != mc || safe_relative(&info.profile_id).is_none() || info.loader.is_some() != fabric {
        return None;
    }
    let ok = client_jar_path(root, mc).is_file()
        && vanilla_json_path(root, mc).is_file()
        && (!fabric || fabric_json_path(root, &info.profile_id).is_file());
    ok.then_some(info)
}

/// One installed game setup, as shown in the Library.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InstanceSummary {
    pub minecraft: String,
    pub loader: Option<String>,
    pub mod_count: usize,
}

fn count_mods(root: &Path, profile_id: &str) -> usize {
    let dir = instance_dir(root, profile_id).join("mods");
    fs::read_dir(dir)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .filter(|e| e.path().extension().and_then(|x| x.to_str()).is_some_and(|x| x.eq_ignore_ascii_case("jar")))
                .count()
        })
        .unwrap_or(0)
}

/// Every game setup that is fully installed, newest Minecraft version first.
pub fn list_instances(root: &Path) -> Vec<InstanceSummary> {
    let prefix = format!("{MARKER_FILE}-");
    let mut out = Vec::new();
    let Ok(entries) = fs::read_dir(root) else { return out };
    for entry in entries.filter_map(Result::ok) {
        let name = entry.file_name().to_string_lossy().into_owned();
        let Some(rest) = name.strip_prefix(&prefix).and_then(|r| r.strip_suffix(".json")) else { continue };
        let (mc, fabric) = if let Some(mc) = rest.strip_suffix("-fabric") {
            (mc, true)
        } else if let Some(mc) = rest.strip_suffix("-vanilla") {
            (mc, false)
        } else {
            continue;
        };
        if let Some(info) = installed(root, mc, fabric) {
            let mod_count = if fabric { count_mods(root, &info.profile_id) } else { 0 };
            out.push(InstanceSummary { minecraft: info.minecraft, loader: info.loader, mod_count });
        }
    }
    let key = |v: &str| v.split('.').map(|p| p.parse::<u32>().unwrap_or(0)).collect::<Vec<_>>();
    out.sort_by(|a, b| key(&b.minecraft).cmp(&key(&a.minecraft)).then(b.loader.is_some().cmp(&a.loader.is_some())));
    out
}

// -------------------------------------------------------------- launching

#[derive(Debug, Clone, PartialEq)]
pub struct LaunchSpec {
    pub program: PathBuf,
    pub args: Vec<String>,
    pub cwd: PathBuf,
}

fn read_json(path: &Path, what: &str) -> Result<Value, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("Could not read the {what}: {e}. Try installing the game files again."))?;
    serde_json::from_str(&text).map_err(|e| format!("The {what} is damaged ({e}). Try installing the game files again."))
}

/// Build the exact command that starts the game. Nothing is run here.
pub fn build_launch(
    root: &Path,
    info: &InstallInfo,
    java: &Path,
    memory_mb: u32,
    player: &Player,
    launcher_version: &str,
) -> Result<LaunchSpec, String> {
    let vanilla = read_json(&vanilla_json_path(root, &info.minecraft), "Minecraft version file")?;
    let fabric = if info.loader.is_some() {
        read_json(&fabric_json_path(root, &info.profile_id), "Fabric profile")?
    } else {
        serde_json::json!({})
    };
    let instance = instance_dir(root, &info.profile_id);

    let libs = merge_libraries(&vanilla, &fabric);
    let mut classpath: Vec<String> = Vec::new();
    for lib in &libs {
        let path = root.join("libraries").join(&lib.rel_path);
        if !path.is_file() {
            return Err(format!("A game file is missing ({}). Install the game files again.", lib.rel_path));
        }
        classpath.push(path.display().to_string());
    }
    classpath.push(client_jar_path(root, &info.minecraft).display().to_string());

    let main_class = fabric
        .get("mainClass")
        .and_then(Value::as_str)
        .or_else(|| vanilla.get("mainClass").and_then(Value::as_str))
        .ok_or("The version files do not name a main class.")?
        .to_string();
    let index_id = vanilla
        .get("assetIndex")
        .and_then(|a| a.get("id"))
        .and_then(Value::as_str)
        .ok_or("The version file has no asset list.")?
        .to_string();

    let natives = versions_dir(root).join(&info.minecraft).join("natives");
    fs::create_dir_all(&natives).map_err(|e| format!("Could not create a folder: {e}"))?;
    fs::create_dir_all(instance.join("mods")).map_err(|e| format!("Could not create the mods folder: {e}"))?;

    let mut vars: HashMap<&str, String> = HashMap::new();
    vars.insert("auth_player_name", player.name.clone());
    vars.insert("auth_uuid", player.uuid.clone());
    vars.insert("auth_access_token", player.access_token.clone());
    vars.insert("auth_xuid", String::new());
    vars.insert("clientid", String::new());
    vars.insert("user_type", player.user_type.to_string());
    vars.insert("user_properties", "{}".to_string());
    vars.insert("version_name", info.profile_id.clone());
    vars.insert("version_type", "release".to_string());
    vars.insert("game_directory", instance.display().to_string());
    vars.insert("assets_root", root.join("assets").display().to_string());
    vars.insert("assets_index_name", index_id);
    vars.insert("natives_directory", natives.display().to_string());
    vars.insert("library_directory", root.join("libraries").display().to_string());
    vars.insert("classpath_separator", ";".to_string());
    vars.insert("classpath", classpath.join(";"));
    vars.insert("launcher_name", "Unlimited".to_string());
    vars.insert("launcher_version", launcher_version.to_string());

    let mut jvm = resolve_args(vanilla.get("arguments").and_then(|a| a.get("jvm")));
    jvm.extend(resolve_args(fabric.get("arguments").and_then(|a| a.get("jvm"))));
    let mut game = resolve_args(vanilla.get("arguments").and_then(|a| a.get("game")));
    game.extend(resolve_args(fabric.get("arguments").and_then(|a| a.get("game"))));
    if !jvm.iter().any(|a| a.contains("${classpath}")) {
        jvm.push("-cp".to_string());
        jvm.push("${classpath}".to_string());
    }

    let mut args = vec![format!("-Xmx{memory_mb}M")];
    args.extend(jvm.iter().map(|a| substitute(a, &vars)));
    args.push(main_class);
    args.extend(game.iter().map(|a| substitute(a, &vars)));

    Ok(LaunchSpec { program: java.to_path_buf(), args, cwd: instance })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn usernames_follow_minecraft_rules() {
        assert!(validate_username("Steve").is_ok());
        assert!(validate_username("a_b_1234567890ab").is_ok());
        assert!(validate_username("ab").is_err());
        assert!(validate_username("seventeen_chars_xx").is_err());
        assert!(validate_username("bad name").is_err());
        assert!(validate_username("bad-name").is_err());
        assert!(validate_username("naïve").is_err());
        assert!(validate_username("").is_err());
    }

    #[test]
    fn offline_uuid_matches_the_one_minecraft_makes() {
        assert_eq!(offline_uuid("Notch"), "b50ad385829d3141a2167e7d7539ba7f");
        assert_eq!(offline_uuid("Steve").len(), 32);
        assert_ne!(offline_uuid("Steve"), offline_uuid("Alex"));
        let p = Player::offline("Steve").unwrap();
        assert_eq!(p.user_type, "legacy");
        assert!(Player::offline("x").is_err());
    }

    #[test]
    fn only_official_https_hosts_are_allowed() {
        let ok = |u: &str| is_allowed_url(&Url::parse(u).unwrap());
        assert!(ok("https://piston-meta.mojang.com/x"));
        assert!(ok("https://libraries.minecraft.net/a/b.jar"));
        assert!(ok("https://maven.fabricmc.net/a.jar"));
        assert!(!ok("http://piston-meta.mojang.com/x"));
        assert!(!ok("https://evil.example.com/x"));
        assert!(!ok("https://piston-meta.mojang.com.evil.com/x"));
    }

    #[test]
    fn rules_pick_windows_and_ignore_features() {
        assert!(rules_allow(None));
        assert!(rules_allow(Some(&json!([]))));
        assert!(rules_allow(Some(&json!([{"action":"allow","os":{"name":"windows"}}]))));
        assert!(!rules_allow(Some(&json!([{"action":"allow","os":{"name":"osx"}}]))));
        assert!(!rules_allow(Some(&json!([{"action":"allow","os":{"name":"windows","arch":"x86"}}]))));
        assert!(rules_allow(Some(&json!([{"action":"allow"},{"action":"disallow","os":{"name":"osx"}}]))));
        assert!(!rules_allow(Some(&json!([{"action":"allow"},{"action":"disallow","os":{"name":"windows"}}]))));
        assert!(!rules_allow(Some(&json!([{"action":"allow","features":{"is_demo_user":true}}]))));
    }

    #[test]
    fn maven_names_become_paths() {
        assert_eq!(
            maven_path("net.fabricmc:fabric-loader:0.16.9").as_deref(),
            Some("net/fabricmc/fabric-loader/0.16.9/fabric-loader-0.16.9.jar")
        );
        assert_eq!(
            maven_path("org.lwjgl:lwjgl:3.3.3:natives-windows").as_deref(),
            Some("org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar")
        );
        assert!(maven_path("nonsense").is_none());
        assert!(maven_path("a:b:../c").is_none());
    }

    #[test]
    fn relative_paths_cannot_escape() {
        assert!(safe_relative("org/lwjgl/a.jar").is_some());
        assert!(safe_relative("../x").is_none());
        assert!(safe_relative("/etc/x").is_none());
        assert!(safe_relative("a\\b").is_none());
        assert!(safe_relative("C:/x").is_none());
        assert!(safe_relative("").is_none());
    }

    fn vanilla() -> Value {
        json!({
            "libraries": [
                {"name":"org.lwjgl:lwjgl:3.3.3","downloads":{"artifact":{"path":"org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3.jar","url":"https://libraries.minecraft.net/org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3.jar","sha1":"aa","size":10}}},
                {"name":"org.lwjgl:lwjgl:3.3.3:natives-windows","rules":[{"action":"allow","os":{"name":"windows"}}],"downloads":{"artifact":{"path":"org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar","url":"https://libraries.minecraft.net/n-win.jar","sha1":"bb","size":11}}},
                {"name":"org.lwjgl:lwjgl:3.3.3:natives-linux","rules":[{"action":"allow","os":{"name":"linux"}}],"downloads":{"artifact":{"path":"org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-linux.jar","url":"https://libraries.minecraft.net/n-lin.jar","sha1":"cc","size":12}}},
                {"name":"org.ow2.asm:asm:9.6","downloads":{"artifact":{"path":"org/ow2/asm/asm/9.6/asm-9.6.jar","url":"https://libraries.minecraft.net/asm96.jar","sha1":"dd","size":13}}}
            ]
        })
    }

    fn fabric() -> Value {
        json!({
            "libraries": [
                {"name":"net.fabricmc:fabric-loader:0.17.0","url":"https://maven.fabricmc.net/","sha1":"ee","size":99},
                {"name":"org.ow2.asm:asm:9.8","url":"https://maven.fabricmc.net/"}
            ]
        })
    }

    #[test]
    fn libraries_skip_other_systems_and_fabric_overrides_versions() {
        let libs = merge_libraries(&vanilla(), &fabric());
        let paths: Vec<&str> = libs.iter().map(|l| l.rel_path.as_str()).collect();
        assert!(paths.contains(&"org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3.jar"));
        assert!(paths.contains(&"org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar"));
        assert!(!paths.iter().any(|p| p.contains("linux")));
        assert!(paths.contains(&"org/ow2/asm/asm/9.8/asm-9.8.jar"));
        assert!(!paths.contains(&"org/ow2/asm/asm/9.6/asm-9.6.jar"));
        let loader = libs.iter().find(|l| l.rel_path.contains("fabric-loader")).unwrap();
        assert_eq!(loader.url, "https://maven.fabricmc.net/net/fabricmc/fabric-loader/0.17.0/fabric-loader-0.17.0.jar");
        assert_eq!(loader.sha1.as_deref(), Some("ee"));
    }

    #[test]
    fn arguments_apply_rules_and_flatten_values() {
        let list = json!([
            "--username", "${auth_player_name}",
            {"rules":[{"action":"allow","features":{"is_demo_user":true}}],"value":"--demo"},
            {"rules":[{"action":"allow","os":{"name":"windows"}}],"value":["-Dx=1","-Dy=2"]},
            {"rules":[{"action":"allow","os":{"name":"osx"}}],"value":"-XstartOnFirstThread"}
        ]);
        assert_eq!(
            resolve_args(Some(&list)),
            vec!["--username", "${auth_player_name}", "-Dx=1", "-Dy=2"]
        );
        let mut vars = HashMap::new();
        vars.insert("auth_player_name", "Steve".to_string());
        assert_eq!(substitute("${auth_player_name}!", &vars), "Steve!");
        assert_eq!(substitute("${unknown}", &vars), "${unknown}");
    }

    #[test]
    fn version_manifest_and_fabric_lookup() {
        let manifest = json!({"versions":[
            {"id":"1.21.10","url":"https://piston-meta.mojang.com/a","sha1":"1"},
            {"id":"1.21.11","url":"https://piston-meta.mojang.com/b","sha1":"2"}]});
        assert_eq!(find_version(&manifest, "1.21.11"), Some(("https://piston-meta.mojang.com/b".into(), "2".into())));
        assert!(find_version(&manifest, "9.9").is_none());

        let loaders = json!([
            {"loader":{"version":"0.18.0-beta.1","stable":false}},
            {"loader":{"version":"0.17.3","stable":true}}]);
        assert_eq!(pick_loader(&loaders).as_deref(), Some("0.17.3"));
        let only_beta = json!([{"loader":{"version":"0.18.0-beta.1","stable":false}}]);
        assert_eq!(pick_loader(&only_beta).as_deref(), Some("0.18.0-beta.1"));
        assert!(pick_loader(&json!([])).is_none());
    }

    #[test]
    fn asset_index_becomes_downloads_and_skips_bad_hashes() {
        let root = Path::new("game");
        let index = json!({"objects":{
            "a/b.png":{"hash":"abcdef0123456789abcdef0123456789abcdef01","size":5},
            "bad":{"hash":"../../evil","size":1}}});
        let list = asset_downloads(root, &index);
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].url, "https://resources.download.minecraft.net/ab/abcdef0123456789abcdef0123456789abcdef01");
        assert!(list[0].path.ends_with("abcdef0123456789abcdef0123456789abcdef01"));
    }


    #[test]
    fn library_lists_only_complete_installs_newest_first() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let marker = |mc: &str, fabric: bool, profile: &str| {
            let loader = if fabric { json!("0.17.0") } else { Value::Null };
            write_atomic(
                &marker_path(root, mc, fabric),
                &json!({"minecraft": mc, "loader": loader, "profileId": profile}).to_string(),
            )
            .unwrap();
        };
        let files = |mc: &str, profile: Option<&str>| {
            write_atomic(&vanilla_json_path(root, mc), "{}").unwrap();
            write_atomic(&client_jar_path(root, mc), "x").unwrap();
            if let Some(p) = profile {
                write_atomic(&fabric_json_path(root, p), "{}").unwrap();
            }
        };
        marker("1.20.6", false, "1.20.6");
        files("1.20.6", None);
        marker("1.21.11", true, "fabric-loader-0.17.0-1.21.11");
        files("1.21.11", Some("fabric-loader-0.17.0-1.21.11"));
        write_atomic(&instance_dir(root, "fabric-loader-0.17.0-1.21.11").join("mods").join("sodium.jar"), "x").unwrap();
        write_atomic(&instance_dir(root, "fabric-loader-0.17.0-1.21.11").join("mods").join("notes.txt"), "x").unwrap();
        // A marker without the game files is not listed.
        marker("1.21.1", false, "1.21.1");

        let list = list_instances(root);
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].minecraft, "1.21.11");
        assert_eq!(list[0].loader.as_deref(), Some("0.17.0"));
        assert_eq!(list[0].mod_count, 1);
        assert_eq!(list[1].minecraft, "1.20.6");
        assert!(list[1].loader.is_none());
    }

    #[test]
    fn launch_command_is_built_from_the_installed_files() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let mc = "1.21.11";
        let info = InstallInfo { minecraft: mc.into(), loader: Some("0.17.0".into()), profile_id: "fabric-loader-0.17.0-1.21.11".into() };

        let mut v = vanilla();
        v["mainClass"] = json!("net.minecraft.client.main.Main");
        v["assetIndex"] = json!({"id":"29"});
        v["arguments"] = json!({
            "jvm": ["-Djava.library.path=${natives_directory}", "-cp", "${classpath}"],
            "game": ["--username","${auth_player_name}","--uuid","${auth_uuid}","--accessToken","${auth_access_token}","--version","${version_name}","--gameDir","${game_directory}","--assetsDir","${assets_root}","--assetIndex","${assets_index_name}","--userType","${user_type}"]
        });
        let mut f = fabric();
        f["mainClass"] = json!("net.fabricmc.loader.impl.launch.knot.KnotClient");
        f["arguments"] = json!({"jvm":["-DFabricMcEmu= net.minecraft.client.main.Main "],"game":[]});

        write_atomic(&vanilla_json_path(root, mc), &v.to_string()).unwrap();
        write_atomic(&fabric_json_path(root, &info.profile_id), &f.to_string()).unwrap();
        write_atomic(&client_jar_path(root, mc), "jar").unwrap();
        for lib in merge_libraries(&v, &f) {
            write_atomic(&root.join("libraries").join(&lib.rel_path), "x").unwrap();
        }

        let player = Player::offline("Steve").unwrap();
        let spec = build_launch(root, &info, Path::new("java.exe"), 3072, &player, "0.1.0").unwrap();
        assert_eq!(spec.args[0], "-Xmx3072M");
        let main_at = spec.args.iter().position(|a| a == "net.fabricmc.loader.impl.launch.knot.KnotClient").unwrap();
        let cp_at = spec.args.iter().position(|a| a == "-cp").unwrap();
        assert!(cp_at < main_at, "JVM options come before the main class");
        let cp = &spec.args[cp_at + 1];
        assert!(cp.contains("fabric-loader-0.17.0.jar") && cp.ends_with("1.21.11.jar"));
        assert!(!cp.contains("linux"));
        let after = &spec.args[main_at + 1..];
        let pos = |flag: &str| after.iter().position(|a| a == flag).unwrap();
        assert_eq!(after[pos("--username") + 1], "Steve");
        assert_eq!(after[pos("--uuid") + 1], offline_uuid("Steve"));
        assert_eq!(after[pos("--accessToken") + 1], "0");
        assert_eq!(after[pos("--userType") + 1], "legacy");
        assert_eq!(after[pos("--version") + 1], "fabric-loader-0.17.0-1.21.11");
        assert!(spec.args.iter().all(|a| !a.contains("${")), "no placeholder is left unfilled");
        assert!(instance_dir(root, &info.profile_id).join("mods").is_dir());
        assert_eq!(spec.cwd, instance_dir(root, &info.profile_id));
    }

    #[test]
    fn plain_minecraft_launches_without_fabric_files() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let mc = "1.21.11";
        let info = InstallInfo { minecraft: mc.into(), loader: None, profile_id: mc.into() };
        let mut v = vanilla();
        v["mainClass"] = json!("net.minecraft.client.main.Main");
        v["assetIndex"] = json!({"id":"29"});
        v["arguments"] = json!({"jvm":["-cp","${classpath}"],"game":["--username","${auth_player_name}"]});
        write_atomic(&vanilla_json_path(root, mc), &v.to_string()).unwrap();
        write_atomic(&client_jar_path(root, mc), "jar").unwrap();
        for lib in libraries_of(&v) {
            write_atomic(&root.join("libraries").join(&lib.rel_path), "x").unwrap();
        }
        let player = Player::offline("Alex").unwrap();
        let spec = build_launch(root, &info, Path::new("java.exe"), 2048, &player, "0.1.0").unwrap();
        assert!(spec.args.contains(&"net.minecraft.client.main.Main".to_string()));
        assert!(!spec.args.iter().any(|a| a.contains("fabric")));
    }

    #[test]
    fn supported_releases_are_the_java_21_era() {
        for ok in ["1.20.5", "1.20.6", "1.21", "1.21.1", "1.21.11"] {
            assert!(supported_release(ok), "{ok}");
        }
        for no in ["1.20.4", "1.20", "1.19.4", "1.8.9", "2.0", "1.21-pre1", "24w14a", "1.x", "1.21.1.1"] {
            assert!(!supported_release(no), "{no}");
        }
        let manifest = json!({"versions":[
            {"id":"1.21.11","type":"release"},{"id":"25w01a","type":"snapshot"},
            {"id":"1.20.4","type":"release"},{"id":"1.20.5","type":"release"}]});
        assert_eq!(releases_from_manifest(&manifest), vec!["1.21.11", "1.20.5"]);
    }

    #[test]
    fn launch_reports_a_missing_library() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let mc = "1.21.11";
        let info = InstallInfo { minecraft: mc.into(), loader: Some("0.17.0".into()), profile_id: "fabric-loader-0.17.0-1.21.11".into() };
        write_atomic(&vanilla_json_path(root, mc), &vanilla().to_string()).unwrap();
        write_atomic(&fabric_json_path(root, &info.profile_id), &fabric().to_string()).unwrap();
        let player = Player::offline("Steve").unwrap();
        let err = build_launch(root, &info, Path::new("java.exe"), 2048, &player, "0.1.0").unwrap_err();
        assert!(err.contains("missing"));
    }

    #[test]
    fn installed_needs_the_marker_and_main_files() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        assert!(installed(root, "1.21.11", true).is_none());
        let info = InstallInfo { minecraft: "1.21.11".into(), loader: Some("0.17.0".into()), profile_id: "fabric-loader-0.17.0-1.21.11".into() };
        write_atomic(&marker_path(root, "1.21.11", true), &serde_json::to_string(&info).unwrap()).unwrap();
        assert!(installed(root, "1.21.11", true).is_none(), "files are still missing");
        write_atomic(&vanilla_json_path(root, "1.21.11"), "{}").unwrap();
        write_atomic(&client_jar_path(root, "1.21.11"), "jar").unwrap();
        write_atomic(&fabric_json_path(root, &info.profile_id), "{}").unwrap();
        assert_eq!(installed(root, "1.21.11", true), Some(info));
        assert!(installed(root, "1.21.11", false).is_none(), "plain Minecraft has its own marker");
        assert!(installed(root, "1.20.1", true).is_none());
    }

    #[test]
    fn cancelled_install_stops_before_touching_the_network() {
        let dir = tempfile::tempdir().unwrap();
        let cancel = AtomicBool::new(true);
        let progress = |_p: GameProgress| {};
        let result = install(dir.path(), "1.21.11", true, &cancel, &progress);
        assert_eq!(result, Err(GameError::Cancelled));
        assert!(installed(dir.path(), "1.21.11", true).is_none());
    }
}
