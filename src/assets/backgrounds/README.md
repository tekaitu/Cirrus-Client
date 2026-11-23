# Your own backgrounds

Classic draws its own voxel landscapes, so it needs no pictures. The Colorful theme
uses **one** picture that the owner supplies.

## Colorful background (every page)

Drop the file in this folder with this exact name:

```
src/assets/backgrounds/colorful.jpg
```

`.jpeg`, `.png` and `.webp` work the same way (`colorful.png`, …); `colorful.jpg`
wins if several exist.

- It is used on **every** page, not just Home.
- It is scaled to cover the window with its aspect ratio kept, so the middle of the
  picture is always visible.
- A dark scrim and a vignette are laid over it automatically so text, cards and
  controls stay readable.
- Classic is untouched by this file.
- Restart `npm run dev` (or rebuild the app) after adding it; the picture is bundled
  at build time.

The Colorful picture is not committed here: the launcher ships no third-party
Minecraft artwork, so this folder stays empty until you add your own file. The older
names `default-colorful.jpg` and `home-colorful.jpg` still work, but `colorful.*`
takes priority.

## Optional Classic pictures

- `home.jpg` (or .png / .webp): the Home page in Classic
- `library.jpg`, `browse.jpg`, `night.jpg`: Instances/Versions, Browse, and Settings/Accounts in Classic
- `default.jpg`: used for any page that has no file of its own in Classic

Use wide images (at least 1920x1080) for a sharp result.
