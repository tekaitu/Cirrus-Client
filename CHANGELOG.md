# Changelog

Every big change gets its own version number. Small fixes bump the last number (0.3.1), new features and redesigns bump the middle one (0.4.0).

## 0.4.0 — Interface refresh: monochrome shell, centred Home
- New palette, taken from the Cirrus mark: pure black and near-black surfaces, white for important text, icons, active states and highlights, and neutral grays for panels, cards, borders and secondary elements. No blue, cyan, purple or other hue anywhere; contrast, spacing and type carry the design. One set of tokens drives every page, in both appearances.
- The one filled control in the interface is the primary action, painted in the highlight colour with its type cut out of it (white on black in the dark appearance, black on white in the light one). Everything else is a flat gray surface with a hairline border, so the eye always knows where to start.
- Home's light behind the menu is now a soft shadow rather than a coloured glow, and the backdrop picture is held back toward monochrome so the mark and the white type stay the loudest things on screen.
- Home is a game menu again: the Cirrus mark and wordmark centred over the picture, the version about to run, one wide Play button with the only light in the interface, then the account line. Installed versions sit in a dock along the bottom.
- The menu fades up once when Home opens, a beat apart per element; nothing loops. Reduced-motion settings still switch all of it off.
- Top bar: the page icons sit directly on the strip, gray until their page is open, then white with a short underline. No pill, tile or plate behind them; the account is borderless until it is touched.
- Pages breathe: a card is a section marked by one hairline and space, not a near-black plate on the page. Browsers and the settings rail are separated by a rule instead of a panel, and the empty states lost their dashed boxes.
- Selection is a line: segmented controls, the settings list, the mod categories and pagination use white text with a short underline or rule for the active choice. No filled black selection blocks.
- Icons are free of containers: card, navigation, empty-state, version-picker and mod icons sit straight on the surface in white or gray, with artwork keeping its own proportions.
- Browse and installed mods read as editorial lists: icon, name, author and description on one line, actions at the end, separated by hairlines. The grid/list switch changes the flow without adding boxes.
- Buttons, fields and the account drawer keep the same flat skins, hover colours and one-pixel press; only overlays (menus, dialogs, the drawer) keep a solid fill.
- The Home backdrop's dark layer is now strongest behind the menu, so the picture stays visible at the top and the text stays readable.
- The in-game Cirrus screens (Fabric) keep the same palette and now share the launcher's open layout: one flat page, a single hairline between the rail and the content, sections marked by a top rule, free-standing icons, and category or page selection as a short white rail instead of a filled plate. The dashboard and appearance screen use the same rules; the HUD editor keeps its own layout and its feature code is untouched.
- The in-game mod library is one open page: a header with the brand, page name, filter count and theme, a quiet category rail with a hairline divider, a search line with a favourites filter, and a single column of mod rows. Rows (drawing and clicking) share one geometry record, so a click always lands on the row it hits; names and descriptions are shortened with an ellipsis, and ON/OFF is quiet text rather than a badge.

