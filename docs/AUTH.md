# Microsoft sign-in

Limited FPS signs in with the official Microsoft flow for Minecraft Java Edition. It never asks for, sees or stores a password.

## What it does

1. **Device code** (Microsoft identity platform): the app shows a short code; you enter it on a Microsoft page (microsoft.com/link) in your browser.
2. **Xbox Live**, then **XSTS** for `rp://api.minecraftservices.com/`.
3. **Minecraft services** `login_with_xbox`, then the Minecraft profile (name and id).

Only those fixed Microsoft, Xbox and Minecraft addresses are contacted; redirects are not followed. The "Open Microsoft page" button only opens microsoft.com / login.microsoftonline.com / login.live.com / aka.ms pages, without a shell.

## Where tokens live

- The Microsoft **refresh token** is saved in **Windows Credential Manager** (entry "Limited FPS" / `microsoft-refresh-token`), not in a file.
- The Minecraft access token stays in memory and is not sent to the interface. The interface only receives your profile name and id.
- Tokens are never logged or put into error messages. "Sign out" deletes the saved login.

## You must register the Azure app (once)

Limited FPS does not ship an app ID and never borrows another launcher's.

1. In the Azure portal create an **App registration**. Supported account types: **Personal Microsoft accounts only** (or any account type that includes personal accounts).
2. Under **Authentication**, turn on **Allow public client flows**.
3. Copy the **Application (client) ID** into **Settings > Microsoft sign-in**. It is an ID, not a secret.
4. Ask Mojang to approve the app for the Minecraft services (their app-registration review). Until it is approved, the last step fails with HTTP 403 and Limited FPS says so. This approval is outside Limited FPS's control.

## Status

Verified only by unit tests against a local fake server and by CI. It has **not** been run against the real Microsoft, Xbox or Minecraft services, because that needs an Azure app registration and Mojang approval. Play stays disabled: signing in does not launch anything.
