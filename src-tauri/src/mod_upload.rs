//! Mods the player already has on their PC.
//!
//! A chosen `.jar` is inspected before anything is written: the archive has to
//! be a readable Fabric mod, its Minecraft range has to include the profile's
//! version, and a mod that is already installed has to be confirmed before it is
//! replaced. Nothing here is downloaded, and an invalid file is never installed.

use serde::Serialize;
use serde_json::Value;
use std::cmp::Ordering;
use std::fs;
use std::io::{Cursor, Read, Seek};
use std::path::Path;

use crate::mods::{safe_jar_name, InstalledMod};

/// A local mod file is a jar the player already has; 64 MiB is far above any real mod.
pub const MAX_UPLOAD_BYTES: u64 = 64 * 1024 * 1024;
const MAX_META_BYTES: u64 = 512 * 1024;
/// Long enough for any real version range, short enough to show in a list.
const MAX_RANGE_CHARS: usize = 120;

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UploadIssue {
    /// "error" blocks the installation, "warning" only asks for attention.
    pub severity: &'static str,
    pub message: String,
}

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModDependency {
    pub id: String,
    /// The version range the mod asks for, when it declares one.
    pub version: Option<String>,
}

/// Everything the Mods page shows about a chosen file, before it is installed.
#[derive(Serialize, Debug, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ModInspection {
    pub file_name: String,
    pub size: u64,
    /// True only when there is no error; warnings do not block.
    pub installable: bool,
    pub mod_id: Option<String>,
    pub name: Option<String>,
    pub version: Option<String>,
    pub description: Option<String>,
    pub authors: Vec<String>,
    /// The mod's own icon as a PNG data address.
    pub icon: Option<String>,
    /// The Minecraft range the mod declares (`depends.minecraft`).
    pub minecraft: Option<String>,
    pub fabric_loader: Option<String>,
    pub java: Option<String>,
    /// Required mods other than Minecraft, Fabric Loader and Java.
    pub dependencies: Vec<ModDependency>,
    /// The installed file that already provides this mod id, if any.
    pub duplicate_of: Option<String>,
    /// A file with the same name is already in the mods folder.
    pub same_file: bool,
    pub problems: Vec<UploadIssue>,
}

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UploadOutcome {
    pub file_name: String,
    /// "installed", "conflict", "invalid" or "failed".
    pub status: &'static str,
    pub message: Option<String>,
}

fn error(message: impl Into<String>) -> UploadIssue {
    UploadIssue { severity: "error", message: message.into() }
}

fn warning(message: impl Into<String>) -> UploadIssue {
    UploadIssue { severity: "warning", message: message.into() }
}

// ------------------------------------------------------- version ranges

fn split_version(text: &str) -> Option<(Vec<u64>, String)> {
    let text = text.trim().trim_start_matches(['v', 'V']);
    if text.is_empty() {
        return None;
    }
    let end = text.find(|c: char| !(c.is_ascii_digit() || c == '.')).unwrap_or(text.len());
    let (numbers, rest) = text.split_at(end);
    let mut parts = Vec::new();
    let raw: Vec<&str> = numbers.split('.').collect();
    for (i, part) in raw.iter().enumerate() {
        if part.is_empty() {
            // "1." is tolerated, "1..2" is not a version.
            if i + 1 == raw.len() {
                continue;
            }
            return None;
        }
        parts.push(part.parse::<u64>().ok()?);
    }
    if parts.is_empty() {
        return None;
    }
    Some((parts, rest.to_string()))
}

fn compare(a: &[u64], b: &[u64]) -> Ordering {
    let len = a.len().max(b.len()).max(3);
    for i in 0..len {
        match a.get(i).copied().unwrap_or(0).cmp(&b.get(i).copied().unwrap_or(0)) {
            Ordering::Equal => {}
            other => return other,
        }
    }
    Ordering::Equal
}

/// `1.21.x`, `1.21.*` and `x` name a prefix of a version rather than one version.
fn wildcard_prefix(text: &str) -> Option<Vec<u64>> {
    let mut parts = Vec::new();
    for part in text.trim().trim_start_matches(['v', 'V']).split('.') {
        let lower = part.to_ascii_lowercase();
        if lower == "x" || lower == "*" || lower.is_empty() {
            break;
        }
        parts.push(part.parse::<u64>().ok()?);
    }
    Some(parts)
}

