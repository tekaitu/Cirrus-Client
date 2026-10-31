//! Java discovery. This module only *finds* runtimes and runs `java -version`;
//! the raw output is returned to the UI, where it is parsed and checked
//! against the Java 21 requirement (see src/core/java.ts).

use serde::Serialize;
use std::collections::HashSet;
use std::ffi::{OsStr, OsString};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

#[cfg(windows)]
const JAVA_EXE: &str = "java.exe";
#[cfg(not(windows))]
const JAVA_EXE: &str = "java";

pub const SRC_CONFIGURED: &str = "Configured in Settings";
pub const SRC_JAVA_HOME: &str = "JAVA_HOME";
pub const SRC_PATH: &str = "PATH";
pub const SRC_COMMON: &str = "Common install folder";
pub const SRC_MINECRAFT: &str = "Minecraft launcher runtime";

const MAX_CANDIDATES: usize = 24;
const RUN_TIMEOUT: Duration = Duration::from_secs(8);

#[derive(Debug, Clone, PartialEq)]
pub struct Candidate {
    pub path: PathBuf,
    pub source: &'static str,
}

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct JavaInstall {
    pub path: String,
    pub source: String,
    /// True when the program started and exited.
    pub ran: bool,
    /// Combined text printed by `java -version` (it writes to stderr).
    pub output: String,
    pub error: Option<String>,
}

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct JavaDetection {
    pub installs: Vec<JavaInstall>,
    pub candidates_checked: usize,
}

fn dedup_key(path: &Path) -> String {
    let resolved = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    resolved.to_string_lossy().replace('/', "\\").to_lowercase()
}

/// Remove duplicate paths, keeping the first (highest-priority) entry.
pub fn dedup(candidates: Vec<Candidate>) -> Vec<Candidate> {
    let mut seen = HashSet::new();
    candidates
        .into_iter()
        .filter(|c| seen.insert(dedup_key(&c.path)))
        .collect()
}

pub fn java_home_candidate(java_home: Option<OsString>) -> Option<Candidate> {
    let home = java_home?;
    if home.is_empty() {
        return None;
    }
    let path = PathBuf::from(home).join("bin").join(JAVA_EXE);
    path.is_file().then_some(Candidate {
        path,
        source: SRC_JAVA_HOME,
    })
}

pub fn path_env_candidates(path_var: &OsStr) -> Vec<Candidate> {
    std::env::split_paths(path_var)
        .filter(|dir| !dir.as_os_str().is_empty())
        .map(|dir| dir.join(JAVA_EXE))
        .filter(|p| p.is_file())
        .map(|path| Candidate {
            path,
            source: SRC_PATH,
        })
        .collect()
}

fn children(dir: &Path) -> Vec<PathBuf> {
    match std::fs::read_dir(dir) {
        Ok(rd) => rd.flatten().map(|e| e.path()).collect(),
        Err(_) => Vec::new(),
    }
}

/// Look for `<root>/<child>/bin/java` for every child folder of each root
/// (the layout used by Adoptium, Microsoft, Zulu, Corretto, Oracle, ...).
pub fn scan_vendor_roots(roots: &[PathBuf]) -> Vec<Candidate> {
    let mut found = Vec::new();
    for root in roots {
        for child in children(root) {
            let path = child.join("bin").join(JAVA_EXE);
            if path.is_file() {
                found.push(Candidate {
                    path,
                    source: SRC_COMMON,
                });
            }
        }
    }
    found
}

/// The official Minecraft launcher stores runtimes as
/// `<root>/<component>/<platform>/<component>/bin/java`.
pub fn scan_minecraft_runtime(root: &Path) -> Vec<Candidate> {
    let mut found = Vec::new();
    for component in children(root) {
        for platform in children(&component) {
            for inner in children(&platform) {
                let path = inner.join("bin").join(JAVA_EXE);
                if path.is_file() {
                    found.push(Candidate {
                        path,
                        source: SRC_MINECRAFT,
                    });
                }
            }
        }
    }
    found
}

