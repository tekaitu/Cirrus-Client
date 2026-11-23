//! Crash recovery: reads the end of the launch log and the newest crash report,
//! works out the most likely cause and offers only fixes that are safe and
//! explainable. Nothing is applied here; the interface confirms a fix first and
//! the backend backs up the previous settings before writing.
//!
//! Honesty rules followed throughout: a guess is labelled as a guess, evidence
//! quotes the lines it is based on, and when nothing is recognised the report
//! says so instead of inventing a cause.

use serde::Serialize;

/// What the launcher knows about the instance that crashed, so the advice can
/// match the version that actually ran rather than a fixed Java 21 rule.
#[derive(Debug, Clone, Default)]
pub struct Context {
    pub minecraft: String,
    pub required_java: Option<u32>,
    pub java_major: Option<u32>,
    pub memory_mb: Option<u32>,
    pub total_ram_mb: Option<u64>,
    pub fabric: bool,
    pub loader_version: Option<String>,
}

/// One suggested fix. `kind` tells the interface which command to run; the
/// value is what to set (memory in MB, Java major, and so on).
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Fix {
    /// `memory`, `java`, `repair`, `loader`, `mods` or `driver`.
    pub kind: String,
    pub label: String,
    pub detail: String,
    pub value: Option<String>,
    /// True when the fix writes to the instance or the settings.
    pub changes_settings: bool,
}

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Diagnosis {
    /// Plain sentence: what most likely happened.
    pub cause: String,
    /// `high`, `medium` or `low`. Never presented as a certainty.
    pub confidence: String,
    /// The lines the guess is based on, trimmed for reading.
    pub evidence: Vec<String>,
    pub fixes: Vec<Fix>,
    /// The most useful part of the crash report, when there is one.
    pub excerpt: Option<String>,
    /// True when no known cause matched: the interface then shows the report only.
    pub unknown: bool,
}

fn memory_fix(current: Option<u32>, context: &Context) -> Fix {
    let total = context.total_ram_mb.unwrap_or(8192) as u32;
    // Half of the machine's memory, kept inside what Minecraft can use, and
    // always a step up from what is set now.
    let suggested = (total / 2).clamp(2048, 12288).max(current.unwrap_or(0) + 1024);
    Fix {
        kind: "memory".to_string(),
        label: format!("Raise the memory limit to {suggested} MB"),
        detail: format!(
            "This instance is set to {} MB. Raising it gives big modpacks room to load; it does not delete anything.",
            current.map(|m| format!("{m} MB")).unwrap_or_else(|| "the launcher default".to_string())
        ),
        value: Some(suggested.to_string()),
        changes_settings: true,
    }
}

fn lower_memory_fix(current: Option<u32>) -> Fix {
    let suggested = current.unwrap_or(4096).saturating_sub(1024).max(2048);
    Fix {
        kind: "memory".to_string(),
        label: format!("Lower the memory limit to {suggested} MB"),
        detail: "Java could not reserve that much memory. A smaller limit lets it start; you can raise it again later."
            .to_string(),
        value: Some(suggested.to_string()),
        changes_settings: true,
    }
}

fn java_fix(required: Option<u32>) -> Fix {
    let major = required.unwrap_or(21);
    Fix {
        kind: "java".to_string(),
        label: format!("Use Java {major}"),
        detail: format!(
            "Minecraft {} needs Java {major} or newer. The launcher can install it or you can pick another detected Java.",
            if major >= 17 { "this version" } else { "this old version" }
        ),
        value: Some(major.to_string()),
        changes_settings: true,
    }
}

fn repair_fix() -> Fix {
    Fix {
        kind: "repair".to_string(),
        label: "Repair the game files".to_string(),
        detail: "Checks Minecraft's own files again and downloads anything missing or damaged. Worlds, mods and settings are not touched."
            .to_string(),
        value: None,
        changes_settings: false,
    }
}

fn loader_fix(current: Option<&str>) -> Fix {
    Fix {
        kind: "loader".to_string(),
        label: "Change the Fabric Loader version".to_string(),
        detail: format!(
            "This instance runs Fabric Loader {}. Switching to a different loader keeps your worlds and mods.",
            current.unwrap_or("(unknown)")
        ),
        value: None,
        changes_settings: true,
    }
}

