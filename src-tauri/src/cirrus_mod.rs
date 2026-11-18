//! The Cirrus Fabric mod ships inside the launcher. Every time a Fabric game starts, the embedded
//! copy is placed into that profile's mods folder (replacing an older one) and Fabric API, which the
//! mod needs, is downloaded once if it is missing. Players never have to install anything by hand.

use crate::mods::{self, Provider};
use std::fs;
use std::path::Path;

/// The mod jar built from `fabric-mod/`, or empty when this build was made without one.
pub const EMBEDDED: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/cirrus-mod.jar"));
/// Stable file name so a newer launcher replaces the mod instead of leaving two copies.
pub const FILE_NAME: &str = "cirrus-client-fabric.jar";

#[derive(Debug, PartialEq, Eq)]
pub enum SyncOutcome {
    /// This build has no mod jar embedded.
    NotBundled,
    /// The installed copy already matched.
    Unchanged,
    /// A new or updated copy was written.
    Written,
}

pub fn is_bundled() -> bool {
    !EMBEDDED.is_empty()
}

/// Make sure `mods_dir` holds exactly the given mod jar, switched on.
pub fn sync(mods_dir: &Path, bytes: &[u8]) -> Result<SyncOutcome, String> {
    if bytes.is_empty() {
        return Ok(SyncOutcome::NotBundled);
    }
    fs::create_dir_all(mods_dir).map_err(|e| format!("Could not create the mods folder: {e}"))?;
    // A copy the player switched off in the launcher would leave Cirrus out of the game; bring it back.
    let switched_off = mods_dir.join(format!("{FILE_NAME}{}", mods::DISABLED_SUFFIX));
    if switched_off.is_file() {
        let _ = fs::remove_file(&switched_off);
    }
    let target = mods_dir.join(FILE_NAME);
    if fs::read(&target).map(|existing| existing == bytes).unwrap_or(false) {
        return Ok(SyncOutcome::Unchanged);
    }
    let partial = mods_dir.join(format!("{FILE_NAME}.part"));
    fs::write(&partial, bytes).map_err(|e| format!("Could not write the Cirrus mod: {e}"))?;
    fs::rename(&partial, &target).map_err(|e| {
        let _ = fs::remove_file(&partial);
        format!("Could not install the Cirrus mod: {e}")
    })?;
    Ok(SyncOutcome::Written)
}

/// True when some Fabric API jar (enabled) is already in the folder.
pub fn has_fabric_api(mods_dir: &Path) -> bool {
    fs::read_dir(mods_dir)
        .map(|entries| {
            entries.flatten().any(|e| {
                let name = e.file_name().to_string_lossy().to_ascii_lowercase();
                name.starts_with("fabric-api-") && name.ends_with(".jar")
            })
        })
        .unwrap_or(false)
}

/// Everything a Fabric launch needs for Cirrus. Blocking; call from a worker thread.
pub fn prepare(mods_dir: &Path, minecraft: &str) -> Result<(), String> {
    sync(mods_dir, EMBEDDED)?;
    if is_bundled() && !has_fabric_api(mods_dir) {
        mods::install(Provider::Modrinth, "fabric-api", minecraft, mods_dir, None).map_err(|e| {
            format!("Cirrus Client needs Fabric API and could not download it ({e}). Check your internet connection and try again.")
        })?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nothing_is_written_when_no_jar_is_embedded() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(sync(dir.path(), &[]).unwrap(), SyncOutcome::NotBundled);
        assert!(!dir.path().join(FILE_NAME).exists());
    }

    #[test]
    fn installs_then_leaves_an_identical_copy_alone() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(sync(dir.path(), b"jar-v1").unwrap(), SyncOutcome::Written);
        assert_eq!(fs::read(dir.path().join(FILE_NAME)).unwrap(), b"jar-v1");
        assert_eq!(sync(dir.path(), b"jar-v1").unwrap(), SyncOutcome::Unchanged);
    }

    #[test]
    fn a_newer_launcher_replaces_the_old_mod_without_leftovers() {
        let dir = tempfile::tempdir().unwrap();
        sync(dir.path(), b"jar-v1").unwrap();
        assert_eq!(sync(dir.path(), b"jar-v2").unwrap(), SyncOutcome::Written);
        assert_eq!(fs::read(dir.path().join(FILE_NAME)).unwrap(), b"jar-v2");
        let names: Vec<_> = fs::read_dir(dir.path()).unwrap().flatten().map(|e| e.file_name().to_string_lossy().into_owned()).collect();
        assert_eq!(names, vec![FILE_NAME.to_string()]);
    }

    #[test]
    fn a_switched_off_copy_is_switched_back_on() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join(format!("{FILE_NAME}{}", mods::DISABLED_SUFFIX)), b"old").unwrap();
        sync(dir.path(), b"jar-v1").unwrap();
        assert!(dir.path().join(FILE_NAME).is_file());
        assert!(!dir.path().join(format!("{FILE_NAME}{}", mods::DISABLED_SUFFIX)).exists());
    }

    #[test]
    fn detects_fabric_api_only_when_enabled() {
        let dir = tempfile::tempdir().unwrap();
        assert!(!has_fabric_api(dir.path()));
        fs::write(dir.path().join(format!("fabric-api-0.141.6+1.21.11.jar{}", mods::DISABLED_SUFFIX)), b"x").unwrap();
        assert!(!has_fabric_api(dir.path()));
        fs::write(dir.path().join("fabric-api-0.141.6+1.21.11.jar"), b"x").unwrap();
        assert!(has_fabric_api(dir.path()));
    }
}
