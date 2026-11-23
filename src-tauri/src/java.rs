//! Java discovery. This module only *finds* runtimes and runs `java -version`;
//! the raw output is returned to the UI, where it is parsed and checked
//! against the Java 21 requirement (see src/core/java.ts). `parse_java_major`
//! below is a second, deliberately identical parser used to verify a freshly
//! installed runtime before it is trusted.

use serde::Serialize;
use std::collections::HashSet;
use std::ffi::{OsStr, OsString};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

#[cfg(windows)]
pub const JAVA_EXE: &str = "java.exe";
#[cfg(not(windows))]
pub const JAVA_EXE: &str = "java";

pub const SRC_CONFIGURED: &str = "Configured in Settings";
pub const SRC_JAVA_HOME: &str = "JAVA_HOME";
pub const SRC_PATH: &str = "PATH";
pub const SRC_COMMON: &str = "Common install folder";
pub const SRC_MINECRAFT: &str = "Minecraft launcher runtime";
pub const SRC_MANAGED: &str = "Maple Client runtime";

const MAX_CANDIDATES: usize = 40;
const RUN_TIMEOUT: Duration = Duration::from_secs(15);

/// Vendor folders that installers create inside Program Files.
const PF_VENDORS: &[&str] = &[
    "Java",
    "Eclipse Adoptium",
    "Eclipse Foundation",
    "AdoptOpenJDK",
    "Microsoft",
    "Zulu",
    "Amazon Corretto",
    "BellSoft",
    "Semeru",
    "RedHat",
    "OpenJDK",
    "GraalVM",
];

/// Per-user installers (no administrator rights) use %LOCALAPPDATA%\Programs\<vendor>.
const USER_VENDORS: &[&str] = &[
    "Eclipse Adoptium",
    "Microsoft",
    "Zulu",
    "Amazon Corretto",
    "Java",
    "OpenJDK",
];

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
    /// Plain-language record of every place that was searched and what it held.
    pub notes: Vec<String>,
}

/// Where to look, captured once so the search logic can be tested with fake folders.
#[derive(Debug, Clone, Default)]
pub struct Env {
    pub java_home: Option<OsString>,
    pub path: Option<OsString>,
    pub program_files: Vec<PathBuf>,
    pub program_files_x86: Option<PathBuf>,
    pub local_app_data: Option<PathBuf>,
    pub app_data: Option<PathBuf>,
    pub user_profile: Option<PathBuf>,
}

fn env_path(name: &str) -> Option<PathBuf> {
    std::env::var_os(name)
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
}

impl Env {
    pub fn from_process() -> Env {
        let mut program_files = Vec::new();
        for var in ["ProgramFiles", "ProgramW6432"] {
            if let Some(p) = env_path(var) {
                if !program_files.contains(&p) {
                    program_files.push(p);
                }
            }
        }
        Env {
            java_home: std::env::var_os("JAVA_HOME"),
            path: std::env::var_os("PATH"),
            program_files,
            program_files_x86: env_path("ProgramFiles(x86)"),
            local_app_data: env_path("LOCALAPPDATA"),
            app_data: env_path("APPDATA"),
            user_profile: env_path("USERPROFILE"),
        }
    }
}

pub struct Gathered {
    pub candidates: Vec<Candidate>,
    pub notes: Vec<String>,
}

// ----------------------------------------------------------------- user input

/// Remove whitespace and surrounding quotes, e.g. `"C:\Program Files\Java\bin\java.exe"`.
pub fn strip_quotes(s: &str) -> &str {
    s.trim().trim_matches(|c| c == '"' || c == '\'').trim()
}

fn is_javaw(p: &Path) -> bool {
    p.file_name()
        .and_then(|n| n.to_str())
        .map(|n| n.eq_ignore_ascii_case("javaw.exe") || n.eq_ignore_ascii_case("javaw"))
        .unwrap_or(false)
}

/// Turn what a person typed or pasted into the executable we should run:
/// quotes are removed, a JDK/JRE folder becomes `<folder>\bin\java.exe`, and
/// `javaw.exe` (which prints nothing) becomes the `java.exe` next to it.
/// If nothing matches, the cleaned path is returned so the error can name it.
pub fn resolve_user_input(raw: &str) -> PathBuf {
    let path = PathBuf::from(strip_quotes(raw));
    if path.is_dir() {
        let in_bin = path.join("bin").join(JAVA_EXE);
        if in_bin.is_file() {
            return in_bin;
        }
        let direct = path.join(JAVA_EXE);
        if direct.is_file() {
            return direct;
        }
        return path;
    }
    if is_javaw(&path) {
        let sibling = path.with_file_name(JAVA_EXE);
        if sibling.is_file() {
            return sibling;
        }
    }
    path
}

