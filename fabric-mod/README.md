# Cirrus Fabric companion

This is the first in-game slice of Cirrus Client, targeting Minecraft Java 1.21.11 with Fabric and Java 21.

## Available now

- A Cirrus button on the Minecraft title and pause screens.
- A Cirrus panel that opens Minecraft's real Options screen and returns to the screen that opened it.
- A local HUD editor that toggles a small Cirrus status panel and moves it between the top corners. These settings are saved in `config/cirrus-client.properties` for this installation.
- The panel explicitly reports that account sync and cosmetics are not connected yet.

It does not claim or grant ownership, change the player profile, or contact a backend. The overlay is a local status indicator, not a cosmetics renderer or full HUD layout editor. The existing launcher mod browser remains a separate desktop feature.

## Build

Install JDK 21 or newer and run:

```powershell
./gradlew.bat build
```

The distributable mod is `build/libs/cirrus-fabric-0.1.0.jar`. Use the shortest named JAR, not the `-sources` JAR.

The launcher does not install this mod yet. That integration will be added after the first in-game build is compiled and verified.