fn mods_fix() -> Fix {
    Fix {
        kind: "mods".to_string(),
        label: "Open this instance's mods".to_string(),
        detail: "Switch off the mod named in the report, one at a time, to find the one that breaks the game.".to_string(),
        value: None,
        changes_settings: false,
    }
}

fn driver_fix() -> Fix {
    Fix {
        kind: "driver".to_string(),
        label: "Update the graphics driver".to_string(),
        detail: "The crash happened inside Java's graphics code. Install the newest driver from your graphics card maker, then try again."
            .to_string(),
        value: None,
        changes_settings: false,
    }
}

/// Picks the lines that mention the interesting parts, so the interface can show
/// evidence without dumping the whole log.
fn evidence_for(lines: &[&str], needles: &[&str], max: usize) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for line in lines {
        let lower = line.to_lowercase();
        if needles.iter().any(|n| lower.contains(n)) {
            let trimmed = line.trim();
            if !trimmed.is_empty() && !out.iter().any(|e| e == trimmed) {
                out.push(trimmed.chars().take(240).collect());
            }
            if out.len() >= max {
                break;
            }
        }
    }
    out
}

/// The first lines of a crash report's description, which is where Minecraft
/// names the failing mod or class.
fn report_excerpt(report: Option<&str>) -> Option<String> {
    let text = report?;
    let lines: Vec<&str> = text.lines().collect();
    // The description (or the fatal-error line) is the useful part; the banner
    // above it is only a fallback when neither is present.
    let start = lines
        .iter()
        .position(|l| l.starts_with("Description:") || l.starts_with("# A fatal error"))
        .or_else(|| lines.iter().position(|l| l.starts_with("---- Minecraft Crash Report ----")))
        .unwrap_or(0);
    let excerpt: Vec<&str> = lines
        .iter()
        .skip(start)
        .filter(|l| !l.trim().is_empty())
        .take(18)
        .copied()
        .collect();
    if excerpt.is_empty() {
        None
    } else {
        Some(excerpt.join("\n"))
    }
}

fn none_cause() -> Diagnosis {
    Diagnosis {
        cause: "The launcher could not identify the cause of this crash from the log.".to_string(),
        confidence: "low".to_string(),
        evidence: Vec::new(),
        fixes: vec![repair_fix()],
        excerpt: None,
        unknown: true,
    }
}

