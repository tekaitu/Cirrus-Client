//! OptiFine, installed from the jar the person downloaded from optifine.net.
//!
//! OptiFine's official download is a windowed installer, so this launcher never
//! runs it. Instead it takes the jar the person already has and does what that
//! installer would have done for a vanilla setup:
//!
//! - it checks that the file really is an OptiFine build for that instance's
//!   Minecraft version, and says what it found when it is not;
//! - it keeps the jar in the game's `libraries/optifine/Optifine/<edition>/`
//!   folder, where the game reads it from;
//! - it makes sure launchwrapper is there, because OptiFine starts through it;
//! - the launch then uses `net.minecraft.launchwrapper.Launch` with
//!   `--tweakClass optifine.OptiFineTweaker` instead of the plain main class.
//!
//! OptiFine 1.13 and newer boots through a different launchwrapper build that
//! this launcher does not install, so those jars are refused with a message
//! rather than started into a crash.

use crate::game::{self, Download};
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;

/// Mojang's own launchwrapper, the tweaker loader OptiFine starts through.
const LAUNCHWRAPPER_URL: &str =
    "https://libraries.minecraft.net/net/minecraft/launchwrapper/1.12/launchwrapper-1.12.jar";
/// SHA-1 and size of exactly that file on libraries.minecraft.net.
const LAUNCHWRAPPER_SHA1: &str = "111e7bea9c968cdb3d06ef4632bf7ff0824d0f36";
const LAUNCHWRAPPER_SIZE: u64 = 32_999;

/// The class every OptiFine build for 1.8 and newer contains. A jar without it
/// is something else wearing an OptiFine name.
const TWEAKER_CLASS: &str = "optifine/OptiFineTweaker.class";

/// Bigger than any OptiFine jar (the largest is around 8 MB).
const MAX_JAR_BYTES: usize = 200 * 1024 * 1024;

/// What a jar turned out to be.
#[derive(Debug, Clone, PartialEq)]
pub struct OptifineJar {
    /// The Minecraft release the jar is built for, e.g. `1.8.9`.
    pub minecraft: String,
    /// The OptiFine release, e.g. `1.8.9_HD_U_M5`.
    pub edition: String,
}

/// `OptiFine_1.8.9_HD_U_M5.jar` -> Minecraft `1.8.9`, edition `1.8.9_HD_U_M5`.
/// The `_MOD.jar` the installer's Extract button writes is accepted too.
pub fn parse_file_name(name: &str) -> Result<OptifineJar, String> {
    let lower = name.to_ascii_lowercase();
    if !lower.ends_with(".jar") {
        return Err("Choose the OptiFine .jar file you downloaded, not another file.".to_string());
    }
    let stem = &name[..name.len() - 4];
    let stem = stem
        .strip_suffix("_MOD")
        .or_else(|| stem.strip_suffix("_mod"))
        .unwrap_or(stem);
    if !stem.to_ascii_lowercase().starts_with("optifine_") {
        return Err(format!(
            "“{name}” is not named like an OptiFine jar. The file is usually called OptiFine_1.8.9_HD_U_M5.jar."
        ));
    }
    let rest = &stem["OptiFine_".len()..];
    let (minecraft, tail) = rest.split_once('_').ok_or_else(|| {
        format!("“{name}” does not name an OptiFine version and a Minecraft version in the usual way.")
    })?;
    if !game::supported_release(minecraft) {
        return Err(format!(
            "That jar is for Minecraft {minecraft}, which this launcher cannot set up. It installs 1.8 and newer releases."
        ));
    }
    let edition = format!("{minecraft}_{tail}");
    if !valid_edition(&edition) {
        return Err(format!("“{name}” has characters in its version that cannot be used in a folder."));
    }
    Ok(OptifineJar { minecraft: minecraft.to_string(), edition })
}

/// An edition is a folder name, so it is checked instead of trusted.
pub fn valid_edition(edition: &str) -> bool {
    !edition.is_empty()
        && edition.len() <= 64
        && !edition.starts_with('.')
        && edition
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '.' || c == '-')
}

/// Where the OptiFine jar lives, in the same Maven-shaped layout the game uses.
pub fn jar_path(root: &Path, edition: &str) -> PathBuf {
    root.join("libraries")
        .join("optifine")
        .join("Optifine")
        .join(edition)
        .join(format!("Optifine-{edition}.jar"))
}

/// Where launchwrapper lives.
pub fn launchwrapper_path(root: &Path) -> PathBuf {
    root.join("libraries")
        .join("net")
        .join("minecraft")
        .join("launchwrapper")
        .join("1.12")
        .join("launchwrapper-1.12.jar")
}

