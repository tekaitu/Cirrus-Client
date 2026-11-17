# Cirrus Fabric companion

Cirrus Fabric targets Minecraft Java 1.21.11 with Fabric and Java 21.

## Available now

- A Cirrus button on the Minecraft title and pause screens.
- A Cirrus title screen with working Singleplayer, Multiplayer, Options and Quit actions.
- First-launch theme selection and persistent dark/light palettes.
- A Right Shift GUI keybind (also rebindable in Minecraft Controls) that opens Cirrus from gameplay and closes it from the Cirrus GUI.
- A responsive, registry-backed Mods library with category filters, search, favorites, enable controls and feature settings.
- A registry-driven HUD editor with per-element enable controls and drag positioning in-game.
- Per-instance settings saved in `config/cirrus-client/settings.properties`; legacy HUD preferences are imported on first load.
- The panel explicitly reports that account sync and cosmetics are not connected yet.

It does not claim or grant ownership, change the player profile, or contact a backend. The overlay is a local status indicator, not a cosmetics renderer or full HUD layout editor. The existing launcher mod browser remains a separate desktop feature.

## Build

Install JDK 21 or newer and run:

```powershell
./gradlew.bat build
```

The distributable mod is `build/libs/cirrus-fabric-0.1.0.jar`. Use the shortest named JAR, not the `-sources` JAR.

The launcher does not install this mod yet. Copy this JAR and Fabric API into the selected instance's `mods` directory to test manually. Review and accept Minecraft's EULA yourself if prompted; Cirrus never edits `eula.txt`.