fn below_next_minor(version: &[u64], asked: &[u64]) -> bool {
    let bound = if asked.len() >= 2 {
        let mut bound = asked[..asked.len() - 1].to_vec();
        let last = bound.len() - 1;
        bound[last] += 1;
        bound
    } else {
        vec![asked[0] + 1]
    };
    compare(version, &bound) == Ordering::Less
}

fn one_token_holds(token: &str, version: &[u64]) -> bool {
    let token = token.trim();
    if token.is_empty() || token == "*" || token.eq_ignore_ascii_case("x") {
        return true;
    }
    let (op, rest) = if let Some(r) = token.strip_prefix(">=") {
        (">=", r)
    } else if let Some(r) = token.strip_prefix("<=") {
        ("<=", r)
    } else if let Some(r) = token.strip_prefix('>') {
        (">", r)
    } else if let Some(r) = token.strip_prefix('<') {
        ("<", r)
    } else if let Some(r) = token.strip_prefix('=') {
        ("=", r)
    } else if let Some(r) = token.strip_prefix('~') {
        ("~", r)
    } else if let Some(r) = token.strip_prefix('^') {
        ("^", r)
    } else {
        ("=", token)
    };
    let rest = rest.trim();
    if rest == "*" || rest.eq_ignore_ascii_case("x") {
        return true;
    }
    if rest.contains(['x', 'X', '*']) {
        let Some(prefix) = wildcard_prefix(rest) else { return false };
        return version.starts_with(&prefix);
    }
    let Some((asked, _)) = split_version(rest) else { return false };
    match op {
        ">=" => compare(version, &asked) != Ordering::Less,
        "<=" => compare(version, &asked) != Ordering::Greater,
        ">" => compare(version, &asked) == Ordering::Greater,
        "<" => compare(version, &asked) == Ordering::Less,
        "~" => compare(version, &asked) != Ordering::Less && below_next_minor(version, &asked),
        "^" => compare(version, &asked) != Ordering::Less && compare(version, &[asked[0] + 1]) == Ordering::Less,
        _ => compare(version, &asked) == Ordering::Equal,
    }
}

/// Does a Fabric version range such as `>=1.21 <1.22` or `~1.21.11` include `version`?
///
/// The common operators (`>=`, `<=`, `>`, `<`, `=`, `~`, `^`), wildcards and
/// `||` alternatives are understood. A pre-release suffix on either side is
/// ignored: a mod built for `1.21.11` counts for `1.21.11`.
pub fn matches_range(range: &str, version: &str) -> bool {
    let range = range.trim();
    if range.is_empty() || range == "*" {
        return true;
    }
    let Some((version, _)) = split_version(version) else { return false };
    range.split("||").any(|alternative| {
        alternative
            .split(|c: char| c == ',' || c.is_whitespace())
            .filter(|token| !token.is_empty())
            .all(|token| one_token_holds(token, &version))
    })
}

// ------------------------------------------------------------- metadata

#[derive(Debug, Default)]
struct Metadata {
    id: Option<String>,
    name: Option<String>,
    version: Option<String>,
    description: Option<String>,
    authors: Vec<String>,
    icon_path: Option<String>,
    minecraft: Option<String>,
    fabric_loader: Option<String>,
    java: Option<String>,
    dependencies: Vec<ModDependency>,
}