/// OptiFine 1.13 and newer need a launchwrapper build this launcher does not
/// ship; 1.8 - 1.12 boot through Mojang's 1.12 release.
fn launchwrapper_fits(minecraft: &str) -> bool {
    let mut parts = minecraft.split('.');
    let major = parts.next().and_then(|p| p.parse::<u32>().ok());
    let minor = parts.next().and_then(|p| p.parse::<u32>().ok());
    matches!((major, minor), (Some(1), Some(m)) if m <= 12)
}

/// Reads the jar's central directory and refuses anything that is not OptiFine.
fn check_jar(bytes: &[u8]) -> Result<(), String> {
    if bytes.len() > MAX_JAR_BYTES {
        return Err("That jar is larger than any OptiFine release, so it was not used.".to_string());
    }
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes))
        .map_err(|_| "That file is not a jar Maple can read. Choose the .jar OptiFine itself gave you.".to_string())?;
    let mut tweaker = false;
    for index in 0..archive.len() {
        match archive.by_index(index) {
            Ok(entry) => {
                if entry.name() == TWEAKER_CLASS {
                    tweaker = true;
                }
            }
            Err(_) => return Err("That jar is damaged: one of its files could not be read.".to_string()),
        }
    }
    if !tweaker {
        return Err(format!(
            "That jar has no {TWEAKER_CLASS}, so it is not an OptiFine build. If OptiFine's installer gave you a file ending in _MOD.jar, choose that one."
        ));
    }
    Ok(())
}

/// Downloads launchwrapper once, checking it against the published hash.
fn ensure_launchwrapper(path: &Path) -> Result<(), String> {
    if path.is_file() {
        let good = fs::metadata(path).map(|m| m.len() == LAUNCHWRAPPER_SIZE).unwrap_or(false);
        if good {
            return Ok(());
        }
        // A wrong-sized file is either old or broken; it is replaced below.
        let _ = fs::remove_file(path);
    }
    let download = Download {
        url: LAUNCHWRAPPER_URL.to_string(),
        path: path.to_path_buf(),
        sha1: Some(LAUNCHWRAPPER_SHA1.to_string()),
        size: Some(LAUNCHWRAPPER_SIZE),
        quick_check: false,
    };
    let client = game::client()?;
    game::download_one(&client, &download, &AtomicBool::new(false)).map_err(|e| match e {
        game::GameError::Cancelled => "The download was cancelled.".to_string(),
        game::GameError::Failed(message) => format!("launchwrapper could not be downloaded: {message}"),
    })?;
    if !path.is_file() {
        return Err("launchwrapper could not be downloaded, so OptiFine was not installed.".to_string());
    }
    Ok(())
}

/// Install the jar into `root` for `minecraft`. Returns the edition that is now
/// ready to launch.
pub fn install(root: &Path, minecraft: &str, file_name: &str, bytes: &[u8]) -> Result<String, String> {
    let parsed = parse_file_name(file_name)?;
    if parsed.minecraft != minecraft {
        return Err(format!(
            "That jar is OptiFine for Minecraft {}, but this instance is Minecraft {minecraft}. Download the matching OptiFine for {minecraft}.",
            parsed.minecraft
        ));
    }
    if !launchwrapper_fits(minecraft) {
        return Err(format!(
            "OptiFine for Minecraft {minecraft} starts through a newer launchwrapper build, which this launcher does not install yet. It can set up OptiFine for 1.8 to 1.12."
        ));
    }
    check_jar(bytes)?;

    // launchwrapper first: a failed download must not leave a half install behind.
    ensure_launchwrapper(&launchwrapper_path(root))?;

    let dest = jar_path(root, &parsed.edition);
    if let Some(dir) = dest.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("Could not create the OptiFine folder: {e}"))?;
    }
    let tmp = dest.with_extension("jar.part");
    fs::write(&tmp, bytes).map_err(|e| format!("Could not save the OptiFine jar: {e}"))?;
    fs::rename(&tmp, &dest).map_err(|e| format!("Could not save the OptiFine jar: {e}"))?;
    Ok(parsed.edition)
}

