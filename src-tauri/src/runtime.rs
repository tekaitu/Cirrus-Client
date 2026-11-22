//! Automatic installation of a portable Java 21 runtime (Eclipse Temurin).
//!
//! Safety rules this module enforces:
//! * Download metadata comes from the Adoptium API at run time (no hardcoded
//!   version or file URL).
//! * Only HTTPS, only allow-listed hosts, including every redirect hop.
//! * The archive's SHA-256 (published by the API, a different host than the
//!   binary) must match before anything is extracted or executed.
//! * Extraction refuses paths that escape the target folder, symlinks, and
//!   absurd sizes; files are written into a staging folder and moved into
//!   place only after the new `java` has been run and reports Java 21+.
//! * Nothing outside the Cirrus Client runtime folder is touched. No PATH,
//!   registry, Defender, or Windows Update changes. No administrator rights.

use crate::java;
use reqwest::Url;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

pub const REQUIRED_MAJOR: u32 = 21;
pub const METADATA_URL: &str = "https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jre&os=windows&vendor=eclipse";
/// Folder (inside the runtime folder) that holds the installed versions.
pub const MANAGED_DIR: &str = "temurin-21";
/// Java versions this launcher can install. Minecraft 1.8 - 1.16 need 8,
/// 1.17 - 1.20.4 need 17, and 1.20.5 and newer need 21.
pub const SUPPORTED_MAJORS: [u32; 3] = [8, 17, 21];

pub fn supported_major(major: u32) -> bool {
    SUPPORTED_MAJORS.contains(&major)
}

pub fn metadata_url(major: u32) -> String {
    format!(
        "https://api.adoptium.net/v3/assets/latest/{major}/hotspot?architecture=x64&image_type=jre&os=windows&vendor=eclipse"
    )
}

pub fn managed_dir(major: u32) -> String {
    format!("temurin-{major}")
}

fn binary_prefix(major: u32) -> String {
    format!("/adoptium/temurin{major}-binaries/")
}

const MAX_DOWNLOAD_BYTES: u64 = 400 * 1024 * 1024;
const MAX_EXTRACT_BYTES: u64 = 1536 * 1024 * 1024;
const MAX_ENTRIES: usize = 20_000;
const MAX_REDIRECTS: usize = 5;

/// Hosts the download may touch. The first hop must be on `github.com`
/// (Adoptium publishes its binaries as GitHub release assets); GitHub then
/// redirects to its own asset hosts.
const ALLOWED_HOSTS: &[&str] = &[
    "api.adoptium.net",
    "github.com",
    "objects.githubusercontent.com",
    "release-assets.githubusercontent.com",
    "github-releases.githubusercontent.com",
];


// ------------------------------------------------------------------ types

#[derive(Debug, Clone)]
pub struct UrlPolicy {
    hosts: Vec<String>,
    https_only: bool,
}

impl UrlPolicy {
    pub fn production() -> UrlPolicy {
        UrlPolicy {
            hosts: ALLOWED_HOSTS.iter().map(|h| h.to_string()).collect(),
            https_only: true,
        }
    }

    #[cfg(test)]
    pub fn local_test() -> UrlPolicy {
        UrlPolicy {
            hosts: vec!["127.0.0.1".to_string()],
            https_only: false,
        }
    }

    pub fn check(&self, url: &Url) -> Result<(), String> {
        if self.https_only && url.scheme() != "https" {
            return Err(format!("Refusing a non-HTTPS address: {url}"));
        }
        if !self.https_only && url.scheme() != "https" && url.scheme() != "http" {
            return Err(format!("Unsupported address type: {url}"));
        }
        if !url.username().is_empty() || url.password().is_some() {
            return Err("Refusing an address that contains credentials.".to_string());
        }
        let host = url.host_str().unwrap_or("").to_ascii_lowercase();
        if !self.hosts.iter().any(|h| *h == host) {
            return Err(format!("Refusing to download from an untrusted host: {host}"));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Release {
    pub release_name: String,
    pub version: String,
    pub file_name: String,
    pub url: String,
    pub sha256: String,
    pub size: Option<u64>,
}

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InstallProgress {
    /// checking | metadata | downloading | verifying | extracting | testing | done
    pub stage: &'static str,
    pub downloaded: u64,
    pub total: Option<u64>,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum InstallError {
    Cancelled,
    Failed(String),
}

impl InstallError {
    fn failed(msg: impl Into<String>) -> InstallError {
        InstallError::Failed(msg.into())
    }
}

impl std::fmt::Display for InstallError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            InstallError::Cancelled => write!(f, "Installation cancelled."),
            InstallError::Failed(m) => write!(f, "{m}"),
        }
    }
}

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InstallOutcome {
    /// "installed" or "alreadyInstalled"
    pub status: &'static str,
    pub java_path: String,
    pub version: Option<String>,
    /// Where an already-present runtime was found.
    pub source: String,
    /// Whether this runtime is Cirrus Client' own copy (then Settings points at it).
    pub managed: bool,
}

pub type ProgressFn<'a> = &'a (dyn Fn(InstallProgress) + Sync);

fn progress(cb: ProgressFn<'_>, stage: &'static str, downloaded: u64, total: Option<u64>, msg: &str) {
    cb(InstallProgress {
        stage,
        downloaded,
        total,
        message: msg.to_string(),
    });
}

fn check_cancel(cancel: &AtomicBool) -> Result<(), InstallError> {
    if cancel.load(Ordering::SeqCst) {
        Err(InstallError::Cancelled)
    } else {
        Ok(())
    }
}

// ------------------------------------------------------------- metadata

fn is_sha256_hex(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit())
}

