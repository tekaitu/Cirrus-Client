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
- **`fabric-mod/`**: first client-only Fabric companion slice for Minecraft 1.21.11. It adds a Cirrus entry to the title and pause screens, opens the actual Minecraft Options screen, and returns to the caller. Account sync, cosmetics, and launcher installation are not connected.

Settings for memory, Java path and game folder are saved and validated now, but nothing reads them to launch Minecraft yet. The Java path does change what detection checks.

## Not implemented (plan only)
Game and Fabric installation from the launcher, launching, and performance settings. The launcher has account and mod-management code, but the game is not installed or launched by this repository. The Fabric companion is a separate build artifact and is not yet installed by the launcher.

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
| `fabric-mod/` | Client-only in-game menu foundation; future slices can add HUD controls and account-backed features after the trust and sync contracts are designed. |

## Decisions

1. **Stack:** Tauri 2 + Rust + React/TypeScript, chosen by the project owner.
2. **Java:** Minecraft 1.21.11 needs Java 21 or newer. Source: Fabric's documentation for 1.21.11, which says at least Java 21 is needed. The launcher detects runtimes (Settings path, JAVA_HOME, PATH, common install folders, the Minecraft launcher's runtimes, its own runtime folder) and can install a portable Eclipse Temurin 21 into its own folder on request, with checksum verification (see [SECURITY.md](SECURITY.md)). It never changes PATH, the registry or system settings.
3. **Authentication:** Microsoft device-code sign-in code and Windows Credential Manager support exist in `src-tauri/src/auth.rs`; the real Microsoft/Xbox/XSTS/Minecraft service flow still needs owner app registration and verification. Passwords are never handled. Tokens must never be logged.
4. **Install and launch (proposed):** a time-boxed spike in Milestone 3 tries the Rust library Lyceris, pinned to an exact version, against a fixed set of criteria (see [LIBRARY-EVALUATION.md](LIBRARY-EVALUATION.md)). If it fails any criterion, we implement the install and launch steps ourselves against Mojang's published version manifests. Nothing is reused until its license and behavior have been checked.
5. **Performance:** no FPS or latency claims until measured on the target PC (Ryzen 5 PRO 4650G, Vega 7, 16 GB, Windows 10). Every optimization must be documented and reversible.

## Unresolved risks

1. **Mojang approval for Microsoft sign-in (blocking for Milestone 3).** Third-party documentation says a new Azure app registration is rejected by the Minecraft services (HTTP 403 / "Invalid app registration") until Mojang approves it through a review form. This needs an Azure app registration owned by the project owner and a wait for approval. Another launcher's client ID must not be reused.
2. **Launcher library not inspected.** Lyceris's license and feature claims come from package pages. Its source was not read, and 1.21.11 support and the real sign-in flow are unverified.
3. **Fabric companion integration is incomplete.** The current mod is not installed by the launcher and has not been run in Minecraft yet.
4. **Local Fabric build availability:** this environment has no JDK or Gradle executable, so the new mod build must be confirmed by its GitHub Actions job before it can be called built.
5. **No Windows testing.** Real launch and performance testing must happen on the target PC.
6. **Unsigned executable** and WebView2 dependency (see README).
