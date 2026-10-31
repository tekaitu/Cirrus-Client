# Architecture (plan)

Only the shell exists today. Everything below the "Implemented" line is a plan.

## Implemented
- Tauri 2 window, React + TypeScript UI, one Rust command (`get_app_info`) reporting the app version and `launcher_ready: false`.
- `src/core/java.ts`: parses `java -version` output and checks it against the Java 21 requirement, with unit tests.
- Windows CI that builds and verifies the executable.

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
2. **Java:** Minecraft 1.21.11 needs Java 21 or newer. Source: Fabric's documentation for 1.21.11, which says at least Java 21 is needed. The launcher will detect a runtime and explain what to install, rather than silently changing the system.
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
