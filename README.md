# Limited FPS

A Windows launcher for **Minecraft Java Edition 1.21.11** (Fabric), aimed at competitive sword PvP on lower-to-mid-range hardware. Built with Tauri 2 (Rust) + React + TypeScript.

> ## Status: interface and diagnostics build
> **This is not a working Minecraft launcher yet.** What works today:
> - **Home** shows the Limited FPS branding, the Minecraft 1.21.11 target, Fabric status, the Java installation found on your PC, and a Play section.
> - **Settings** (memory, custom Java path with a test button, game folder, reduce motion) are validated, saved to a file in your app config folder and restored on the next start. A damaged settings file is backed up and replaced with defaults, and Settings has a reset button.
> - **Java installer**: when no compatible Java is found, "Install Java 21" downloads Eclipse Temurin 21 from Adoptium, verifies its SHA-256 checksum, and installs it into Limited FPS's own folder (no administrator rights; PATH, registry and Windows settings are untouched). See [docs/SECURITY.md](docs/SECURITY.md). **Not yet tested on a real PC.**
> - **Diagnostics** shows real OS, CPU and RAM information and every Java installation found (JAVA_HOME, PATH, common install folders, the Minecraft launcher's runtimes), with a copyable report.
>
> **Not implemented yet:** the Play button is disabled on purpose. There is no Microsoft sign-in, no game download, no Fabric installation and no launching. Fabric and the game show as "Not installed" because nothing can install them yet.
>
> A green CI build shows that the code compiles and the automated tests pass on a Windows runner. It does not prove Minecraft launches, and it says nothing about FPS or input latency. No performance numbers exist, and none are promised.

## Planned scope

Minecraft 1.21.11 with Fabric, Java detection, instance and mod management, official Microsoft sign-in, launch logs and diagnostics, and documented, reversible performance settings. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the plan and [docs/LIBRARY-EVALUATION.md](docs/LIBRARY-EVALUATION.md) for the open risks.

Out of scope, permanently: cheats, aim assist, auto-clickers, combat automation, packet manipulation, anti-cheat evasion, and disabling Windows security features.

## Development

Requirements: Node.js 20+, a stable Rust toolchain, and the [Tauri 2 prerequisites](https://tauri.app/start/prerequisites/) (on Windows: Microsoft C++ Build Tools and WebView2).

```powershell
npm install
npm run typecheck
npm test                 # unit + component tests (Vitest, jsdom)
npm run build            # builds the frontend into dist/
cd src-tauri; cargo test --lib; cd ..   # Rust unit tests
npx tauri dev            # run the app
npx tauri build --no-bundle   # produces src-tauri/target/release/limited-fps.exe
```

## Continuous integration

`.github/workflows/build-windows.yml` runs on `windows-latest` for pushes to `main`, pull requests and manual runs (`workflow_dispatch`). It type-checks, runs the frontend (Vitest) and Rust tests, builds the executable, verifies it exists and is non-empty, then uploads it as the workflow artifact **LimitedFPS-windows-exe** (kept 14 days). Nothing is published as a Release automatically, and `.exe` files are never committed.

The workflow also uploads a `generated-lockfiles` artifact. No lockfiles are committed yet because they could not be generated in the environment where this skeleton was written. Commit them from that artifact so builds become reproducible, then switch the workflow to `npm ci`.

## Known limitations

- The `.exe` is not code-signed, so Windows SmartScreen may warn.
- Running it needs the Microsoft WebView2 runtime.
- No license has been chosen for this repository yet, so all rights are reserved by default. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