/// The jars OptiFine adds to the classpath: launchwrapper, then OptiFine.
pub fn classpath(root: &Path, edition: &str) -> Result<Vec<PathBuf>, String> {
    if !valid_edition(edition) {
        return Err("The saved OptiFine version is not usable, so OptiFine was left out. Add its jar again.".to_string());
    }
    let jar = jar_path(root, edition);
    if !jar.is_file() {
        return Err(format!(
            "OptiFine {edition} is no longer in the game's libraries folder. Add its jar again in the Versions panel."
        ));
    }
    let launchwrapper = launchwrapper_path(root);
    if !launchwrapper.is_file() {
        return Err("launchwrapper is missing, so OptiFine cannot start. Add the OptiFine jar again.".to_string());
    }
    Ok(vec![launchwrapper, jar])
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn reads_the_jar_name_optifine_uses() {
        let jar = parse_file_name("OptiFine_1.8.9_HD_U_M5.jar").unwrap();
        assert_eq!(jar.minecraft, "1.8.9");
        assert_eq!(jar.edition, "1.8.9_HD_U_M5");
        // The installer's Extract button writes this one.
        let extracted = parse_file_name("OptiFine_1.8.9_HD_U_M5_MOD.jar").unwrap();
        assert_eq!(extracted, jar);
        assert_eq!(parse_file_name("OptiFine_1.12.2_HD_U_G5.jar").unwrap().minecraft, "1.12.2");
    }

    #[test]
    fn refuses_names_that_are_not_optifine() {
        assert!(parse_file_name("optifine_1.8.9_HD_U_M5.zip").is_err());
        assert!(parse_file_name("RandomMod.jar").is_err());
        assert!(parse_file_name("OptiFine.jar").is_err());
        assert!(parse_file_name("OptiFine_1.8.9.jar").is_err());
        assert!(parse_file_name("OptiFine_1.7.10_HD_U_E7.jar").is_err(), "1.8 and newer only");
        assert!(parse_file_name("OptiFine_1.8.9_HD_U_M5/../x.jar").is_err());
    }

    #[test]
    fn editions_are_safe_folder_names() {
        assert!(valid_edition("1.8.9_HD_U_M5"));
        assert!(valid_edition("1.12.2_HD_U_G5"));
        assert!(!valid_edition(""));
        assert!(!valid_edition(".."));
        assert!(!valid_edition("../etc"));
        assert!(!valid_edition("a/b"));
        assert!(!valid_edition("a\\b"));
    }

    #[test]
    fn refuses_a_file_that_is_not_a_jar() {
        let err = check_jar(b"this is not a zip file").unwrap_err();
        assert!(err.contains("not a jar"), "{err}");
        // An empty archive has no OptiFine class in it.
        let empty_zip: &[u8] = b"PK\x05\x06\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0";
        assert!(check_jar(empty_zip).is_err());
    }

    #[test]
    fn install_refuses_the_wrong_minecraft_before_anything_is_written() {
        let dir = tempdir().unwrap();
        let err = install(dir.path(), "1.20.1", "OptiFine_1.8.9_HD_U_M5.jar", b"nope").unwrap_err();
        assert!(err.contains("Minecraft 1.8.9"), "{err}");
        assert!(!jar_path(dir.path(), "1.8.9_HD_U_M5").exists());
    }

    #[test]
    fn install_refuses_newer_releases_with_a_reason() {
        let dir = tempdir().unwrap();
        let err = install(dir.path(), "1.20.1", "OptiFine_1.20.1_HD_U_I6.jar", b"nope").unwrap_err();
        assert!(err.contains("newer launchwrapper"), "{err}");
    }

    #[test]
    fn install_refuses_a_jar_that_is_not_optifine() {
        let dir = tempdir().unwrap();
        let err = install(dir.path(), "1.8.9", "OptiFine_1.8.9_HD_U_M5.jar", b"not a zip").unwrap_err();
        assert!(err.contains("not a jar"), "{err}");
        assert!(!jar_path(dir.path(), "1.8.9_HD_U_M5").exists());
        // Nothing was fetched for a jar that never checked out.
        assert!(!launchwrapper_path(dir.path()).exists());
    }

    #[test]
    fn the_classpath_is_launchwrapper_then_optifine() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        assert!(classpath(root, "1.8.9_HD_U_M5").is_err(), "a missing jar is reported");
        fs::create_dir_all(jar_path(root, "1.8.9_HD_U_M5").parent().unwrap()).unwrap();
        fs::write(jar_path(root, "1.8.9_HD_U_M5"), b"jar").unwrap();
        assert!(classpath(root, "1.8.9_HD_U_M5").is_err(), "launchwrapper is still missing");
        fs::create_dir_all(launchwrapper_path(root).parent().unwrap()).unwrap();
        fs::write(launchwrapper_path(root), b"lw").unwrap();
        let jars = classpath(root, "1.8.9_HD_U_M5").unwrap();
        assert_eq!(jars.len(), 2);
        assert!(jars[0].ends_with("launchwrapper-1.12.jar"));
        assert!(jars[1].ends_with("Optifine-1.8.9_HD_U_M5.jar"));
        assert!(classpath(root, "../etc").is_err());
    }
}
