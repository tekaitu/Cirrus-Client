# Launcher updates

Cirrus checks for newer Cirrus Launcher releases, not Minecraft versions, Fabric
Loader builds or mods — those stay independent.

What this build does today:

- On start (after a short delay) and from **Settings → Updates → Check again**, the
  launcher asks the official GitHub releases API for `tekaitu/Cirrus-Client`.
- The request is HTTPS only, the host is checked against an allowlist, the body is
  capped, and only a *strictly newer* stable version is offered (no downgrades, no
  pre-releases, no version confusion).
- The answer is shown as current → latest with the release notes, a **Later**
  button that hides the notice for the session, and no repeated popups.
- **Settings → Updates** has an on/off switch for the automatic start-up check
  (on by default). Manual checks keep working when it is off.
- Nothing is downloaded or executed. `installReady` is `false`, and the notice says
  so before offering the official release page.

Why installation is off, and what it needs:

Automatic installation must be able to prove that a downloaded package really came
from Cirrus. That requires a signing key pair and a manifest signed with it. None of
that exists in the repository, and it cannot be invented safely — an unsigned
download path would be exactly the "insecure placeholder updater" this project
refuses to ship.

To enable real, verified installation:

1. **Signing key pair** (keep the private half out of the repository):
   `npx tauri signer generate -w ~/.tauri/cirrus.key`
   This prints a public key. Add it to `src-tauri/tauri.conf.json` under
   `plugins.updater.pubkey`, and add `tauri-plugin-updater` to the app and to
   `capabilities/default.json`.
2. **CI secrets**: `TAURI_SIGNING_PRIVATE_KEY` (the private key file contents) and
   `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in the repository's Actions secrets. The
   Windows build then signs every installer and emits `latest.json`.
3. **Hosting**: publish the signed installer(s) and `latest.json` as GitHub release
   assets (the same official repository the check already uses). `latest.json`
   carries `version`, `notes`, `pub_date` and per-platform `url` + `signature`.
4. **Turn the switch on** in `src-tauri/src/updater.rs`: the check already returns
   the release's assets; once the plugin is configured, set `install_ready: true`,
   wire the download/install command, and restart the launcher after a successful
   install.

Safety rules the installer must keep, once enabled:

- Verify the manifest signature *and* the package signature before running anything.
- Download to a temporary file, verify, then hand the path to the updater; never
  execute a partial or unverified file.
- Refuse anything older than the installed version.
- Keep accounts, settings, `unlimited-instances.json`, instances, mods, worlds and
  Java choices outside the replaced files (they already live in the app data
  folder, not next to the executable).
- Report failure plainly; a failed or interrupted download must leave the current
  installation untouched and offer a retry.

Stable and Beta channels: the check currently reads stable releases only. A Beta
channel would read GitHub pre-releases and be hidden from ordinary users until it
is finished.
