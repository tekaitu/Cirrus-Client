//! Launcher updates: asks GitHub for the newest official Cirrus Client release
//! and reports whether it is newer than the running build.
//!
//! Only release *checking* lives here. Installing an update needs a signed
//! release (a private signing key in CI and the matching public key in the app),
//! and this build has no key, so the interface says so plainly instead of
//! downloading and running an unverified file. Everything here is limited to
//! HTTPS on GitHub's own hosts, and a version is only offered when it is newer,
//! so a stale or hostile answer cannot trigger a downgrade.

use reqwest::Url;
use serde::Serialize;
use std::io::Read;
use std::time::Duration;

/// Official releases only: the GitHub API and the pages its assets live on.
const API_URL: &str = "https://api.github.com/repos/tekaitu/Cirrus-Client/releases/latest";
const ALLOWED_HOSTS: &[&str] = &[
    "api.github.com",
    "github.com",
    "objects.githubusercontent.com",
    "release-assets.githubusercontent.com",
];
const MAX_BODY_BYTES: u64 = 512 * 1024;

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheck {
    pub current: String,
    pub latest: String,
    pub available: bool,
    /// The release notes, trimmed for the notification.
    pub notes: String,
    /// The official release page (also the changelog).
    pub page_url: Option<String>,
    /// A Windows installer asset, when the release has one.
    pub download_url: Option<String>,
    pub published_at: Option<String>,
    /// Why downloading can or cannot happen in this build.
    pub install_ready: bool,
    pub install_message: String,
}

fn host_allowed(url: &Url) -> bool {
    url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && url
            .host_str()
            .map(|h| ALLOWED_HOSTS.contains(&h.to_ascii_lowercase().as_str()))
            .unwrap_or(false)
}

/// True for the project's own release pages, the only addresses the update
/// notification is allowed to open.
pub fn allowed_page(url: &str) -> bool {
    match Url::parse(url) {
        Ok(u) => {
            host_allowed(&u)
                && u.path().to_ascii_lowercase().starts_with("/tekaitu/cirrus-client")
        }
        Err(_) => false,
    }
}

/// A dotted version as numbers, ignoring a leading `v` and any suffix.
pub fn version_parts(text: &str) -> Vec<u64> {
    text.trim()
        .trim_start_matches('v')
        .trim_start_matches('V')
        .split(|c: char| !(c.is_ascii_digit()))
        .take_while(|p| !p.is_empty())
        .filter_map(|p| p.parse::<u64>().ok())
        .collect()
}

/// True only when `latest` is strictly newer than `current`, so a release page
/// that lists an older build (or a rollback) is never offered as an update.
pub fn is_newer(latest: &str, current: &str) -> bool {
    let a = version_parts(latest);
    let b = version_parts(current);
    if a.is_empty() || b.is_empty() {
        return false;
    }
    let len = a.len().max(b.len());
    for i in 0..len {
        let x = a.get(i).copied().unwrap_or(0);
        let y = b.get(i).copied().unwrap_or(0);
        if x != y {
            return x > y;
        }
    }
    false
}

fn trim_notes(body: &str) -> String {
    let mut out = String::new();
    for line in body.lines() {
        let line = line.trim_end();
        if line.starts_with("## ") || line.starts_with("# ") {
            // Markdown headings read badly in a small panel; keep the words.
            out.push_str(line.trim_start_matches('#').trim());
        } else {
            out.push_str(line);
        }
        out.push('\n');
        if out.chars().count() > 1200 {
            out.push_str("…\n");
            break;
        }
    }
    out.trim().to_string()
}

fn pick_installer(assets: &serde_json::Value) -> Option<String> {
    let list = assets.as_array()?;
    for asset in list {
        let name = asset.get("name").and_then(|n| n.as_str()).unwrap_or("");
        let lower = name.to_ascii_lowercase();
        // The NSIS installer is what can replace the running launcher; a bare exe
        // is not an installer.
        if !(lower.ends_with(".exe") || lower.ends_with(".msi")) {
            continue;
        }
        if lower.contains("setup") || lower.contains("installer") || lower.ends_with(".msi") {
            let url = asset.get("browser_download_url").and_then(|u| u.as_str())?;
            if let Ok(parsed) = Url::parse(url) {
                if host_allowed(&parsed) {
                    return Some(url.to_string());
                }
            }
        }
    }
    None
}

/// Turn GitHub's release answer into a check result.
pub fn from_release_json(json: &str, current: &str) -> Result<UpdateCheck, String> {
    let value: serde_json::Value =
        serde_json::from_str(json).map_err(|e| format!("GitHub's answer was not understood ({e})."))?;
    let latest = value
        .get("tag_name")
        .and_then(|t| t.as_str())
        .or_else(|| value.get("name").and_then(|t| t.as_str()))
        .ok_or("That release has no version tag.")?
        .trim()
        .trim_start_matches('v')
        .to_string();
    if latest.is_empty() {
        return Err("That release has no version tag.".to_string());
    }
    let page = value
        .get("html_url")
        .and_then(|u| u.as_str())
        .and_then(|u| Url::parse(u).ok())
        .filter(host_allowed)
        .map(|u| u.to_string());
    let notes = value
        .get("body")
        .and_then(|b| b.as_str())
        .map(trim_notes)
        .unwrap_or_default();
    let download = value.get("assets").and_then(pick_installer);
    let available = is_newer(&latest, current);
    Ok(UpdateCheck {
        current: current.to_string(),
        latest,
        available,
        notes,
        page_url: page,
        download_url: download,
        published_at: value
            .get("published_at")
            .and_then(|d| d.as_str())
            .map(str::to_string),
        // Signed installs are not configured in this build (see the docs).
        install_ready: false,
        install_message:
            "Automatic installation needs a signed Cirrus release. This build can open the official release page instead."
                .to_string(),
    })
}

