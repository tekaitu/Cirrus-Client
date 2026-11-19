use std::path::{Path, PathBuf};

/// The Cirrus Fabric mod is built first (see the Windows workflow) and embedded into the launcher.
/// Set CIRRUS_MOD_JAR to point at a specific jar; otherwise fabric-mod/build/libs is searched.
/// Without a jar the launcher still builds (development), and simply has no mod to install.
fn main() {
    println!("cargo:rerun-if-env-changed=CIRRUS_MOD_JAR");
    println!("cargo:rerun-if-changed=../fabric-mod/build/libs");
    let manifest = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default());
    let out = PathBuf::from(std::env::var("OUT_DIR").expect("OUT_DIR")).join("cirrus-mod.jar");
    let source = std::env::var("CIRRUS_MOD_JAR")
        .ok()
        .map(PathBuf::from)
        .or_else(|| find_in_libs(&manifest.join("../fabric-mod/build/libs")));
    match source {
        Some(path) if path.is_file() => {
            println!("cargo:warning=Embedding the Cirrus Fabric mod: {}", path.display());
            std::fs::copy(&path, &out).expect("copy the Cirrus mod jar");
        }
        _ => {
            println!("cargo:warning=No Cirrus Fabric mod jar found; this build will not install the mod.");
            std::fs::write(&out, []).expect("write placeholder");
        }
    }
    tauri_build::build()
}

fn find_in_libs(dir: &Path) -> Option<PathBuf> {
    let mut jars: Vec<PathBuf> = std::fs::read_dir(dir)
        .ok()?
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
            name.starts_with("cirrus-fabric-") && name.ends_with(".jar") && !name.contains("-sources") && !name.contains("-dev")
        })
        .collect();
    jars.sort();
    jars.pop()
}
