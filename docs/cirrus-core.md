# Cirrus Core

Cirrus Core is the part of the in-game client that does not depend on Minecraft. It lives in `fabric-mod/src/core/java`
(package `dev.cirrus.core`) and is compiled together with the Fabric client, so it ships in the same mod jar.

## Layers

```
dev.cirrus.core.*      pure Java, no Minecraft / loader / graphics / logging libraries, Java 8 compatible
dev.cirrus.client.render.*   Minecraft 1.21.11 adapter: McCanvas, McTextMetrics, McInput, CornerTextures, PerfOverlay
dev.cirrus.client.*    the rest of the shipping 1.21.11 Fabric client (screens, modules, HUD, hooks)
```

Core packages: `config`, `settings`, `module`, `profile`, `layout`, `anim`, `theme`, `render` (Canvas, Shapes, Colors, CornerMask, Icons),
`text` (TextMetrics, TextStyle, TextFit), `input` (Keys, MouseButtons, InputState), `perf` (PerfMeter, PerfCounters), `log` (CoreLog).

## Rules (enforced by `CoreBoundaryTest`)

1. Core never references `net.minecraft`, `com.mojang`, `net.fabricmc`, Forge/NeoForge, `org.lwjgl`, `org.slf4j`, `com.google` or `dev.cirrus.client`.
2. Every Core file sits in the package that matches its folder under `dev.cirrus.core`.
3. All of Core compiles on its own, with an empty classpath, at `--release 8`. That keeps it shareable with Minecraft 1.8.9 later without
   restricting the 1.21.x client, which stays on Java 21.

## Rendering

Cirrus does not run a renderer. Core draws through the `Canvas` interface (fill, corner mask, icon, text, clip). Each Minecraft version
supplies one implementation on top of that version's own GUI pipeline (`McCanvas` wraps `GuiGraphics` for 1.21.11). Mojang is moving the game
from OpenGL to Vulkan, so Cirrus code makes no raw OpenGL calls.

## Performance measurement

`PerfMeter` times Cirrus' own drawing per frame (average, p95, p99, max, draw operations per frame). Off by default; enable with
`-Dcirrus.perf=true` to get an on-screen overlay in Cirrus screens. CI prints `[cirrus-perf]` lines. `ShapesBench` (test sources) benchmarks the shape planner
without a game. These numbers are CPU time spent issuing Cirrus draw calls, not GPU time.

## Not yet in Core (Minecraft-dependent today)

`CirrusMod`, `ModRegistry`, `HudElement`, `HudMod`, `Profiles`, all screens, `Gfx`, `Glyphs`, `CirrusUi`, asset loading, key bindings, and the
dashboard (pure but needs Gson and Java 11 HTTP). They need a module-context abstraction before they can move (Phase 2).
