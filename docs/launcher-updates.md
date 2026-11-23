# Launcher updates

Maple Client checks for newer **launcher** releases, not Minecraft versions,
Fabric Loader builds or mods — those stay independent.

Maple is distributed from a private project. That changes what the update path
may assume:

- End users never need a GitHub account, a repository page or a source archive.
- The launcher must not carry a personal access token, a signing key or any other
  secret to read a private source repository.
- Release metadata and installers must be reachable over HTTPS from a public,
  read-only endpoint that the project publishes itself, and every package must be
  signed.

## What this build does today

- On start (after a short delay) and from **Settings → Updates → Check again**, the
  launcher asks the official release API for the newest stable release.
- The request is HTTPS only, the host is checked against an allowlist, the body is
  capped, and only a *strictly newer* stable version is offered (no downgrades, no
  pre-releases, no version confusion).
- The answer is shown as current → latest with the release notes, a **Later**
  button that hides the notice for the session, and no repeated popups.
- **Settings → Updates** has an on/off switch for the automatic start-up check
  (on by default). Manual checks keep working when it is off.
- Nothing is downloaded or executed. `installReady` is `false`, and the interface
  says so. There is no "Open GitHub" button anywhere in the launcher.
- The update feed URL still points at the original repository. On a private
  repository an unauthenticated request returns 404 and the launcher reports that
  the check could not be completed — it never treats a failure as "up to date".

## What is missing for automatic installation

Automatic installation must prove that a downloaded package really came from the
project. That needs a signing key pair, a signed manifest and a public read-only
feed. None of that exists yet, and it cannot be invented safely: an unsigned
download path would be exactly the "insecure placeholder updater" this project
refuses to ship.

To enable real, verified installation:

1. **Signing key pair**, kept out of the repository:
   `npx tauri signer generate -w ~/.tauri/maple.key`
   Add the printed public key to `src-tauri/tauri.conf.json` under
   `plugins.updater.pubkey`, add `tauri-plugin-updater` as a dependency, and grant
   it in `capabilities/default.json`.
2. **CI secrets**: `TAURI_SIGNING_PRIVATE_KEY` and
   `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. The Windows build then signs every
   installer and emits `latest.json`. Neither value is ever shipped in the app.
3. **A public read-only release feed**: publish `latest.json` plus the signed
   installers to a controlled endpoint (a CDN bucket, a small release service, or
   signed assets served from a private CI job). `latest.json` carries `version`,
   `notes`, `pub_date` and per-platform `url` + `signature`. The feed URL and its
   host allowlist in `src-tauri/src/updater.rs` must be updated to that endpoint.
4. **Turn installation on** in `src-tauri/src/updater.rs`: set
   `install_ready: true` only after the manifest signature, the package signature
   and the version are verified, and wire download progress, install status and
   the restart into the Updates panel.

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
- Never report success before the new version is running and confirms its version.

## Rebrand and existing installations

The rename from Cirrus Client to Maple Client deliberately keeps:

- `identifier` in `tauri.conf.json` (`com.limitedfps.app`), which is what decides
  the app-data folder and therefore where settings, instances and caches live;
- the stored preference keys (`unlimited.*`), the instance store file name, the
  Minecraft root and the credential-manager entries.

Changing either would make existing installations look empty. The window title,
product name, publisher, installer metadata and icons change; the data location
does not. A future rename of the identifier would need a one-time migration that
copies the old folder into the new one before the first launch.

Stable and Beta channels: the check currently reads stable releases only. A Beta
channel would read pre-releases and stay hidden from ordinary users until finished.
