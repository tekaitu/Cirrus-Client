//! Skin library: skins are small PNG files kept in `<game folder>/skins`, with an index that says
//! which model (classic or slim) each one uses.
//!
//! Skins come from three places: a PNG file the player picks, a player name (looked up through
//! Mojang's public profile service) or a texture address on textures.minecraft.net. Applying one
//! uploads it to the signed-in account through Minecraft services. Only those fixed hosts are
//! contacted and redirects are never followed.

use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;

/// Larger than any real skin (a 64x64 PNG is a few KB); anything bigger is not a skin.
pub const MAX_SKIN_BYTES: usize = 256 * 1024;
const MAX_NAME_CHARS: usize = 32;
const INDEX_FILE: &str = "index.json";

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredSkin {
    pub id: String,
    pub name: String,
    /// "classic" (wide arms) or "slim" (3 pixel arms).
    pub model: String,
    /// Where it came from: "file", "player:<name>" or "url".
    pub source: String,
}

/// What the interface gets: the stored entry plus the PNG as a data address it can draw directly.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkinView {
    pub id: String,
    pub name: String,
    pub model: String,
    pub source: String,
    pub data_url: String,
}

// ---------------------------------------------------------------- base64 (standard alphabet)

const B64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

pub fn b64_encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let n = (u32::from(chunk[0]) << 16)
            | (u32::from(*chunk.get(1).unwrap_or(&0)) << 8)
            | u32::from(*chunk.get(2).unwrap_or(&0));
        out.push(B64[(n >> 18) as usize & 63] as char);
        out.push(B64[(n >> 12) as usize & 63] as char);
        out.push(if chunk.len() > 1 { B64[(n >> 6) as usize & 63] as char } else { '=' });
        out.push(if chunk.len() > 2 { B64[n as usize & 63] as char } else { '=' });
    }
    out
}

pub fn b64_decode(text: &str) -> Option<Vec<u8>> {
    let mut out = Vec::with_capacity(text.len() * 3 / 4);
    let mut acc = 0u32;
    let mut bits = 0;
    for c in text.trim().trim_end_matches('=').bytes() {
        if c == b'\n' || c == b'\r' || c == b' ' {
            continue;
        }
        let v = match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'+' | b'-' => 62,
            b'/' | b'_' => 63,
            _ => return None,
        };
        acc = (acc << 6) | u32::from(v);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
            acc &= (1 << bits) - 1;
        }
    }
    Some(out)
}

pub fn png_data_url(png: &[u8]) -> String {
    format!("data:image/png;base64,{}", b64_encode(png))
}

// ---------------------------------------------------------------- validation

/// Width and height from a PNG header, or `None` when the bytes are not a PNG.
pub fn png_size(bytes: &[u8]) -> Option<(u32, u32)> {
    const SIGNATURE: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
    if bytes.len() < 24 || bytes[..8] != SIGNATURE || &bytes[12..16] != b"IHDR" {
        return None;
    }
    let w = u32::from_be_bytes(bytes[16..20].try_into().ok()?);
    let h = u32::from_be_bytes(bytes[20..24].try_into().ok()?);
    Some((w, h))
}

/// Accepts the sizes Minecraft knows: 64x64, and the pre-1.8 64x32 layout.
pub fn validate_png(bytes: &[u8]) -> Result<(u32, u32), String> {
    if bytes.len() > MAX_SKIN_BYTES {
        return Err("That file is too large to be a skin.".to_string());
    }
    match png_size(bytes) {
        Some((64, 64)) => Ok((64, 64)),
        Some((64, 32)) => Ok((64, 32)),
        Some((w, h)) => Err(format!("A Minecraft skin is 64 x 64 pixels; this image is {w} x {h}.")),
        None => Err("That file is not a PNG image.".to_string()),
    }
}

pub fn valid_model(model: &str) -> Result<&'static str, String> {
    match model {
        "classic" => Ok("classic"),
        "slim" => Ok("slim"),
        _ => Err("The skin type must be Classic or Slim.".to_string()),
    }
}

/// Minecraft account names: 3 to 16 letters, digits and underscores.
pub fn valid_username(name: &str) -> bool {
    (3..=16).contains(&name.len()) && name.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')
}

fn is_uuid(text: &str) -> bool {
    let plain: String = text.chars().filter(|c| *c != '-').collect();
    plain.len() == 32 && plain.bytes().all(|b| b.is_ascii_hexdigit())
}

