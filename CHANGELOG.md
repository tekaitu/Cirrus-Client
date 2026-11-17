# Changelog

Every big change gets its own version number. Small fixes bump the last number (0.3.1), new features and redesigns bump the middle one (0.4.0).

## 0.3.1 — Minecraft identity, real player preview, no developer settings
- Microsoft sign-in opens in a dedicated sign-in window by default; the device code stays as a fallback.
- Account menu and Accounts page show the Minecraft player name and skin head instead of the UUID. The UUID is no longer displayed anywhere in the interface.
- Several Microsoft accounts can be saved and switched without signing in again; each token lives in its own Credential Manager entry.
- Official Microsoft and Minecraft brand marks on the sign-in button and account card.
- Skins: the real character is the default preview (own skin, Classic/Slim model, own cape), with drag-to-turn with momentum, double-click reset, and a cape chooser. The Cirrus cape is clearly labelled as a local preview.
- Header uses the transparent Cirrus cloud mark instead of a black tile.
- Removed Developer options and the Azure Application (client) ID from every user-facing screen. The app ID is built into the build, still overridable with `LIMITEDFPS_MS_CLIENT_ID`.
- Appearance lookups are cached in the backend for five minutes, so the account menu and Skins page do not re-download the same skin.

## 0.3.0 — Official artwork, calmer Home, Servers and notifications
- Real Minecraft key art for the background and version cards.
- Home is now just the big title, the Play button and your version cards.
- Sign-in button shows the Minecraft and Microsoft marks; Discord uses the real Discord mark.
- New Servers page (empty until there is a partner server) and a notification bell.
- Skins: bigger preview you can turn by dragging.
- Technical items (Java re-scan, Diagnostics, Discord Presence, client ID) moved into Settings.
- Removed the "Launcher news" section, the glow effects and the extra status cards.

## 0.2.0 — New look (UI v4)
- New top bar, Home, Versions, Browse, Mods and Modpacks pages. (Shipped before the version number was raised; the installer still said 0.1.0.)

## 0.1.0 — First build
- Play Minecraft 1.21.11 with Fabric, Microsoft sign-in, mods, skins and profiles.