/// `depends` values are either one range or a list of ranges.
fn range_of(value: Option<&Value>) -> Option<String> {
    let value = value?;
    let joined = match value {
        Value::String(s) => s.trim().to_string(),
        Value::Array(list) => list
            .iter()
            .filter_map(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
            .join(" || "),
        _ => return None,
    };
    (!joined.is_empty()).then(|| joined.chars().take(MAX_RANGE_CHARS).collect())
}

/// The fields of `fabric.mod.json` the launcher reads. `None` means it could not be parsed.
fn parse_metadata(text: &str) -> Option<Metadata> {
    let json: Value = serde_json::from_str(text.trim_start_matches('\u{feff}')).ok()?;
    let string = |key: &str| {
        json.get(key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string)
    };
    let authors = json
        .get("authors")
        .and_then(Value::as_array)
        .map(|list| {
            list.iter()
                .filter_map(|a| match a {
                    Value::String(s) => Some(s.trim().to_string()),
                    other => other.get("name").and_then(Value::as_str).map(|s| s.trim().to_string()),
                })
                .filter(|s| !s.is_empty())
                .take(4)
                .collect()
        })
        .unwrap_or_default();
    let icon_path = match json.get("icon") {
        Some(Value::String(s)) => Some(s.clone()),
        Some(Value::Object(map)) => map
            .iter()
            .filter_map(|(k, v)| Some((k.parse::<u32>().ok()?, v.as_str()?.to_string())))
            .max_by_key(|(size, _)| *size)
            .map(|(_, path)| path),
        _ => None,
    };
    // Only Minecraft, the loader and Java are known by name; everything else is a mod dependency.
    let known = ["minecraft", "fabricloader", "java", "fabric-loader", "fabric_loader"];
    let mut dependencies = Vec::new();
    if let Some(depends) = json.get("depends").and_then(Value::as_object) {
        for (id, value) in depends {
            let id = id.trim();
            if id.is_empty() || known.contains(&id) {
                continue;
            }
            dependencies.push(ModDependency { id: id.to_string(), version: range_of(Some(value)) });
        }
    }
    dependencies.sort_by(|a, b| a.id.to_lowercase().cmp(&b.id.to_lowercase()));
    dependencies.truncate(24);
    Some(Metadata {
        id: string("id").map(|s| s.to_string()),
        name: string("name").or_else(|| string("id")),
        version: string("version"),
        description: string("description"),
        authors,
        icon_path,
        minecraft: range_of(json.get("depends").and_then(|d| d.get("minecraft"))),
        fabric_loader: range_of(
            json.get("depends")
                .and_then(|d| d.get("fabricloader").or_else(|| d.get("fabric-loader"))),
        ),
        java: range_of(json.get("depends").and_then(|d| d.get("java"))),
        dependencies,
    })
}

fn read_entry<R: Read + Seek>(zip: &mut zip::ZipArchive<R>, name: &str) -> Option<Vec<u8>> {
    let entry = zip.by_name(name).ok()?;
    let mut bytes = Vec::new();
    entry.take(MAX_META_BYTES).read_to_end(&mut bytes).ok()?;
    Some(bytes)
}

fn icon_from<R: Read + Seek>(
    zip: &mut zip::ZipArchive<R>,
    path: &str,
) -> Option<String> {
    let path = path.trim_start_matches('/');
    if path.is_empty() || path.contains("..") {
        return None;
    }
    let png = read_entry(zip, path)?;
    png.starts_with(&[0x89, b'P', b'N', b'G'])
        .then(|| crate::skins::png_data_url(&png))
}

/// A mod id is what Fabric accepts: short and made of lowercase letters, digits, `_` and `-`.
fn valid_mod_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '-')
}

// -------------------------------------------------------------- inspect