/// Only Mojang's own texture host is trusted for downloads.
pub fn is_texture_url(url: &str) -> bool {
    match reqwest::Url::parse(url) {
        Ok(u) => u.scheme() == "https" && u.host_str() == Some("textures.minecraft.net") && u.username().is_empty(),
        Err(_) => false,
    }
}

// ---------------------------------------------------------------- the library on disk

pub fn skins_dir(root: &Path) -> PathBuf {
    root.join("skins")
}

fn load_index(root: &Path) -> Vec<StoredSkin> {
    fs::read_to_string(skins_dir(root).join(INDEX_FILE))
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}

fn save_index(root: &Path, list: &[StoredSkin]) -> Result<(), String> {
    let dir = skins_dir(root);
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create the skins folder: {e}"))?;
    let json = serde_json::to_string_pretty(list).map_err(|e| e.to_string())?;
    fs::write(dir.join(INDEX_FILE), json).map_err(|e| format!("Could not save the skin list: {e}"))
}

fn valid_skin_id(id: &str) -> bool {
    id.starts_with("s-") && id.len() <= 48 && id[2..].bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
}

fn slug(name: &str) -> String {
    let mut out = String::new();
    for c in name.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
        } else if !out.ends_with('-') && !out.is_empty() {
            out.push('-');
        }
    }
    let out = out.trim_matches('-').to_string();
    if out.is_empty() { "skin".to_string() } else { out.chars().take(30).collect() }
}

pub fn png_path(root: &Path, id: &str) -> Result<PathBuf, String> {
    if !valid_skin_id(id) {
        return Err("That is not a skin id.".to_string());
    }
    Ok(skins_dir(root).join(format!("{id}.png")))
}

pub fn list(root: &Path) -> Vec<SkinView> {
    load_index(root)
        .into_iter()
        .filter_map(|s| {
            let bytes = fs::read(png_path(root, &s.id).ok()?).ok()?;
            Some(SkinView { data_url: png_data_url(&bytes), id: s.id, name: s.name, model: s.model, source: s.source })
        })
        .collect()
}

pub fn add(root: &Path, name: &str, model: &str, source: &str, png: &[u8]) -> Result<SkinView, String> {
    validate_png(png)?;
    let model = valid_model(model)?;
    let name: String = name.trim().chars().take(MAX_NAME_CHARS).collect();
    if name.is_empty() {
        return Err("Give the skin a name.".to_string());
    }
    let mut index = load_index(root);
    let base = format!("s-{}", slug(&name));
    let mut id = base.clone();
    let mut n = 2;
    while index.iter().any(|s| s.id == id) {
        id = format!("{base}-{n}");
        n += 1;
    }
    let dir = skins_dir(root);
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create the skins folder: {e}"))?;
    fs::write(dir.join(format!("{id}.png")), png).map_err(|e| format!("Could not save the skin: {e}"))?;
    let stored = StoredSkin { id: id.clone(), name: name.clone(), model: model.to_string(), source: source.to_string() };
    index.push(stored);
    save_index(root, &index)?;
    Ok(SkinView { id, name, model: model.to_string(), source: source.to_string(), data_url: png_data_url(png) })
}

pub fn remove(root: &Path, id: &str) -> Result<(), String> {
    let path = png_path(root, id)?;
    let mut index = load_index(root);
    let before = index.len();
    index.retain(|s| s.id != id);
    if index.len() == before {
        return Err("That skin is not in the library.".to_string());
    }
    save_index(root, &index)?;
    let _ = fs::remove_file(path);
    Ok(())
}

/// Changes whether a library skin is drawn with wide (classic) or 3 pixel (slim) arms.
pub fn set_model(root: &Path, id: &str, model: &str) -> Result<SkinView, String> {
    let model = valid_model(model)?;
    let mut index = load_index(root);
    let entry = index.iter_mut().find(|s| s.id == id).ok_or("That skin is not in the library.")?;
    entry.model = model.to_string();
    let updated = entry.clone();
    save_index(root, &index)?;
    let bytes = fs::read(png_path(root, id)?).map_err(|_| "The skin file is missing.".to_string())?;
    Ok(SkinView { data_url: png_data_url(&bytes), id: updated.id, name: updated.name, model: updated.model, source: updated.source })
}