fn env_path(name: &str) -> Option<PathBuf> {
    std::env::var_os(name)
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
}

/// Candidate order is the priority order: configured, JAVA_HOME, PATH,
/// common install folders, then the Minecraft launcher's bundled runtimes.
pub fn gather_candidates(configured: Option<&str>) -> Vec<Candidate> {
    let mut all = Vec::new();

    if let Some(p) = configured.map(str::trim).filter(|p| !p.is_empty()) {
        all.push(Candidate {
            path: PathBuf::from(p),
            source: SRC_CONFIGURED,
        });
    }
    all.extend(java_home_candidate(std::env::var_os("JAVA_HOME")));
    if let Some(path_var) = std::env::var_os("PATH") {
        all.extend(path_env_candidates(&path_var));
    }

    let mut vendor_roots = Vec::new();
    for var in ["ProgramFiles", "ProgramW6432", "ProgramFiles(x86)"] {
        if let Some(pf) = env_path(var) {
            for vendor in [
                "Java",
                "Eclipse Adoptium",
                "Microsoft",
                "Zulu",
                "Amazon Corretto",
                "BellSoft",
                "Semeru",
            ] {
                vendor_roots.push(pf.join(vendor));
            }
        }
    }
    all.extend(scan_vendor_roots(&vendor_roots));

    if let Some(appdata) = env_path("APPDATA") {
        all.extend(scan_minecraft_runtime(&appdata.join(".minecraft").join("runtime")));
    }
    if let Some(local) = env_path("LOCALAPPDATA") {
        all.extend(scan_minecraft_runtime(
            &local
                .join("Packages")
                .join("Microsoft.4297127D64EC6_8wekyb3d8bbwe")
                .join("LocalCache")
                .join("Local")
                .join("runtime"),
        ));
    }

    let mut unique = dedup(all);
    unique.truncate(MAX_CANDIDATES);
    unique
}

fn drain<R: Read + Send + 'static>(reader: Option<R>) -> std::thread::JoinHandle<String> {
    std::thread::spawn(move || {
        let mut buf = Vec::new();
        if let Some(mut r) = reader {
            let _ = r.read_to_end(&mut buf);
        }
        String::from_utf8_lossy(&buf).into_owned()
    })
}

/// Run `<java> -version` with a timeout and return everything it printed.
pub fn run_java_version(path: &Path, timeout: Duration) -> Result<String, String> {
    let mut cmd = Command::new(path);
    cmd.arg("-version")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Could not start this file: {e}"))?;
    let out = drain(child.stdout.take());
    let err = drain(child.stderr.take());

    let deadline = Instant::now() + timeout;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!("Timed out after {} seconds.", timeout.as_secs()));
                }
                std::thread::sleep(Duration::from_millis(20));
            }
            Err(e) => return Err(format!("Could not check the process: {e}")),
        }
    };

    let stderr = err.join().unwrap_or_default();
    let stdout = out.join().unwrap_or_default();
    let text = format!("{}\n{}", stderr.trim(), stdout.trim())
        .trim()
        .to_string();
    if !status.success() && text.is_empty() {
        return Err(format!("The program exited with {status} and printed nothing."));
    }
    Ok(text)
}

pub fn inspect(path: &Path, source: &str) -> JavaInstall {
    let display = path.display().to_string();
    if !path.is_file() {
        return JavaInstall {
            path: display,
            source: source.to_string(),
            ran: false,
            output: String::new(),
            error: Some("File not found.".to_string()),
        };
    }
    match run_java_version(path, RUN_TIMEOUT) {
        Ok(output) => JavaInstall {
            path: display,
            source: source.to_string(),
            ran: true,
            output,
            error: None,
        },
        Err(error) => JavaInstall {
            path: display,
            source: source.to_string(),
            ran: false,
            output: String::new(),
            error: Some(error),
        },
    }
}

