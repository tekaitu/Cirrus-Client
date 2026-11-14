# Security notes: Java download and install

What the "Install Java 21" button does, and the rules the code enforces (`src-tauri/src/runtime.rs`):

1. **Current metadata, no stale URL.** The download address, version and SHA-256 checksum come from the Adoptium API at run time (`api.adoptium.net/v3/assets/latest/21/hotspot?...`: Windows, x64, JRE, Eclipse).
2. **HTTPS and an allow-list only.** Every request and every redirect hop must be HTTPS on `api.adoptium.net`, `github.com` or GitHub's release-asset hosts. The first hop must be under `github.com/adoptium/temurin21-binaries/`. Anything else is refused (no mirrors, no credentials in URLs).
3. **Checksum before use.** The checksum from the API (a different host than the binary) is compared with the SHA-256 computed while downloading. A mismatch deletes the file; it is never extracted or run.
4. **Safe extraction.** Paths that escape the target folder (zip-slip), symlinks, absurd sizes and entry counts are rejected. Files are written to a staging folder inside Cirrus Client's runtime folder.
5. **Run only after verification.** The new `java.exe` is executed (`-version`) only after the checksum passed, and must report Java 21 or newer before it is moved into place with a rename.
6. **Contained.** Everything lives under the app-local data folder (`...\\com.limitedfps.app\\runtime`). Interrupted or cancelled installs delete their `.part`, download and staging files. No admin rights; no change to PATH, registry, Windows Defender or Windows Update.
7. **Settings.** Only `javaPath` is written, and only when Cirrus Client's own copy was installed. An existing system Java is reported, not modified.
8. **No re-download.** If a compatible Java is already found (Settings, JAVA_HOME, PATH, common folders, launcher runtimes, our own runtime), nothing is downloaded.

Known limits: the checksum and the binary both originate from Adoptium's infrastructure (the checksum host is separate from the binary host, but the vendor's signature, `.sig`, is not verified yet). A stalled connection can only be cancelled between data chunks; a 30-minute overall timeout applies. This was verified by unit tests and CI only; it has not been run on a real Windows PC with the real download.