/// Inspects a chosen jar. `installed` is the profile's current mod list, used to
/// find duplicates and missing dependencies.
pub fn inspect(file_name: &str, bytes: &[u8], mc: &str, installed: &[InstalledMod]) -> ModInspection {
    let mut result = ModInspection {
        file_name: file_name.to_string(),
        size: bytes.len() as u64,
        installable: false,
        ..ModInspection::default()
    };
    let mut problems = Vec::new();

    if safe_jar_name(file_name).is_none() {
        problems.push(error("Only a .jar file can be installed as a mod."));
    }
    if result.size == 0 {
        problems.push(error("This file is empty."));
    } else if result.size > MAX_UPLOAD_BYTES {
        problems.push(error("This file is far larger than a Minecraft mod, so it was not read."));
    }

    if problems.is_empty() {
        let cursor = Cursor::new(bytes);
        match zip::ZipArchive::new(cursor) {
            Err(_) => problems.push(error(
                "This file is not a readable ZIP archive, so it is not a Minecraft mod.",
            )),
            Ok(mut zip) => {
                if let Some(meta) = read_entry(&mut zip, "fabric.mod.json") {
                    let parsed = parse_metadata(&String::from_utf8_lossy(&meta));
                    match parsed {
                        None => problems.push(error(
                            "The mod's fabric.mod.json could not be read, so this is not a usable Fabric mod.",
                        )),
                        Some(meta) => {
                            result.mod_id = meta.id.clone();
                            result.name = meta.name.clone();
                            result.version = meta.version.clone();
                            result.description = meta.description.clone();
                            result.authors = meta.authors.clone();
                            result.minecraft = meta.minecraft.clone();
                            result.fabric_loader = meta.fabric_loader.clone();
                            result.java = meta.java.clone();
                            result.dependencies = meta.dependencies.clone();
                            if let Some(path) = &meta.icon_path {
                                result.icon = icon_from(&mut zip, path);
                            }

                            match &meta.id {
                                None => problems.push(error("This mod does not declare an id.")),
                                Some(id) if !valid_mod_id(id) => problems.push(error(format!(
                                    "“{id}” is not a valid Fabric mod id."
                                ))),
                                Some(_) => {}
                            }

                            if meta.version.is_none() {
                                problems.push(warning("This mod does not declare a version."));
                            }

                            match &meta.minecraft {
                                None => problems.push(warning(
                                    "This mod does not say which Minecraft versions it supports, so it may not load.",
                                )),
                                Some(range) => {
                                    if !matches_range(range, mc) {
                                        problems.push(error(format!(
                                            "This mod needs Minecraft {range}, but this profile is Minecraft {mc}."
                                        )));
                                    }
                                }
                            }

                            if meta.fabric_loader.is_none() {
                                problems.push(warning(
                                    "This mod does not declare Fabric Loader, so it may be built for another loader.",
                                ));
                            }

                            // Required mods: report the ones that are not installed.
                            let have: Vec<String> = installed
                                .iter()
                                .filter_map(|m| m.id.as_ref())
                                .map(|id| id.to_lowercase())
                                .collect();
                            let mut missing = Vec::new();
                            for dependency in &meta.dependencies {
                                let wanted = dependency.id.to_lowercase();
                                // Fabric API's id changed once; either counts.
                                let alt = (wanted == "fabric-api" || wanted == "fabric")
                                    .then(|| if wanted == "fabric" { "fabric-api" } else { "fabric" });
                                let present = have.iter().any(|h| *h == wanted)
                                    || alt.map(|alt| have.iter().any(|h| h == alt)).unwrap_or(false);
                                if !present {
                                    missing.push(dependency.id.clone());
                                }
                            }
                            if !missing.is_empty() {
                                problems.push(warning(format!(
                                    "This mod needs {} — not installed in this profile.",
                                    missing.join(", ")
                                )));
                            }
                        }
                    }
                } else {
                    // Explain the most likely reason instead of a bare "not a mod".
                    if zip.by_name("META-INF/mods.toml").is_ok()
                        || zip.by_name("META-INF/neoforge.mods.toml").is_ok()
                    {
                        problems.push(error(
                            "This is a Forge or NeoForge mod. Maple runs Fabric mods only.",
                        ));
                    } else if zip.by_name("pack.mcmeta").is_ok() {
                        problems.push(error(
                            "This is a resource pack, not a mod. Install it under Browse › Texture Packs.",
                        ));
                    } else {
                        problems.push(error(
                            "This archive has no fabric.mod.json, so it is not a Fabric mod.",
                        ));
                    }
                }
            }
        }
    }

    if let Some(id) = &result.mod_id {
        let id = id.to_lowercase();
        result.duplicate_of = installed
            .iter()
            .find(|m| m.id.as_ref().map(|other| other.to_lowercase()) == Some(id.clone()))
            .map(|m| m.file_name.clone());
        if let Some(existing) = &result.duplicate_of {
            if existing != file_name {
                problems.push(warning(format!(
                    "This mod is already installed as “{existing}”. Installing it again replaces that file."
                )));
            }
        }
    }
    result.same_file = installed.iter().any(|m| m.file_name == file_name);
    if result.same_file {
        problems.push(warning("A file with this name is already in the mods folder."));
    }

    result.installable = !problems.iter().any(|p| p.severity == "error");
    result.problems = problems;
    result
}

// -------------------------------------------------------------- install

