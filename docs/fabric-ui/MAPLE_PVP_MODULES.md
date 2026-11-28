# Maple PvP modules

Ten modules moved from the "Planned" catalogue to real, switchable modules. None of them automates input, reads anything the player could
not already see, or changes what is sent to a server. Every one starts **off** for a new player (the HUD ones included).

| Module | Category | What it does | How it is built |
|---|---|---|---|
| CPS | HUD | Your own clicks per second (left, optionally right) | Core `CpsMod` + `ClickCounter`: counts rising edges of the attack/use key each frame. Movable widget. |
| Coordinates | HUD | Position and compass facing; one line or stacked; optional decimals | Core `CoordinatesMod` + `Facing`; position/yaw come from `ModContext`. Movable widget. |
| Potion Effects | HUD | Active effects with level and time left; Detailed or Compact; warns under 10 s | Core `PotionEffectsMod`; effects come from `ModContext.effects()`. This one module is both "Potion Effects" and "Potion Timer". |
| Custom Crosshair | HUD | Cross / Dot / Circle / Cross and dot; colour, size, thickness, gap, opacity, outline | Core `CrosshairMod.draw` through `Canvas`; mixin on `Gui.renderCrosshair` cancels the vanilla one only while the module is on and the player is in first person. The vanilla attack-cooldown indicator is replaced too. |
| Zoom | Movement | Hold a key (default C, rebindable in Controls > Maple) to zoom; level and smoothing | Core `ZoomState`; mixin on `GameRenderer.getFov`. |
| Toggle Sprint/Sneak | Movement | Tap once to sprint / sneak | Switches the game's own *Toggle Sprint* / *Toggle Sneak* options. |
| Damage Tilt | Player | Removes the screen shake when hurt | Mixin on `GameRenderer.bobHurt` (on/off only; there is no partial strength). |
| Low Fire | Render | Moves the first-person fire overlay down | Mixin on `ScreenEffectRenderer.renderFire`, wrapped in its own push/pop. |
| Raw Mouse Input | Player | Unaccelerated mouse | Switches the game's own *Raw Input* option. |
| Hitboxes | Combat | Shows entity hitboxes | Switches the game's own hitbox debug display (same as F3+B). **No custom colour or thickness**: that would need Maple's own world renderer. |

## Safety rules
* Anything that changes a vanilla option remembers the player's value and puts it back when the module is switched off and when the game closes (`PvpHooks`).
* Mixins use `require = 0` and the exact method names read from the real 1.21.11 jar (CI dumps them), so a Minecraft update that renames a method disables the effect instead of crashing; the in-game check fails loudly if a hook is no longer applied.
* Not included on purpose: auto-clicking, reach/aim/combat assistance, packet changes.

## Verified on the real client (CI, 1.21.11)
Registration, off-by-default, all mixin hooks merged into the game's classes, Toggle Sprint / Raw Input / Hitboxes switching the game's options on and back,
and the real-renderer look of the widgets and crosshair shapes (`pvp-widgets-crosshairs` screenshot).

## Not verified (no world on the CI runner)
Zoom, Damage Tilt, Low Fire and the in-world crosshair have been **checked as applied hooks and by unit tests, not seen in a running world**. Check
them in the Windows build: zoom with C, take damage, stand in fire, and look at the crosshair.

## Still planned
Classic PvP, Hit Color, Damage Indicator, Perspective, Fullbright, Item Physics, 3D Skin Layers, Particles, Motion Blur, Time & Weather, Chat Tools,
Clip System and the platform features.
