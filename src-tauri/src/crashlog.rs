//! The launch log and crash reports of the game.
//!
//! The launcher writes everything the game prints to one log file. While the game runs the interface reads new
//! text from it (`read_chunk`); when the game dies unexpectedly the interface gets the end of the log, the newest
//! crash report and a plain-language guess at the cause (`collect`). Everything shown is cleaned of access tokens.

use serde::Serialize;
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

/// File name of the launch log inside the game's `logs` folder.
pub const LAUNCH_LOG: &str = "cirrus-launch.log";
/// Most that is read from a crash report (the top of the report names the cause).
const MAX_REPORT_BYTES: u64 = 120 * 1024;
/// How much of the end of the log is kept for a crash.
const MAX_TAIL_BYTES: u64 = 256 * 1024;
const TAIL_LINES: usize = 250;
/// Most that one `read_chunk` call returns.
pub const CHUNK_BYTES: u64 = 64 * 1024;

/// What the interface shows after the game closed unexpectedly.
#[derive(Serialize, Clone, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct CrashInfo {
    /// A short, plain explanation of the most likely cause, when one is recognised.
    pub hint: Option<String>,
    /// The text of the newest crash report from this run (Minecraft's own, or Java's `hs_err` file).
    pub report: Option<String>,
    pub report_path: Option<String>,
    /// The last lines of the launch log.
    pub log_tail: String,
}

/// New text from the launch log, and where to continue reading next time.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LogChunk {
    pub text: String,
    pub offset: u64,
}

/// Hides access tokens: the value after `--accessToken`, long `eyJ…` tokens, and every given secret.
pub fn redact(text: &str, secrets: &[&str]) -> String {
    let mut out = text.to_string();
    for s in secrets {
        if s.len() >= 8 {
            out = out.replace(s, "[hidden]");
        }
    }
    out.split('\n')
        .map(|line| {
            let mut prev_was_flag = false;
            line.split(' ')
                .map(|word| {
                    let hide = prev_was_flag || looks_like_token(word);
                    prev_was_flag = word.trim() == "--accessToken";
                    if hide {
                        "[hidden]".to_string()
                    } else {
                        word.to_string()
                    }
                })
                .collect::<Vec<_>>()
                .join(" ")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn looks_like_token(word: &str) -> bool {
    let w = word.trim_matches(|c: char| !c.is_ascii_alphanumeric());
    w.len() >= 30 && w.starts_with("eyJ") && w.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'_' || b == b'-')
}

/// The last `n` lines of `text`.
pub fn tail_lines(text: &str, n: usize) -> String {
    let lines: Vec<&str> = text.lines().collect();
    let start = lines.len().saturating_sub(n);
    lines[start..].join("\n")
}

/// A plain-language guess at why the game stopped, from the crash report and the end of the log.
pub fn diagnose(text: &str) -> Option<String> {
    let t = text.to_lowercase();
    let has = |s: &str| t.contains(&s.to_lowercase());
    let hint = if has("outofmemoryerror") {
        "Minecraft ran out of memory. Give it more in Settings > Memory and RAM, or switch off heavy mods."
    } else if has("could not reserve enough space") || has("could not create the java virtual machine") {
        "Java could not start with the amount of memory chosen. Lower it in Settings > Memory and RAM."
    } else if has("unsupportedclassversionerror") || has("class file version") {
        "A mod or Minecraft needs a newer Java than the one used. Install Java 21 from Cirrus Client and try again."
    } else if has("fabric-api") && (has("which is missing") || has("requires any version of fabric-api") || has("requires version")) {
        "A mod needs Fabric API, which is not installed. Install Fabric API from the Mods page."
    } else if has("incompatible mod set") || has("incompatible mods found") || has("modresolutionexception") {
        "Some mods do not fit together, or do not match this Minecraft version. Switch off the mods named in the report."
    } else if has("mixin apply failed") || has("mixinapplyerror") || has("invalidmixinexception") || has("mixintransformererror") {
        "A mod failed to change the game (a Mixin error). Switch off the mod named in the report."
    } else if has("noclassdeffounderror") || has("classnotfoundexception") {
        "A mod is missing a part it needs, often a library mod. Check the mods named in the report."
    } else if has("exception_access_violation") || has("a fatal error has been detected by the java runtime") {
        "Java itself crashed, often because of a graphics driver. Update your graphics driver and try without rendering mods."
    } else if has("glfw error") || has("wglcreatecontext") || (has("opengl") && has("failed")) {
        "The graphics driver could not set up the game window. Update your graphics driver."
    } else {
        return None;
    };
    Some(hint.to_string())
}

/// Reads at most `max` bytes from the start of a file as text; adds a note when it was cut.
pub fn read_start(path: &Path, max: u64) -> Option<String> {
    let mut file = fs::File::open(path).ok()?;
    let len = file.metadata().ok()?.len();
    let mut buf = Vec::new();
    file.by_ref().take(max).read_to_end(&mut buf).ok()?;
    let mut text = String::from_utf8_lossy(&buf).into_owned();
    if len > max {
        text.push_str("\n… (the rest of this file was left out)");
    }
    Some(text)
}

/// Reads at most `max` bytes from the end of a file as text.
pub fn read_end(path: &Path, max: u64) -> Option<String> {
    let mut file = fs::File::open(path).ok()?;
    let len = file.metadata().ok()?.len();
    let start = len.saturating_sub(max);
    file.seek(SeekFrom::Start(start)).ok()?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf).ok()?;
    Some(String::from_utf8_lossy(&buf).into_owned())
}

/// Adds the newest file in `dir` that `wanted` accepts and that is not older than `floor`.
fn scan(dir: &Path, floor: SystemTime, wanted: fn(&str) -> bool, best: &mut Option<(SystemTime, PathBuf)>) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if !wanted(&name) {
            continue;
        }
        let Ok(modified) = entry.metadata().and_then(|m| m.modified()) else { continue };
        if modified < floor {
            continue;
        }
        if best.as_ref().map_or(true, |(t, _)| modified > *t) {
            *best = Some((modified, entry.path()));
        }
    }
}

