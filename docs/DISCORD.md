# Discord Rich Presence (Discord Status)

While Cirrus Client is open, the player's Discord profile shows what they are doing, for example
**Playing Minecraft 1.21.11 · Fabric** (with elapsed time) or **Browsing mods**. It talks to the Discord
desktop app through its local pipe: no login, no token, no extra network traffic. If Discord is not running,
nothing happens and the launcher works as usual. Players can switch it off with the **Presence** pill under the
navigation bar (remembered on that PC).

## Application ID

Cirrus Client has its own Discord application built in: **`1571269169968840854`** (the ID is public, not a
secret). Nothing needs to be configured for the status to work. To test with a different application, set
`CIRRUS_DISCORD_APP_ID` (a build variable or a process environment variable); that value wins over the built-in one.

## What the owner still does in the Discord Developer Portal

These two things live on Discord's side and cannot be done from the code:

1. Open <https://discord.com/developers/applications>, choose the application with the ID above and make sure its
   **name** is "Cirrus Client" (Discord shows it as "Playing Cirrus Client").
2. Under **Rich Presence > Art Assets**, upload the logo (`public/brand/icon.png`) with the key `cirrus_logo`.
   Until that asset exists, Discord shows the status text without a picture.

Not verified yet: the status has been tested with a fake Discord connection in unit tests, not against the real
Discord app on a PC.