/// Read the log end and crash report and produce a diagnosis.
pub fn diagnose(report: Option<&str>, log_tail: &str, context: &Context) -> Diagnosis {
    let mut combined = String::new();
    if let Some(r) = report {
        combined.push_str(r);
        combined.push('\n');
    }
    combined.push_str(log_tail);
    let lower = combined.to_lowercase();
    let has = |s: &str| lower.contains(&s.to_lowercase());
    let lines: Vec<&str> = combined.lines().collect();

    if has("could not reserve enough space")
        || has("could not create the java virtual machine")
        || has("invalid maximum heap size")
    {
        return Diagnosis {
            cause: "Java could not reserve the amount of memory Maple asked for.".to_string(),
            confidence: "high".to_string(),
            evidence: evidence_for(&lines, &["could not reserve", "virtual machine", "heap size"], 4),
            fixes: vec![lower_memory_fix(context.memory_mb), repair_fix()],
            excerpt: report_excerpt(report),
            unknown: false,
        };
    }
    if has("outofmemoryerror") || has("java heap space") {
        return Diagnosis {
            cause: "Minecraft ran out of memory while loading or playing.".to_string(),
            confidence: "high".to_string(),
            evidence: evidence_for(&lines, &["outofmemoryerror", "java heap space"], 4),
            fixes: vec![memory_fix(context.memory_mb, context), repair_fix()],
            excerpt: report_excerpt(report),
            unknown: false,
        };
    }
    if has("unsupportedclassversionerror") || has("class file version") || has("requires java") {
        return Diagnosis {
            cause: "The Java version used is too old for this Minecraft version or a mod.".to_string(),
            confidence: "high".to_string(),
            evidence: evidence_for(&lines, &["unsupportedclassversion", "class file version", "requires java"], 4),
            fixes: vec![java_fix(context.required_java), repair_fix()],
            excerpt: report_excerpt(report),
            unknown: false,
        };
    }
    if has("the java runtime environment has been created but the jvm could not be started") {
        return Diagnosis {
            cause: "Java started but the game's virtual machine could not be created.".to_string(),
            confidence: "medium".to_string(),
            evidence: evidence_for(&lines, &["jvm could not be started"], 3),
            fixes: vec![lower_memory_fix(context.memory_mb), java_fix(context.required_java)],
            excerpt: report_excerpt(report),
            unknown: false,
        };
    }
    if has("incompatible mod set") || has("incompatible mods found") || has("modresolutionexception") {
        let evidence = evidence_for(&lines, &["incompatible", "requires", "mod "], 6);
        return Diagnosis {
            cause: "The installed mods do not fit together, or one does not match this Minecraft version.".to_string(),
            confidence: "high".to_string(),
            evidence,
            fixes: vec![mods_fix(), repair_fix()],
            excerpt: report_excerpt(report),
            unknown: false,
        };
    }
    if has("fabric-api") && (has("which is missing") || has("requires any version of fabric-api") || has("requires version")) {
        return Diagnosis {
            cause: "A mod needs Fabric API, which is not installed.".to_string(),
            confidence: "high".to_string(),
            evidence: evidence_for(&lines, &["fabric-api", "missing", "requires"], 4),
            fixes: vec![mods_fix()],
            excerpt: report_excerpt(report),
            unknown: false,
        };
    }
    if has("mixin apply failed") || has("mixinapplyerror") || has("invalidmixinexception") || has("mixintransformererror") {
        return Diagnosis {
            cause: "A mod failed to patch the game (a Mixin error).".to_string(),
            confidence: "medium".to_string(),
            evidence: evidence_for(&lines, &["mixin", "failed"], 5),
            fixes: vec![mods_fix(), repair_fix()],
            excerpt: report_excerpt(report),
            unknown: false,
        };
    }
    if has("noclassdeffounderror") || has("classnotfoundexception") {
        return Diagnosis {
            cause: "Minecraft or a mod is missing a library it expects.".to_string(),
            confidence: "medium".to_string(),
            evidence: evidence_for(&lines, &["noclassdeffound", "classnotfound", "missing"], 5),
            fixes: vec![repair_fix(), mods_fix()],
            excerpt: report_excerpt(report),
            unknown: false,
        };
    }
    if has("exception_access_violation") || has("a fatal error has been detected by the java runtime") {
        return Diagnosis {
            cause: "Java itself crashed, which is often caused by a graphics driver or an overlay.".to_string(),
            confidence: "medium".to_string(),
            evidence: evidence_for(&lines, &["fatal error", "exception_access_violation", "problematic frame"], 5),
            fixes: vec![driver_fix(), repair_fix()],
            excerpt: report_excerpt(report),
            unknown: false,
        };
    }
    if has("glfw error") || has("wglcreatecontext") || (has("opengl") && has("failed")) {
        return Diagnosis {
            cause: "The graphics driver could not create the game window.".to_string(),
            confidence: "medium".to_string(),
            evidence: evidence_for(&lines, &["glfw", "wgl", "opengl"], 4),
            fixes: vec![driver_fix()],
            excerpt: report_excerpt(report),
            unknown: false,
        };
    }
    if has("fabric-loader") && (has("could not find") || has("does not support")) {
        return Diagnosis {
            cause: "The Fabric Loader version does not match this Minecraft version.".to_string(),
            confidence: "medium".to_string(),
            evidence: evidence_for(&lines, &["fabric", "loader"], 5),
            fixes: vec![loader_fix(context.loader_version.as_deref()), repair_fix()],
            excerpt: report_excerpt(report),
            unknown: false,
        };
    }
    if has("address already in use") || has("failed to bind") {
        return Diagnosis {
            cause: "Another copy of Minecraft is probably already running.".to_string(),
            confidence: "medium".to_string(),
            evidence: evidence_for(&lines, &["address already in use", "failed to bind"], 3),
            fixes: Vec::new(),
            excerpt: report_excerpt(report),
            unknown: false,
        };
    }
    if context.fabric && context.required_java.is_some() && context.java_major.is_some() {
        let required = context.required_java.unwrap();
        if context.java_major.unwrap() < required {
            return Diagnosis {
                cause: format!(
                    "The game closed without a clear message, and the Java in use (Java {}) is older than Minecraft {} needs (Java {required}).",
                    context.java_major.unwrap(),
                    context.minecraft
                ),
                confidence: "low".to_string(),
                evidence: evidence_for(&lines, &["java", "error", "exception"], 4),
                fixes: vec![java_fix(context.required_java), repair_fix()],
                excerpt: report_excerpt(report),
                unknown: false,
            };
        }
    }

    let mut result = none_cause();
    result.excerpt = report_excerpt(report);
    result.evidence = evidence_for(&lines, &["error", "exception", "caused by"], 5);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn context() -> Context {
        Context {
            minecraft: "1.21.11".to_string(),
            required_java: Some(21),
            java_major: Some(21),
            memory_mb: Some(4096),
            total_ram_mb: Some(16384),
            fabric: true,
            loader_version: Some("0.17.0".to_string()),
        }
    }

    #[test]
    fn out_of_memory_offers_a_higher_limit() {
        let d = diagnose(None, "java.lang.OutOfMemoryError: Java heap space", &context());
        assert!(d.cause.contains("memory"));
        assert_eq!(d.confidence, "high");
        let fix = &d.fixes[0];
        assert_eq!(fix.kind, "memory");
        assert!(fix.value.as_deref().unwrap().parse::<u32>().unwrap() > 4096);
        assert!(!d.unknown);
    }

    #[test]
    fn not_enough_memory_available_offers_a_lower_limit() {
        let d = diagnose(None, "Error occurred during initialization of VM\nCould not reserve enough space for object heap", &context());
        let fix = &d.fixes[0];
        assert_eq!(fix.kind, "memory");
        assert!(fix.value.as_deref().unwrap().parse::<u32>().unwrap() < 4096);
    }

    #[test]
    fn old_java_is_named_as_the_cause() {
        let d = diagnose(
            Some("java.lang.UnsupportedClassVersionError: class file version 65.0"),
            "",
            &Context { java_major: Some(17), ..context() },
        );
        assert!(d.cause.contains("Java"));
        assert_eq!(d.fixes[0].kind, "java");
        assert_eq!(d.fixes[0].value.as_deref(), Some("21"));
        assert!(d.evidence.iter().any(|e| e.contains("UnsupportedClassVersion")));
    }

    #[test]
    fn fabric_api_missing_points_at_mods() {
        let d = diagnose(None, "Mod 'Sodium' requires any version of fabric-api, which is missing!", &context());
        assert!(d.cause.contains("Fabric API"));
        assert_eq!(d.fixes[0].kind, "mods");
    }

    #[test]
    fn graphics_crashes_point_at_the_driver() {
        let d = diagnose(
            Some("# A fatal error has been detected by the Java Runtime Environment:\nSIGSEGV (0xb)"),
            "",
            &context(),
        );
        assert!(d.cause.to_lowercase().contains("graphics") || d.cause.to_lowercase().contains("java itself"));
        assert_eq!(d.fixes[0].kind, "driver");
    }

    #[test]
    fn an_unrecognised_crash_is_reported_as_unknown() {
        let d = diagnose(None, "Starting Minecraft\nStopping!", &context());
        assert!(d.unknown);
        assert_eq!(d.confidence, "low");
        assert!(d.cause.contains("could not identify"));
        assert_eq!(d.fixes[0].kind, "repair");
    }

    #[test]
    fn report_excerpt_starts_at_the_description() {
        let report = "---- Minecraft Crash Report ----\n// oh no\n\nDescription: Ticking entity\n\njava.lang.NullPointerException";
        let excerpt = report_excerpt(Some(report)).unwrap();
        assert!(excerpt.starts_with("Description: Ticking entity"));
        assert!(excerpt.contains("NullPointerException"));
    }

    #[test]
    fn a_memory_fix_stays_inside_reasonable_bounds() {
        let fix = memory_fix(Some(12288), &Context { total_ram_mb: Some(16384), ..context() });
        let value: u32 = fix.value.unwrap().parse().unwrap();
        assert!((2048..=16384).contains(&value));
        assert!(value > 12288);
    }
}
