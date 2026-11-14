# Branding

**Cirrus Client** is black and white, like its logo. The three logo images were supplied by the project owner and are kept in `branding/source/`:

- `mark.png`: white cloud-and-stars mark on a transparent background.
- `icon-art.png`: the cloud-and-leaf emblem used for the app icon.
- `wordmark.png`: "Cirrus Client" lettering.

`python branding/make_brand.py` (Pillow + numpy) turns them into `public/brand/*.png`, `public/favicon.png` and `src-tauri/icons/*` (PNG sizes and a multi-size ICO). The results are committed, so the build never needs Python. In the app, `LogoMark`, `Wordmark` and `CloudMark` in `src/components/Logo.tsx` show them.

## Themes

Default is the black-and-white **Cirrus** theme with the White accent. Other themes (Midnight, Graphite, Ocean, Forest, Sunset, Light) and six more accent colours are in Settings → Interface (`src/core/theme.ts`, colours in `src/styles.css`).

## Launcher layout

Slim icon rail (Home, Mods, Library on top; Settings, Diagnostics, account at the bottom), a breadcrumb top bar, and card-based pages. News content lives in `src/content/news.ts` and is labelled "not live news". Not copied from Minecraft, Mojang or any other launcher.
