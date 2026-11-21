//! Texture packs: browse Modrinth and CurseForge, install a pack into the
//! instance's `resourcepacks` folder, and manage what is already there.
//!
//! A downloaded pack is checked before it is used: it has to be a readable ZIP
//! with a `pack.mcmeta` at its root (or one folder down). A pack is never
//! switched on without the player asking for it.

use reqwest::Url;
use serde::Serialize;
use serde_json::Value;
use sha1::{Digest, Sha1};
use sha2::Sha512;
use std::fs::{self, File};
use std::io::{Read, Seek, Write};
use std::path::{Path, PathBuf};

use crate::mods::{client, curseforge_sort_field, get_json, modrinth_index, net_error, Provider};

pub const MODRINTH_API: &str = "https://api.modrinth.com/v2";
pub const CURSEFORGE_API: &str = "https://api.curseforge.com/v1";
/// CurseForge's class for resource packs.
pub const CURSEFORGE_PACK_CLASS: &str = "12";
const CURSEFORGE_GAME_ID: &str = "432";
const PAGE_SIZE: u32 = 20;
const MAX_PACK_BYTES: u64 = 256 * 1024 * 1024;
const MAX_ICON_BYTES: u64 = 512 * 1024;
const MAX_META_BYTES: u64 = 256 * 1024;
const MAX_DESCRIPTION_CHARS: usize = 4000;

/// The resolutions Modrinth and CurseForge use as categories for texture packs.
pub const RESOLUTIONS: &[&str] = &["8x", "16x", "32x", "48x", "64x", "128x", "256x", "512x"];

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PackHit {
    pub provider: &'static str,
    pub id: String,
    pub title: String,
    pub description: String,
    pub author: String,
    pub downloads: u64,
    pub icon_url: Option<String>,
    pub page_url: Option<String>,
    /// Detected from the pack's categories ("64x" and so on), when the site says.
    pub resolution: Option<String>,
}

#[derive(Serialize, Debug, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct PackSearchResult {
    pub hits: Vec<PackHit>,
    pub total: u64,
}

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PackDetails {
    pub provider: &'static str,
    pub id: String,
    pub title: String,
    pub description: String,
    /// The pack's own description as plain text, when the site publishes one.
    pub long_description: Option<String>,
    pub author: String,
    pub downloads: u64,
    pub icon_url: Option<String>,
    pub page_url: Option<String>,
    /// Large preview pictures, in the site's own order.
    pub gallery: Vec<String>,
    /// Minecraft versions the pack is published for.
    pub versions: Vec<String>,
    pub resolution: Option<String>,
    pub file_name: Option<String>,
    pub file_size: Option<u64>,
}

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPack {
    pub file_name: String,
    pub size: u64,
    pub description: Option<String>,
    pub pack_format: Option<u32>,
    /// Whether Minecraft's options list this pack as active.
    pub enabled: bool,
    pub icon: Option<String>,
}

/// What a pack's own `pack.mcmeta` says.
#[derive(Debug, Default, PartialEq)]
pub struct PackMeta {
    pub pack_format: Option<u32>,
    pub description: Option<String>,
    pub icon: Option<String>,
}

// --------------------------------------------------------------- helpers

/// A resource pack file name that is safe to create inside `resourcepacks`.
pub fn safe_pack_name(name: &str) -> Option<String> {
    let ok = !name.is_empty()
        && name.len() <= 150
        && name.to_ascii_lowercase().ends_with(".zip")
        && !name.starts_with('.')
        && !name.contains("..")
        && name.chars().all(|c| {
            !c.is_control() && !matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')
        });
    ok.then(|| name.to_string())
}

/// `"64x"` out of a pack's categories, whichever category carries it.
pub fn resolution_of(categories: &[String]) -> Option<String> {
    categories.iter().find_map(|category| {
        let text = category.trim().to_ascii_lowercase();
        let digits = text.strip_suffix('x')?;
        digits.parse::<u32>().ok().map(|n| format!("{n}x"))
    })
}

fn looks_like_minecraft_version(text: &str) -> bool {
    !text.is_empty()
        && text.len() <= 20
        && text.starts_with(|c: char| c.is_ascii_digit())
        && text.contains('.')
}

/// The pack description from a `pack.mcmeta` (a string or a chat component).
fn description_of(value: &Value) -> Option<String> {
    match value {
        Value::String(s) => {
            let s = s.trim();
            (!s.is_empty()).then(|| s.chars().take(300).collect())
        }
        Value::Array(list) => list.iter().find_map(description_of),
        Value::Object(_) => value
            .get("text")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.chars().take(300).collect())
            .or_else(|| value.get("translate").and_then(Value::as_str).map(|s| s.to_string())),
        _ => None,
    }
}

fn first_number(value: &Value) -> Option<u32> {
    match value {
        Value::Number(n) => n.as_u64().map(|n| n as u32),
        Value::Array(list) => list.iter().find_map(first_number),
        Value::Object(map) => map
            .get("min_inclusive")
            .and_then(first_number)
            .or_else(|| map.get("min_format").and_then(first_number))
            .or_else(|| map.get("pack_format").and_then(first_number))
            .or_else(|| map.get("max_inclusive").and_then(first_number)),
        _ => None,
    }
}