/// Folder name for an installed release, safe for any file system.
pub fn install_dir_name(release_name: &str) -> String {
    let cleaned: String = release_name
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '.' || c == '-' { c } else { '_' })
        .collect();
    format!("{cleaned}-jre")
}

/// Read the Adoptium "latest assets" answer and pick the Windows x64 JRE zip.
pub fn parse_release(json: &str, policy: &UrlPolicy) -> Result<Release, String> {
    parse_release_for(json, policy, REQUIRED_MAJOR)
}

pub fn parse_release_for(json: &str, policy: &UrlPolicy, major_wanted: u32) -> Result<Release, String> {
    let value: serde_json::Value = serde_json::from_str(json)
        .map_err(|e| format!("The Java download information was not understood ({e})."))?;
    let items = value
        .as_array()
        .ok_or("The Java download information had an unexpected shape.")?;
    if items.is_empty() {
        return Err(format!("The vendor did not list a Java {major_wanted} download for Windows x64."));
    }
    let mut last_problem = format!("No usable Java {major_wanted} download was listed.");
    for item in items {
        match release_from_item_for(item, policy, major_wanted) {
            Ok(r) => return Ok(r),
            Err(e) => last_problem = e,
        }
    }
    Err(last_problem)
}

fn release_from_item(item: &serde_json::Value, policy: &UrlPolicy) -> Result<Release, String> {
    release_from_item_for(item, policy, REQUIRED_MAJOR)
}

fn release_from_item_for(
    item: &serde_json::Value,
    policy: &UrlPolicy,
    major_wanted: u32,
) -> Result<Release, String> {
    let text = |v: Option<&serde_json::Value>| v.and_then(|x| x.as_str()).map(str::to_string);
    let binary = item.get("binary").ok_or("A download entry had no binary.")?;
    let pkg = binary.get("package").ok_or("A download entry had no package.")?;

    if let Some(os) = text(binary.get("os")) {
        if os != "windows" {
            return Err(format!("Unexpected operating system in download: {os}"));
        }
    }
    if let Some(arch) = text(binary.get("architecture")) {
        if arch != "x64" {
            return Err(format!("Unexpected architecture in download: {arch}"));
        }
    }
    if let Some(kind) = text(binary.get("image_type")) {
        if kind != "jre" {
            return Err(format!("Unexpected package type in download: {kind}"));
        }
    }

    let file_name = text(pkg.get("name")).ok_or("The download had no file name.")?;
    let link = text(pkg.get("link")).ok_or("The download had no address.")?;
    let sha256 = text(pkg.get("checksum"))
        .ok_or("The vendor published no checksum, so the download can't be verified.")?
        .to_ascii_lowercase();

    if !is_sha256_hex(&sha256) {
        return Err("The vendor's checksum was not a valid SHA-256 value.".to_string());
    }
    if !file_name.to_ascii_lowercase().ends_with(".zip")
        || file_name.contains('/')
        || file_name.contains('\\')
        || file_name.contains("..")
    {
        return Err(format!("Unexpected download file name: {file_name}"));
    }
    let url = Url::parse(&link).map_err(|e| format!("The download address was invalid ({e})."))?;
    policy.check(&url)?;
    if policy.https_only && !url.path().starts_with(&binary_prefix(major_wanted)) {
        return Err(format!("The download address is not an official Temurin {major_wanted} release."));
    }

    let version = text(item.get("version").and_then(|v| v.get("semver")))
        .or_else(|| text(item.get("version_data").and_then(|v| v.get("semver"))))
        .ok_or("The download had no version.")?;
    let major: u32 = version
        .split(|c: char| !c.is_ascii_digit())
        .next()
        .and_then(|m| m.parse().ok())
        .unwrap_or(0);
    if major != major_wanted {
        return Err(format!("The vendor offered Java {major}, not Java {major_wanted}."));
    }
    let release_name = text(item.get("release_name")).unwrap_or_else(|| format!("jdk-{version}"));
    let size = pkg.get("size").and_then(|s| s.as_u64());
    if let Some(s) = size {
        if s > MAX_DOWNLOAD_BYTES {
            return Err("The download is larger than expected.".to_string());
        }
    }
    Ok(Release {
        release_name,
        version,
        file_name,
        url: url.to_string(),
        sha256,
        size,
    })
}