pub fn detect(configured: Option<&str>) -> JavaDetection {
    let candidates = gather_candidates(configured);
    let installs = candidates
        .iter()
        .map(|c| inspect(&c.path, c.source))
        .collect();
    JavaDetection {
        installs,
        candidates_checked: candidates.len(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn touch(path: &Path) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, b"stub").unwrap();
    }

    #[test]
    fn dedup_keeps_first_entry_and_ignores_case_and_slashes() {
        let list = vec![
            Candidate {
                path: PathBuf::from("C:\\Java\\bin\\java.exe"),
                source: SRC_CONFIGURED,
            },
            Candidate {
                path: PathBuf::from("c:/java/bin/JAVA.EXE"),
                source: SRC_PATH,
            },
            Candidate {
                path: PathBuf::from("D:\\Other\\bin\\java.exe"),
                source: SRC_PATH,
            },
        ];
        let out = dedup(list);
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].source, SRC_CONFIGURED);
    }

    #[test]
    fn java_home_candidate_requires_an_existing_binary() {
        let dir = tempfile::tempdir().unwrap();
        assert!(java_home_candidate(Some(dir.path().as_os_str().to_owned())).is_none());
        assert!(java_home_candidate(None).is_none());
        assert!(java_home_candidate(Some(OsString::new())).is_none());

        touch(&dir.path().join("bin").join(JAVA_EXE));
        let found = java_home_candidate(Some(dir.path().as_os_str().to_owned())).unwrap();
        assert_eq!(found.source, SRC_JAVA_HOME);
    }

    #[test]
    fn path_env_candidates_finds_binaries_on_path() {
        let with_java = tempfile::tempdir().unwrap();
        let without = tempfile::tempdir().unwrap();
        touch(&with_java.path().join(JAVA_EXE));
        let joined =
            std::env::join_paths([without.path().to_path_buf(), with_java.path().to_path_buf()])
                .unwrap();
        let found = path_env_candidates(&joined);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].source, SRC_PATH);
        assert!(found[0].path.starts_with(with_java.path()));
    }

    #[test]
    fn scan_vendor_roots_looks_one_level_down() {
        let root = tempfile::tempdir().unwrap();
        touch(&root.path().join("jdk-21.0.4").join("bin").join(JAVA_EXE));
        touch(&root.path().join("not-java").join("readme.txt"));
        let found = scan_vendor_roots(&[root.path().to_path_buf(), PathBuf::from("missing-dir")]);
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].source, SRC_COMMON);
    }

    #[test]
    fn scan_minecraft_runtime_follows_launcher_layout() {
        let root = tempfile::tempdir().unwrap();
        touch(
            &root
                .path()
                .join("java-runtime-delta")
                .join("windows-x64")
                .join("java-runtime-delta")
                .join("bin")
                .join(JAVA_EXE),
        );
        let found = scan_minecraft_runtime(root.path());
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].source, SRC_MINECRAFT);
    }

    #[test]
    fn inspect_reports_missing_file() {
        let result = inspect(Path::new("definitely/not/a/real/java"), SRC_CONFIGURED);
        assert!(!result.ran);
        assert_eq!(result.error.as_deref(), Some("File not found."));
    }

    #[test]
    fn running_a_missing_program_is_an_error_not_a_panic() {
        let result = run_java_version(Path::new("definitely/not/a/real/java"), Duration::from_secs(2));
        assert!(result.unwrap_err().contains("Could not start"));
    }

    #[test]
    fn configured_path_is_listed_first_even_when_it_does_not_exist() {
        let list = gather_candidates(Some("Z:\\nowhere\\java.exe"));
        assert_eq!(list[0].source, SRC_CONFIGURED);
        assert_eq!(list[0].path, PathBuf::from("Z:\\nowhere\\java.exe"));
    }

    #[test]
    fn blank_configured_path_is_ignored() {
        let list = gather_candidates(Some("   "));
        assert!(list.iter().all(|c| c.source != SRC_CONFIGURED));
    }
}