## 0.3.2 — Character Studio, icon navigation and a real version picker
- Home opens on the new forest-lantern artwork (`src/assets/backgrounds/home.jpg`) with a lighter dark layer over it, so the picture shows behind the title and Play button.
- The account chip opens a panel on the side of the window instead of a menu in the middle. It offers both ways to play in one place: an offline ("cracked") username with validation and a "Use this name" step, and the Microsoft account.
- Cracked play now works from the account panel: the name is stored, the header and Home show that player (with an "Offline" tag and no borrowed skin), and Play launches Minecraft in offline mode with it. Signing in with Microsoft switches play back to the real account.
- Removed the "Manage account" button from the middle of the Home identity row; managing accounts lives in the side panel.
- New startup screen: the Cirrus cloud mark on black with a small loading circle, shown while settings load and fading away when the window is ready.
- Character Studio replaces the old skin page: the account's real Minecraft character fills the large central stage, with its own skin, arm model and equipped cape read from the Minecraft profile, a live sync indicator, and an honest error state when the profile cannot be read.
- Skin changes go through the account: choose a 64 × 64 PNG (or drop it on the stage), copy a skin from a username or texture link, then apply it to the Minecraft account. Applying or refreshing updates every head, the dashboard and the figure through the shared appearance cache, and switching accounts swaps the whole character.
- Better 3D figure: bigger stage, smooth drag-to-turn with inertia, arrow-key turning, zoom slider with ± buttons, directional lighting on every side of every body part, a floor shadow, Classic and Slim bodies, legacy 64 × 32 skins and the account cape with its own shading.
- Removed the four Cirrus skin presets, the Cirrus Cloud cape and the cape chooser. Capes now come only from the account; an account without one says so and points to minecraft.net instead of inventing a cosmetic. Minecraft ownership and other account trivia are gone from the studio.
- Top navigation is one recognizable icon per page with a tooltip, an accessible name, a tinted active tile and an accent dot; the arrow keys, Home and End move between pages.
- New Play button: solid accent surface, one-pixel press, colour-only hover, explicit launching state with a spinner, and a flat disabled state when the game cannot start.
- New version picker instead of a plain dropdown: a trigger card showing the chosen version, loader and install status, plus a panel with installed-on-this-PC shortcuts, search, All/Releases/Snapshots filters, per-version install labels and the Java check. The panel flips above the trigger and stays inside the window.
- Discord keeps its official mark with a quiet blurple colour change and no glow, lighting or movement.

## 0.3.1 — Minecraft identity, real player preview, no developer settings
- Microsoft sign-in opens in a dedicated sign-in window by default; the device code stays as a fallback.
- Account menu and Accounts page show the real Minecraft player head, player name, formatted UUID, skin model, equipped cape and Minecraft ownership. Account switching and removal stay in the same place.
- Several Microsoft accounts can be saved and switched without signing in again; each token lives in its own Credential Manager entry.
- Official Microsoft and Minecraft brand marks on the sign-in button and account card.
- Character: the real character is the default preview (own skin, Classic/Slim model, own cape), with drag-to-turn, zoom, a cape chooser, four original Cirrus skin presets, PNG upload and a one-click restore of the previous skin. The Cirrus cape is clearly labelled as a local preview.
- Header uses the transparent Cirrus cloud mark instead of a black tile.
- Removed Developer options and the Azure Application (client) ID from every user-facing screen. The app ID is built into the build, still overridable with `LIMITEDFPS_MS_CLIENT_ID`.
- Fixed real skin and cape loading: Mojang still returns `http://textures.minecraft.net` texture addresses, which the downloader previously rejected as insecure. They are now validated and upgraded to HTTPS, so real heads, skins and equipped capes appear instead of the labelled fallback.
- One shared appearance cache keeps every head, the dashboard and the 3D character in sync; Refresh and account switching update all of them, and 64 × 32 skins use the correct legacy body layout.
- Appearance lookups are cached in the backend for five minutes, so the account menu and Skins page do not re-download the same skin.
- New shared control layer for every button, icon button, segmented control and navigation tab: solid surfaces, a one-pixel press, a 120 ms release, fixed heights, and explicit loading, disabled and keyboard-focus states. No cursor light, sheen, glow or hover lift.
- Download panel now shows the real stage, percentage, average speed, time left and elapsed time from the bytes the backend reports, with a safe cancel and clear success and failure states.
- Mojang's whole version list is grouped into releases and snapshots and can now be searched and filtered by type. Snapshots and releases this build cannot install are marked as such instead of looking installable, the selected version shows whether it is installed, and the Java major from Mojang's manifest is compared with the Java Cirrus found.
- Settings are grouped into Game, Performance, Appearance, Account and More, with a new Account section, Minecraft window size and extra JVM options.
- The character preview stands still, turns only when dragged, can be refreshed when a skin changes, and falls back to a clearly labelled default look instead of a blank square.
- Accounts page gains the full 3D character, an active-account marker, add-account and a two-step remove confirmation.
- Toast notifications for sign-in, expired logins, downloads, launches and missing Java, matching the notification bell.
- Home shows who is signed in, the account's ownership and skin model, the install state and the last played version.
- A failed game download can be retried without leaving the panel.

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