/// Ask GitHub for the newest release. Blocking; the caller runs it off the UI thread.
pub fn check(current: &str) -> Result<UpdateCheck, String> {
    let url = Url::parse(API_URL).map_err(|e| e.to_string())?;
    if !host_allowed(&url) {
        return Err("The update address is not an official one.".to_string());
    }
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent("CirrusClient")
        .build()
        .map_err(|e| format!("Could not prepare the update check: {e}"))?;
    let mut response = client
        .get(url)
        .header("Accept", "application/vnd.github+json")
        .send()
        .map_err(|e| format!("Could not reach GitHub: {e}"))?;
    if !response.status().is_success() {
        return Err(match response.status().as_u16() {
            404 => "Cirrus has no published releases yet, so there is nothing to update to.".to_string(),
            403 => "GitHub is limiting update checks right now. Try again later.".to_string(),
            code => format!("GitHub answered with status {code}."),
        });
    }
    let mut body = String::new();
    let taken = response
        .take(MAX_BODY_BYTES)
        .read_to_string(&mut body)
        .map_err(|e| format!("Could not read the update answer: {e}"))?;
    if taken == 0 {
        return Err("GitHub sent an empty answer.".to_string());
    }
    from_release_json(&body, current)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_project_pages_can_be_opened() {
        assert!(allowed_page("https://github.com/tekaitu/Cirrus-Client/releases/tag/v0.3.4"));
        assert!(!allowed_page("https://github.com/someone-else/Cirrus-Client"));
        assert!(!allowed_page("https://evil.example.com/tekaitu/Cirrus-Client"));
        assert!(!allowed_page("http://github.com/tekaitu/Cirrus-Client"));
        assert!(!allowed_page("javascript:alert(1)"));
    }

    #[test]
    fn versions_compare_as_numbers_not_text() {
        assert!(is_newer("0.3.4", "0.3.3"));
        assert!(is_newer("0.10.0", "0.9.9"));
        assert!(is_newer("1.0", "0.9.9.9"));
        assert!(is_newer("v0.3.3", "0.3.2"));
        assert!(!is_newer("0.3.3", "0.3.3"));
        assert!(!is_newer("0.3.2", "0.3.3"));
        assert!(!is_newer("", "0.3.3"));
        assert!(!is_newer("garbage", "0.3.3"));
    }

    #[test]
    fn a_newer_release_is_offered_with_its_notes_and_installer() {
        let json = serde_json::json!({
            "tag_name": "v0.3.4",
            "html_url": "https://github.com/tekaitu/Cirrus-Client/releases/tag/v0.3.4",
            "body": "## Fixes\n- Faster downloads\n- Java 17 support",
            "published_at": "2026-11-30T10:00:00Z",
            "assets": [
                {"name": "CirrusClient_0.3.4_x64-setup.exe",
                 "browser_download_url": "https://github.com/tekaitu/Cirrus-Client/releases/download/v0.3.4/CirrusClient_0.3.4_x64-setup.exe"}
            ]
        });
        let check = from_release_json(&json.to_string(), "0.3.3").unwrap();
        assert!(check.available);
        assert_eq!(check.latest, "0.3.4");
        assert!(check.notes.contains("Faster downloads"));
        assert!(check.download_url.unwrap().ends_with("-setup.exe"));
        assert!(!check.install_ready, "installing needs a signed release");
    }

    #[test]
    fn the_same_release_is_not_an_update() {
        let json = serde_json::json!({"tag_name": "v0.3.3", "assets": []});
        let check = from_release_json(&json.to_string(), "0.3.3").unwrap();
        assert!(!check.available);
        assert_eq!(check.download_url, None);
    }

    #[test]
    fn a_rollback_release_is_not_offered() {
        let json = serde_json::json!({"tag_name": "v0.3.2"});
        let check = from_release_json(&json.to_string(), "0.3.3").unwrap();
        assert!(!check.available, "downgrades are never offered");
    }

    #[test]
    fn installer_links_outside_github_are_ignored() {
        let json = serde_json::json!({
            "tag_name": "v9.0.0",
            "assets": [{"name": "setup.exe", "browser_download_url": "https://evil.example.com/setup.exe"}]
        });
        let check = from_release_json(&json.to_string(), "0.3.3").unwrap();
        assert_eq!(check.download_url, None);
    }

    #[test]
    fn release_pages_are_https_github_only() {
        let json = serde_json::json!({"tag_name": "v9.0.0", "html_url": "http://evil.example.com/x"});
        let check = from_release_json(&json.to_string(), "0.3.3").unwrap();
        assert_eq!(check.page_url, None);
    }

    #[test]
    fn notes_are_trimmed_for_a_small_panel() {
        let long = "line\n".repeat(2000);
        let json = serde_json::json!({"tag_name": "v9.0.0", "body": long});
        let check = from_release_json(&json.to_string(), "0.3.3").unwrap();
        assert!(check.notes.chars().count() < 1500);
    }
}
