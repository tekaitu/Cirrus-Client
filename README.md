# Cirrus Client

A Windows launcher for **Minecraft Java Edition 1.21.11** (Fabric), aimed at competitive sword PvP on lower-to-mid-range hardware. Built with Tauri 2 (Rust) + React + TypeScript.

> ## Status: interface and diagnostics build
> **This is not a working Minecraft launcher yet.** What works today:
> - **Home** shows the Cirrus Client branding, the Minecraft 1.21.11 target, Fabric status, the Java installation found on your PC, and a Play section.
> - **Settings** (memory, custom Java path with a test button, game folder, reduce motion) are validated, saved to a file in your app config folder and restored on the next start. A damaged settings file is backed up and replaced with defaults, and Settings has a reset button.
> - **Java installer**: when no compatible Java is found, "Install Java 21" downloads Eclipse Temurin 21 from Adoptium, verifies its SHA-256 checksum, and installs it into Cirrus Client's own folder (no administrator rights; PATH, registry and Windows settings are untouched). See [docs/SECURITY.md](docs/SECURITY.md). **Not yet tested on a real PC.**
> - **Microsoft sign-in** (official device-code flow, refresh token in Windows Credential Manager) is implemented but **not verified against the real services**: it needs your own Azure app ID in Settings and Mojang's approval. See [docs/AUTH.md](docs/AUTH.md).
> - **Diagnostics** shows real OS, CPU and RAM information and every Java installation found (JAVA_HOME, PATH, common install folders, the Minecraft launcher's runtimes), with a copyable report.
> - **Fabric companion (first slice)**: a separate Minecraft 1.21.11 Fabric mod adds a Cirrus entry to the title and pause screens and provides a working route to Minecraft Options. It is not yet installed by the launcher; account sync, cosmetics, friends, store and HUD editing are not connected.
>
> **Not implemented yet:** the Play button is disabled on purpose. The launcher does not yet download or install Minecraft/Fabric or launch the game. The companion mod is built separately and is not yet installed by the launcher.
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
npx tauri build --no-bundle   # produces src-tauri/target/release/cirrus-client.exe
```

The Fabric companion requires JDK 21 or newer. From `fabric-mod`, build it with `./gradlew.bat build`; see [fabric-mod/README.md](fabric-mod/README.md).

## Continuous integration

`.github/workflows/build-windows.yml` runs on `windows-latest` for pushes to `main`, pull requests and manual runs (`workflow_dispatch`). It type-checks, runs the frontend (Vitest) and Rust tests, builds the executable, verifies it exists and is non-empty, then uploads it as the workflow artifact **CirrusClient-windows-exe** (kept 14 days). Nothing is published as a Release automatically, and `.exe` files are never committed.

The workflow also uploads a `generated-lockfiles` artifact. No lockfiles are committed yet because they could not be generated in the environment where this skeleton was written. Commit them from that artifact so builds become reproducible, then switch the workflow to `npm ci`.

## Known limitations

- The `.exe` is not code-signed, so Windows SmartScreen may warn.
- Running it needs the Microsoft WebView2 runtime.
- No license has been chosen for this repository yet, so all rights are reserved by default. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Playing, versions and mods

- **Online and offline:** Playing online uses your Microsoft account (sign in once, it is remembered). Playing offline with a player name needs no sign-in and works for singleplayer and offline-mode servers. Cirrus Client is for people who own Minecraft: Java Edition; offline mode relies on that honesty, and signing in is what proves it. See `LICENSE`.
- **Versions:** Minecraft 1.20.5 and newer (all Java 21), with Fabric or plain Vanilla. Each version/loader pair has its own folder under `instances/` for worlds, options and mods. Older versions need Java 8/17 installs, which are not built yet.
- **Set up & play:** one click installs Java 21 (checksum verified), then Minecraft and Fabric, then starts the game.
- **Mods:** the Mods tab searches Modrinth (no key needed) and CurseForge (needs `LIMITEDFPS_CF_API_KEY` as a GitHub secret at build time). Downloads come only from the providers' hosts and are checked against published hashes. Required dependencies are installed too.
- **OptiFine:** not installed automatically (its download requires a manual step and its license forbids redistribution). On Fabric, the Mods tab offers two ready-made packs instead: a **Performance pack** (Sodium, Lithium, FerriteCore, Entity Culling, ImmediatelyFast, ModernFix, Dynamic FPS) and a **HUD & PvP pack** (Sodium Extra for the FPS/coordinates overlay, Modern Keystrokes, CPS+, Zoomify, Mod Menu). They are existing open-source Fabric mods from Modrinth; a mod with no build for your Minecraft version is skipped and reported.

## Desktop app layout

Home, Play, Mods, Accounts, Settings (nine sections), About and Diagnostics. The plan and its honest limits are in [docs/DESKTOP_DESIGN.md](docs/DESKTOP_DESIGN.md).