fn http_client(policy: &UrlPolicy, timeout: Duration) -> Result<reqwest::blocking::Client, String> {
    let for_redirects = policy.clone();
    let redirect = reqwest::redirect::Policy::custom(move |attempt| {
        if attempt.previous().len() >= MAX_REDIRECTS {
            return attempt.error("Too many redirects.");
        }
        match for_redirects.check(attempt.url()) {
            Ok(()) => attempt.follow(),
            Err(e) => attempt.error(e),
        }
    });
    reqwest::blocking::Client::builder()
        .redirect(redirect)
        .connect_timeout(Duration::from_secs(20))
        .timeout(timeout)
        .user_agent(concat!("CirrusClient/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| format!("Could not set up a secure connection: {e}"))
}

fn friendly_net_error(e: &reqwest::Error) -> String {
    if e.is_timeout() {
        "The connection timed out. Check your internet connection and try again.".to_string()
    } else if e.is_connect() {
        "Could not connect. Check your internet connection (or firewall) and try again.".to_string()
    } else {
        format!("Network problem: {e}")
    }
}

pub fn fetch_release_for(
    metadata_url: &str,
    policy: &UrlPolicy,
    major: u32,
) -> Result<Release, String> {
    let url = Url::parse(metadata_url).map_err(|e| format!("Bad metadata address: {e}"))?;
    policy.check(&url)?;
    let client = http_client(policy, Duration::from_secs(30))?;
    let resp = client.get(url).send().map_err(|e| friendly_net_error(&e))?;
    if !resp.status().is_success() {
        return Err(format!(
            "The Java download service answered with an error ({}).",
            resp.status()
        ));
    }
    let mut body = String::new();
    resp.take(2 * 1024 * 1024)
        .read_to_string(&mut body)
        .map_err(|e| format!("Could not read the download information: {e}"))?;
    parse_release_for(&body, policy, major)
}

pub fn fetch_release(metadata_url: &str, policy: &UrlPolicy) -> Result<Release, String> {
    let url = Url::parse(metadata_url).map_err(|e| format!("Bad metadata address: {e}"))?;
    policy.check(&url)?;
    let client = http_client(policy, Duration::from_secs(30))?;
    let resp = client.get(url).send().map_err(|e| friendly_net_error(&e))?;
    if !resp.status().is_success() {
        return Err(format!(
            "The Java download service answered with an error ({}).",
            resp.status()
        ));
    }
    let mut body = String::new();
    resp.take(2 * 1024 * 1024)
        .read_to_string(&mut body)
        .map_err(|e| format!("Could not read the download information: {e}"))?;
    parse_release(&body, policy)
}

// ------------------------------------------------------------- download

pub fn sha256_file(path: &Path) -> std::io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 64 * 1024];
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(to_hex(&hasher.finalize()))
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn remove_file_quiet(path: &Path) {
    let _ = fs::remove_file(path);
}

/// Download `url` to `dest` (through a `.part` file), checking the SHA-256 on
/// the way. On any problem nothing is left at `dest`.
pub fn download_verified(
    url: &str,
    dest: &Path,
    expected_sha256: &str,
    policy: &UrlPolicy,
    cancel: &AtomicBool,
    on_progress: &dyn Fn(u64, Option<u64>),
) -> Result<(), InstallError> {
    let parsed = Url::parse(url).map_err(|e| InstallError::failed(format!("Bad download address: {e}")))?;
    policy.check(&parsed).map_err(InstallError::Failed)?;
    check_cancel(cancel)?;

    let part = dest.with_extension("zip.part");
    remove_file_quiet(&part);
    remove_file_quiet(dest);

    let client = http_client(policy, Duration::from_secs(30 * 60)).map_err(InstallError::Failed)?;
    let resp = client
        .get(parsed)
        .send()
        .map_err(|e| InstallError::failed(friendly_net_error(&e)))?;
    if !resp.status().is_success() {
        return Err(InstallError::failed(format!(
            "The download server answered with an error ({}).",
            resp.status()
        )));
    }
    // The final address after redirects must also be allowed.
    policy.check(resp.url()).map_err(InstallError::Failed)?;
    let total = resp.content_length();
    if let Some(t) = total {
        if t > MAX_DOWNLOAD_BYTES {
            return Err(InstallError::failed("The download is larger than expected, so it was not saved."));
        }
    }

    let result = (|| -> Result<String, InstallError> {
        let mut out = File::create(&part)
            .map_err(|e| InstallError::failed(format!("Could not create the download file: {e}")))?;
        let mut resp = resp;
        let mut hasher = Sha256::new();
        let mut buf = vec![0u8; 64 * 1024];
        let mut done: u64 = 0;
        let mut last_report = Instant::now();
        loop {
            check_cancel(cancel)?;
            let n = resp
                .read(&mut buf)
                .map_err(|e| InstallError::failed(format!("The download was interrupted: {e}")))?;
            if n == 0 {
                break;
            }
            done += n as u64;
            if done > MAX_DOWNLOAD_BYTES {
                return Err(InstallError::failed("The download is larger than expected and was stopped."));
            }
            hasher.update(&buf[..n]);
            out.write_all(&buf[..n])
                .map_err(|e| InstallError::failed(format!("Could not save the download: {e}")))?;
            if last_report.elapsed() >= Duration::from_millis(150) {
                on_progress(done, total);
                last_report = Instant::now();
            }
        }
        out.flush()
            .map_err(|e| InstallError::failed(format!("Could not save the download: {e}")))?;
        on_progress(done, total);
        if let Some(t) = total {
            if t != done {
                return Err(InstallError::failed(
                    "The download ended early (it was incomplete). Please try again.",
                ));
            }
        }
        Ok(to_hex(&hasher.finalize()))
    })();

    let actual = match result {
        Ok(a) => a,
        Err(e) => {
            remove_file_quiet(&part);
            return Err(e);
        }
    };
    if !actual.eq_ignore_ascii_case(expected_sha256) {
        remove_file_quiet(&part);
        return Err(InstallError::failed(
            "The downloaded file did not match the vendor's checksum, so it was deleted and NOT used.",
        ));
    }
    fs::rename(&part, dest).map_err(|e| {
        remove_file_quiet(&part);
        InstallError::failed(format!("Could not finish saving the download: {e}"))
    })
}

// ----------------------------------------------------------- extraction

fn io_err(what: &str, e: std::io::Error) -> InstallError {
    InstallError::failed(format!("{what}: {e}"))
}

/// Unpack `zip_path` into `target` (which must not exist yet).
pub fn extract_zip(zip_path: &Path, target: &Path, cancel: &AtomicBool) -> Result<(), InstallError> {
    let file = File::open(zip_path).map_err(|e| io_err("Could not open the archive", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| InstallError::failed(format!("The downloaded archive is not a valid zip file ({e}).")))?;
    if archive.len() == 0 || archive.len() > MAX_ENTRIES {
        return Err(InstallError::failed("The archive has an unexpected number of files."));
    }
    fs::create_dir_all(target).map_err(|e| io_err("Could not create the install folder", e))?;

    let mut total: u64 = 0;
    for i in 0..archive.len() {
        check_cancel(cancel)?;
        let mut entry = archive
            .by_index(i)
            .map_err(|e| InstallError::failed(format!("Could not read the archive ({e}).")))?;
        let relative = entry
            .enclosed_name()
            .ok_or_else(|| InstallError::failed(format!("The archive contains an unsafe path: {}", entry.name())))?;
        if let Some(mode) = entry.unix_mode() {
            if mode & 0o170000 == 0o120000 {
                return Err(InstallError::failed(format!(
                    "The archive contains a link, which is not allowed: {}",
                    entry.name()
                )));
            }
        }
        let out_path = target.join(&relative);
        if !out_path.starts_with(target) {
            return Err(InstallError::failed("The archive tried to write outside the install folder."));
        }
        if entry.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| io_err("Could not create a folder", e))?;
            continue;
        }
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent).map_err(|e| io_err("Could not create a folder", e))?;
        }
        let mut out = File::create(&out_path).map_err(|e| io_err("Could not create a file", e))?;
        let mut buf = vec![0u8; 64 * 1024];
        loop {
            let n = entry
                .read(&mut buf)
                .map_err(|e| InstallError::failed(format!("Could not unpack the archive ({e}).")))?;
            if n == 0 {
                break;
            }
            total += n as u64;
            if total > MAX_EXTRACT_BYTES {
                return Err(InstallError::failed("The archive is larger than expected when unpacked."));
            }
            out.write_all(&buf[..n]).map_err(|e| io_err("Could not write a file", e))?;
        }
    }
    Ok(())
}

