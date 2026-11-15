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

Cirrus Client ships its own public app ID (`eacfd73b-93b5-4f1c-81ec-889620103c1f`, built in; an app ID is not a secret) and never borrows another launcher's. It is free: no Azure subscription or payment is needed. (Checked against Microsoft's error-code reference and current launcher documentation, November 2026.)

### 1. Register the app (free)
1. Open <https://entra.microsoft.com> and sign in with your own Microsoft account. If you see **AADSTS16000** here, your personal account has no directory yet. Create a free one at <https://entra.microsoft.com/#create/tenant> (or by starting a free Azure account, which does not charge you), then sign in again.
2. **Identity > Applications > App registrations > New registration.** Name it "Cirrus Client".
3. **Supported account types: Personal Microsoft accounts only.** (Do not choose single tenant: players would hit AADSTS16000 or AADSTS50020.)
4. Leave the redirect URI empty here and press **Register**.
5. Open **Authentication**. Under **Add a platform > Mobile and desktop applications**, tick or add `https://login.microsoftonline.com/consumers/oauth2/nativeclient`.
6. On the same page, turn **Allow public client flows** on (needed for the "Use a code instead" fallback) and Save.
7. Copy the **Application (client) ID** from the Overview page. It is an ID, not a secret; never create or share a client secret.

### 2. Give it to the app
- **Built in:** the ID above is compiled into `src-tauri/src/auth.rs` (`DEFAULT_CLIENT_ID`), so players can sign in without configuring anything.
- **Released build:** in the GitHub repository open Settings > Secrets and variables > Actions > **Variables** and add `LIMITEDFPS_MS_CLIENT_ID` to build with a different registration instead of the built-in one. The next build embeds it.
- **Quick local test:** paste it into Settings > General > Microsoft sign-in (advanced). It is stored in the settings file and overrides the built-in value.

### 3. Get it approved for Minecraft (the part that decides everything)
Microsoft sign-in succeeding does **not** mean Minecraft sign-in works. Mojang's services (`api.minecraftservices.com/authentication/login_with_xbox`) answer **HTTP 403 "Invalid app registration"** for any app ID that is not on their allow list. Request approval through the form linked from <https://aka.ms/AppRegInfo> (Mojang's review). The outcome and the time it takes are up to Mojang; Cirrus Client cannot speed it up and cannot work around it. Until approved, Cirrus shows the 403 message, **offline play keeps working**, and nobody should substitute another launcher's ID.

### Errors Cirrus explains
| Code | Meaning | Fix |
| --- | --- | --- |
| AADSTS16000 / 50020 | Account not allowed in that directory | Supported account types: Personal Microsoft accounts only |
| AADSTS700016 | App ID unknown | Re-copy the Application (client) ID |
| AADSTS7000218 / 700025 / 9002325 / 7000215 | Public client flow not enabled or wrong redirect | Allow public client flows; add the native client redirect |
| AADSTS70011 | Scope rejected | Check the app registration |
| HTTP 403 at Minecraft | App not approved by Mojang | Request approval (step 3) |
| XSTS 2148916233 / 2148916235 / 2148916238 | No Xbox profile / Xbox not available in region / child account | Fix on the Xbox / Microsoft family settings page |

## Status

Verified only by unit tests against a local fake server and by CI. It has **not** been run against the real Microsoft, Xbox or Minecraft services, because that needs your Client ID and Mojang's approval.
