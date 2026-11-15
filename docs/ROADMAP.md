# Cirrus Client roadmap and Phase Two preparation

Phase One (the desktop app) is built. Phase Two (the in-game Fabric client) has NOT been started and waits for explicit approval.

## Original Cirrus feature ideas (not built)
| Idea | Feasibility | Priority |
| --- | --- | --- |
| One-click "Performance check": launch, record frame times from a small Fabric mod, show before/after for the installed performance pack | Medium: needs the Phase Two mod to report numbers | High |
| Mod update checker: compare installed jars to the latest compatible Modrinth versions | Medium: Modrinth hash lookup exists; needs UI and safe replace | High |
| Profiles with their own mod sets (mods folder per profile) | Medium: profiles exist already; mod folders are shared today | High |
| Mod compatibility hints (marks mods that do not list the selected game version) | Easy-Medium: data is in Modrinth responses | Medium |
| Skin history and quick switch between 2 or 3 favourite skins from the Home page | Easy: library exists | Medium |
| Server list with ping and MOTD | Medium: needs a small Rust status-ping client | Medium |
| Export/import a profile as a single file to share | Medium | Low |
| Crash helper: read the latest crash report and explain the common causes | Medium | Medium |
| Auto-updater (signed Tauri updater) | Needs a signing key and release hosting | Medium |

## Phase Two architecture notes (docs only, no code yet)
- A Fabric mod ("cirrus-core") in its own Gradle module, built by the same GitHub Actions workflow, installed by the launcher into the mods folder like any other mod.
- The launcher and the mod talk through a small JSON file in the game directory (settings the mod reads at start), so no network service is needed.
- HUD elements, the HUD editor and the in-game menu sit on top of cirrus-core as separate Fabric modules so each can be switched off.
- Nothing in this repository depends on Phase Two; the desktop app works without it.