fn is_crash_report(name: &str) -> bool {
    name.ends_with(".txt")
}

fn is_java_crash_file(name: &str) -> bool {
    name.starts_with("hs_err_pid") && name.ends_with(".log")
}

/// The newest Minecraft crash report or Java `hs_err` file written since `since` (a little slack for clocks).
pub fn latest_crash_report(instance: &Path, since: SystemTime) -> Option<PathBuf> {
    let floor = since.checked_sub(Duration::from_secs(3)).unwrap_or(since);
    let mut best = None;
    scan(&instance.join("crash-reports"), floor, is_crash_report, &mut best);
    scan(instance, floor, is_java_crash_file, &mut best);
    best.map(|(_, p)| p)
}

/// Everything the crash screen shows.
pub fn collect(instance: &Path, log: &Path, since: SystemTime, secrets: &[&str]) -> CrashInfo {
    let log_tail = read_end(log, MAX_TAIL_BYTES)
        .map(|t| redact(&tail_lines(&t, TAIL_LINES), secrets))
        .unwrap_or_default();
    let report_path = latest_crash_report(instance, since);
    let report = report_path
        .as_ref()
        .and_then(|p| read_start(p, MAX_REPORT_BYTES))
        .map(|t| redact(&t, secrets));
    let both = format!("{}\n{}", report.as_deref().unwrap_or(""), log_tail);
    CrashInfo {
        hint: diagnose(&both),
        report,
        report_path: report_path.map(|p| p.display().to_string()),
        log_tail,
    }
}