// -------------------------------------------------------------- discovery

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

/// `JAVA_HOME` normally points at the JDK folder, but people also set it to the
/// `bin` folder or wrap it in quotes; accept all of those.
pub fn java_home_candidate(java_home: Option<OsString>) -> Option<Candidate> {
    let raw = java_home?.to_string_lossy().into_owned();
    let home = PathBuf::from(strip_quotes(&raw));
    if home.as_os_str().is_empty() {
        return None;
    }
    let standard = home.join("bin").join(JAVA_EXE);
    if standard.is_file() {
        return Some(Candidate {
            path: standard,
            source: SRC_JAVA_HOME,
        });
    }
    let direct = home.join(JAVA_EXE);
    direct.is_file().then_some(Candidate {
        path: direct,
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
pub fn scan_vendor_roots(roots: &[PathBuf], source: &'static str) -> Vec<Candidate> {
    let mut found = Vec::new();
    for root in roots {
        for child in children(root) {
            let path = child.join("bin").join(JAVA_EXE);
            if path.is_file() {
                found.push(Candidate { path, source });
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

fn count_existing(dirs: &[PathBuf]) -> usize {
    dirs.iter().filter(|d| d.is_dir()).count()
}

/// Candidate order is the priority order: configured, JAVA_HOME, PATH, common
/// install folders, the Minecraft launcher's bundled runtimes, then runtimes
/// installed by Maple Client itself.
pub fn gather_with_env(env: &Env, configured: Option<&str>, managed_roots: &[PathBuf]) -> Gathered {
    let mut all: Vec<Candidate> = Vec::new();
    let mut notes: Vec<String> = Vec::new();

    // 1. The path from Settings
    match configured.map(strip_quotes).filter(|p| !p.is_empty()) {
        Some(raw) => {
            let resolved = resolve_user_input(raw);
            let state = if resolved.is_file() { "file found" } else { "not found" };
            notes.push(format!("Settings path: {} ({state})", resolved.display()));
            all.push(Candidate {
                path: resolved,
                source: SRC_CONFIGURED,
            });
        }
        None => notes.push("Settings path: not set (automatic detection)".to_string()),
    }

    // 2. JAVA_HOME
    let home_text = env
        .java_home
        .as_ref()
        .map(|h| strip_quotes(&h.to_string_lossy()).to_string())
        .filter(|h| !h.is_empty());
    match home_text {
        None => notes.push("JAVA_HOME: not set".to_string()),
        Some(home) => match java_home_candidate(Some(OsString::from(&home))) {
            Some(c) => {
                notes.push(format!("JAVA_HOME: {home} (java found)"));
                all.push(c);
            }
            None => notes.push(format!("JAVA_HOME: {home} (no java found there)")),
        },
    }

    // 3. PATH
    match &env.path {
        None => notes.push("PATH: not set".to_string()),
        Some(path_var) => {
            let folders = std::env::split_paths(path_var)
                .filter(|d| !d.as_os_str().is_empty())
                .count();
            let found = path_env_candidates(path_var);
            notes.push(format!(
                "PATH: {folders} folder(s) checked, {} contain {JAVA_EXE}",
                found.len()
            ));
            all.extend(found);
        }
    }

    // 4. Common install folders (system-wide and per-user)
    let mut pf_roots: Vec<PathBuf> = Vec::new();
    for pf in env.program_files.iter().chain(env.program_files_x86.iter()) {
        for vendor in PF_VENDORS {
            pf_roots.push(pf.join(vendor));
        }
    }
    let mut user_roots: Vec<PathBuf> = Vec::new();
    if let Some(local) = &env.local_app_data {
        for vendor in USER_VENDORS {
            user_roots.push(local.join("Programs").join(vendor));
        }
    }
    if let Some(profile) = &env.user_profile {
        user_roots.push(profile.join(".jdks"));
    }
    let mut common = scan_vendor_roots(&pf_roots, SRC_COMMON);
    common.extend(scan_vendor_roots(&user_roots, SRC_COMMON));
    for pf in env.program_files.iter().chain(env.program_files_x86.iter()) {
        let jbr = pf
            .join("Android")
            .join("Android Studio")
            .join("jbr")
            .join("bin")
            .join(JAVA_EXE);
        if jbr.is_file() {
            common.push(Candidate {
                path: jbr,
                source: SRC_COMMON,
            });
        }
    }
    let scanned = count_existing(&pf_roots) + count_existing(&user_roots);
    notes.push(format!(
        "Common install folders: {scanned} existing vendor folder(s) scanned, {} Java found",
        common.len()
    ));
    all.extend(common);

    // 5. Minecraft launcher runtimes
    let mut mc_roots: Vec<PathBuf> = Vec::new();
    if let Some(app_data) = &env.app_data {
        mc_roots.push(app_data.join(".minecraft").join("runtime"));
    }
    if let Some(local) = &env.local_app_data {
        mc_roots.push(
            local
                .join("Packages")
                .join("Microsoft.4297127D64EC6_8wekyb3d8bbwe")
                .join("LocalCache")
                .join("Local")
                .join("runtime"),
        );
    }
    if let Some(x86) = &env.program_files_x86 {
        mc_roots.push(x86.join("Minecraft Launcher").join("runtime"));
    }
    let mut minecraft = Vec::new();
    for root in &mc_roots {
        minecraft.extend(scan_minecraft_runtime(root));
        // Older launchers keep it one level up: runtime/jre-x64/bin/java.exe
        minecraft.extend(scan_vendor_roots(std::slice::from_ref(root), SRC_MINECRAFT));
    }
    notes.push(format!(
        "Minecraft launcher runtimes: {} folder(s) scanned, {} Java found",
        count_existing(&mc_roots),
        minecraft.len()
    ));
    all.extend(minecraft);

    // 6. Runtimes installed by Maple Client
    let managed = scan_vendor_roots(managed_roots, SRC_MANAGED);
    let shown = managed_roots
        .first()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|| "none".to_string());
    notes.push(format!(
        "Maple Client runtimes ({shown}): {} Java found",
        managed.len()
    ));
    all.extend(managed);

    let mut candidates = dedup(all);
    candidates.truncate(MAX_CANDIDATES);
    Gathered { candidates, notes }
}

pub fn gather_candidates(configured: Option<&str>, managed_roots: &[PathBuf]) -> Gathered {
    gather_with_env(&Env::from_process(), configured, managed_roots)
}

// ------------------------------------------------------------------ running

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

/// Like `inspect`, but for a path a person typed: quotes, folders and
/// `javaw.exe` are understood and the error messages say what to do.
pub fn inspect_user_path(input: &str, source: &str) -> JavaInstall {
    let resolved = resolve_user_input(input);
    if resolved.is_dir() {
        return JavaInstall {
            path: resolved.display().to_string(),
            source: source.to_string(),
            ran: false,
            output: String::new(),
            error: Some(format!(
                "That is a folder without bin\\{JAVA_EXE} inside. Choose the Java install folder or {JAVA_EXE} itself."
            )),
        };
    }
    if !resolved.is_file() {
        return JavaInstall {
            path: resolved.display().to_string(),
            source: source.to_string(),
            ran: false,
            output: String::new(),
            error: Some(format!("No file found at {}.", resolved.display())),
        };
    }
    inspect(&resolved, source)
}

/// Run `java -version` for every candidate, a few at a time so a slow PC is
/// not flooded with processes, keeping the priority order of the input.
fn inspect_all(candidates: &[Candidate]) -> Vec<JavaInstall> {
    let mut results = Vec::with_capacity(candidates.len());
    for chunk in candidates.chunks(6) {
        let batch: Vec<JavaInstall> = std::thread::scope(|scope| {
            let handles: Vec<_> = chunk
                .iter()
                .map(|c| scope.spawn(move || inspect(&c.path, c.source)))
                .collect();
            handles
                .into_iter()
                .zip(chunk.iter())
                .map(|(handle, c)| {
                    handle.join().unwrap_or_else(|_| JavaInstall {
                        path: c.path.display().to_string(),
                        source: c.source.to_string(),
                        ran: false,
                        output: String::new(),
                        error: Some("The check stopped unexpectedly.".to_string()),
                    })
                })
                .collect()
        });
        results.extend(batch);
    }
    results
}

pub fn detect(configured: Option<&str>, managed_roots: &[PathBuf]) -> JavaDetection {
    let gathered = gather_candidates(configured, managed_roots);
    let installs = inspect_all(&gathered.candidates);
    JavaDetection {
        installs,
        candidates_checked: gathered.candidates.len(),
        notes: gathered.notes,
    }
}

/// The first installation (in priority order) that runs and reports at least
/// `required_major`. Returns its path and the version text it printed.
pub fn first_compatible(
    detection: &JavaDetection,
    required_major: u32,
) -> Option<(String, Option<String>)> {
    detection
        .installs
        .iter()
        .find(|i| i.ran && parse_java_major(&i.output).map_or(false, |m| m >= required_major))
        .map(|i| (i.path.clone(), parse_java_version_string(&i.output)))
}

// ------------------------------------------------------------------ version

fn major_from(s: &str) -> Option<u32> {
    let digits: String = s.chars().take_while(|c| c.is_ascii_digit()).collect();
    if digits.is_empty() {
        return None;
    }
    let first: u32 = digits.parse().ok()?;
    if first == 1 {
        // Legacy scheme: "1.8.0_392" means Java 8.
        if let Some(rest) = s[digits.len()..].strip_prefix('.') {
            let second: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
            if let Ok(m) = second.parse::<u32>() {
                return Some(m);
            }
        }
    }
    Some(first)
}

/// Java major version from `java -version` (or `java --version`) output.
pub fn parse_java_major(output: &str) -> Option<u32> {
    for line in output.lines() {
        if let Some(idx) = line.find("version \"") {
            return major_from(&line[idx + "version \"".len()..]);
        }
    }
    for line in output.lines() {
        let l = line.trim();
        for prefix in ["openjdk ", "java "] {
            if let Some(rest) = l.strip_prefix(prefix) {
                if let Some(m) = major_from(rest) {
                    return Some(m);
                }
            }
        }
    }
    None
}

/// The text between the quotes in `version "21.0.4"`, e.g. `21.0.4`.
pub fn parse_java_version_string(output: &str) -> Option<String> {
    const MARKER: &str = "version \"";
    for line in output.lines() {
        if let Some(idx) = line.find(MARKER) {
            let rest = &line[idx + MARKER.len()..];
            let end = rest.find('"')?;
            return Some(rest[..end].to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn touch(path: &Path) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, b"stub").unwrap();
    }

    fn no_env() -> Env {
        Env::default()
    }

    // ---- existing behaviour -------------------------------------------------

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
        let found = scan_vendor_roots(
            &[root.path().to_path_buf(), PathBuf::from("missing-dir")],
            SRC_COMMON,
        );
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
        let result = run_java_version(
            Path::new("definitely/not/a/real/java"),
            Duration::from_secs(2),
        );
        assert!(result.unwrap_err().contains("Could not start"));
    }

    // ---- paths people type: quotes, spaces, folders, javaw ----------------

    #[test]
    fn strip_quotes_removes_whitespace_and_both_quote_styles() {
        assert_eq!(strip_quotes("  \"C:\\Program Files\\Java\\bin\\java.exe\"  "), "C:\\Program Files\\Java\\bin\\java.exe");
        assert_eq!(strip_quotes("'D:\\jdk'"), "D:\\jdk");
        assert_eq!(strip_quotes("plain"), "plain");
        assert_eq!(strip_quotes("   "), "");
    }

    #[test]
    fn resolve_user_input_accepts_a_quoted_path_with_spaces() {
        let root = tempfile::tempdir().unwrap();
        let exe = root.path().join("Program Files").join("My Java").join("bin").join(JAVA_EXE);
        touch(&exe);
        let quoted = format!("  \"{}\"  ", exe.display());
        assert_eq!(resolve_user_input(&quoted), exe);
    }

    #[test]
    fn resolve_user_input_turns_a_jdk_folder_into_its_java_exe() {
        let root = tempfile::tempdir().unwrap();
        let jdk = root.path().join("Program Files").join("jdk 21");
        let exe = jdk.join("bin").join(JAVA_EXE);
        touch(&exe);
        assert_eq!(resolve_user_input(&jdk.display().to_string()), exe);
        // the bin folder itself works too
        assert_eq!(resolve_user_input(&jdk.join("bin").display().to_string()), exe);
    }

    #[test]
    fn resolve_user_input_maps_javaw_to_java() {
        let root = tempfile::tempdir().unwrap();
        let bin = root.path().join("jdk").join("bin");
        touch(&bin.join(JAVA_EXE));
        let javaw = bin.join("javaw.exe");
        touch(&javaw);
        assert_eq!(resolve_user_input(&javaw.display().to_string()), bin.join(JAVA_EXE));
    }

    #[test]
    fn resolve_user_input_leaves_unknown_paths_alone() {
        assert_eq!(
            resolve_user_input("  \"Z:\\nowhere\\java.exe\" "),
            PathBuf::from("Z:\\nowhere\\java.exe")
        );
    }

    #[test]
    fn inspect_user_path_explains_each_failure() {
        let root = tempfile::tempdir().unwrap();
        let empty_dir = root.path().join("empty folder");
        fs::create_dir_all(&empty_dir).unwrap();

        let missing = inspect_user_path("\"Z:\\nowhere\\java.exe\"", SRC_CONFIGURED);
        assert!(!missing.ran);
        assert!(missing.error.unwrap().contains("No file found"));

        let folder = inspect_user_path(&empty_dir.display().to_string(), SRC_CONFIGURED);
        assert!(!folder.ran);
        assert!(folder.error.unwrap().contains("folder"));
    }

    #[test]
    fn java_home_may_point_at_the_bin_folder_or_be_quoted() {
        let root = tempfile::tempdir().unwrap();
        let bin = root.path().join("Program Files").join("jdk").join("bin");
        touch(&bin.join(JAVA_EXE));
        let as_bin = java_home_candidate(Some(bin.as_os_str().to_owned())).unwrap();
        assert_eq!(as_bin.source, SRC_JAVA_HOME);

        let quoted = format!("\"{}\"", bin.parent().unwrap().display());
        let as_home = java_home_candidate(Some(OsString::from(quoted))).unwrap();
        assert_eq!(as_home.path, bin.join(JAVA_EXE));
    }

    // ---- searching with a fake machine -------------------------------------

    #[test]
    fn finds_java_in_program_files_folders_that_contain_spaces() {
        let root = tempfile::tempdir().unwrap();
        let pf = root.path().join("Program Files");
        let exe = pf
            .join("Eclipse Adoptium")
            .join("jdk-21.0.4.7-hotspot")
            .join("bin")
            .join(JAVA_EXE);
        touch(&exe);
        let env = Env {
            program_files: vec![pf],
            ..no_env()
        };
        let g = gather_with_env(&env, None, &[]);
        assert_eq!(g.candidates.len(), 1);
        assert_eq!(g.candidates[0].path, exe);
        assert_eq!(g.candidates[0].source, SRC_COMMON);
        assert!(g.notes.iter().any(|n| n.starts_with("Common install folders: 1 existing")));
    }

    #[test]
    fn finds_per_user_installs_and_android_studio_runtime() {
        let root = tempfile::tempdir().unwrap();
        let local = root.path().join("Users").join("A Player").join("AppData").join("Local");
        let profile = root.path().join("Users").join("A Player");
        let adoptium = local
            .join("Programs")
            .join("Eclipse Adoptium")
            .join("jdk-21")
            .join("bin")
            .join(JAVA_EXE);
        let jdks = profile.join(".jdks").join("temurin-21").join("bin").join(JAVA_EXE);
        let pf = root.path().join("Program Files");
        let jbr = pf
            .join("Android")
            .join("Android Studio")
            .join("jbr")
            .join("bin")
            .join(JAVA_EXE);
        touch(&adoptium);
        touch(&jdks);
        touch(&jbr);
        let env = Env {
            program_files: vec![pf],
            local_app_data: Some(local),
            user_profile: Some(profile),
            ..no_env()
        };
        let g = gather_with_env(&env, None, &[]);
        let paths: Vec<_> = g.candidates.iter().map(|c| c.path.clone()).collect();
        assert!(paths.contains(&adoptium));
        assert!(paths.contains(&jdks));
        assert!(paths.contains(&jbr));
    }

    #[test]
    fn finds_minecraft_launcher_runtimes_in_both_layouts() {
        let root = tempfile::tempdir().unwrap();
        let app_data = root.path().join("AppData").join("Roaming");
        let x86 = root.path().join("Program Files (x86)");
        let modern = app_data
            .join(".minecraft")
            .join("runtime")
            .join("java-runtime-delta")
            .join("windows-x64")
            .join("java-runtime-delta")
            .join("bin")
            .join(JAVA_EXE);
        let legacy = x86
            .join("Minecraft Launcher")
            .join("runtime")
            .join("jre-x64")
            .join("bin")
            .join(JAVA_EXE);
        touch(&modern);
        touch(&legacy);
        let env = Env {
            app_data: Some(app_data),
            program_files_x86: Some(x86),
            ..no_env()
        };
        let g = gather_with_env(&env, None, &[]);
        let paths: Vec<_> = g.candidates.iter().map(|c| c.path.clone()).collect();
        assert!(paths.contains(&modern));
        assert!(paths.contains(&legacy));
        assert!(g.candidates.iter().all(|c| c.source == SRC_MINECRAFT));
    }

    #[test]
    fn managed_runtimes_are_found_and_labelled() {
        let root = tempfile::tempdir().unwrap();
        let managed_root = root.path().join("runtimes").join("temurin-21");
        let exe = managed_root.join("jdk-21.0.5_11-jre").join("bin").join(JAVA_EXE);
        touch(&exe);
        let g = gather_with_env(&no_env(), None, &[managed_root]);
        assert_eq!(g.candidates.len(), 1);
        assert_eq!(g.candidates[0].source, SRC_MANAGED);
        assert!(g.notes.iter().any(|n| n.contains("Maple Client runtimes") && n.ends_with("1 Java found")));
    }

    #[test]
    fn configured_path_comes_first_and_is_resolved() {
        let root = tempfile::tempdir().unwrap();
        let jdk = root.path().join("My JDK");
        let exe = jdk.join("bin").join(JAVA_EXE);
        touch(&exe);
        let g = gather_with_env(&no_env(), Some(&format!("\"{}\"", jdk.display())), &[]);
        assert_eq!(g.candidates[0].source, SRC_CONFIGURED);
        assert_eq!(g.candidates[0].path, exe);
        assert!(g.notes[0].contains("file found"));
    }

    #[test]
    fn invalid_configured_path_is_kept_so_the_failure_can_be_shown() {
        let g = gather_with_env(&no_env(), Some("Z:\\nowhere\\java.exe"), &[]);
        assert_eq!(g.candidates[0].source, SRC_CONFIGURED);
        assert!(g.notes[0].contains("not found"));
        let shown = inspect(&g.candidates[0].path, g.candidates[0].source);
        assert!(!shown.ran);
    }

    #[test]
    fn blank_configured_path_is_ignored() {
        let g = gather_with_env(&no_env(), Some("   "), &[]);
        assert!(g.candidates.is_empty());
        assert!(g.notes[0].contains("not set"));
    }

    #[test]
    fn missing_java_everywhere_still_explains_what_was_checked() {
        let root = tempfile::tempdir().unwrap();
        let env = Env {
            java_home: Some(OsString::from("C:\\does\\not\\exist")),
            path: Some(std::env::join_paths([root.path().to_path_buf()]).unwrap()),
            program_files: vec![root.path().join("Program Files")],
            ..no_env()
        };
        let g = gather_with_env(&env, None, &[]);
        assert!(g.candidates.is_empty());
        assert!(g.notes.iter().any(|n| n.starts_with("JAVA_HOME:") && n.contains("no java found")));
        assert!(g.notes.iter().any(|n| n.starts_with("PATH: 1 folder(s) checked, 0 contain")));
        assert_eq!(g.notes.len(), 6);
    }

    #[test]
    fn duplicates_between_sources_are_listed_once_with_the_best_source() {
        let root = tempfile::tempdir().unwrap();
        let pf = root.path().join("Program Files");
        let exe = pf.join("Java").join("jdk-21").join("bin").join(JAVA_EXE);
        touch(&exe);
        let env = Env {
            java_home: Some(exe.parent().unwrap().parent().unwrap().as_os_str().to_owned()),
            program_files: vec![pf],
            ..no_env()
        };
        let g = gather_with_env(&env, None, &[]);
        assert_eq!(g.candidates.len(), 1);
        assert_eq!(g.candidates[0].source, SRC_JAVA_HOME);
    }

    // ---- version parsing -----------------------------------------------------

    #[test]
    fn parse_java_major_handles_real_world_output() {
        let temurin = "openjdk version \"21.0.4\" 2024-07-16 LTS\nOpenJDK Runtime Environment Temurin-21.0.4+7 (build 21.0.4+7-LTS)";
        assert_eq!(parse_java_major(temurin), Some(21));
        assert_eq!(parse_java_major("java version \"1.8.0_392\"\nJava(TM) SE Runtime"), Some(8));
        assert_eq!(parse_java_major("openjdk version \"17\" 2021-09-14"), Some(17));
        assert_eq!(parse_java_major("openjdk version \"21-ea\" 2023-09-19"), Some(21));
        assert_eq!(
            parse_java_major("Picked up JAVA_TOOL_OPTIONS: -Xmx1g\nopenjdk version \"21.0.2\" 2024-01-16"),
            Some(21)
        );
    }

    #[test]
    fn parse_java_major_accepts_the_double_dash_version_style() {
        assert_eq!(parse_java_major("openjdk 21.0.4 2024-07-16 LTS\nOpenJDK Runtime"), Some(21));
        assert_eq!(parse_java_major("java 17.0.9 2023-10-17 LTS"), Some(17));
    }

    #[test]
    fn parse_java_major_rejects_unrelated_text() {
        assert_eq!(parse_java_major(""), None);
        assert_eq!(parse_java_major("command not found"), None);
        assert_eq!(parse_java_major("version without quotes 21"), None);
    }

    #[test]
    fn parse_java_version_string_returns_the_quoted_text() {
        assert_eq!(
            parse_java_version_string("openjdk version \"21.0.4\" 2024-07-16 LTS").as_deref(),
            Some("21.0.4")
        );
        assert_eq!(
            parse_java_version_string("Picked up JAVA_TOOL_OPTIONS: -Xmx1g\njava version \"1.8.0_392\"").as_deref(),
            Some("1.8.0_392")
        );
        assert_eq!(parse_java_version_string("nothing here"), None);
        assert_eq!(parse_java_version_string("openjdk version \"21.0.4"), None);
    }

    fn fake_install(path: &str, ran: bool, output: &str) -> JavaInstall {
        JavaInstall {
            path: path.to_string(),
            source: SRC_PATH.to_string(),
            ran,
            output: output.to_string(),
            error: if ran { None } else { Some("failed".to_string()) },
        }
    }

    #[test]
    fn first_compatible_skips_old_broken_and_unreadable_installs() {
        let detection = JavaDetection {
            installs: vec![
                fake_install("a", true, "openjdk version \"17.0.9\" 2023-10-17"),
                fake_install("b", false, ""),
                fake_install("c", true, "garbage"),
                fake_install("d", true, "openjdk version \"21.0.4\" 2024-07-16 LTS"),
                fake_install("e", true, "openjdk version \"25.0.1\" 2025-10-21 LTS"),
            ],
            candidates_checked: 5,
            notes: vec![],
        };
        let (path, version) = first_compatible(&detection, 21).unwrap();
        assert_eq!(path, "d");
        assert_eq!(version.as_deref(), Some("21.0.4"));
        assert!(first_compatible(&detection, 26).is_none());
    }

    #[test]
    fn first_compatible_ignores_output_from_programs_that_did_not_run() {
        let detection = JavaDetection {
            installs: vec![fake_install("a", false, "openjdk version \"21.0.4\"")],
            candidates_checked: 1,
            notes: vec![],
        };
        assert!(first_compatible(&detection, 21).is_none());
    }

    #[test]
    fn inspect_all_keeps_input_order_and_reports_each_failure() {
        let candidates: Vec<Candidate> = (0..8)
            .map(|i| Candidate {
                path: PathBuf::from(format!("definitely/not/real/java-{i}")),
                source: SRC_PATH,
            })
            .collect();
        let results = inspect_all(&candidates);
        assert_eq!(results.len(), 8);
        for (i, r) in results.iter().enumerate() {
            assert!(r.path.ends_with(&format!("java-{i}")));
            assert!(!r.ran);
            assert_eq!(r.error.as_deref(), Some("File not found."));
        }
    }
}
