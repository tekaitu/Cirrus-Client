# Discord Rich Presence (Discord Status)

While Cirrus Client is open, the player's Discord profile shows what they are doing, for example
**Playing Minecraft 1.21.11 · Fabric** (with elapsed time) or **Browsing mods**. It talks to the Discord
desktop app through its local pipe: no login, no token, no extra network traffic. If Discord is not running,
nothing happens and the launcher works as usual. Players can switch it off with the **Presence** pill under the
navigation bar (remembered on that PC).

## One-time setup (the owner)

1. Open <https://discord.com/developers/applications> and create an application named **Cirrus Client**
   (that name is what Discord shows as "Playing Cirrus Client").
2. Under **Rich Presence > Art Assets**, upload the logo (`public/brand/icon.png`) with the key `cirrus_logo`.
3. Copy the **Application ID** (a 17 to 20 digit number; it is public, not a secret).
4. In the GitHub repository open Settings > Secrets and variables > Actions > **Variables** and add
   `CIRRUS_DISCORD_APP_ID` with that number. The next build embeds it.
   For a local build: `$env:CIRRUS_DISCORD_APP_ID = "123456789012345678"; npx tauri build --no-bundle`.

Without the variable the build still works; the status simply stays off.