/// The folder inside `extracted` that contains `bin/java`.
pub fn find_java_home(extracted: &Path) -> Option<PathBuf> {
    if extracted.join("bin").join(java::JAVA_EXE).is_file() {
        return Some(extracted.to_path_buf());
    }
    let mut found = None;
    for entry in fs::read_dir(extracted).ok()?.flatten() {
        let p = entry.path();
        if p.is_dir() && p.join("bin").join(java::JAVA_EXE).is_file() {
            if found.is_some() {
                return None; // ambiguous
            }
            found = Some(p);
        }
    }
    found
}

// ------------------------------------------------------------- install

/// Check a runtime by running it. Returns the version text it reported.
pub fn verify_runtime(java_exe: &Path) -> Result<String, String> {
    verify_runtime_for(java_exe, REQUIRED_MAJOR)
}

/// Runs the new Java and makes sure it is the major version that was asked for
/// (or newer, which is always safe within the same era).
pub fn verify_runtime_for(java_exe: &Path, wanted: u32) -> Result<String, String> {
    let output = java::run_java_version(java_exe, Duration::from_secs(30))?;
    let major = java::parse_java_major(&output)
        .ok_or_else(|| "The new Java did not report a version.".to_string())?;
    if major < wanted || (wanted == 8 && major > 8) {
        return Err(format!("The new Java reports version {major}, not {wanted}."));
    }
    Ok(java::parse_java_version_string(&output).unwrap_or_else(|| major.to_string()))
}

fn managed_root(runtime_dir: &Path) -> PathBuf {
    runtime_dir.join(MANAGED_DIR)
}

fn managed_root_for(runtime_dir: &Path, major: u32) -> PathBuf {
    runtime_dir.join(managed_dir(major))
}

/// Where the roots to search for our own runtimes are: one per installable Java.
pub fn managed_roots(runtime_dir: &Path) -> Vec<PathBuf> {
    SUPPORTED_MAJORS
        .iter()
        .map(|m| managed_root_for(runtime_dir, *m))
        .collect()
}

/// Delete leftovers of an earlier interrupted install (only inside `runtime_dir`).
pub fn clean_leftovers(runtime_dir: &Path) {
    let _ = fs::remove_dir_all(runtime_dir.join("downloads"));
    if let Ok(entries) = fs::read_dir(runtime_dir) {
        for e in entries.flatten() {
            let name = e.file_name().to_string_lossy().to_string();
            if name.starts_with(".staging-") && e.path().is_dir() {
                let _ = fs::remove_dir_all(e.path());
            }
        }
    }
}

/// Unpack a verified archive, test the runtime, and move it into place.
/// `verify` runs the new java (injected so tests don't need a real JRE).
pub fn install_from_zip(
    runtime_dir: &Path,
    zip_path: &Path,
    dir_name: &str,
    cancel: &AtomicBool,
    verify: &dyn Fn(&Path) -> Result<String, String>,
    on_progress: ProgressFn<'_>,
) -> Result<(PathBuf, String), InstallError> {
    install_from_zip_for(
        runtime_dir,
        zip_path,
        dir_name,
        cancel,
        verify,
        on_progress,
        REQUIRED_MAJOR,
    )
}