/// Removes HTML tags and decodes the few entities CurseForge descriptions use.
pub fn html_to_text(html: &str) -> String {
    let mut out = String::new();
    let mut in_tag = false;
    let mut tag = String::new();
    for c in html.chars() {
        if in_tag {
            if c == '>' {
                in_tag = false;
                let name = tag.trim_start_matches('/').split_whitespace().next().unwrap_or("").to_ascii_lowercase();
                if matches!(
                    name.as_str(),
                    "br" | "p" | "div" | "li" | "tr" | "ul" | "ol" | "blockquote" | "pre" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
                ) {
                    out.push('\n');
                }
                tag.clear();
            } else {
                tag.push(c);
            }
        } else if c == '<' {
            in_tag = true;
            tag.clear();
        } else {
            out.push(c);
        }
    }
    let decoded = out
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ");
    let mut text = String::new();
    for line in decoded.lines() {
        let line = line.trim_end();
        if line.trim().is_empty() && text.ends_with('\n') {
            continue;
        }
        text.push_str(line);
        text.push('\n');
    }
    text.trim().chars().take(MAX_DESCRIPTION_CHARS).collect()
}

// ------------------------------------------------------------ pack.mcmeta

fn meta_entry_name<R: Read + Seek>(zip: &mut zip::ZipArchive<R>) -> Option<String> {
    let mut found: Option<String> = None;
    for index in 0..zip.len() {
        let name = {
            let entry = zip.by_index(index).ok()?;
            entry.name().to_string()
        };
        let lower = name.to_ascii_lowercase();
        let at_root = lower == "pack.mcmeta";
        let one_folder_down = lower.ends_with("/pack.mcmeta") && lower.matches('/').count() == 1;
        if at_root || one_folder_down {
            if found.as_ref().map(|best| name.len() < best.len()).unwrap_or(true) {
                found = Some(name);
            }
        }
    }
    found
}

fn read_meta_from<R: Read + Seek>(zip: &mut zip::ZipArchive<R>) -> Result<PackMeta, String> {
    let Some(name) = meta_entry_name(zip) else {
        return Err("This archive has no pack.mcmeta, so it is not a Minecraft resource pack.".to_string());
    };
    let text = {
        let entry = zip
            .by_name(&name)
            .map_err(|e| format!("The pack could not be read: {e}"))?;
        let mut bytes = Vec::new();
        entry
            .take(MAX_META_BYTES)
            .read_to_end(&mut bytes)
            .map_err(|e| format!("The pack could not be read: {e}"))?;
        String::from_utf8_lossy(&bytes).to_string()
    };
    let json: Value = serde_json::from_str(text.trim_start_matches('\u{feff}'))
        .map_err(|_| "The pack.mcmeta in this archive could not be read.".to_string())?;
    let pack = json.get("pack");
    let pack_format = pack.and_then(|p| p.get("pack_format").or_else(|| p.get("min_format"))).and_then(first_number);
    let description = pack.and_then(|p| p.get("description")).and_then(description_of);

    // The icon sits next to pack.mcmeta, at the root of the pack.
    let folder = name.trim_end_matches("pack.mcmeta");
    let icon_name = format!("{folder}pack.png");
    let icon = zip
        .by_name(&icon_name)
        .ok()
        .and_then(|entry| {
            let mut png = Vec::new();
            entry.take(MAX_ICON_BYTES).read_to_end(&mut png).ok()?;
            png.starts_with(&[0x89, b'P', b'N', b'G']).then(|| crate::skins::png_data_url(&png))
        });
    Ok(PackMeta { pack_format, description, icon })
}

/// Reads `pack.mcmeta` from a ZIP in memory. Used for uploads and in tests.
pub fn read_pack_bytes(bytes: &[u8]) -> Result<PackMeta, String> {
    let mut zip = zip::ZipArchive::new(std::io::Cursor::new(bytes))
        .map_err(|_| "This archive is not a readable ZIP file.".to_string())?;
    read_meta_from(&mut zip)
}

/// Reads `pack.mcmeta` from a ZIP file on disk.
pub fn read_pack_file(path: &Path) -> Result<PackMeta, String> {
    let file = File::open(path).map_err(|e| format!("The pack could not be opened: {e}"))?;
    let mut zip = zip::ZipArchive::new(file).map_err(|_| "The file is not a readable ZIP file.".to_string())?;
    read_meta_from(&mut zip)
}

// --------------------------------------------------------------- browsing

/// Facets for a Modrinth texture pack search.
pub fn modrinth_pack_facets(mc: &str, resolution: Option<&str>) -> String {
    let mut groups = vec![
        serde_json::json!(["project_type:resourcepack"]),
        serde_json::json!([format!("versions:{mc}")]),
    ];
    if let Some(res) = resolution.filter(|r| RESOLUTIONS.contains(r)) {
        groups.push(serde_json::json!([format!("categories:{res}")]));
    }
    serde_json::Value::Array(groups).to_string()
}

