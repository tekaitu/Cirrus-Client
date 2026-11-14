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
| Mods | Performance and HUD packs, Modrinth/CurseForge search, installed mods with on/off switches, filter |
| Accounts | Microsoft sign-in state, offline play, how credentials are stored |
| Settings | General, Appearance, Performance, Minecraft, Memory and RAM, Game directory, Launch settings, Keybinds, Updates |
| About | Version, update information, credits, Discord, GitHub, license |
| Diagnostics | Real system and Java results, copyable report (unchanged) |

Sidebar: labelled icons (collapses to icons below 960px wide). Alt + 1..6 jumps to Home, Play, Mods, Accounts, Settings, About.

## Design system
- Colours: background `#111214`, panels `#191B20`, cards `#202329`, primary `#246BFD`, secondary blue `#1455FF`, light blue `#B9DEFF`, text `#FFFFFF`, secondary text `#A0A5B0`.
- Shape: 6px radius on controls, 8px on cards. Flat surfaces, 1px borders, no glow or blur.
- Buttons: primary (blue), secondary (raised), destructive (red), quiet/icon, segmented toggle, on/off switch, chips for presets; every one has hover, pressed, focus-visible and disabled states.
- Inputs: text, number, dropdown (custom chevron), slider, checkbox/switch share one height, border and focus ring.
- Icons: one line-icon set in `src/components/Icons.tsx` (1.8px strokes). No emoji.
- Empty states have an icon, a sentence on what is missing and what to do.

## Honest limits (nothing fake)
- Keybinds: the launcher has fixed Alt+number shortcuts; they are listed but not editable. In-game keybinds belong to the in-game client.
- Updates: there is no auto-updater. The Updates section and About page say so and open the GitHub page.
- Website: no official website exists, so About shows a disabled "Not available" entry.
- Accounts: one Microsoft account at a time; "switching" means sign out and in again, or using offline play.
- Mod enable/disable renames `x.jar` to `x.jar.disabled` (Fabric ignores it). Categories for the Modrinth search are not offered because the search backend has no category filter yet.
