# Branding

**Maple Client** is named after its mark: a single orange maple leaf on a
transparent background. The primary brand colour is `#E25303`.

The mark is drawn once, as an SVG path, and every other asset is generated from
the same outline so the leaf never drifts between sizes:

- `src/components/Logo.tsx` holds the outline (`MAPLE_LEAF_POINTS`) and renders
  `LogoMark`, `Wordmark` and `CloudMark` for the running launcher.
- `public/brand/maple.svg` is the standalone vector mark.
- `python3 branding/make_maple_icons.py` (no third-party dependencies) rasterises
  the outline into `public/brand/mark.png`, `public/brand/icon.png`,
  `public/favicon.png`, `src-tauri/icons/*.png` (16–512 px) and a multi-size
  `src-tauri/icons/icon.ico`.

The generated files are committed, so building the app never needs Python.

## Colours

| Token | Value | Use |
| --- | --- | --- |
| `--brand` / `--accent` | `#E25303` | selected navigation, primary buttons, progress, focus rings |
| surfaces | neutral near-black | chrome, cards, dialogs |
| `--danger` | red | delete and other destructive actions |

Orange is an accent, not a surface colour: only one or two elements per screen
carry it. Danger actions use red, never the brand orange.

## Themes

Three appearances are available from the first-launch chooser and
Settings → Appearance: **Classic** (dark, default selection), **Colorful** (the
Minecraft key art fills the window behind translucent panels) and **Light**.
Theme choice is stored in `unlimited.theme` and applies instantly without a
restart; accounts, instances and settings are shared by all three. Tokens live in
`src/styles/tokens.css` and `src/styles/classic.css`; `src/core/theme.ts` holds the
labels, swatches and descriptions used by the chooser.

The Colorful theme shows the owner's Minecraft background, supplied as
`src/assets/backgrounds/colorful.jpg` (or `.png`/`.webp`) and used on every page, not
only Home. It is bundled at build time and covered by a scrim so text stays readable.
The launcher ships no Minecraft artwork of its own; see the README in that folder.

## Launcher layout

A background-free vertical rail (Play, Instances, Versions, Servers, Mods,
Modpacks, Character, News, Settings, then a slim utility rail at the bottom), a
custom title bar, and pages built from cards. Home keeps Recently played, Quick
Join and News in separate sections. News content lives in `src/content/news.ts`.
Nothing is copied from Minecraft, Mojang or another launcher.

## Existing installations

The rebrand keeps the Tauri `identifier` (`com.limitedfps.app`) and the
`unlimited.*` preference keys on purpose, so an update from Cirrus Client keeps
its accounts, instances, mods and settings. See `docs/launcher-updates.md`.