/// New text of the launch log from `offset` on. A file that got shorter (a new launch) is read from its start.
pub fn read_chunk(path: &Path, offset: u64, secrets: &[&str]) -> LogChunk {
    let Ok(mut file) = fs::File::open(path) else {
        return LogChunk { text: String::new(), offset: 0 };
    };
    let len = file.metadata().map(|m| m.len()).unwrap_or(0);
    let from = if offset > len { 0 } else { offset };
    if file.seek(SeekFrom::Start(from)).is_err() {
        return LogChunk { text: String::new(), offset: from };
    }
    let mut buf = Vec::new();
    if file.take(CHUNK_BYTES).read_to_end(&mut buf).is_err() {
        return LogChunk { text: String::new(), offset: from };
    }
    // Never cut a character in half: keep the incomplete end for the next call.
    let (text, used) = match std::str::from_utf8(&buf) {
        Ok(s) => (s.to_string(), buf.len()),
        Err(e) if e.error_len().is_none() => (String::from_utf8_lossy(&buf[..e.valid_up_to()]).into_owned(), e.valid_up_to()),
        Err(_) => (String::from_utf8_lossy(&buf).into_owned(), buf.len()),
    };
    LogChunk { text: redact(&text, secrets), offset: from + used as u64 }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn access_tokens_are_hidden() {
        let jwt = format!("eyJ{}", "a1B2c3".repeat(10));
        let text = format!("args: --username Steve --accessToken SECRETVALUE --uuid 1\nbearer {jwt}.x\nplain line");
        let clean = redact(&text, &["SECRETVALUE"]);
        assert!(!clean.contains("SECRETVALUE"));
        assert!(!clean.contains("eyJa1B2"));
        assert!(clean.contains("--username Steve"));
        assert!(clean.contains("plain line"));
        // Spacing and line breaks are kept.
        assert_eq!(redact("a  b\n\tc", &[]), "a  b\n\tc");
    }

    #[test]
    fn short_secrets_are_not_used_to_rewrite_the_text() {
        assert_eq!(redact("abc abc", &["abc"]), "abc abc");
    }

    #[test]
    fn the_end_of_a_log_keeps_the_last_lines() {
        assert_eq!(tail_lines("1\n2\n3\n4", 2), "3\n4");
        assert_eq!(tail_lines("only", 5), "only");
    }

    #[test]
    fn common_crashes_get_a_plain_explanation() {
        let cases = [
            ("java.lang.OutOfMemoryError: Java heap space", "ran out of memory"),
            ("Error: Could not create the Java Virtual Machine.", "could not start"),
            ("java.lang.UnsupportedClassVersionError: class file version 65.0", "newer Java"),
            ("Mod 'Sodium' requires any version of fabric-api, which is missing!", "Fabric API"),
            ("net.fabricmc.loader.impl.FormattedException: Incompatible mod set!", "do not fit together"),
            ("org.spongepowered.asm.mixin.transformer.throwables.MixinTransformerError", "Mixin"),
            ("EXCEPTION_ACCESS_VIOLATION (0xc0000005)", "graphics driver"),
        ];
        for (text, expect) in cases {
            let hint = diagnose(text).unwrap_or_default();
            assert!(hint.contains(expect), "{text} -> {hint}");
        }
        assert_eq!(diagnose("everything is fine"), None);
    }

    #[test]
    fn the_newest_report_of_this_run_is_found() {
        let dir = tempfile::tempdir().unwrap();
        let crashes = dir.path().join("crash-reports");
        fs::create_dir_all(&crashes).unwrap();
        let since = SystemTime::now();
        fs::write(crashes.join("crash-2026.txt"), "Description: Ticking entity\nOutOfMemoryError").unwrap();
        fs::write(crashes.join("notes.md"), "not a report").unwrap();
        let found = latest_crash_report(dir.path(), since).unwrap();
        assert!(found.ends_with("crash-2026.txt"));
        // A report from before the run does not count.
        let later = SystemTime::now() + Duration::from_secs(3600);
        assert!(latest_crash_report(dir.path(), later).is_none());
    }

    #[test]
    fn a_crash_collects_the_log_end_the_report_and_a_hint() {
        let dir = tempfile::tempdir().unwrap();
        let log = dir.path().join("launch.log");
        let since = SystemTime::now();
        fs::write(&log, "line one\n--accessToken TOPSECRET99 go\nlast line").unwrap();
        fs::create_dir_all(dir.path().join("crash-reports")).unwrap();
        fs::write(dir.path().join("crash-reports/crash-1.txt"), "java.lang.OutOfMemoryError").unwrap();
        let info = collect(dir.path(), &log, since, &["TOPSECRET99"]);
        assert!(info.log_tail.contains("last line"));
        assert!(!info.log_tail.contains("TOPSECRET99"));
        assert!(info.report.as_deref().unwrap().contains("OutOfMemoryError"));
        assert!(info.hint.unwrap().contains("memory"));
        assert!(info.report_path.unwrap().ends_with("crash-1.txt"));
    }

    #[test]
    fn the_log_is_read_in_pieces_and_restarts_when_it_is_replaced() {
        let dir = tempfile::tempdir().unwrap();
        let log = dir.path().join("launch.log");
        fs::write(&log, "first\n").unwrap();
        let a = read_chunk(&log, 0, &[]);
        assert_eq!(a.text, "first\n");
        let mut f = fs::OpenOptions::new().append(true).open(&log).unwrap();
        f.write_all("second\n".as_bytes()).unwrap();
        let b = read_chunk(&log, a.offset, &[]);
        assert_eq!(b.text, "second\n");
        assert_eq!(read_chunk(&log, b.offset, &[]).text, "");
        // A new launch replaces the file with a shorter one.
        fs::write(&log, "new\n").unwrap();
        assert_eq!(read_chunk(&log, b.offset, &[]).text, "new\n");
        // A missing file is an empty log, not an error.
        assert_eq!(read_chunk(&dir.path().join("none.log"), 5, &[]).text, "");
    }

    #[test]
    fn half_a_character_waits_for_the_rest() {
        let dir = tempfile::tempdir().unwrap();
        let log = dir.path().join("launch.log");
        let bytes = "é".as_bytes(); // two bytes
        fs::write(&log, [b"ok ".as_slice(), &bytes[..1]].concat()).unwrap();
        let a = read_chunk(&log, 0, &[]);
        assert_eq!(a.text, "ok ");
        fs::write(&log, ["ok ".as_bytes(), bytes].concat()).unwrap();
        let b = read_chunk(&log, a.offset, &[]);
        assert_eq!(b.text, "é");
    }
}