pub fn get(root: &Path, id: &str) -> Result<(StoredSkin, Vec<u8>), String> {
    let stored = load_index(root).into_iter().find(|s| s.id == id).ok_or("That skin is not in the library.")?;
    let bytes = fs::read(png_path(root, id)?).map_err(|_| "The skin file is missing.".to_string())?;
    Ok((stored, bytes))
}

// ---------------------------------------------------------------- network

pub struct Endpoints {
    pub profile_by_name: String,
    pub session_profile: String,
    pub upload: String,
}

impl Endpoints {
    pub fn production() -> Endpoints {
        Endpoints {
            profile_by_name: "https://api.mojang.com/users/profiles/minecraft/".into(),
            session_profile: "https://sessionserver.mojang.com/session/minecraft/profile/".into(),
            upload: "https://api.minecraftservices.com/minecraft/profile/skins".into(),
        }
    }
}

pub fn http_client() -> Result<Client, String> {
    Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(30))
        .user_agent(concat!("CirrusClient/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| format!("Could not set up a secure connection: {e}"))
}

fn get_json(client: &Client, url: &str) -> Result<(u16, Value), String> {
    let resp = client.get(url).send().map_err(|_| "Could not reach Mojang's servers. Check your internet connection.".to_string())?;
    let status = resp.status().as_u16();
    let mut body = String::new();
    resp.take(1024 * 1024).read_to_string(&mut body).map_err(|_| "Mojang's answer could not be read.".to_string())?;
    Ok((status, serde_json::from_str(&body).unwrap_or(Value::Null)))
}

/// The skin address and model inside a session-server profile answer.
pub fn texture_from_profile(profile: &Value) -> Option<(String, String)> {
    let props = profile.get("properties")?.as_array()?;
    let value = props.iter().find(|p| p.get("name").and_then(Value::as_str) == Some("textures"))?.get("value")?.as_str()?;
    let decoded: Value = serde_json::from_slice(&b64_decode(value)?).ok()?;
    let skin = decoded.get("textures")?.get("SKIN")?;
    let url = skin.get("url")?.as_str()?.to_string();
    let model = match skin.get("metadata").and_then(|m| m.get("model")).and_then(Value::as_str) {
        Some("slim") => "slim",
        _ => "classic",
    };
    Some((url, model.to_string()))
}

pub fn download_texture(client: &Client, url: &str) -> Result<Vec<u8>, String> {
    if !is_texture_url(url) {
        return Err("Only skins hosted on textures.minecraft.net can be added by address.".to_string());
    }
    let resp = client.get(url).send().map_err(|_| "Could not download the skin. Check your internet connection.".to_string())?;
    if !resp.status().is_success() {
        return Err(format!("The skin could not be downloaded (HTTP {}).", resp.status().as_u16()));
    }
    let mut bytes = Vec::new();
    resp.take(MAX_SKIN_BYTES as u64 + 1).read_to_end(&mut bytes).map_err(|_| "The skin download was interrupted.".to_string())?;
    validate_png(&bytes)?;
    Ok(bytes)
}

/// Looks a player up by name or id and returns (their name, PNG, model).
pub fn fetch_player_skin(client: &Client, ep: &Endpoints, who: &str) -> Result<(String, Vec<u8>, String), String> {
    let who = who.trim();
    let (id, name) = if is_uuid(who) {
        (who.replace('-', ""), None)
    } else if valid_username(who) {
        let (status, v) = get_json(client, &format!("{}{}", ep.profile_by_name, who))?;
        match status {
            200 => {}
            204 | 404 => return Err(format!("There is no Minecraft player called {who}.")),
            429 => return Err("Mojang is rate-limiting lookups. Wait a minute and try again.".to_string()),
            other => return Err(format!("Mojang's profile service answered HTTP {other}.")),
        }
        let id = v.get("id").and_then(Value::as_str).filter(|i| is_uuid(i)).ok_or("Mojang's answer had no player id.")?;
        (id.to_string(), v.get("name").and_then(Value::as_str).map(str::to_string))
    } else {
        return Err("Enter a Minecraft username (3 to 16 letters, numbers or underscores) or a player id.".to_string());
    };
    let (status, profile) = get_json(client, &format!("{}{}", ep.session_profile, id))?;
    match status {
        200 => {}
        204 | 404 => return Err("That player does not exist.".to_string()),
        429 => return Err("Mojang is rate-limiting lookups. Wait a minute and try again.".to_string()),
        other => return Err(format!("Mojang's session service answered HTTP {other}.")),
    }
    let shown = name.or_else(|| profile.get("name").and_then(Value::as_str).map(str::to_string)).unwrap_or_else(|| who.to_string());
    let (url, model) = texture_from_profile(&profile).ok_or_else(|| format!("{shown} has no custom skin to copy."))?;
    let png = download_texture(client, &url)?;
    Ok((shown, png, model))
}

const BOUNDARY: &str = "----CirrusClientSkinUpload7d1f3a9c";

/// The multipart body Minecraft services expects: a `variant` field and the `file`.
pub fn multipart_body(model: &str, png: &[u8]) -> Vec<u8> {
    let mut body = Vec::with_capacity(png.len() + 400);
    body.extend_from_slice(
        format!("--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"variant\"\r\n\r\n{model}\r\n").as_bytes(),
    );
    body.extend_from_slice(
        format!(
            "--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"skin.png\"\r\nContent-Type: image/png\r\n\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(png);
    body.extend_from_slice(format!("\r\n--{BOUNDARY}--\r\n").as_bytes());
    body
}

/// Sets the signed-in account's skin. Needs the Minecraft access token of a signed-in session.
pub fn apply(client: &Client, ep: &Endpoints, mc_token: &str, model: &str, png: &[u8]) -> Result<(), String> {
    let (w, h) = validate_png(png)?;
    if (w, h) != (64, 64) {
        return Err("Minecraft only accepts 64 x 64 skins for an account. This is an old 64 x 32 skin.".to_string());
    }
    let model = valid_model(model)?;
    let resp = client
        .post(&ep.upload)
        .bearer_auth(mc_token)
        .header("Content-Type", format!("multipart/form-data; boundary={BOUNDARY}"))
        .body(multipart_body(model, png))
        .send()
        .map_err(|_| "Could not reach Minecraft services. Check your internet connection.".to_string())?;
    match resp.status().as_u16() {
        200 | 204 => Ok(()),
        401 | 403 => Err("Minecraft did not accept your session. Sign out, sign in again and retry.".to_string()),
        429 => Err("Minecraft services are rate-limiting skin changes. Wait a few minutes and try again.".to_string()),
        400 => Err("Minecraft rejected this skin file.".to_string()),
        other => Err(format!("Minecraft services answered HTTP {other}.")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A valid PNG header with the given size (enough for the checks here; not a drawable image).
    fn fake_png(w: u32, h: u32) -> Vec<u8> {
        let mut v = vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, b'I', b'H', b'D', b'R'];
        v.extend_from_slice(&w.to_be_bytes());
        v.extend_from_slice(&h.to_be_bytes());
        v.extend_from_slice(&[8, 6, 0, 0, 0, 0, 0, 0, 0]);
        v
    }

    #[test]
    fn base64_round_trips_every_padding_case() {
        for input in [&b""[..], b"f", b"fo", b"foo", b"foob", b"fooba", b"foobar"] {
            assert_eq!(b64_decode(&b64_encode(input)).unwrap(), input);
        }
        assert_eq!(b64_encode(b"foobar"), "Zm9vYmFy");
        assert_eq!(b64_encode(b"fo"), "Zm8=");
        assert_eq!(b64_decode("Zm9v\nYmFy").unwrap(), b"foobar");
        assert!(b64_decode("Zm9v*mFy").is_none());
    }

    #[test]
    fn only_real_skin_pngs_are_accepted() {
        assert_eq!(validate_png(&fake_png(64, 64)), Ok((64, 64)));
        assert_eq!(validate_png(&fake_png(64, 32)), Ok((64, 32)));
        assert!(validate_png(&fake_png(128, 128)).unwrap_err().contains("128 x 128"));
        assert!(validate_png(b"GIF89a not a png at all......").unwrap_err().contains("not a PNG"));
        assert!(validate_png(&vec![0u8; MAX_SKIN_BYTES + 1]).unwrap_err().contains("too large"));
    }

    #[test]
    fn names_ids_and_hosts_are_checked() {
        assert!(valid_username("Steve_99"));
        assert!(!valid_username("ab"));
        assert!(!valid_username("has space"));
        assert!(!valid_username("waytoolongusername1"));
        assert!(is_uuid("069a79f4-44e9-4726-a5be-fca90e38aaf5"));
        assert!(is_uuid("069a79f444e94726a5befca90e38aaf5"));
        assert!(!is_uuid("nope"));
        assert!(is_texture_url("https://textures.minecraft.net/texture/abc"));
        assert!(!is_texture_url("http://textures.minecraft.net/texture/abc"));
        assert!(!is_texture_url("https://textures.minecraft.net.evil.example/texture/abc"));
        assert!(!is_texture_url("https://evil.example/texture/abc"));
        assert!(!is_texture_url("https://user@textures.minecraft.net/texture/abc"));
        assert!(valid_model("slim").is_ok() && valid_model("classic").is_ok() && valid_model("big").is_err());
        assert!(png_path(Path::new("."), "../x").is_err());
        assert!(png_path(Path::new("."), "s-ok").is_ok());
    }

    #[test]
    fn the_library_adds_lists_names_uniquely_and_removes() {
        let dir = tempfile::tempdir().unwrap();
        assert!(list(dir.path()).is_empty());
        let a = add(dir.path(), "  My Skin! ", "slim", "file", &fake_png(64, 64)).unwrap();
        assert_eq!(a.id, "s-my-skin");
        assert_eq!(a.name, "My Skin!");
        assert!(a.data_url.starts_with("data:image/png;base64,"));
        let b = add(dir.path(), "My Skin!", "classic", "player:Notch", &fake_png(64, 64)).unwrap();
        assert_eq!(b.id, "s-my-skin-2");
        assert!(add(dir.path(), "  ", "classic", "file", &fake_png(64, 64)).is_err());
        assert!(add(dir.path(), "x", "classic", "file", b"nope").is_err());
        let all = list(dir.path());
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].model, "slim");
        let (stored, bytes) = get(dir.path(), "s-my-skin-2").unwrap();
        assert_eq!(stored.source, "player:Notch");
        assert_eq!(bytes, fake_png(64, 64));
        let changed = set_model(dir.path(), "s-my-skin", "classic").unwrap();
        assert_eq!(changed.model, "classic");
        assert_eq!(list(dir.path())[0].model, "classic");
        assert!(set_model(dir.path(), "s-my-skin", "huge").is_err());
        assert!(set_model(dir.path(), "s-nope", "slim").is_err());
        remove(dir.path(), "s-my-skin").unwrap();
        assert_eq!(list(dir.path()).len(), 1);
        assert!(remove(dir.path(), "s-my-skin").is_err());
        assert!(remove(dir.path(), "../etc").is_err());
    }

    #[test]
    fn the_skin_address_and_model_come_out_of_a_session_profile() {
        let textures = r#"{"textures":{"SKIN":{"url":"https://textures.minecraft.net/texture/abc","metadata":{"model":"slim"}}}}"#;
        let profile = serde_json::json!({ "name": "Steve", "properties": [{ "name": "textures", "value": b64_encode(textures.as_bytes()) }] });
        assert_eq!(
            texture_from_profile(&profile),
            Some(("https://textures.minecraft.net/texture/abc".to_string(), "slim".to_string()))
        );
        let plain = r#"{"textures":{"SKIN":{"url":"https://textures.minecraft.net/texture/def"}}}"#;
        let profile = serde_json::json!({ "properties": [{ "name": "textures", "value": b64_encode(plain.as_bytes()) }] });
        assert_eq!(texture_from_profile(&profile).unwrap().1, "classic");
        assert!(texture_from_profile(&serde_json::json!({ "properties": [] })).is_none());
        assert!(texture_from_profile(&Value::Null).is_none());
    }

    #[test]
    fn the_upload_is_a_well_formed_multipart_body() {
        let png = fake_png(64, 64);
        let body = multipart_body("slim", &png);
        let text = String::from_utf8_lossy(&body);
        assert!(text.starts_with(&format!("--{BOUNDARY}\r\n")));
        assert!(text.contains("name=\"variant\"\r\n\r\nslim\r\n"));
        assert!(text.contains("name=\"file\"; filename=\"skin.png\""));
        assert!(text.ends_with(&format!("\r\n--{BOUNDARY}--\r\n")));
        assert!(body.windows(png.len()).any(|w| w == &png[..]));
    }

    #[test]
    fn old_skins_cannot_be_applied_to_an_account() {
        let client = Client::new();
        let ep = Endpoints { profile_by_name: String::new(), session_profile: String::new(), upload: "http://127.0.0.1:9/".into() };
        assert!(apply(&client, &ep, "token", "classic", &fake_png(64, 32)).unwrap_err().contains("64 x 32"));
        assert!(apply(&client, &ep, "token", "huge", &fake_png(64, 64)).unwrap_err().contains("Classic or Slim"));
    }
}
