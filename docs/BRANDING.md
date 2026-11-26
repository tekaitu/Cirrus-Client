# Branding

**Maple Client** is named after its mark: a single orange maple leaf on a
transparent background. The leaf art is `#E25303`; the interface accent that
carries it is the warmer `#ff7a45` ember.

The owner's client icon is the single source of the mark and every shipped asset
is cut from it, so the leaf never drifts between sizes:

- `src/assets/brand/maple-mark.png` is the transparent, tightly cropped mark.
  `src/components/Logo.tsx` renders it through `LogoMark`, `Wordmark` and
  `CloudMark` for the running launcher.
- The same art is composed on a warm squircle tile for `public/favicon.png`,
  `src-tauri/icons/*.png` (32–512 px) and the multi-size
  `src-tauri/icons/icon.ico`; `src-tauri/icons/maple-mark.png` keeps the bare
  transparent mark.

The generated files are committed, so building the app never needs an image tool.
`branding/make_maple_icons.py` is the older outline-based generator and is kept
for reference only — its polygon is no longer the shipped mark.

## Colours

| Token | Value | Use |
| --- | --- | --- |
| `--brand` / `--accent` | `#ff7a45` | selected navigation, progress, focus rings, active controls |
| `--accent-2` | `#ffb547` | the amber end of progress and highlight gradients |
| `--accent-3` | `#ff4d6d` | destructive and error states |
| surfaces | `#0b0908`, `#121010`, `#191514`, `#211b19` | page, surface, raised, raised-2 |
| `--text` | `#f3ede8` | body and headings |

Orange is an accent, not a surface colour: primary buttons are near-white with
dark type, and only one or two elements per screen carry the ember.

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
