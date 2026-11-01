# Architecture (plan)

Only what is listed under "Implemented" exists. Everything after it is a plan.

## Implemented
- **UI** (React + TypeScript, plain CSS): sidebar with Home, Settings and Diagnostics; loading, empty and error states; an error screen instead of a blank window if rendering fails; responsive layout; a disabled Play section that states launching is not available.
- **`src-tauri/src/system.rs`**: OS, CPU and RAM via the `sysinfo` crate.
- **`src-tauri/src/java.rs`**: finds Java (Settings path, JAVA_HOME, PATH, common vendor folders, Minecraft launcher runtimes), runs `java -version` with a timeout and no console window, and returns the raw output.
- **`src/core/java.ts`**: parses that output and checks it against the Java 21 requirement (one parser, unit-tested). The first compatible install in priority order is the one reported as "in use".
- **`src-tauri/src/settings.rs`**: validated settings saved atomically (write a temp file, then rename) to `settings.json` in the app config folder; a damaged or too-new file is renamed to `settings.json.corrupt` and defaults are restored; reset command.
- **Tauri commands**: `get_app_info`, `get_system_info`, `detect_java`, `inspect_java`, `load_settings`, `save_settings`, `reset_settings`.
- **Diagnostics report**: plain text built in `src/core/report.ts` from the same live data.
- Windows CI that tests, builds and verifies the executable.

Settings for memory, Java path and game folder are saved and validated now, but nothing reads them to launch Minecraft yet. The Java path does change what detection checks.

## Not implemented (plan only)
Microsoft sign-in, game and Fabric installation, launching, mod management, and performance settings. These are described in the plan below.

## Planned modules

| Module | Responsibility |
|---|---|
| UI (React) | Home, instances/mods, performance settings, diagnostics. Only controls that work are shown. |
| `settings` (Rust) | Persisted settings, validation, reset and recovery. |
| `java` (Rust) | Find installed runtimes, check them against the version requirement, allow a configured path. |
| `instances` (Rust) | Instance directories, Fabric loader install, mod list. |
| `auth` (Rust) | Official Microsoft sign-in and secure token storage. |
| `launch` (Rust) | Build launch arguments, run the game, capture logs, report errors. |
| `diagnostics` (Rust) | Launch reports, mod conflict hints, memory settings checks. |

## Decisions

1. **Stack:** Tauri 2 + Rust + React/TypeScript, chosen by the project owner.
2. **Java:** Minecraft 1.21.11 needs Java 21 or newer. Source: Fabric's documentation for 1.21.11, which says at least Java 21 is needed. The launcher detects runtimes (Settings path, JAVA_HOME, PATH, common install folders, the Minecraft launcher's runtimes, its own runtime folder) and can install a portable Eclipse Temurin 21 into its own folder on request, with checksum verification (see [SECURITY.md](SECURITY.md)). It never changes PATH, the registry or system settings.
3. **Authentication (proposed):** the standard Microsoft device-code or browser sign-in, followed by the Xbox Live, XSTS and Minecraft services exchange, then an ownership and profile check. Passwords are never handled. Refresh tokens go in Windows Credential Manager (planned, not yet tested). Tokens are never logged.
4. **Install and launch (proposed):** a time-boxed spike in Milestone 3 tries the Rust library Lyceris, pinned to an exact version, against a fixed set of criteria (see [LIBRARY-EVALUATION.md](LIBRARY-EVALUATION.md)). If it fails any criterion, we implement the install and launch steps ourselves against Mojang's published version manifests. Nothing is reused until its license and behavior have been checked.
5. **Performance:** no FPS or latency claims until measured on the target PC (Ryzen 5 PRO 4650G, Vega 7, 16 GB, Windows 10). Every optimization must be documented and reversible.

## Unresolved risks

1. **Mojang approval for Microsoft sign-in (blocking for Milestone 3).** Third-party documentation says a new Azure app registration is rejected by the Minecraft services (HTTP 403 / "Invalid app registration") until Mojang approves it through a review form. This needs an Azure app registration owned by the project owner and a wait for approval. Another launcher's client ID must not be reused.
2. **Launcher library not inspected.** Lyceris's license and feature claims come from package pages. Its source was not read, and 1.21.11 support and the real sign-in flow are unverified.
3. **Fabric loader version for 1.21.11 not confirmed.** The Fabric metadata service could not be reached from the build environment.
4. **Nothing has been compiled or run yet** in the environment where this skeleton was written, because package registries were blocked there. The first real check is the GitHub Actions run.
5. **No Windows testing.** Real launch and performance testing must happen on the target PC.
6. **Unsigned executable** and WebView2 dependency (see README).
