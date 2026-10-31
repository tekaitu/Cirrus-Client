# Limited FPS

A Windows launcher for **Minecraft Java Edition 1.21.11** (Fabric), aimed at competitive sword PvP on lower-to-mid-range hardware. Built with Tauri 2 (Rust) + React + TypeScript.

> ## Status: foundation build only
> **This is not a working Minecraft launcher yet.** The app opens a window and reports its status. There is no Microsoft sign-in, no Minecraft download, no Fabric setup, no Play button and no performance tuning. Those arrive in later milestones, and nothing is described as working until it has been tested for real.
>
> A green CI build only shows that the code compiles and the unit tests pass on a Windows runner. It does not prove Minecraft launches, and it says nothing about FPS or input latency. No performance numbers exist yet, and none are promised.

## Planned scope

Minecraft 1.21.11 with Fabric, Java detection, instance and mod management, official Microsoft sign-in, launch logs and diagnostics, and documented, reversible performance settings. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the plan and [docs/LIBRARY-EVALUATION.md](docs/LIBRARY-EVALUATION.md) for the open risks.

Out of scope, permanently: cheats, aim assist, auto-clickers, combat automation, packet manipulation, anti-cheat evasion, and disabling Windows security features.

## Development

Requirements: Node.js 20+, a stable Rust toolchain, and the [Tauri 2 prerequisites](https://tauri.app/start/prerequisites/) (on Windows: Microsoft C++ Build Tools and WebView2).

```powershell
npm install
npm run typecheck
npm test                 # frontend unit tests (Vitest)
npm run build            # builds the frontend into dist/
cd src-tauri; cargo test --lib; cd ..
npx tauri dev            # run the app
npx tauri build --no-bundle   # produces src-tauri/target/release/limited-fps.exe
```

## Continuous integration

`.github/workflows/build-windows.yml` runs on `windows-latest` for pushes to `main`, pull requests and manual runs (`workflow_dispatch`). It type-checks, runs the frontend and Rust tests, builds the executable, verifies it exists and is non-empty, then uploads it as the workflow artifact **LimitedFPS-windows-exe** (kept 14 days). Nothing is published as a Release automatically, and `.exe` files are never committed.

The workflow also uploads a `generated-lockfiles` artifact. No lockfiles are committed yet because they could not be generated in the environment where this skeleton was written. Commit them from that artifact so builds become reproducible, then switch the workflow to `npm ci`.

## Known limitations

- The `.exe` is not code-signed, so Windows SmartScreen may warn.
- Running it needs the Microsoft WebView2 runtime.
- No license has been chosen for this repository yet, so all rights are reserved by default. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
