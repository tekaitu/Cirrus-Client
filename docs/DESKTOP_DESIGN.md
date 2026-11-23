# Cirrus Client desktop app: design plan

The desktop app comes first. The in-game Fabric client (HUD mods, in-game menus) is not started and waits for approval of this app.

## Research notes (what is borrowed as an idea, not copied)
- **Feather**: a plain left navigation, compact rectangular buttons, a mod list that is easy to scan, the Play action always in reach.
- **Lunar**: a polished home screen with a big Play button, clear status of what is installed, settings split into sections instead of one long page.
- Cirrus keeps its own identity: the supplied cloud logo and wordmark, the blue palette below, and no logos, art or exact layouts from either product.

## Navigation
| Page | Purpose |
| --- | --- |
| Home | Cirrus welcome, "The sky is the limit.", big Play button, status checks, recent activity, shortcuts, local news |
| Play | Version and loader, set-up and launch, memory/Java/game folder summary, profiles, installed versions |
| Mods | Two views. "Mod manager": card grid or list (icon, name, version, authors, description read from each jar, on/off switch, remove), filter, performance and HUD packs. "Browse mods": left filter sidebar (site, version, Modrinth categories) and a result list with Install |
| Skins | Skin library (file, username or textures link), turnable 3D preview, Classic/Slim, apply to the signed-in account, "In use" marker |
| Accounts | Microsoft sign-in state, offline play, how credentials are stored |
| Settings | General, Appearance, Performance, Minecraft, Memory and RAM, Game directory, Launch settings, Keybinds, Updates |
| About | Version, update information, credits, Discord, GitHub, license |
| Diagnostics | Real system and Java results, copyable report (unchanged) |

Title bar: Cirrus draws its own (brand, tabs, tools, account chip, minimise / maximise / close). Settings > Appearance can switch back to the normal Windows title bar. Empty areas drag the window. Top bar: brand on the left, page tabs in the middle (Home, Versions, Browse, Mods, Modpacks, Skins, Accounts), Settings / About / Diagnostics / Discord status / Re-scan Java and the account chip on the right. Tab names fold to icons below 1480px wide (names stay as tooltips and screen-reader labels). Status pills (Minecraft, Java) live in the footer. Alt + 1..9 jumps to Home, Versions, Browse, Mods, Modpacks, Skins, Accounts, Settings, About.

## UI v4 (Home, Versions, Browse, Mods, Modpacks)

- **Pages:** Home (big "version + loader" title, Play, version cards along the bottom, status / recent / shortcuts and the launcher news below), Versions (every installed version as a card plus the full launch panel and launch configuration), Browse (Modrinth / CurseForge with categories, grid or list, sort, pagination), Mods (the mod manager for the selected version), Modpacks (your profiles).
- **Not built, on purpose:** Servers and Stats. There is no backend for either, so there is no page and no fake data.
- **Backgrounds:** drawn in code (see `src/core/scene.ts`) for Classic. The Colorful theme uses the owner's own Minecraft background from `src/assets/backgrounds/colorful.jpg` on every page; no Minecraft artwork ships with the launcher. Optional Classic pictures: `home`, `library`, `browse`, `night`, `default` in the same folder (see the README there).
- **Styles:** `src/styles/tokens.css` (colours, glass, both themes), `base.css` (type, buttons, fields, dialogs), `shell.css` (window, top bar, backgrounds), `pages.css` (pages). `legacy.css` still carries the styles of Settings, Skins, About, Diagnostics and the dialogs.
- **Motion:** short hover / fade animations only; they stop with the OS "reduce motion" setting or Settings > Appearance > Reduce motion.

## Design system (v3)
- Only two appearances: **Dark** (near-black with Cirrus blue) and **Light**. Older theme names saved by earlier builds fall back to Dark. Colours are CSS variables in `src/styles.css`; the choice is stored under `unlimited.theme`.
- Home hero: an illustrated pixel sky (stars and a moon in Dark, clouds and a sun in Light) with the heading, then a **Play dock**: a raised bar holding the version, the player, a large blue **Play** button and Launch options. Readiness chips sit under it.
- Shape: 8px radius on controls, 10 to 14px on cards and the hero. Flat surfaces, 1px borders; one blue marks what is active.
- Buttons: primary (blue), secondary (raised), destructive (red), Discord (its own purple), quiet/icon, segmented toggle, on/off switch; every one has hover, pressed, focus-visible and disabled states.
- Icons: one line-icon set in `src/components/Icons.tsx`. Brand logos (Discord, GitHub) come from official SVG files placed in `src/assets/brand/` (see the README there); without them a neutral icon is shown.
- Empty states have an icon, a sentence on what is missing and what to do.

## Launch log and crash details
- While the game starts or runs, **View log** opens a live log (polled every 0.7 s from `<game folder>/logs/cirrus-launch.log`) with Copy log, Open logs folder and Stop Minecraft. Access tokens are hidden in what is shown and copied.
- If the game ends with a crash (not when the person pressed Stop), a crash window opens by itself: a plain-language likely cause when one is recognised, the newest `crash-reports` file (or Java's `hs_err` file) from that run, the end of the game log, Copy details and Open crash folder.

## Honest limits (nothing fake)
- Keybinds: the launcher has fixed Alt+number shortcuts; they are listed but not editable. In-game keybinds belong to the in-game client.
- Updates: there is no auto-updater. The Updates section and About page say so and open the GitHub page.
- Website: no official website exists, so About shows a disabled "Not available" entry.
- Accounts: one Microsoft account at a time; "switching" means sign out and in again, or using offline play.
- Skins: adding, previewing and storing skins is local and tested. Looking up a username and applying a skin call Mojang's services and are not verified against the live services yet; applying needs a Microsoft sign-in that Mojang accepts (see AUTH.md). Offline players have no account skin.
- Servers: not built, because there is no real server list or ping backend yet.
- Social icons: Discord and GitHub buttons are built to show the official logo, but the logo files are not in the repository yet. Official brand logos are not drawn by hand; drop the official `discord.svg` / `github.svg` into `src/assets/brand/` (see the README there) and they appear. Until then a neutral icon is shown.
- Launch log and crash window have been tested with unit tests and mock data only, not with a real crashing game yet.
- The custom title bar (dragging, resizing, window buttons) cannot be tested in CI; use the Settings switch for the Windows title bar if it misbehaves.
- Launcher news is left as it is until a dashboard exists to post it from.
- Mod enable/disable renames `x.jar` to `x.jar.disabled` (Fabric ignores it). Modrinth searches can be narrowed by category; CurseForge searches cannot yet.