pub fn install_from_zip_for(
    runtime_dir: &Path,
    zip_path: &Path,
    dir_name: &str,
    cancel: &AtomicBool,
    verify: &dyn Fn(&Path) -> Result<String, String>,
    on_progress: ProgressFn<'_>,
    major: u32,
) -> Result<(PathBuf, String), InstallError> {
    let staging = runtime_dir.join(format!(".staging-{}", std::process::id()));
    let _ = fs::remove_dir_all(&staging);
    let cleanup = |p: &Path| {
        let _ = fs::remove_dir_all(p);
    };

    progress(on_progress, "extracting", 0, None, "Unpacking Java…");
    if let Err(e) = extract_zip(zip_path, &staging, cancel) {
        cleanup(&staging);
        return Err(e);
    }
    if let Err(e) = check_cancel(cancel) {
        cleanup(&staging);
        return Err(e);
    }
    let home = match find_java_home(&staging) {
        Some(h) => h,
        None => {
            cleanup(&staging);
            return Err(InstallError::failed("The archive did not contain a Java runtime."));
        }
    };

    progress(on_progress, "testing", 0, None, "Checking that the new Java runs…");
    let version = match verify(&home.join("bin").join(java::JAVA_EXE)) {
        Ok(v) => v,
        Err(e) => {
            cleanup(&staging);
            return Err(InstallError::failed(format!("The new Java could not be verified: {e}")));
        }
    };

    let root = managed_root_for(runtime_dir, major);
    if let Err(e) = fs::create_dir_all(&root) {
        cleanup(&staging);
        return Err(io_err("Could not create the runtime folder", e));
    }
    let final_dir = root.join(dir_name);
    if final_dir.exists() {
        // An older copy that failed verification (otherwise we would not be here).
        if let Err(e) = fs::remove_dir_all(&final_dir) {
            cleanup(&staging);
            return Err(io_err("Could not replace the old runtime folder", e));
        }
    }
    if let Err(e) = fs::rename(&home, &final_dir) {
        cleanup(&staging);
        return Err(io_err("Could not move Java into place", e));
    }
    cleanup(&staging);
    Ok((final_dir.join("bin").join(java::JAVA_EXE), version))
}

/// The newest Cirrus Client runtime that runs and is Java 21+, if any.
pub fn existing_managed(runtime_dir: &Path) -> Option<(PathBuf, String)> {
    let mut candidates = java::scan_vendor_roots(&managed_roots(runtime_dir), java::SRC_MANAGED);
    candidates.sort_by(|a, b| b.path.cmp(&a.path));
    candidates
        .into_iter()
        .find_map(|c| verify_runtime(&c.path).ok().map(|v| (c.path, v)))
}

/// The whole flow. `configured` is the Settings path (may be unset).
pub fn install_java(
    runtime_dir: &Path,
    configured: Option<&str>,
    cancel: &AtomicBool,
    on_progress: ProgressFn<'_>,
) -> Result<InstallOutcome, InstallError> {
    install_java_major(runtime_dir, configured, REQUIRED_MAJOR, cancel, on_progress)
}

pub fn install_java_major(
    runtime_dir: &Path,
    configured: Option<&str>,
    major_wanted: u32,
    cancel: &AtomicBool,
    on_progress: ProgressFn<'_>,
) -> Result<InstallOutcome, InstallError> {
    if !supported_major(major_wanted) {
        return Err(InstallError::failed(format!(
            "Cirrus Client cannot install Java {major_wanted}. It can install Java 8, 17 and 21."
        )));
    }
    progress(
        on_progress,
        "checking",
        0,
        None,
        &format!("Looking for an existing Java {major_wanted}…"),
    );
    let roots = managed_roots(runtime_dir);
    let detection = java::detect(configured, &roots);
    if let Some((path, version)) = java::first_compatible(&detection, major_wanted) {
        let managed = detection
            .installs
            .iter()
            .any(|i| i.path == path && i.source == java::SRC_MANAGED);
        let source = detection
            .installs
            .iter()
            .find(|i| i.path == path)
            .map(|i| i.source.clone())
            .unwrap_or_default();
        progress(
            on_progress,
            "done",
            0,
            None,
            &format!("Java {major_wanted} is already available."),
        );
        return Ok(InstallOutcome {
            status: "alreadyInstalled",
            java_path: path,
            version,
            source,
            managed,
        });
    }
    check_cancel(cancel)?;

    fs::create_dir_all(runtime_dir).map_err(|e| io_err("Could not create the runtime folder", e))?;
    clean_leftovers(runtime_dir);

    let policy = UrlPolicy::production();
    progress(
        on_progress,
        "metadata",
        0,
        None,
        &format!("Asking Adoptium for the current Java {major_wanted} download…"),
    );
    let release = fetch_release_for(&metadata_url(major_wanted), &policy, major_wanted)
        .map_err(InstallError::Failed)?;
    check_cancel(cancel)?;

    let dir_name = install_dir_name(&release.release_name);
    let downloads = runtime_dir.join("downloads");
    fs::create_dir_all(&downloads).map_err(|e| io_err("Could not create the download folder", e))?;
    let zip_path = downloads.join(&release.file_name);

    let note = format!("Downloading {}…", release.release_name);
    progress(on_progress, "downloading", 0, release.size, &note);
    let result = download_verified(
        &release.url,
        &zip_path,
        &release.sha256,
        &policy,
        cancel,
        &|done, total| progress(on_progress, "downloading", done, total.or(release.size), &note),
    );
    if let Err(e) = result {
        let _ = fs::remove_dir_all(&downloads);
        return Err(e);
    }
    progress(on_progress, "verifying", 0, None, "Checksum matches the vendor's. Installing…");

    let verify = |exe: &Path| verify_runtime_for(exe, major_wanted);
    let installed = install_from_zip_for(
        runtime_dir,
        &zip_path,
        &dir_name,
        cancel,
        &verify,
        on_progress,
        major_wanted,
    );
    let _ = fs::remove_dir_all(&downloads);
    let (exe, version) = installed?;
    progress(
        on_progress,
        "done",
        0,
        None,
        &format!("Java {major_wanted} is installed."),
    );
    Ok(InstallOutcome {
        status: "installed",
        java_path: exe.display().to_string(),
        version: Some(version),
        source: java::SRC_MANAGED.to_string(),
        managed: true,
    })
}

