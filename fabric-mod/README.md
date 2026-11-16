# Cirrus Fabric companion

This is the first in-game slice of Cirrus Client, targeting Minecraft Java 1.21.11 with Fabric and Java 21.

## Available now

- A Cirrus button on the Minecraft title and pause screens.
- A Cirrus panel that opens Minecraft's real Options screen and returns to the screen that opened it.
- The panel explicitly reports that account sync and cosmetics are not connected yet.

It does not claim or grant ownership, change the player profile, or contact a backend. The existing launcher mod browser remains a separate desktop feature.

## Build

Install JDK 21 or newer and run:

```powershell
./gradlew.bat build
```

The distributable mod is `build/libs/cirrus-fabric-0.1.0.jar`. Use the shortest named JAR, not the `-sources` JAR.

The launcher does not install this mod yet. That integration will be added after the first in-game build is compiled and verified.
