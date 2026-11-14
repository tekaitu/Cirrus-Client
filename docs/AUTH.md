# Microsoft sign-in

Cirrus Client signs in with the official Microsoft flow for Minecraft Java Edition. It never asks for, sees or stores a password.

## What the player sees

Click **Sign in with Microsoft**. A window opens on Microsoft's own sign-in page; the player signs in there and the window closes. No app ID, no code, no password typed into Cirrus Client. The window can only show Microsoft sign-in pages and cannot call the app's commands. "Use a code instead" is a fallback that shows a short code to type at microsoft.com/link in the player's own browser.

Technically this is the authorization-code flow with PKCE (no client secret) and the scope `XboxLive.signin offline_access`, the minimum needed for Minecraft.

## Why an app ID still exists

Microsoft and Mojang only allow Minecraft sign-in for an app that is registered and approved, so the launcher needs one app ID. Players never see it: the **owner registers it once** and it is built into the EXE. Another launcher's ID must never be used.

## What it does

1. **Device code** (Microsoft identity platform): the app shows a short code; you enter it on a Microsoft page (microsoft.com/link) in your browser.
2. **Xbox Live**, then **XSTS** for `rp://api.minecraftservices.com/`.
3. **Minecraft services** `login_with_xbox`, then the Minecraft profile (name and id).

Only those fixed Microsoft, Xbox and Minecraft addresses are contacted; redirects are not followed. The "Open Microsoft page" button only opens microsoft.com / login.microsoftonline.com / login.live.com / aka.ms pages, without a shell.

## Where tokens live

- The Microsoft **refresh token** is saved in **Windows Credential Manager** (entry "Limited FPS" (the original service name, kept so existing sign-ins keep working) / `microsoft-refresh-token`), not in a file.
- The Minecraft access token stays in memory and is not sent to the interface. The interface only receives your profile name and id.
- Tokens are never logged or put into error messages. "Sign out" deletes the saved login.

## You must register the Azure app (once)

Cirrus Client does not ship an app ID and never borrows another launcher's.

1. In the Azure portal create an **App registration**. Supported account types: **Personal Microsoft accounts only** (or any account type that includes personal accounts).
2. Under **Authentication**, turn on **Allow public client flows**.
3. Under **Authentication > Add a platform > Mobile and desktop applications**, add the redirect address `https://login.microsoftonline.com/consumers/oauth2/nativeclient`.
4. Copy the **Application (client) ID** (it is an ID, not a secret) and build it in: in the GitHub repository open Settings > Secrets and variables > Actions > **Variables** and add `LIMITEDFPS_MS_CLIENT_ID`; the next build embeds it. For a quick local test, paste it into Settings > Microsoft sign-in (advanced override).
5. Ask Mojang to approve the app for the Minecraft services (their app-registration review). Until it is approved, the last step fails with HTTP 403 and Cirrus Client says so. This approval is outside Cirrus Client's control.

## Status

Verified only by unit tests against a local fake server and by CI. It has **not** been run against the real Microsoft, Xbox or Minecraft services, because that needs an Azure app registration and Mojang approval. Play stays disabled: signing in does not launch anything.