// ----------------------------------------------------------------- tests

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;
    use std::sync::atomic::AtomicUsize;

    const GOOD_SHA: &str = "6f3a7c1d2b4e5f60718293a4b5c6d7e8f9011223344556677889900aabbccdde";

    fn item(link: &str, checksum: &str, name: &str, semver: &str) -> String {
        format!(
            r#"[{{"binary":{{"os":"windows","architecture":"x64","image_type":"jre",
            "package":{{"name":"{name}","link":"{link}","checksum":"{checksum}","size":51234567}}}},
            "release_name":"jdk-21.0.5+11","version":{{"semver":"{semver}"}}}}]"#
        )
    }

    const GOOD_LINK: &str = "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.5%2B11/OpenJDK21U-jre_x64_windows_hotspot_21.0.5_11.zip";

    #[test]
    fn parses_a_normal_vendor_answer() {
        let json = item(GOOD_LINK, GOOD_SHA, "OpenJDK21U-jre_x64_windows_hotspot_21.0.5_11.zip", "21.0.5+11.0.LTS");
        let r = parse_release(&json, &UrlPolicy::production()).unwrap();
        assert_eq!(r.sha256, GOOD_SHA);
        assert_eq!(r.release_name, "jdk-21.0.5+11");
        assert_eq!(r.size, Some(51234567));
        assert!(r.url.starts_with("https://github.com/adoptium/temurin21-binaries/"));
    }

    #[test]
    fn rejects_bad_vendor_answers() {
        let p = UrlPolicy::production();
        let name = "x.zip";
        assert!(parse_release("not json", &p).is_err());
        assert!(parse_release("{}", &p).is_err());
        assert!(parse_release("[]", &p).unwrap_err().contains("did not list"));
        // missing / malformed checksum
        assert!(parse_release(&item(GOOD_LINK, "", name, "21.0.5"), &p).is_err());
        assert!(parse_release(&item(GOOD_LINK, "abc123", name, "21.0.5"), &p).is_err());
        // not a zip, or path tricks in the name
        assert!(parse_release(&item(GOOD_LINK, GOOD_SHA, "x.msi", "21.0.5"), &p).is_err());
        assert!(parse_release(&item(GOOD_LINK, GOOD_SHA, "..\\\\x.zip", "21.0.5"), &p).is_err());
        // wrong Java version
        assert!(parse_release(&item(GOOD_LINK, GOOD_SHA, name, "17.0.9+9"), &p).unwrap_err().contains("17"));
        // plain http, other host, wrong repository, credentials
        let http = GOOD_LINK.replace("https://", "http://");
        assert!(parse_release(&item(&http, GOOD_SHA, name, "21.0.5"), &p).unwrap_err().contains("HTTPS"));
        let evil = "https://evil.example.com/adoptium/temurin21-binaries/x.zip";
        assert!(parse_release(&item(evil, GOOD_SHA, name, "21.0.5"), &p).unwrap_err().contains("untrusted"));
        let other_repo = "https://github.com/someone/else/releases/download/x.zip";
        assert!(parse_release(&item(other_repo, GOOD_SHA, name, "21.0.5"), &p).is_err());
        let creds = "https://user:pw@github.com/adoptium/temurin21-binaries/x.zip";
        assert!(parse_release(&item(creds, GOOD_SHA, name, "21.0.5"), &p).is_err());
    }

    #[test]
    fn skips_unusable_entries_and_uses_the_next_one() {
        let json = format!(
            "[{},{}]",
            item(GOOD_LINK, "bad", "a.zip", "21.0.5").trim_matches(|c| c == '[' || c == ']'),
            item(GOOD_LINK, GOOD_SHA, "b.zip", "21.0.5").trim_matches(|c| c == '[' || c == ']')
        );
        assert_eq!(parse_release(&json, &UrlPolicy::production()).unwrap().file_name, "b.zip");
    }

    #[test]
    fn url_policy_allows_only_trusted_https_hosts() {
        let p = UrlPolicy::production();
        for ok in [
            "https://api.adoptium.net/v3/assets/latest/21/hotspot",
            "https://github.com/adoptium/temurin21-binaries/x.zip",
            "https://objects.githubusercontent.com/abc",
            "https://release-assets.githubusercontent.com/abc",
        ] {
            assert!(p.check(&Url::parse(ok).unwrap()).is_ok(), "{ok}");
        }
        for bad in [
            "http://github.com/x",
            "https://github.com.evil.net/x",
            "https://evilgithub.com/x",
            "https://example.com/x",
            "ftp://github.com/x",
            "https://127.0.0.1/x",
        ] {
            assert!(p.check(&Url::parse(bad).unwrap()).is_err(), "{bad}");
        }
    }

    #[test]
    fn install_dir_names_are_file_system_safe() {
        assert_eq!(install_dir_name("jdk-21.0.5+11"), "jdk-21.0.5_11-jre");
        assert_eq!(install_dir_name("a/b\\c:d"), "a_b_c_d-jre");
    }

    #[test]
    fn sha256_matches_known_values() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("f");
        fs::write(&p, b"abc").unwrap();
        assert_eq!(
            sha256_file(&p).unwrap(),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    // --- zip helpers

    fn make_zip(path: &Path, files: &[(&str, &[u8], Option<u32>)]) {
        let file = File::create(path).unwrap();
        let mut w = zip::ZipWriter::new(file);
        for (name, data, symlink) in files {
            let opts = zip::write::SimpleFileOptions::default();
            if symlink.is_some() {
                let target = String::from_utf8_lossy(data).to_string();
                w.add_symlink(*name, target, opts).unwrap();
            } else {
                w.start_file(*name, opts).unwrap();
                w.write_all(data).unwrap();
            }
        }
        w.finish().unwrap();
    }

    fn jre_zip(path: &Path) {
        let exe = format!("jdk-21.0.5+11-jre/bin/{}", java::JAVA_EXE);
        make_zip(
            path,
            &[(exe.as_str(), b"stub", None), ("jdk-21.0.5+11-jre/release", b"x", None)],
        );
    }

    fn no_progress() -> impl Fn(InstallProgress) + Sync {
        |_p| {}
    }

    #[test]
    fn extraction_unpacks_normal_archives() {
        let dir = tempfile::tempdir().unwrap();
        let zip = dir.path().join("a.zip");
        jre_zip(&zip);
        let target = dir.path().join("out");
        extract_zip(&zip, &target, &AtomicBool::new(false)).unwrap();
        let home = find_java_home(&target).unwrap();
        assert!(home.join("bin").join(java::JAVA_EXE).is_file());
    }

    #[test]
    fn extraction_refuses_zip_slip_paths() {
        let dir = tempfile::tempdir().unwrap();
        let zip = dir.path().join("evil.zip");
        make_zip(&zip, &[("../evil.txt", b"x", None)]);
        let target = dir.path().join("out");
        let err = extract_zip(&zip, &target, &AtomicBool::new(false)).unwrap_err();
        assert!(err.to_string().contains("unsafe"));
        assert!(!dir.path().join("evil.txt").exists());
    }

    #[test]
    fn extraction_refuses_symlink_entries() {
        let dir = tempfile::tempdir().unwrap();
        let zip = dir.path().join("link.zip");
        make_zip(&zip, &[("jre/link", b"/etc/passwd", Some(0o120777))]);
        let err = extract_zip(&zip, &dir.path().join("out"), &AtomicBool::new(false)).unwrap_err();
        assert!(err.to_string().contains("link"));
    }

    #[test]
    fn extraction_refuses_files_that_are_not_zips() {
        let dir = tempfile::tempdir().unwrap();
        let zip = dir.path().join("junk.zip");
        fs::write(&zip, b"this is not a zip").unwrap();
        assert!(extract_zip(&zip, &dir.path().join("out"), &AtomicBool::new(false)).is_err());
    }

    #[test]
    fn install_moves_a_verified_runtime_into_place_and_cleans_up() {
        let dir = tempfile::tempdir().unwrap();
        let runtime = dir.path().join("runtime");
        fs::create_dir_all(&runtime).unwrap();
        let zip = runtime.join("a.zip");
        jre_zip(&zip);
        let verify = |_p: &Path| -> Result<String, String> { Ok("21.0.5".to_string()) };
        let (exe, version) = install_from_zip(
            &runtime, &zip, "jdk-21.0.5_11-jre", &AtomicBool::new(false), &verify, &no_progress(),
        )
        .unwrap();
        assert_eq!(version, "21.0.5");
        assert!(exe.is_file());
        assert!(exe.starts_with(runtime.join(MANAGED_DIR)));
        let leftovers: Vec<_> = fs::read_dir(&runtime)
            .unwrap()
            .flatten()
            .filter(|e| e.file_name().to_string_lossy().starts_with(".staging-"))
            .collect();
        assert!(leftovers.is_empty());
        // The search code finds what was installed.
        let found = java::scan_vendor_roots(&managed_roots(&runtime), java::SRC_MANAGED);
        assert_eq!(found.len(), 1);
    }

    #[test]
    fn failed_verification_installs_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let runtime = dir.path().join("runtime");
        fs::create_dir_all(&runtime).unwrap();
        let zip = runtime.join("a.zip");
        jre_zip(&zip);
        let verify = |_p: &Path| -> Result<String, String> { Err("exited with an error".to_string()) };
        let err = install_from_zip(
            &runtime, &zip, "x-jre", &AtomicBool::new(false), &verify, &no_progress(),
        )
        .unwrap_err();
        assert!(err.to_string().contains("could not be verified"));
        assert!(!runtime.join(MANAGED_DIR).join("x-jre").exists());
        assert!(!runtime.join(format!(".staging-{}", std::process::id())).exists());
    }

    #[test]
    fn cancel_during_install_leaves_nothing_behind() {
        let dir = tempfile::tempdir().unwrap();
        let runtime = dir.path().join("runtime");
        fs::create_dir_all(&runtime).unwrap();
        let zip = runtime.join("a.zip");
        jre_zip(&zip);
        let verify = |_p: &Path| -> Result<String, String> { Ok("21".to_string()) };
        let err = install_from_zip(
            &runtime, &zip, "x-jre", &AtomicBool::new(true), &verify, &no_progress(),
        )
        .unwrap_err();
        assert_eq!(err, InstallError::Cancelled);
        assert!(!runtime.join(MANAGED_DIR).exists());
    }

    #[test]
    fn leftovers_from_interrupted_installs_are_removed() {
        let dir = tempfile::tempdir().unwrap();
        let runtime = dir.path().join("runtime");
        fs::create_dir_all(runtime.join(".staging-123")).unwrap();
        fs::create_dir_all(runtime.join("downloads")).unwrap();
        fs::write(runtime.join("downloads").join("x.zip.part"), b"half").unwrap();
        fs::create_dir_all(runtime.join(MANAGED_DIR).join("keep-jre")).unwrap();
        clean_leftovers(&runtime);
        assert!(!runtime.join(".staging-123").exists());
        assert!(!runtime.join("downloads").exists());
        assert!(runtime.join(MANAGED_DIR).join("keep-jre").exists());
    }

    // --- download against a throwaway local server

    /// Serves `body` once per connection, `count` times. Returns the base URL.
    fn serve(body: Vec<u8>, count: usize, hits: std::sync::Arc<AtomicUsize>) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        std::thread::spawn(move || {
            for _ in 0..count {
                let Ok((mut stream, _)) = listener.accept() else { return };
                hits.fetch_add(1, Ordering::SeqCst);
                let mut req = [0u8; 2048];
                let _ = stream.read(&mut req);
                let head = format!(
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                );
                let _ = stream.write_all(head.as_bytes());
                let _ = stream.write_all(&body);
            }
        });
        format!("http://127.0.0.1:{port}/file.zip")
    }

    fn sha_of(data: &[u8]) -> String {
        let mut h = Sha256::new();
        h.update(data);
        to_hex(&h.finalize())
    }

    #[test]
    fn download_with_matching_checksum_succeeds() {
        let dir = tempfile::tempdir().unwrap();
        let body = vec![7u8; 300_000];
        let url = serve(body.clone(), 1, Default::default());
        let dest = dir.path().join("a.zip");
        let seen = std::sync::Mutex::new(Vec::new());
        download_verified(
            &url, &dest, &sha_of(&body), &UrlPolicy::local_test(), &AtomicBool::new(false),
            &|done, total| seen.lock().unwrap().push((done, total)),
        )
        .unwrap();
        assert_eq!(fs::read(&dest).unwrap(), body);
        assert!(!dest.with_extension("zip.part").exists());
        let seen = seen.into_inner().unwrap();
        assert_eq!(seen.last().unwrap(), &(300_000, Some(300_000)));
    }

    #[test]
    fn download_with_wrong_checksum_is_deleted_and_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let body = vec![1u8; 10_000];
        let url = serve(body, 1, Default::default());
        let dest = dir.path().join("a.zip");
        let err = download_verified(
            &url, &dest, GOOD_SHA, &UrlPolicy::local_test(), &AtomicBool::new(false), &|_, _| {},
        )
        .unwrap_err();
        assert!(err.to_string().contains("did not match"));
        assert!(!dest.exists());
        assert!(!dest.with_extension("zip.part").exists());
    }

    #[test]
    fn cancelled_download_never_touches_the_network() {
        let dir = tempfile::tempdir().unwrap();
        let hits = std::sync::Arc::new(AtomicUsize::new(0));
        let url = serve(vec![0u8; 10], 1, hits.clone());
        let dest = dir.path().join("a.zip");
        let err = download_verified(
            &url, &dest, GOOD_SHA, &UrlPolicy::local_test(), &AtomicBool::new(true), &|_, _| {},
        )
        .unwrap_err();
        assert_eq!(err, InstallError::Cancelled);
        assert_eq!(hits.load(Ordering::SeqCst), 0);
        assert!(!dest.exists());
    }

    #[test]
    fn download_from_an_untrusted_host_is_refused_before_connecting() {
        let dir = tempfile::tempdir().unwrap();
        let err = download_verified(
            "https://evil.example.com/a.zip", &dir.path().join("a.zip"), GOOD_SHA,
            &UrlPolicy::production(), &AtomicBool::new(false), &|_, _| {},
        )
        .unwrap_err();
        assert!(err.to_string().contains("untrusted"));
    }

    #[test]
    fn unreachable_server_gives_a_readable_error_and_no_files() {
        let dir = tempfile::tempdir().unwrap();
        // Port 1 on localhost is closed on any normal machine.
        let err = download_verified(
            "http://127.0.0.1:1/a.zip", &dir.path().join("a.zip"), GOOD_SHA,
            &UrlPolicy::local_test(), &AtomicBool::new(false), &|_, _| {},
        )
        .unwrap_err();
        assert!(matches!(err, InstallError::Failed(_)));
        assert!(fs::read_dir(dir.path()).unwrap().next().is_none());
    }

    #[test]
    fn fetch_release_refuses_untrusted_metadata_hosts() {
        assert!(fetch_release("https://evil.example.com/v3/assets", &UrlPolicy::production()).is_err());
        assert!(fetch_release("http://api.adoptium.net/v3/assets", &UrlPolicy::production()).is_err());
    }

    #[test]
    fn existing_managed_runtime_is_none_when_empty() {
        let dir = tempfile::tempdir().unwrap();
        assert!(existing_managed(dir.path()).is_none());
    }
}