pub fn parse_modrinth_packs(value: &Value) -> PackSearchResult {
    let hits = value
        .get("hits")
        .and_then(Value::as_array)
        .map(|list| {
            list.iter()
                .filter_map(|hit| {
                    let id = hit.get("project_id")?.as_str()?.to_string();
                    let slug = hit.get("slug").and_then(Value::as_str).unwrap_or("");
                    let categories = hit
                        .get("categories")
                        .and_then(Value::as_array)
                        .map(|list| list.iter().filter_map(Value::as_str).map(str::to_string).collect::<Vec<_>>())
                        .unwrap_or_default();
                    Some(PackHit {
                        provider: "modrinth",
                        id,
                        title: hit.get("title")?.as_str()?.to_string(),
                        description: hit.get("description").and_then(Value::as_str).unwrap_or("").to_string(),
                        author: hit.get("author").and_then(Value::as_str).unwrap_or("").to_string(),
                        downloads: hit.get("downloads").and_then(Value::as_u64).unwrap_or(0),
                        icon_url: hit
                            .get("icon_url")
                            .and_then(Value::as_str)
                            .filter(|u| u.starts_with("https://cdn.modrinth.com/"))
                            .map(str::to_string),
                        page_url: (!slug.is_empty()).then(|| format!("https://modrinth.com/resourcepack/{slug}")),
                        resolution: resolution_of(&categories),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    PackSearchResult { hits, total: value.get("total_hits").and_then(Value::as_u64).unwrap_or(0) }
}

pub fn parse_curseforge_packs(value: &Value) -> PackSearchResult {
    let hits = value
        .get("data")
        .and_then(Value::as_array)
        .map(|list| {
            list.iter()
                .filter_map(|hit| {
                    let id = hit.get("id")?.as_u64()?.to_string();
                    let categories = hit
                        .get("categories")
                        .and_then(Value::as_array)
                        .map(|list| {
                            list.iter()
                                .filter_map(|c| c.get("name").and_then(Value::as_str).map(str::to_string))
                                .collect::<Vec<_>>()
                        })
                        .unwrap_or_default();
                    Some(PackHit {
                        provider: "curseforge",
                        id,
                        title: hit.get("name")?.as_str()?.to_string(),
                        description: hit.get("summary").and_then(Value::as_str).unwrap_or("").to_string(),
                        author: hit
                            .get("authors")
                            .and_then(Value::as_array)
                            .and_then(|a| a.first())
                            .and_then(|a| a.get("name"))
                            .and_then(Value::as_str)
                            .unwrap_or("")
                            .to_string(),
                        downloads: hit.get("downloadCount").and_then(Value::as_f64).unwrap_or(0.0) as u64,
                        icon_url: hit
                            .get("logo")
                            .and_then(|l| l.get("thumbnailUrl"))
                            .and_then(Value::as_str)
                            .filter(|u| {
                                u.starts_with("https://media.forgecdn.net/")
                                    || u.starts_with("https://mediafilez.forgecdn.net/")
                            })
                            .map(str::to_string),
                        page_url: hit
                            .get("links")
                            .and_then(|l| l.get("websiteUrl"))
                            .and_then(Value::as_str)
                            .filter(|u| u.starts_with("https://www.curseforge.com/"))
                            .map(str::to_string),
                        resolution: resolution_of(&categories),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    let total = value
        .get("pagination")
        .and_then(|p| p.get("totalCount"))
        .and_then(Value::as_u64)
        .unwrap_or(0);
    PackSearchResult { hits, total }
}

fn clean_project_id(id: &str) -> Result<&str, String> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err("That pack id looks wrong.".to_string());
    }
    Ok(id)
}

fn clean_curseforge_id(id: &str) -> Result<&str, String> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_digit()) {
        return Err("That pack id looks wrong.".to_string());
    }
    Ok(id)
}

/// Search a provider for texture packs for `mc`.
pub fn search(
    provider: Provider,
    query: &str,
    mc: &str,
    offset: u32,
    resolution: Option<&str>,
    sort: Option<&str>,
    cf_key: Option<&str>,
) -> Result<PackSearchResult, String> {
    let c = client()?;
    let query = query.trim();
    match provider {
        Provider::Modrinth => {
            let facets = modrinth_pack_facets(mc, resolution);
            let limit = PAGE_SIZE.to_string();
            let off = offset.to_string();
            let index = modrinth_index(sort, query.is_empty());
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
            Ok(parse_modrinth_packs(&get_json(&c, url, None)?))
        }
        Provider::CurseForge => {
            let key = cf_key.ok_or("CurseForge search needs an API key, which this build does not include.")?;
            let size = PAGE_SIZE.to_string();
            let off = offset.to_string();
            let url = Url::parse_with_params(
                &format!("{CURSEFORGE_API}/mods/search"),
                &[
                    ("gameId", CURSEFORGE_GAME_ID),
                    ("classId", CURSEFORGE_PACK_CLASS),
                    ("searchFilter", query),
                    ("gameVersion", mc),
                    ("sortField", curseforge_sort_field(sort)),
                    ("sortOrder", "desc"),
                    ("pageSize", size.as_str()),
                    ("index", off.as_str()),
                ],
            )
            .map_err(|e| format!("Bad address: {e}"))?;
            Ok(parse_curseforge_packs(&get_json(&c, url, Some(key))?))
        }
    }
}

fn unique_versions(list: impl Iterator<Item = String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for version in list {
        if looks_like_minecraft_version(&version) && !out.contains(&version) {
            out.push(version);
        }
    }
    out.truncate(24);
    out
}

/// Everything a pack's details view shows, plus the file an install would use.
pub fn details(provider: Provider, id: &str, mc: &str, cf_key: Option<&str>) -> Result<PackDetails, String> {
    let c = client()?;
    match provider {
        Provider::Modrinth => {
            let id = clean_project_id(id)?;
            let project = get_json(&c, Url::parse(&format!("{MODRINTH_API}/project/{id}")).map_err(|e| e.to_string())?, None)?;
            let versions = project
                .get("game_versions")
                .and_then(Value::as_array)
                .map(|list| unique_versions(list.iter().filter_map(Value::as_str).map(str::to_string)))
                .unwrap_or_default();
            let gallery = project
                .get("gallery")
                .and_then(Value::as_array)
                .map(|list| {
                    list.iter()
                        .filter_map(|image| image.get("url").and_then(Value::as_str))
                        .filter(|url| url.starts_with("https://cdn.modrinth.com/"))
                        .take(8)
                        .map(str::to_string)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            let (file_name, file_size) = modrinth_pack_file(&c, id, mc)?;
            Ok(PackDetails {
                provider: "modrinth",
                id: id.to_string(),
                title: project.get("title").and_then(Value::as_str).unwrap_or("").to_string(),
                description: project.get("description").and_then(Value::as_str).unwrap_or("").to_string(),
                long_description: project
                    .get("body")
                    .and_then(Value::as_str)
                    .map(html_to_text)
                    .filter(|text| !text.is_empty()),
                author: project.get("organization").and_then(Value::as_str).unwrap_or("").to_string(),
                downloads: project.get("downloads").and_then(Value::as_u64).unwrap_or(0),
                icon_url: project
                    .get("icon_url")
                    .and_then(Value::as_str)
                    .filter(|u| u.starts_with("https://cdn.modrinth.com/"))
                    .map(str::to_string),
                page_url: project
                    .get("slug")
                    .and_then(Value::as_str)
                    .map(|slug| format!("https://modrinth.com/resourcepack/{slug}")),
                gallery,
                versions,
                resolution: resolution_of(
                    &project
                        .get("categories")
                        .and_then(Value::as_array)
                        .map(|list| list.iter().filter_map(Value::as_str).map(str::to_string).collect::<Vec<_>>())
                        .unwrap_or_default(),
                ),
                file_name,
                file_size,
            })
        }
        Provider::CurseForge => {
            let id = clean_curseforge_id(id)?;
            let key = cf_key.ok_or("CurseForge needs an API key, which this build does not include.")?;
            let project = get_json(
                &c,
                Url::parse(&format!("{CURSEFORGE_API}/mods/{id}")).map_err(|e| e.to_string())?,
                Some(key),
            )?;
            let data = project.get("data").cloned().unwrap_or(Value::Null);
            let file = curseforge_pack_file(&c, key, id, mc)?;
            let versions = file
                .as_ref()
                .and_then(|f| f.get("gameVersions"))
                .and_then(Value::as_array)
                .map(|list| unique_versions(list.iter().filter_map(Value::as_str).map(str::to_string)))
                .unwrap_or_default();
            let gallery = data
                .get("screenshots")
                .and_then(Value::as_array)
                .map(|list| {
                    list.iter()
                        .filter_map(|s| s.get("url").and_then(Value::as_str))
                        .filter(|url| url.starts_with("https://media.forgecdn.net/") || url.starts_with("https://mediafilez.forgecdn.net/"))
                        .take(8)
                        .map(str::to_string)
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            let categories = data
                .get("categories")
                .and_then(Value::as_array)
                .map(|list| {
                    list.iter()
                        .filter_map(|c| c.get("name").and_then(Value::as_str).map(str::to_string))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            Ok(PackDetails {
                provider: "curseforge",
                id: id.to_string(),
                title: data.get("name").and_then(Value::as_str).unwrap_or("").to_string(),
                description: data.get("summary").and_then(Value::as_str).unwrap_or("").to_string(),
                long_description: data
                    .get("description")
                    .and_then(Value::as_str)
                    .map(html_to_text)
                    .filter(|text| !text.is_empty()),
                author: data
                    .get("authors")
                    .and_then(Value::as_array)
                    .and_then(|a| a.first())
                    .and_then(|a| a.get("name"))
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
                downloads: data.get("downloadCount").and_then(Value::as_f64).unwrap_or(0.0) as u64,
                icon_url: data
                    .get("logo")
                    .and_then(|l| l.get("thumbnailUrl"))
                    .and_then(Value::as_str)
                    .filter(|u| u.starts_with("https://media.forgecdn.net/") || u.starts_with("https://mediafilez.forgecdn.net/"))
                    .map(str::to_string),
                page_url: data
                    .get("links")
                    .and_then(|l| l.get("websiteUrl"))
                    .and_then(Value::as_str)
                    .filter(|u| u.starts_with("https://www.curseforge.com/"))
                    .map(str::to_string),
                gallery,
                versions,
                resolution: resolution_of(&categories),
                file_name: file.as_ref().and_then(|f| f.get("fileName")).and_then(Value::as_str).map(str::to_string),
                file_size: file.as_ref().and_then(|f| f.get("fileLength")).and_then(Value::as_u64),
            })
        }
    }
}

// ------------------------------------------------------------------ files

struct FileSpec {
    name: String,
    url: String,
    sha1: Option<String>,
    sha512: Option<String>,
    size: Option<u64>,
}

/// Chooses the newest release file of a Modrinth pack for `mc`.
fn modrinth_pack_file(
    c: &reqwest::blocking::Client,
    project: &str,
    mc: &str,
) -> Result<(Option<String>, Option<u64>), String> {
    let games = serde_json::json!([mc]).to_string();
    let loaders = serde_json::json!(["minecraft"]).to_string();
    let url = Url::parse_with_params(
        &format!("{MODRINTH_API}/project/{project}/version"),
        &[("game_versions", games.as_str()), ("loaders", loaders.as_str())],
    )
    .map_err(|e| format!("Bad address: {e}"))?;
    let versions = match get_json(c, url, None) {
        Ok(value) => value,
        // A details view still works without a build for this version.
        Err(_) => return Ok((None, None)),
    };
    let Some(file) = best_modrinth_file(&versions) else { return Ok((None, None)) };
    Ok((
        file.get("filename").and_then(Value::as_str).map(str::to_string),
        file.get("size").and_then(Value::as_u64),
    ))
}

/// The chosen file of a version list: a release first, then anything.
fn best_modrinth_file(versions: &Value) -> Option<&Value> {
    let list = versions.as_array()?;
    let chosen = list
        .iter()
        .find(|v| v.get("version_type").and_then(Value::as_str) == Some("release"))
        .or_else(|| list.first())?;
    let files = chosen.get("files").and_then(Value::as_array)?;
    files
        .iter()
        .find(|f| f.get("primary").and_then(Value::as_bool) == Some(true))
        .or_else(|| files.first())
}

fn modrinth_spec(versions: &Value) -> Result<FileSpec, String> {
    let file = best_modrinth_file(versions)
        .ok_or("No file of this pack is available for the chosen Minecraft version.")?;
    let name = file.get("filename").and_then(Value::as_str).unwrap_or("");
    let name = safe_pack_name(name).ok_or("The pack file has an unusual name, so it was not downloaded.")?;
    let hashes = file.get("hashes");
    Ok(FileSpec {
        name,
        url: file.get("url").and_then(Value::as_str).unwrap_or("").to_string(),
        sha1: hashes.and_then(|h| h.get("sha1")).and_then(Value::as_str).map(str::to_string),
        sha512: hashes.and_then(|h| h.get("sha512")).and_then(Value::as_str).map(str::to_string),
        size: file.get("size").and_then(Value::as_u64),
    })
}

fn curseforge_pack_file(
    c: &reqwest::blocking::Client,
    key: &str,
    project: &str,
    mc: &str,
) -> Result<Option<Value>, String> {
    let url = Url::parse_with_params(
        &format!("{CURSEFORGE_API}/mods/{project}/files"),
        &[("gameVersion", mc), ("pageSize", "20")],
    )
    .map_err(|e| format!("Bad address: {e}"))?;
    let files = match get_json(c, url, Some(key)) {
        Ok(value) => value,
        Err(_) => return Ok(None),
    };
    let list = files.get("data").and_then(Value::as_array).cloned().unwrap_or_default();
    let chosen = list
        .iter()
        .find(|f| f.get("releaseType").and_then(Value::as_u64) == Some(1))
        .or_else(|| list.first())
        .cloned();
    Ok(chosen)
}

fn curseforge_spec(file: &Value) -> Result<FileSpec, String> {
    let url = file
        .get("downloadUrl")
        .and_then(Value::as_str)
        .ok_or("The author of this pack does not allow downloads outside CurseForge. Download it from their page instead.")?;
    let name = file.get("fileName").and_then(Value::as_str).unwrap_or("");
    let name = safe_pack_name(name).ok_or("The pack file has an unusual name, so it was not downloaded.")?;
    let sha1 = file
        .get("hashes")
        .and_then(Value::as_array)
        .and_then(|hashes| hashes.iter().find(|h| h.get("algo").and_then(Value::as_u64) == Some(1)))
        .and_then(|h| h.get("value"))
        .and_then(Value::as_str)
        .map(str::to_string);
    Ok(FileSpec {
        name,
        url: url.to_string(),
        sha1,
        sha512: None,
        size: file.get("fileLength").and_then(Value::as_u64),
    })
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn download(c: &reqwest::blocking::Client, spec: &FileSpec, dest: &Path) -> Result<(), String> {
    let url = Url::parse(&spec.url).map_err(|e| format!("Bad download address: {e}"))?;
    if !crate::mods::is_allowed_url(&url) {
        return Err("Refused to download from an address that is not a known pack site.".to_string());
    }
    if spec.sha1.is_none() && spec.sha512.is_none() {
        return Err("The pack site did not publish a checksum for this file, so it was not downloaded.".to_string());
    }
    if spec.size.map(|n| n > MAX_PACK_BYTES).unwrap_or(false) {
        return Err("This pack is larger than Cirrus downloads in one go.".to_string());
    }
    let resp = c.get(url).send().map_err(|e| net_error(&e))?;
    if !resp.status().is_success() {
        return Err(format!("The download server answered with an error ({}).", resp.status()));
    }
    if !crate::mods::is_allowed_url(resp.url()) {
        return Err("The download was redirected somewhere that is not allowed.".to_string());
    }
    if resp.content_length().map(|n| n > MAX_PACK_BYTES).unwrap_or(false) {
        return Err("This pack is larger than Cirrus downloads in one go.".to_string());
    }
    let part = dest.with_extension("zip.part");
    let result = (|| -> Result<(), String> {
        let mut out = File::create(&part).map_err(|e| format!("Could not create the file: {e}"))?;
        let mut resp = resp.take(MAX_PACK_BYTES + 1);
        let mut h1 = Sha1::new();
        let mut h512 = Sha512::new();
        let mut buffer = vec![0u8; 64 * 1024];
        let mut total: u64 = 0;
        loop {
            let n = resp.read(&mut buffer).map_err(|e| format!("The download was interrupted: {e}"))?;
            if n == 0 {
                break;
            }
            total += n as u64;
            if total > MAX_PACK_BYTES {
                return Err("This pack is larger than Cirrus downloads in one go.".to_string());
            }
            h1.update(&buffer[..n]);
            h512.update(&buffer[..n]);
            out.write_all(&buffer[..n]).map_err(|e| format!("Could not save the file: {e}"))?;
        }
        out.flush().map_err(|e| format!("Could not save the file: {e}"))?;
        if let Some(expected) = &spec.sha512 {
            if !hex(&h512.finalize()).eq_ignore_ascii_case(expected) {
                return Err("The downloaded pack did not match its checksum, so it was deleted and not used.".to_string());
            }
        } else if let Some(expected) = &spec.sha1 {
            if !hex(&h1.finalize()).eq_ignore_ascii_case(expected) {
                return Err("The downloaded pack did not match its checksum, so it was deleted and not used.".to_string());
            }
        }
        Ok(())
    })();
    if let Err(e) = result {
        let _ = fs::remove_file(&part);
        return Err(e);
    }
    fs::rename(&part, dest).map_err(|e| {
        let _ = fs::remove_file(&part);
        format!("Could not finish saving the file: {e}")
    })
}

/// Downloads a pack and installs it into `resourcepacks_dir`. The pack is left
/// switched off: turning it on is the player's choice.
pub fn install(
    provider: Provider,
    project: &str,
    mc: &str,
    resourcepacks_dir: &Path,
    cf_key: Option<&str>,
) -> Result<InstalledPack, String> {
    let c = client()?;
    let spec = match provider {
        Provider::Modrinth => {
            let id = clean_project_id(project)?;
            let games = serde_json::json!([mc]).to_string();
            let loaders = serde_json::json!(["minecraft"]).to_string();
            let url = Url::parse_with_params(
                &format!("{MODRINTH_API}/project/{id}/version"),
                &[("game_versions", games.as_str()), ("loaders", loaders.as_str())],
            )
            .map_err(|e| format!("Bad address: {e}"))?;
            modrinth_spec(&get_json(&c, url, None)?)?
        }
        Provider::CurseForge => {
            let id = clean_curseforge_id(project)?;
            let key = cf_key.ok_or("CurseForge needs an API key, which this build does not include.")?;
            let file = curseforge_pack_file(&c, key, id, mc)?
                .ok_or("No file of this pack is available for the chosen Minecraft version.")?;
            curseforge_spec(&file)?
        }
    };

    fs::create_dir_all(resourcepacks_dir).map_err(|e| format!("Could not create the resourcepacks folder: {e}"))?;
    let dest = resourcepacks_dir.join(&spec.name);
    if dest.exists() {
        return Err(format!("“{}” is already installed.", spec.name));
    }
    let staging = resourcepacks_dir.join(format!(".{}.download", std::process::id()));
    download(&c, &spec, &staging)?;
    let meta = match read_pack_file(&staging) {
        Ok(meta) => meta,
        Err(e) => {
            let _ = fs::remove_file(&staging);
            return Err(format!("The downloaded file is not a Minecraft resource pack: {e}"));
        }
    };
    fs::rename(&staging, &dest).map_err(|e| {
        let _ = fs::remove_file(&staging);
        format!("Could not finish saving the pack: {e}")
    })?;
    let size = fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
    Ok(InstalledPack {
        file_name: spec.name,
        size,
        description: meta.description,
        pack_format: meta.pack_format,
        enabled: false,
        icon: meta.icon,
    })
}

// ------------------------------------------------------------- installed

fn options_file(instance_dir: &Path) -> PathBuf {
    instance_dir.join("options.txt")
}

/// The pack names in `resourcePacks:[...]` of an options.txt.
pub fn active_packs(text: &str) -> Vec<String> {
    let line = text
        .lines()
        .find(|line| line.starts_with("resourcePacks:"));
    match line.and_then(|line| line.strip_prefix("resourcePacks:")) {
        Some(value) => parse_options_list(value),
        None => Vec::new(),
    }
}

fn parse_options_list(value: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut chars = value.chars();
    while let Some(c) = chars.next() {
        if c != '"' {
            continue;
        }
        let mut item = String::new();
        while let Some(c) = chars.next() {
            match c {
                '\\' => {
                    if let Some(next) = chars.next() {
                        item.push(next);
                    }
                }
                '"' => break,
                other => item.push(other),
            }
        }
        out.push(item);
    }
    out
}

fn quote_option(value: &str) -> String {
    let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
    format!("\"{escaped}\"")
}

/// Adds or removes `file/<file_name>` in the `resourcePacks` line of an
/// options.txt, leaving every other line exactly as it was.
pub fn update_packs_line(text: &str, file_name: &str, enabled: bool) -> String {
    let entry = format!("file/{file_name}");
    let mut lines: Vec<String> = text.lines().map(str::to_string).collect();
    let index = lines.iter().position(|line| line.starts_with("resourcePacks:"));
    let mut entries = index
        .and_then(|i| lines[i].strip_prefix("resourcePacks:"))
        .map(parse_options_list)
        .unwrap_or_default();
    if enabled {
        if !entries.iter().any(|e| e.eq_ignore_ascii_case(&entry)) {
            let after_vanilla = entries
                .iter()
                .position(|e| e.eq_ignore_ascii_case("vanilla"))
                .map(|p| p + 1)
                .unwrap_or(entries.len());
            entries.insert(after_vanilla, entry);
        }
    } else {
        if index.is_none() {
            // There is no line to edit; adding an empty one would switch every pack off.
            return text.to_string();
        }
        entries.retain(|e| !e.eq_ignore_ascii_case(&entry));
    }
    let line = format!(
        "resourcePacks:[{}]",
        entries.iter().map(|e| quote_option(e)).collect::<Vec<_>>().join(",")
    );
    match index {
        Some(i) => lines[i] = line,
        None => lines.push(line),
    }
    let mut out = lines.join("\n");
    out.push('\n');
    out
}

/// The zipped packs in a `resourcepacks` folder, with their metadata and whether
/// Minecraft's options list them as active.
pub fn list_installed(resourcepacks_dir: &Path, instance_dir: &Path) -> Vec<InstalledPack> {
    let options = fs::read_to_string(options_file(instance_dir)).unwrap_or_default();
    let active = active_packs(&options);
    let mut out: Vec<InstalledPack> = fs::read_dir(resourcepacks_dir)
        .map(|entries| {
            entries
                .filter_map(|entry| entry.ok())
                .filter_map(|entry| {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if !name.to_ascii_lowercase().ends_with(".zip") {
                        return None;
                    }
                    let meta = entry.metadata().ok()?;
                    if !meta.is_file() {
                        return None;
                    }
                    let info = read_pack_file(&entry.path()).ok()?;
                    let enabled = active.iter().any(|pack| pack.eq_ignore_ascii_case(&format!("file/{name}")));
                    Some(InstalledPack {
                        file_name: name,
                        size: meta.len(),
                        description: info.description,
                        pack_format: info.pack_format,
                        enabled,
                        icon: info.icon,
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    out.sort_by(|a, b| a.file_name.to_lowercase().cmp(&b.file_name.to_lowercase()));
    out
}

pub fn remove(resourcepacks_dir: &Path, file_name: &str) -> Result<(), String> {
    let name = safe_pack_name(file_name).ok_or("That is not a resource pack file name.")?;
    let path = resourcepacks_dir.join(&name);
    if !path.is_file() {
        return Err("That pack is not installed any more.".to_string());
    }
    fs::remove_file(&path).map_err(|e| format!("Could not remove the pack: {e}"))
}

/// Switches a pack on or off for the next launch by editing `options.txt`.
/// Minecraft has to have written that file once first.
pub fn set_enabled(
    resourcepacks_dir: &Path,
    instance_dir: &Path,
    file_name: &str,
    enabled: bool,
) -> Result<bool, String> {
    let name = safe_pack_name(file_name).ok_or("That is not a resource pack file name.")?;
    if !resourcepacks_dir.join(&name).is_file() {
        return Err("That pack is not installed any more.".to_string());
    }
    let path = options_file(instance_dir);
    let text = fs::read_to_string(&path).map_err(|_| {
        "Start Minecraft once so it creates options.txt, then switch the pack on.".to_string()
    })?;
    let next = update_packs_line(&text, &name, enabled);
    if next == text {
        return Ok(enabled);
    }
    let temp = path.with_extension("txt.tmp");
    fs::write(&temp, &next).map_err(|e| format!("Could not save options.txt: {e}"))?;
    fs::rename(&temp, &path).map_err(|e| format!("Could not save options.txt: {e}"))?;
    Ok(enabled)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::io::Write;

    fn pack_zip(files: &[(&str, &str)]) -> Vec<u8> {
        let mut buffer = std::io::Cursor::new(Vec::new());
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

    #[test]
    fn resolutions_come_from_categories() {
        assert_eq!(resolution_of(&["decoration".into(), "64x".into()]), Some("64x".into()));
        assert_eq!(resolution_of(&["themed".into()]), None);
        assert_eq!(resolution_of(&["16X".into()]), Some("16x".into()));
    }

    #[test]
    fn modrinth_pack_search_is_narrowed_by_version_and_resolution() {
        let facets: Value = serde_json::from_str(&modrinth_pack_facets("1.21.11", Some("64x"))).unwrap();
        assert_eq!(facets[0][0], "project_type:resourcepack");
        assert_eq!(facets[1][0], "versions:1.21.11");
        assert_eq!(facets[2][0], "categories:64x");
        let without: Value = serde_json::from_str(&modrinth_pack_facets("1.21.11", Some("evil"))).unwrap();
        assert_eq!(without.as_array().unwrap().len(), 2);

        let hits = json!({"total_hits":3,"hits":[
            {"project_id":"abc","slug":"clean","title":"Clean","description":"Neat","author":"Ana","downloads":120000,
             "icon_url":"https://cdn.modrinth.com/i.png","categories":["64x","themed"]},
            {"project_id":"def","title":"Odd","icon_url":"https://evil.example.com/i.png","categories":[]},
            {"title":"No id"}]});
        let result = parse_modrinth_packs(&hits);
        assert_eq!(result.total, 3);
        assert_eq!(result.hits.len(), 2);
        assert_eq!(result.hits[0].resolution.as_deref(), Some("64x"));
        assert_eq!(result.hits[0].page_url.as_deref(), Some("https://modrinth.com/resourcepack/clean"));
        assert!(result.hits[1].icon_url.is_none());
    }

    #[test]
    fn curseforge_pack_search_reads_categories_and_authors() {
        let hits = json!({"pagination":{"totalCount":7},"data":[
            {"id":42,"name":"Pastel","summary":"Soft","authors":[{"name":"Bo"}],"downloadCount":2500,
             "logo":{"thumbnailUrl":"https://media.forgecdn.net/a.png"},
             "categories":[{"name":"32x"}],
             "links":{"websiteUrl":"https://www.curseforge.com/minecraft/texture-packs/pastel"}}]});
        let result = parse_curseforge_packs(&hits);
        assert_eq!(result.total, 7);
        assert_eq!(result.hits[0].id, "42");
        assert_eq!(result.hits[0].author, "Bo");
        assert_eq!(result.hits[0].resolution.as_deref(), Some("32x"));
        assert_eq!(result.hits[0].downloads, 2500);
    }

    #[test]
    fn a_pack_needs_pack_mcmeta_and_can_sit_one_folder_down() {
        let good = pack_zip(&[("pack.mcmeta", r#"{"pack":{"pack_format":34,"description":"Clean skies"}}"#)]);
        let meta = read_pack_bytes(&good).unwrap();
        assert_eq!(meta.pack_format, Some(34));
        assert_eq!(meta.description.as_deref(), Some("Clean skies"));

        let nested = pack_zip(&[("Pastel/pack.mcmeta", r#"{"pack":{"pack_format":22,"description":{"text":"Pastel"}}}"#)]);
        let meta = read_pack_bytes(&nested).unwrap();
        assert_eq!(meta.description.as_deref(), Some("Pastel"));

        let not_a_pack = pack_zip(&[("readme.txt", "hi")]);
        assert!(read_pack_bytes(&not_a_pack).is_err());
        assert!(read_pack_bytes(b"not a zip").is_err());
    }

    #[test]
    fn only_safe_pack_names_are_accepted() {
        assert_eq!(safe_pack_name("Clean.zip").as_deref(), Some("Clean.zip"));
        for bad in ["", "pack.jar", "../pack.zip", "a/b.zip", "a\\b.zip", ".hidden.zip", "C:evil.zip"] {
            assert!(safe_pack_name(bad).is_none(), "{bad:?}");
        }
    }

    #[test]
    fn html_descriptions_become_plain_text() {
        let text = html_to_text("<p>Clean <b>skies</b> &amp; clouds</p><br><p>64x</p>");
        assert_eq!(text, "Clean skies & clouds\n64x");
    }

    #[test]
    fn active_packs_can_be_switched_on_and_off_in_options_txt() {
        let options = "fov:0.5\nresourcePacks:[\"vanilla\",\"file/Clean.zip\"]\ngamma:0.5\n";
        assert_eq!(active_packs(options), vec!["vanilla", "file/Clean.zip"]);

        let on = update_packs_line("resourcePacks:[\"vanilla\"]\n", "Clean.zip", true);
        assert_eq!(on, "resourcePacks:[\"vanilla\",\"file/Clean.zip\"]\n");

        let off = update_packs_line(&on, "Clean.zip", false);
        assert_eq!(off, "resourcePacks:[\"vanilla\"]\n");
        assert_eq!(active_packs(&off), vec!["vanilla"]);

        // No options.txt line and nothing to switch off: the text is untouched.
        assert_eq!(update_packs_line("fov:0.5\n", "Clean.zip", false), "fov:0.5\n");
        // Names with quotes are escaped, so the file stays readable.
        let quoted = update_packs_line("resourcePacks:[\"vanilla\"]\n", "My \"pack\".zip", true);
        assert!(quoted.contains("My \\\"pack\\\".zip"));
    }

    #[test]
    fn listing_finds_packs_and_their_active_state() {
        let dir = tempfile::tempdir().unwrap();
        let packs = dir.path().join("resourcepacks");
        std::fs::create_dir_all(&packs).unwrap();
        let good = pack_zip(&[("pack.mcmeta", r#"{"pack":{"pack_format":34,"description":"Clean"}}"#)]);
        std::fs::write(packs.join("Clean.zip"), &good).unwrap();
        std::fs::write(packs.join("notes.txt"), "not a pack").unwrap();
        std::fs::write(dir.path().join("options.txt"), "resourcePacks:[\"vanilla\",\"file/Clean.zip\"]\n").unwrap();

        let listed = list_installed(&packs, dir.path());
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].file_name, "Clean.zip");
        assert!(listed[0].enabled);
        assert_eq!(listed[0].description.as_deref(), Some("Clean"));

        set_enabled(&packs, dir.path(), "Clean.zip", false).unwrap();
        assert!(!list_installed(&packs, dir.path())[0].enabled);
        remove(&packs, "Clean.zip").unwrap();
        assert!(list_installed(&packs, dir.path()).is_empty());
    }
}
