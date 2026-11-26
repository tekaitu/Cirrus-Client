# Cirrus Core (Maple Client)

The client is branded **Maple Client**; `Cirrus Core` and the `dev.cirrus` packages keep their names internally so settings, profiles and shared profile codes stay compatible.

Cirrus Core is the part of the in-game client that does not depend on Minecraft. It lives in `fabric-mod/src/core/java`
(package `dev.cirrus.core`) and is compiled together with the Fabric client, so it ships in the same mod jar.

## Layers

```
Cirrus Core  ->  Minecraft adapter  ->  supported Minecraft version

dev.cirrus.core.*            pure Java, no Minecraft / loader / graphics / logging libraries, Java 8 compatible
dev.cirrus.client.render.*   1.21.11 adapter: McCanvas (drawing), McTextMetrics, McInput (input), CornerTextures
dev.cirrus.client.mod.*      1.21.11 adapter: ClientModContext (the ModContext), McHudMod, Armor Status, key bindings
dev.cirrus.client.*          the rest of the shipping 1.21.11 client (screens, hooks, assets, dashboard)
```

Core packages: `config`, `settings`, `module` (CirrusMod, ModContext, ModRegistry, PlannedCatalog/PlannedMod), `hud` (HudElement, HudMod, HudLayout,
HudDrag, FPS/Ping/Keystrokes), `profile` (Profiles, ProfileStore, ProfileCodec), `layout`, `anim`, `theme` (CirrusTheme, Brand), `render` (Canvas, Shapes,
Colors, CornerMask, Icons), `text`, `input` (Keys, MouseButtons, GameAction, InputState, InputTracker, InputListener), `perf` (PerfMeter, PerfCounters,
PerfOverlay), `log`.

A second modern-version adapter would implement `Canvas`, `TextMetrics`, `InputState`/event feed and `ModContext` for that version and register the same Core
modules; nothing in Core changes. Only 1.21.11 is implemented and tested.

## Input

`InputState` is what Core asks: pointer position and movement, scroll, left/right/middle buttons, held keys, modifiers. `InputTracker` is the one implementation
that turns adapter events into that state and notifies `InputListener`s. On 1.21.11, `McInput` polls held keys, buttons and position live from the game
(`MouseHandler.isLeftPressed/isRightPressed/isMiddlePressed/getScaledXPos`, `InputConstants.isKeyDown`) and takes events (scroll, movement, press/release) from
`CirrusScreen`, whose input entry points are final and report to Core before the screen's own `on*` hooks run. Key and modifier numbering is GLFW's, which both
`Keys` and Minecraft use.

## Modules and HUD

`ModContext` is everything a module may ask of the game: config, input, text metrics, GUI size, fps, ping, whether a world is loaded, and whether a bound
action (forward, jump, attack...) is held. `ClientModContext` implements it for 1.21.11 and is bound once at start-up. FPS, Ping and Keystrokes are Core modules.
Armor Status draws item stacks, so it stays in the client on `McHudMod`, which hands it a `GuiGraphics`.

The HUD model is separate from gameplay code: `HudLayout` (active/removed lists, remove, restore, hit-test, reset position) and `HudDrag` (drag with grab offset,
clamped and persisted on every step). A removed widget keeps its saved position and returns to it. For widgets that are also modules (all four today) removing
a widget switches its module off, as before; storage keys are unchanged (`enabled.<id>`, `hud.x/y/anchor.<id>`).

### Widgets editor (Phase 3)

All editing behaviour is Core and unit-tested; `HudEditorScreen` only draws and forwards input.

- `SnapEngine`: while a widget is dragged, its left/centre/right and top/middle/bottom lines snap to the screen's edges and centre and to the same lines of every
  other active widget within 4 GUI units; the line snapped to is reported (`HudDrag.guideX/guideY`) so the editor can draw a guide. Holding Alt turns snapping off.
- `HudLayout.nudge` (arrow keys, Shift = 10 units) and `HudLayout.filter` (the editor's search). `HudElement.setPosition` now also clears a legacy `TOP_RIGHT`
  anchor so a moved or nudged widget really moves.
- `FormatTemplate`: informational widgets (FPS, Ping) write their value through a named style (`Parentheses` default, `Plain`, `Label`, `Suffix`, `Brackets`),
  so the default reads "(400)" with no forced label. The stored value is only ever a style name, never free text, so configs and share codes cannot inject a template.
  `HudColors` is the matching text-colour option (named colours, white default). Both are ordinary `mod.<id>.format` / `mod.<id>.color` keys and travel with profiles.
- Editor views: a searchable widget list with Remove/Add, and, once a widget is selected, its options (scale, colour, format, background...) with Reset position.
  Delete removes the selected widget. A floating "Mods" tab returns to the Click GUI. The in-game HUD loop skips drawing while the editor is open (the editor draws the live widgets itself).

## Rules (enforced by `CoreBoundaryTest`)

1. Core never references `net.minecraft`, `com.mojang`, `net.fabricmc`, Forge/NeoForge, `org.lwjgl`, `org.slf4j`, `com.google` or `dev.cirrus.client`.
2. Every Core file sits in the package that matches its folder under `dev.cirrus.core`.
3. All of Core compiles on its own, with an empty classpath, at `--release 8`. That keeps it shareable with Minecraft 1.8.9 later without
   restricting the 1.21.x client, which stays on Java 21.

## Rendering

Cirrus does not run a renderer. Core draws through the `Canvas` interface (fill, corner mask, icon, text, clip, transform). Each Minecraft version
supplies one implementation on top of that version's own GUI pipeline (`McCanvas` wraps `GuiGraphics` for 1.21.11). Text, icons, clips and plain fills in the existing screens all go through it; the older static helpers (`CirrusUi`, `Glyphs`, `Gfx`) are thin wrappers. Mojang is moving the game
from OpenGL to Vulkan, so Cirrus code makes no raw OpenGL calls.

## Performance measurement

`PerfMeter` times Cirrus' own drawing per frame (average, p95, p99, max, draw operations per frame). Off by default; enable with
`-Dcirrus.perf=true` to get an on-screen overlay in Cirrus screens. CI prints `[cirrus-perf]` lines. `ShapesBench` (test sources) benchmarks the shape planner
without a game. These numbers are CPU time spent issuing Cirrus draw calls, not GPU time.

## Still Minecraft- or Java-11-dependent

Screens and screen widgets, `Gfx`/`CirrusUi`/`Glyphs` wrappers (they take `GuiGraphics`), `McCanvas` internals, `ArmorStatusMod` (item stacks), `ModKeys` (key
bindings), asset loading (`AssetManager`, Java 11 HTTP) and the dashboard (Gson, Java 11). Vanilla-font text lines in the title and multiplayer screens still call
`GuiGraphics.drawString` directly.
