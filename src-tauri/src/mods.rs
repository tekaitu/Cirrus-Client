//! Mods: search and install from Modrinth (public API) and CurseForge (needs an API key).
//!
//! Downloads only come from the providers' own hosts, are limited in size and
//! are checked against the hashes the provider publishes. Files are written
//! straight into the instance's `mods` folder; nothing is run.

use reqwest::Url;
use serde::Serialize;
use serde_json::Value;
use sha1::{Digest, Sha1};
use sha2::Sha512;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::Duration;

pub const MODRINTH_API: &str = "https://api.modrinth.com/v2";
pub const CURSEFORGE_API: &str = "https://api.curseforge.com/v1";
const CURSEFORGE_GAME_ID: &str = "432";
const CURSEFORGE_MODS_CLASS: &str = "6";
const CURSEFORGE_FABRIC: &str = "4";
const PAGE_SIZE: u32 = 20;
const MAX_MOD_BYTES: u64 = 128 * 1024 * 1024;
const MAX_JSON_BYTES: u64 = 8 * 1024 * 1024;
const MAX_INSTALLS: usize = 12;

const ALLOWED_HOSTS: &[&str] = &[
    "api.modrinth.com",
    "cdn.modrinth.com",
    "api.curseforge.com",
    "edge.forgecdn.net",
    "mediafilez.forgecdn.net",
];

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModHit {
    pub provider: &'static str,
    pub id: String,
    pub title: String,
    pub description: String,
    pub author: String,
    pub downloads: u64,
    pub icon_url: Option<String>,
    pub page_url: Option<String>,
}

#[derive(Serialize, Debug, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub hits: Vec<ModHit>,
    pub total: u64,
}

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InstalledMod {
    pub file_name: String,
    pub size: u64,
}

#[derive(Serialize, Debug, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct InstallReport {
    /// Files that were downloaded.
    pub installed: Vec<String>,
    /// Files that were already there.
    pub present: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Provider {
    Modrinth,
    CurseForge,
}

impl Provider {
    pub fn parse(name: &str) -> Option<Provider> {
        match name {
            "modrinth" => Some(Provider::Modrinth),
            "curseforge" => Some(Provider::CurseForge),
            _ => None,
        }
    }
}

// ------------------------------------------------------------ web access

pub fn is_allowed_url(url: &Url) -> bool {
    url.scheme() == "https" && url.host_str().map(|h| ALLOWED_HOSTS.contains(&h)).unwrap_or(false)
}

fn client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .user_agent(concat!("CirrusClient-Launcher/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(120))
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
        format!("The request failed: {e}")
    }
}

