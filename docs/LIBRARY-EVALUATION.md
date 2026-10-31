# Launcher library evaluation

Researched on 2026-10-31 from package pages and documentation only. **No candidate's source code was read and nothing was built or run.** Treat every row as "claimed", not "verified". Several sources disagreed, noted below.

| Candidate | License (as found) | What it claims | What is not verified |
|---|---|---|---|
| **Lyceris** (Rust crate, repo: github.com/BatuhanAksoy/lyceris per docs.rs) | MIT OR Apache-2.0 | Minecraft install, automatic Java download, Fabric/Quilt/Forge/NeoForge, Microsoft auth | Minecraft 1.21.11 support; how its sign-in works (its README example uses offline mode); which Azure client ID it needs. Sources disagree on the latest version (lib.rs: 0.3.2, Dec 2024; docs.rs: 1.1.3, Apr 2025), and crates.io metadata was not reachable. About 10.8k total downloads. |
| **minecraft-msa-auth** (Rust crate) | MIT OR Apache-2.0 | Microsoft device-code token exchanged for a Minecraft token | Latest version listed as 0.5.0 (2026-08-13) per docs.rs. The page did not confirm the intermediate Xbox/XSTS/profile steps. |
| **Modrinth App / Theseus** | Desktop app GPLv3; web UI AGPLv3; mixed others | Full launcher | Copyleft licenses plus separate Terms of Use and branding restrictions make copying code unsuitable. **Not a candidate.** |
| **XMCL** (`@xmcl/*`, JavaScript) | MIT (per the deprecated `@xmcl/minecraft-launcher-core` page, which points to `@xmcl/core`) | JS launcher libraries | Would need a Node sidecar and does not fit a Rust/Tauri backend. Not pursued. |
| **Prism Launcher** | Not checked | | A search returned nothing usable. Not evaluated. |

## Spike criteria for Milestone 3 (Lyceris)

Adopt only if, with an exact pinned version, all of these hold on a real run:
1. It installs and launches vanilla 1.21.11 and a Fabric profile for 1.21.11.
2. It uses our own Azure client ID and the official flow, with no offline or cracked mode in shipped code paths.
3. Tokens are never written to logs or plain files.
4. It handles Java 21 detection or download predictably.
5. Its transitive dependency licenses are acceptable and recorded in THIRD_PARTY_NOTICES.md.

If any fail, implement the steps directly against Mojang's manifests, with at most small utility crates.

## Official Microsoft sign-in flow (from the community-maintained Minecraft wiki)
1. Microsoft OAuth2 (device code or authorization code) with scope `XboxLive.signin`, public client, consumers tenant.
2. Xbox Live user authentication.
3. XSTS authorization for `rp://api.minecraftservices.com/`.
4. `login_with_xbox` on the Minecraft services API, returning a Minecraft access token.
5. Entitlement check (note: Game Pass accounts may not appear in the store entitlements list).
6. Profile fetch (UUID and username).

Error cases to handle with plain messages: no Xbox account, child accounts needing family approval, no Minecraft license, no profile created.
