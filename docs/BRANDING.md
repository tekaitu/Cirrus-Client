# Branding

Original identity: a bold, forward-leaning white **L** on a rounded dark-navy tile, with blue speed streaks (the FPS/speed motif). Palette: navy `#10204A`/`#070C1B`, electric blue `#2F7BFF`/`#5AAEFF`, white.

- `branding/generate_assets.py` draws everything from geometry (Pillow + numpy) and writes `src-tauri/icons/*`, `branding/*.svg`, `public/favicon.svg` and `src/branding/logo.generated.ts`. Re-run it after changing the design.
- Icons of 48 px and smaller use a simpler two-streak variant so the L stays readable at 32x32.
- The wordmark ("LIMITED" white, "FPS" blue) is separate from the icon. In the app: `LogoMark` and `Wordmark` in `src/components/Logo.tsx`.
- Not copied from Minecraft, Mojang or any other launcher.

## Launcher layout

Compact desktop layout: a 56 px icon-only sidebar (Home, Settings, Diagnostics), a slim toolbar (Re-scan Java, Get help, a disabled "Community" entry because no community links exist), then on Home a large hero (original SVG art, no Minecraft assets) beside an Account and Status column, with a news row below. News content lives in `src/content/news.ts`: dated project notes and tips written for the app, labelled "not live news" in the UI. All art is inline SVG, so startup never waits on images.