/// Installs a chosen jar into `mods_dir`. An invalid file is refused, and an
/// existing file or mod with the same identity is only replaced when `overwrite`
/// is true (the person confirmed it).
pub fn install_upload(
    file_name: &str,
    bytes: &[u8],
    mc: &str,
    mods_dir: &Path,
    installed: &[InstalledMod],
    overwrite: bool,
) -> UploadOutcome {
    let outcome = |status: &'static str, message: Option<String>| UploadOutcome {
        file_name: file_name.to_string(),
        status,
        message,
    };
    let inspection = inspect(file_name, bytes, mc, installed);
    if !inspection.installable {
        let first = inspection
            .problems
            .iter()
            .find(|p| p.severity == "error")
            .map(|p| p.message.clone())
            .unwrap_or_else(|| "This file cannot be installed.".to_string());
        return outcome("invalid", Some(first));
    }
    let Some(name) = safe_jar_name(file_name) else {
        return outcome("invalid", Some("Only a .jar file can be installed as a mod.".to_string()));
    };

    let dest = mods_dir.join(&name);
    let mut replaced = Vec::new();
    if let Some(existing) = &inspection.duplicate_of {
        if existing != &name {
            if !overwrite {
                return outcome(
                    "conflict",
                    Some(format!("This mod is already installed as “{existing}”.")),
                );
            }
            replaced.push(existing.clone());
        }
    }
    if dest.exists() && !overwrite {
        return outcome("conflict", Some(format!("“{name}” is already in the mods folder.")));
    }
    if let Err(e) = fs::create_dir_all(mods_dir) {
        return outcome("failed", Some(format!("Could not create the mods folder: {e}")));
    }
    // The old copy (possibly switched off) goes only after the new file is written.
    let part = dest.with_extension("jar.part");
    if let Err(e) = fs::write(&part, bytes) {
        let _ = fs::remove_file(&part);
        return outcome("failed", Some(format!("Could not save the file: {e}")));
    }
    if let Err(e) = fs::rename(&part, &dest) {
        let _ = fs::remove_file(&part);
        return outcome("failed", Some(format!("Could not finish saving the file: {e}")));
    }
    let mut removed = Vec::new();
    for old in &replaced {
        if old == &name {
            continue;
        }
        let path = mods_dir.join(old);
        let off = mods_dir.join(format!("{}{}", old, ".disabled"));
        if path.is_file() && fs::remove_file(&path).is_ok() {
            removed.push(old.clone());
        } else if off.is_file() && fs::remove_file(&off).is_ok() {
            removed.push(old.clone());
        }
    }

    let message = match (replaced.is_empty(), removed.is_empty()) {
        (true, _) => format!("Installed as {name}."),
        (false, true) => format!("Installed as {name}, but the older copy could not be removed."),
        (false, false) => format!("Installed as {name} and removed {}.", removed.join(", ")),
    };
    outcome("installed", Some(message))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn installed(id: &str, file: &str) -> InstalledMod {
        InstalledMod {
            file_name: file.to_string(),
            size: 10,
            enabled: true,
            id: Some(id.to_string()),
            name: None,
            version: None,
            description: None,
            authors: Vec::new(),
            icon: None,
        }
    }

    fn jar(files: &[(&str, &str)]) -> Vec<u8> {
        let mut buffer = Cursor::new(Vec::new());
        {
            let mut zip = zip::ZipWriter::new(&mut buffer);
            let options = zip::write::SimpleFileOptions::default();
            for (name, text) in files {
                zip.start_file(*name, options).unwrap();
                zip.write_all(text.as_bytes()).unwrap();
            }
            zip.finish().unwrap();
        }
        buffer.into_inner()
    }

    fn mod_json(extra: &str) -> String {
        format!(
            r#"{{"schemaVersion":1,"id":"example_mod","name":"Example","version":"1.2.3","description":"Does things","authors":["Ana"],"depends":{{"minecraft":"1.21.x","fabricloader":">=0.16"}}{extra}}}"#
        )
    }

    #[test]
    fn version_ranges_follow_fabric_rules() {
        assert!(matches_range("1.21.x", "1.21.11"));
        assert!(!matches_range("1.21.x", "1.20.4"));
        assert!(matches_range(">=1.21 <1.22", "1.21.11"));
        assert!(!matches_range(">=1.21 <1.22", "1.22"));
        assert!(matches_range("~1.21.11", "1.21.11"));
        assert!(!matches_range("~1.21.11", "1.22.0"));
        assert!(matches_range("^1.20", "1.21.11"));
        assert!(!matches_range("^1.20", "2.0"));
        assert!(matches_range("*", "1.21.11"));
        assert!(matches_range("1.20.1 || 1.21.11", "1.21.11"));
        assert!(matches_range(">=1.21.9-", "1.21.11"));
        assert!(!matches_range("1.21.11", "1.21.1"));
        assert!(matches_range("1.21.11", "1.21.11"));
    }

    #[test]
    fn a_fabric_mod_is_read_from_its_metadata() {
        let bytes = jar(&[("fabric.mod.json", &mod_json(""))]);
        let report = inspect("example.jar", &bytes, "1.21.11", &[]);
        assert!(report.installable, "{:?}", report.problems);
        assert_eq!(report.mod_id.as_deref(), Some("example_mod"));
        assert_eq!(report.name.as_deref(), Some("Example"));
        assert_eq!(report.version.as_deref(), Some("1.2.3"));
        assert_eq!(report.minecraft.as_deref(), Some("1.21.x"));
        assert_eq!(report.authors, vec!["Ana"]);
        assert!(report.duplicate_of.is_none());
    }

    #[test]
    fn files_that_are_not_fabric_mods_are_refused() {
        let empty = jar(&[("readme.txt", "hi")]);
        let report = inspect("thing.jar", &empty, "1.21.11", &[]);
        assert!(!report.installable);
        assert!(report.problems.iter().any(|p| p.message.contains("no fabric.mod.json")));

        let forge = jar(&[("META-INF/mods.toml", "modLoader=\"javafml\"")]);
        let report = inspect("forge.jar", &forge, "1.21.11", &[]);
        assert!(report.problems.iter().any(|p| p.message.contains("Forge")));

        let not_zip = b"this is not a zip".to_vec();
        let report = inspect("fake.jar", &not_zip, "1.21.11", &[]);
        assert!(!report.installable);
        assert!(report.problems.iter().any(|p| p.message.contains("ZIP")));

        let bad_name = jar(&[("fabric.mod.json", &mod_json(""))]);
        let report = inspect("mod.zip", &bad_name, "1.21.11", &[]);
        assert!(!report.installable);
    }

    #[test]
    fn an_incompatible_minecraft_version_is_an_error() {
        let bytes = jar(&[("fabric.mod.json", &mod_json(""))]);
        let report = inspect("example.jar", &bytes, "1.20.4", &[]);
        assert!(!report.installable);
        assert!(report.problems.iter().any(|p| p.message.contains("needs Minecraft 1.21.x")));
    }

    #[test]
    fn duplicate_mods_and_missing_dependencies_are_reported() {
        let bytes = jar(&[("fabric.mod.json", &mod_json(""))]);
        let report = inspect("example.jar", &bytes, "1.21.11", &[installed("example_mod", "old.jar")]);
        assert_eq!(report.duplicate_of.as_deref(), Some("old.jar"));
        assert!(report.problems.iter().any(|p| p.severity == "warning" && p.message.contains("old.jar")));

        // A mod that needs something not installed gets a warning, not an error.
        let needs = jar(&[(
            "fabric.mod.json",
            r#"{"schemaVersion":1,"id":"needs_api","version":"1.0.0","depends":{"minecraft":">=1.21","fabricloader":"*","fabric-api":"*"}}"#,
        )]);
        let report = inspect("needs.jar", &needs, "1.21.11", &[]);
        assert!(report.installable);
        assert!(report.problems.iter().any(|p| p.message.contains("fabric-api")));
        let with_api = inspect("needs.jar", &needs, "1.21.11", &[installed("fabric-api", "fabric-api.jar")]);
        assert!(!with_api.problems.iter().any(|p| p.message.contains("fabric-api")));
    }

    #[test]
    fn installing_writes_the_file_and_respects_confirmation() {
        let dir = tempfile::tempdir().unwrap();
        let bytes = jar(&[("fabric.mod.json", &mod_json(""))]);
        let first = install_upload("example.jar", &bytes, "1.21.11", dir.path(), &[], false);
        assert_eq!(first.status, "installed");
        assert!(dir.path().join("example.jar").is_file());

        let listed = crate::mods::list_installed(dir.path());
        let again = install_upload("example.jar", &bytes, "1.21.11", dir.path(), &listed, false);
        assert_eq!(again.status, "conflict");
        let confirmed = install_upload("example.jar", &bytes, "1.21.11", dir.path(), &listed, true);
        assert_eq!(confirmed.status, "installed");

        let invalid = b"not a jar".to_vec();
        let refused = install_upload("bad.jar", &invalid, "1.21.11", dir.path(), &[], false);
        assert_eq!(refused.status, "invalid");
        assert!(!dir.path().join("bad.jar").exists());
    }

    #[test]
    fn an_older_copy_of_the_same_mod_is_replaced() {
        let dir = tempfile::tempdir().unwrap();
        let bytes = jar(&[("fabric.mod.json", &mod_json(""))]);
        std::fs::write(dir.path().join("example-1.0.jar"), &bytes).unwrap();
        let listed = crate::mods::list_installed(dir.path());
        assert_eq!(listed.len(), 1);
        let outcome = install_upload("example-2.0.jar", &bytes, "1.21.11", dir.path(), &listed, true);
        assert_eq!(outcome.status, "installed");
        assert!(dir.path().join("example-2.0.jar").is_file());
        assert!(!dir.path().join("example-1.0.jar").exists());
    }
}
