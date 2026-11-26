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

## Transparency is per surface

HUD widget background opacity is a per-widget setting (`mod.<id>.opacity`). Menu surfaces use fixed theme tokens and never read it.
