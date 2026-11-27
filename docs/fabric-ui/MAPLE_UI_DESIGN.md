# Maple in-game UI: design rules and HUD editor model

## Visual system (`CirrusTheme`, `ui/Look`, `ui/CirrusUi`)

* Minecraft stays visible. The Click GUI uses a light dim; the HUD editor a very light veil (about 11% black) in a world.
* Surfaces are restrained translucent tints (`surface`, `surfaceHover`, `field`) with no outlines, selection frames or glow. Floating
  surfaces (menus, popovers, tooltips) use the near-opaque `popup` token plus one hairline so text stays readable over the game.
* Orange `#E25303` is only an accent: primary buttons, the selected tab bar, active toggles/sliders, small headings.
* One spacing/typography/icon set shared by every screen (`CirrusButton`, `MenuButton`, `ModTile`, `SettingsPanel`, `CirrusUi.popup`).
* Left unchanged on purpose: the join-multiplayer screen (explicit earlier black-button spec) and the loading screens.

## HUD widget states (Core: `HudElement`, `HudLayout`)

| State | Stored as | Meaning |
|---|---|---|
| Enabled (default) | `hud.enabled.<id>` (module switch for modules) | Drawn on the HUD. |
| **Disabled** | enabled = false | Stays in the layout and keeps all settings and its position. The editor shows it dimmed with "Disabled"; Enable brings it back in place. |
| **Removed** | `hud.removed.<id>` = true | Out of the active layout (not shown, not grabbable, not a snap target). Restored from the Widgets list at its old position, switched on. |

Both keep position and options, travel with profiles and share codes, and old configs (no `hud.removed.*` keys) read as "not removed".

## HUD editor (`HudEditorScreen`)

* Only the widgets are shown: the vanilla HUD is hidden while editing (restored on leaving), the world stays visible.
* Floating, centred cluster at the top: **Mods** (opens the Click GUI with the editor as its parent, so Esc/Back returns to the same editor),
  **Widgets** (restore list with search), **Done**.
* **Left-drag** moves; snaps to screen edges/centre and other widgets with guide lines; arrow keys nudge (Shift = 10); Alt turns snapping off.
* **Right-click** a widget: *Disable / Enable widget*, *Remove widget*, *Customize*.
* **Customize** opens a popover with the widget's own options, reusing the Click GUI's settings list: text colour (now incl. Black),
  background on/off, background colour, background opacity, scale, format, plus Reset options / Reset position.
* Esc closes the open popup first, then clears the selection, then leaves the editor. Delete removes the selected widget.

## Appearance page (`ui/AppearancePage`, Core `theme/Appearance`)

The Click GUI sidebar has an **Appearance** page. Its settings (theme, accent colour, text colour, font, menu opacity, dim, blur menus,
blur HUD editor, ...) are stored with the normal mod settings and read through `Appearance.build(...)`, so changing one restyles the menus,
widgets lists and editor immediately (`Look.refresh`). A small preview and "Reset appearance" sit above/below the list. These are our own
settings; no other client's theme names or branding are used. Not implemented: pixel style, icon packs, screen transitions, UI sounds.

## Backgrounds

* Out of a world, every Maple screen (title, Click GUI, HUD editor) draws the **vanilla panorama**; there is no dark overlay on the title screen.
* In a world, the Click GUI uses the theme backdrop; the HUD editor blurs the game behind it (`Screen.renderBlurredBackground`) plus a faint
  tint. Blur follows the player's vanilla **Menu Background Blurriness** option, so it does nothing if that is 0. "All menus" blur is off by default.

## Transparency is per surface

HUD widget background opacity is a per-widget setting (`mod.<id>.opacity`). Menu surfaces use fixed theme tokens and never read it.