fn get_json(c: &reqwest::blocking::Client, url: Url, cf_key: Option<&str>) -> Result<Value, String> {
    if !is_allowed_url(&url) {
        return Err("Refused to contact an address that is not a known mod site.".to_string());
    }
    let mut req = c.get(url.clone());
    // The CurseForge key is only ever sent to CurseForge's API.
    if url.host_str() == Some("api.curseforge.com") {
        if let Some(key) = cf_key {
            req = req.header("x-api-key", key);
        }
    }
    let resp = req.send().map_err(|e| net_error(&e))?;
    if resp.status().as_u16() == 403 && url.host_str() == Some("api.curseforge.com") {
        return Err("CurseForge refused the request. The API key in this build may be missing or invalid.".to_string());
    }
    if !resp.status().is_success() {
        return Err(format!("The mod site answered with an error ({}).", resp.status()));
    }
    let mut body = String::new();
    resp.take(MAX_JSON_BYTES)
        .read_to_string(&mut body)
        .map_err(|e| format!("The answer was interrupted: {e}"))?;
    serde_json::from_str(&body).map_err(|e| format!("The mod site's answer could not be read: {e}"))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// A mod file name that is safe to create inside the mods folder.
pub fn safe_jar_name(name: &str) -> Option<String> {
    let ok = !name.is_empty()
        && name.len() <= 150
        && name.to_ascii_lowercase().ends_with(".jar")
        && !name.starts_with('.')
        && !name.contains("..")
        && name.chars().all(|c| !c.is_control() && !matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'));
    ok.then(|| name.to_string())
}

#[derive(Debug)]
struct FileSpec {
    name: String,
    url: String,
    sha1: Option<String>,
    sha512: Option<String>,
}

fn download_mod(c: &reqwest::blocking::Client, spec: &FileSpec, dest: &Path) -> Result<(), String> {
    let url = Url::parse(&spec.url).map_err(|e| format!("Bad download address: {e}"))?;
    if !is_allowed_url(&url) {
        return Err("Refused to download from an address that is not a known mod site.".to_string());
    }
    if spec.sha1.is_none() && spec.sha512.is_none() {
        return Err("The mod site did not publish a checksum for this file, so it was not downloaded.".to_string());
    }
    let resp = c.get(url).send().map_err(|e| net_error(&e))?;
    if !resp.status().is_success() {
        return Err(format!("The download server answered with an error ({}).", resp.status()));
    }
    if !is_allowed_url(resp.url()) {
        return Err("The download was redirected somewhere that is not allowed.".to_string());
    }
    if resp.content_length().map(|n| n > MAX_MOD_BYTES).unwrap_or(false) {
        return Err("The mod file is larger than expected, so it was not downloaded.".to_string());
    }
    let part = dest.with_extension("jar.part");
    let result = (|| -> Result<(), String> {
        let mut out = File::create(&part).map_err(|e| format!("Could not create the file: {e}"))?;
        let mut resp = resp.take(MAX_MOD_BYTES + 1);
        let mut h1 = Sha1::new();
        let mut h512 = Sha512::new();
        let mut buf = vec![0u8; 64 * 1024];
        let mut total: u64 = 0;
        loop {
            let n = resp.read(&mut buf).map_err(|e| format!("The download was interrupted: {e}"))?;
            if n == 0 {
                break;
            }
            total += n as u64;
            if total > MAX_MOD_BYTES {
                return Err("The mod file is larger than expected, so it was not saved.".to_string());
            }
            h1.update(&buf[..n]);
            h512.update(&buf[..n]);
            out.write_all(&buf[..n]).map_err(|e| format!("Could not save the file: {e}"))?;
        }
        out.flush().map_err(|e| format!("Could not save the file: {e}"))?;
        if let Some(expected) = &spec.sha512 {
            if !hex(&h512.finalize()).eq_ignore_ascii_case(expected) {
                return Err("A downloaded mod did not match its checksum, so it was deleted and not used.".to_string());
            }
        } else if let Some(expected) = &spec.sha1 {
            if !hex(&h1.finalize()).eq_ignore_ascii_case(expected) {
                return Err("A downloaded mod did not match its checksum, so it was deleted and not used.".to_string());
            }
        }
        Ok(())
    })();
    match result {
        Ok(()) => fs::rename(&part, dest).map_err(|e| {
            let _ = fs::remove_file(&part);
            format!("Could not finish saving the file: {e}")
        }),
        Err(e) => {
            let _ = fs::remove_file(&part);
            Err(e)
        }
    }
}

// ------------------------------------------------------------- Modrinth

pub fn modrinth_facets(mc: &str, loader: &str) -> String {
    serde_json::json!([
        ["project_type:mod"],
        [format!("versions:{mc}")],
        [format!("categories:{loader}")]
    ])
    .to_string()
}

pub fn parse_modrinth_hits(v: &Value) -> SearchResult {
    let hits = v
        .get("hits")
        .and_then(Value::as_array)
        .map(|list| {
            list.iter()
                .filter_map(|h| {
                    let id = h.get("project_id")?.as_str()?.to_string();
                    let slug = h.get("slug").and_then(Value::as_str).unwrap_or("");
                    Some(ModHit {
                        provider: "modrinth",
                        id,
                        title: h.get("title")?.as_str()?.to_string(),
                        description: h.get("description").and_then(Value::as_str).unwrap_or("").to_string(),
                        author: h.get("author").and_then(Value::as_str).unwrap_or("").to_string(),
                        downloads: h.get("downloads").and_then(Value::as_u64).unwrap_or(0),
                        icon_url: h
                            .get("icon_url")
                            .and_then(Value::as_str)
                            .filter(|u| u.starts_with("https://cdn.modrinth.com/"))
                            .map(str::to_string),
                        page_url: (!slug.is_empty()).then(|| format!("https://modrinth.com/mod/{slug}")),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    SearchResult { hits, total: v.get("total_hits").and_then(Value::as_u64).unwrap_or(0) }
}

/// The best file for a Modrinth version list (newest first): releases before betas.
fn modrinth_spec(versions: &Value) -> Result<(FileSpec, Vec<String>), String> {
    let list = versions.as_array().ok_or("The mod site's answer was not a version list.")?;
    let chosen = list
        .iter()
        .find(|v| v.get("version_type").and_then(Value::as_str) == Some("release"))
        .or_else(|| list.first())
        .ok_or("No version of this mod is available for the chosen Minecraft version and loader.")?;
    let files = chosen.get("files").and_then(Value::as_array).ok_or("The mod version has no files.")?;
    let file = files
        .iter()
        .find(|f| f.get("primary").and_then(Value::as_bool) == Some(true))
        .or_else(|| files.first())
        .ok_or("The mod version has no files.")?;
    let name = file.get("filename").and_then(Value::as_str).unwrap_or("");
    let name = safe_jar_name(name).ok_or("The mod file has an unusual name, so it was not downloaded.")?;
    let hashes = file.get("hashes");
    let spec = FileSpec {
        name,
        url: file.get("url").and_then(Value::as_str).unwrap_or("").to_string(),
        sha1: hashes.and_then(|h| h.get("sha1")).and_then(Value::as_str).map(str::to_string),
        sha512: hashes.and_then(|h| h.get("sha512")).and_then(Value::as_str).map(str::to_string),
    };
    let deps = chosen
        .get("dependencies")
        .and_then(Value::as_array)
        .map(|d| {
            d.iter()
                .filter(|x| x.get("dependency_type").and_then(Value::as_str) == Some("required"))
                .filter_map(|x| x.get("project_id").and_then(Value::as_str))
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();
    Ok((spec, deps))
}

fn modrinth_versions(c: &reqwest::blocking::Client, project: &str, mc: &str, loader: &str) -> Result<Value, String> {
    if project.is_empty() || !project.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_') {
        return Err("That mod id looks wrong.".to_string());
    }
    let games = serde_json::json!([mc]).to_string();
    let loaders = serde_json::json!([loader]).to_string();
    let url = Url::parse_with_params(
        &format!("{MODRINTH_API}/project/{project}/version"),
        &[("game_versions", games.as_str()), ("loaders", loaders.as_str())],
    )
    .map_err(|e| format!("Bad address: {e}"))?;
    get_json(c, url, None)
}

// ----------------------------------------------------------- CurseForge

pub fn parse_curseforge_hits(v: &Value) -> SearchResult {
    let hits = v
        .get("data")
        .and_then(Value::as_array)
        .map(|list| {
            list.iter()
                .filter_map(|h| {
                    let id = h.get("id")?.as_u64()?.to_string();
                    Some(ModHit {
                        provider: "curseforge",
                        id,
                        title: h.get("name")?.as_str()?.to_string(),
                        description: h.get("summary").and_then(Value::as_str).unwrap_or("").to_string(),
                        author: h
                            .get("authors")
                            .and_then(Value::as_array)
                            .and_then(|a| a.first())
                            .and_then(|a| a.get("name"))
                            .and_then(Value::as_str)
                            .unwrap_or("")
                            .to_string(),
                        downloads: h.get("downloadCount").and_then(Value::as_f64).unwrap_or(0.0) as u64,
                        icon_url: h
                            .get("logo")
                            .and_then(|l| l.get("thumbnailUrl"))
                            .and_then(Value::as_str)
                            .filter(|u| u.starts_with("https://media.forgecdn.net/") || u.starts_with("https://cdn.modrinth.com/"))
                            .map(str::to_string),
                        page_url: h
                            .get("links")
                            .and_then(|l| l.get("websiteUrl"))
                            .and_then(Value::as_str)
                            .filter(|u| u.starts_with("https://www.curseforge.com/"))
                            .map(str::to_string),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    let total = v
        .get("pagination")
        .and_then(|p| p.get("totalCount"))
        .and_then(Value::as_u64)
        .unwrap_or(0);
    SearchResult { hits, total }
}

fn curseforge_spec(files: &Value) -> Result<(FileSpec, Vec<String>), String> {
    let list = files.get("data").and_then(Value::as_array).ok_or("CurseForge's answer was not a file list.")?;
    let chosen = list
        .iter()
        .find(|f| f.get("releaseType").and_then(Value::as_u64) == Some(1))
        .or_else(|| list.first())
        .ok_or("No file of this mod is available for the chosen Minecraft version and loader.")?;
    let url = chosen
        .get("downloadUrl")
        .and_then(Value::as_str)
        .ok_or("The author of this mod does not allow downloads outside CurseForge. Download it from their page instead.")?;
    let name = chosen.get("fileName").and_then(Value::as_str).unwrap_or("");
    let name = safe_jar_name(name).ok_or("The mod file has an unusual name, so it was not downloaded.")?;
    let sha1 = chosen
        .get("hashes")
        .and_then(Value::as_array)
        .and_then(|hs| hs.iter().find(|h| h.get("algo").and_then(Value::as_u64) == Some(1)))
        .and_then(|h| h.get("value"))
        .and_then(Value::as_str)
        .map(str::to_string);
    let deps = chosen
        .get("dependencies")
        .and_then(Value::as_array)
        .map(|d| {
            d.iter()
                .filter(|x| x.get("relationType").and_then(Value::as_u64) == Some(3))
                .filter_map(|x| x.get("modId").and_then(Value::as_u64))
                .map(|id| id.to_string())
                .collect()
        })
        .unwrap_or_default();
    Ok((FileSpec { name, url: url.to_string(), sha1, sha512: None }, deps))
}

fn curseforge_files(c: &reqwest::blocking::Client, key: &str, project: &str, mc: &str) -> Result<Value, String> {
    if project.is_empty() || !project.chars().all(|ch| ch.is_ascii_digit()) {
        return Err("That mod id looks wrong.".to_string());
    }
    let url = Url::parse_with_params(
        &format!("{CURSEFORGE_API}/mods/{project}/files"),
        &[("gameVersion", mc), ("modLoaderType", CURSEFORGE_FABRIC), ("pageSize", "10")],
    )
    .map_err(|e| format!("Bad address: {e}"))?;
    get_json(c, url, Some(key))
}

// ---------------------------------------------------------------- public

/// Search a provider. Only Fabric mods are listed (the loader the launcher installs).
pub fn search(
    provider: Provider,
    query: &str,
    mc: &str,
    offset: u32,
    cf_key: Option<&str>,
) -> Result<SearchResult, String> {
    let c = client()?;
    let query = query.trim();
    match provider {
        Provider::Modrinth => {
            let facets = modrinth_facets(mc, "fabric");
            let limit = PAGE_SIZE.to_string();
            let off = offset.to_string();
            let index = if query.is_empty() { "downloads" } else { "relevance" };
            let url = Url::parse_with_params(
                &format!("{MODRINTH_API}/search"),
                &[
                    ("query", query),
                    ("facets", facets.as_str()),
                    ("limit", limit.as_str()),
                    ("offset", off.as_str()),
                    ("index", index),
                ],
            )
            .map_err(|e| format!("Bad address: {e}"))?;
            Ok(parse_modrinth_hits(&get_json(&c, url, None)?))
        }
        Provider::CurseForge => {
            let key = cf_key.ok_or("CurseForge search needs an API key, which this build does not include.")?;
            let size = PAGE_SIZE.to_string();
            let off = offset.to_string();
            let url = Url::parse_with_params(
                &format!("{CURSEFORGE_API}/mods/search"),
                &[
                    ("gameId", CURSEFORGE_GAME_ID),
                    ("classId", CURSEFORGE_MODS_CLASS),
                    ("searchFilter", query),
                    ("gameVersion", mc),
                    ("modLoaderType", CURSEFORGE_FABRIC),
                    ("sortField", "2"),
                    ("sortOrder", "desc"),
                    ("pageSize", size.as_str()),
                    ("index", off.as_str()),
                ],
            )
            .map_err(|e| format!("Bad address: {e}"))?;
            Ok(parse_curseforge_hits(&get_json(&c, url, Some(key))?))
        }
    }
}

/// Install a mod and the mods it requires into `mods_dir`.
pub fn install(
    provider: Provider,
    project: &str,
    mc: &str,
    mods_dir: &Path,
    cf_key: Option<&str>,
) -> Result<InstallReport, String> {
    let c = client()?;
    fs::create_dir_all(mods_dir).map_err(|e| format!("Could not create the mods folder: {e}"))?;
    let mut report = InstallReport::default();
    let mut queue: Vec<String> = vec![project.to_string()];
    let mut seen: Vec<String> = Vec::new();

    while let Some(current) = queue.pop() {
        if seen.contains(&current) {
            continue;
        }
        if seen.len() >= MAX_INSTALLS {
            return Err("This mod needs too many other mods; nothing more was installed.".to_string());
        }
        seen.push(current.clone());

        let (spec, deps) = match provider {
            Provider::Modrinth => modrinth_spec(&modrinth_versions(&c, &current, mc, "fabric")?)?,
            Provider::CurseForge => {
                let key = cf_key.ok_or("CurseForge needs an API key, which this build does not include.")?;
                curseforge_spec(&curseforge_files(&c, key, &current, mc)?)?
            }
        };
        let dest = mods_dir.join(&spec.name);
        if dest.is_file() {
            report.present.push(spec.name);
        } else {
            download_mod(&c, &spec, &dest)?;
            report.installed.push(spec.name);
        }
        queue.extend(deps);
    }
    Ok(report)
}

pub fn list_installed(mods_dir: &Path) -> Vec<InstalledMod> {
    let mut out: Vec<InstalledMod> = fs::read_dir(mods_dir)
        .map(|rd| {
            rd.filter_map(|e| e.ok())
                .filter_map(|e| {
                    let name = e.file_name().to_string_lossy().to_string();
                    let meta = e.metadata().ok()?;
                    (meta.is_file() && name.to_ascii_lowercase().ends_with(".jar"))
                        .then(|| InstalledMod { file_name: name, size: meta.len() })
                })
                .collect()
        })
        .unwrap_or_default();
    out.sort_by(|a, b| a.file_name.to_lowercase().cmp(&b.file_name.to_lowercase()));
    out
}

pub fn remove(mods_dir: &Path, file_name: &str) -> Result<(), String> {
    let name = safe_jar_name(file_name).ok_or("That is not a mod file name.")?;
    let path: PathBuf = mods_dir.join(name);
    if !path.is_file() {
        return Err("That mod is not installed any more.".to_string());
    }
    fs::remove_file(&path).map_err(|e| format!("Could not remove the mod: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn only_known_mod_hosts_over_https() {
        let ok = |u: &str| is_allowed_url(&Url::parse(u).unwrap());
        assert!(ok("https://api.modrinth.com/v2/search"));
        assert!(ok("https://cdn.modrinth.com/data/x/versions/y/a.jar"));
        assert!(ok("https://edge.forgecdn.net/files/1/2/a.jar"));
        assert!(!ok("http://api.modrinth.com/v2/search"));
        assert!(!ok("https://api.modrinth.com.evil.net/x"));
        assert!(!ok("https://github.com/x.jar"));
    }

    #[test]
    fn jar_names_cannot_escape_the_mods_folder() {
        assert_eq!(safe_jar_name("sodium-fabric-0.6.jar").as_deref(), Some("sodium-fabric-0.6.jar"));
        for bad in ["", "a.txt", "../a.jar", "a/b.jar", "a\\b.jar", ".hidden.jar", "C:evil.jar", "a..b.jar", "a\nb.jar"] {
            assert!(safe_jar_name(bad).is_none(), "{bad:?}");
        }
    }

    #[test]
    fn modrinth_search_is_limited_to_fabric_mods_for_the_version() {
        let facets: Value = serde_json::from_str(&modrinth_facets("1.21.11", "fabric")).unwrap();
        assert_eq!(facets[0][0], "project_type:mod");
        assert_eq!(facets[1][0], "versions:1.21.11");
        assert_eq!(facets[2][0], "categories:fabric");
    }

    #[test]
    fn modrinth_hits_are_read_and_icons_restricted() {
        let v = json!({"total_hits": 2, "hits": [
            {"project_id":"AANobbMI","slug":"sodium","title":"Sodium","description":"Fast","author":"jellysquid3","downloads":1000,"icon_url":"https://cdn.modrinth.com/i.png"},
            {"project_id":"x","title":"Odd","icon_url":"https://evil.example.com/i.png"},
            {"title":"No id"}]});
        let r = parse_modrinth_hits(&v);
        assert_eq!(r.total, 2);
        assert_eq!(r.hits.len(), 2);
        assert_eq!(r.hits[0].page_url.as_deref(), Some("https://modrinth.com/mod/sodium"));
        assert!(r.hits[0].icon_url.is_some());
        assert!(r.hits[1].icon_url.is_none());
        assert!(r.hits[1].page_url.is_none());
    }

    #[test]
    fn modrinth_picks_a_release_primary_file_and_required_dependencies() {
        let versions = json!([
            {"version_type":"beta","files":[{"filename":"m-beta.jar","url":"https://cdn.modrinth.com/b.jar","hashes":{"sha512":"b"}}],"dependencies":[]},
            {"version_type":"release","dependencies":[
                {"project_id":"P1","dependency_type":"required"},
                {"project_id":"P2","dependency_type":"optional"}],
             "files":[
                {"filename":"m-sources.jar","url":"https://cdn.modrinth.com/s.jar","hashes":{"sha512":"s"}},
                {"filename":"m-1.0.jar","primary":true,"url":"https://cdn.modrinth.com/a.jar","hashes":{"sha1":"1","sha512":"5"}}]}]);
        let (spec, deps) = modrinth_spec(&versions).unwrap();
        assert_eq!(spec.name, "m-1.0.jar");
        assert_eq!(spec.sha512.as_deref(), Some("5"));
        assert_eq!(deps, vec!["P1"]);
        assert!(modrinth_spec(&json!([])).is_err());
        let evil = json!([{"version_type":"release","files":[{"filename":"../x.jar","url":"https://cdn.modrinth.com/a.jar","hashes":{}}]}]);
        assert!(modrinth_spec(&evil).is_err());
    }

    #[test]
    fn curseforge_results_and_files_are_read() {
        let hits = json!({"pagination":{"totalCount":5},"data":[
            {"id":394468,"name":"Sodium","summary":"Fast","authors":[{"name":"jellysquid3"}],"downloadCount":1.5e7,
             "logo":{"thumbnailUrl":"https://media.forgecdn.net/a.png"},"links":{"websiteUrl":"https://www.curseforge.com/minecraft/mc-mods/sodium"}}]});
        let r = parse_curseforge_hits(&hits);
        assert_eq!(r.total, 5);
        assert_eq!(r.hits[0].id, "394468");
        assert_eq!(r.hits[0].downloads, 15_000_000);

        let files = json!({"data":[
            {"releaseType":2,"fileName":"b.jar","downloadUrl":"https://edge.forgecdn.net/b.jar","hashes":[{"algo":1,"value":"bb"}]},
            {"releaseType":1,"fileName":"a.jar","downloadUrl":"https://edge.forgecdn.net/a.jar","hashes":[{"algo":2,"value":"md5"},{"algo":1,"value":"aa"}],
             "dependencies":[{"modId":306612,"relationType":3},{"modId":1,"relationType":2}]}]});
        let (spec, deps) = curseforge_spec(&files).unwrap();
        assert_eq!(spec.name, "a.jar");
        assert_eq!(spec.sha1.as_deref(), Some("aa"));
        assert_eq!(deps, vec!["306612"]);

        let blocked = json!({"data":[{"releaseType":1,"fileName":"a.jar","downloadUrl":null,"hashes":[]}]});
        assert!(curseforge_spec(&blocked).unwrap_err().contains("does not allow downloads"));
    }

    #[test]
    fn curseforge_search_needs_a_key() {
        let err = search(Provider::CurseForge, "sodium", "1.21.11", 0, None).unwrap_err();
        assert!(err.contains("API key"));
        assert!(Provider::parse("nope").is_none());
    }

    #[test]
    fn mod_ids_are_checked_before_any_request() {
        let c = client().unwrap();
        assert!(modrinth_versions(&c, "../etc", "1.21.11", "fabric").is_err());
        assert!(curseforge_files(&c, "k", "12ab", "1.21.11").is_err());
    }

    #[test]
    fn installed_mods_can_be_listed_and_removed() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("b.jar"), "xx").unwrap();
        fs::write(dir.path().join("A.jar"), "x").unwrap();
        fs::write(dir.path().join("notes.txt"), "x").unwrap();
        let list = list_installed(dir.path());
        assert_eq!(list.iter().map(|m| m.file_name.as_str()).collect::<Vec<_>>(), vec!["A.jar", "b.jar"]);
        assert!(remove(dir.path(), "../b.jar").is_err());
        assert!(remove(dir.path(), "notes.txt").is_err());
        remove(dir.path(), "b.jar").unwrap();
        assert!(remove(dir.path(), "b.jar").is_err());
        assert_eq!(list_installed(dir.path()).len(), 1);
    }
}
