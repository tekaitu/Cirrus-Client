# Maple glyph beside verified players

A small Maple leaf is drawn before a **verified Maple Client player's** name in the tab list and above their head (name tag).

## What is implemented

| Piece | Where | Notes |
|---|---|---|
| Verified-player seam | `core/identity/MapleIdentity`, `VerifiedPlayers` | Pure Java. **Default: nobody is verified.** |
| Glyph | `assets/cirrus_fabric/font/maple_glyph.json` + `textures/font/maple_glyph.png` | One-character bitmap font (U+E000), orange leaf, 16x16 drawn 8 high. |
| Text decoration | `client/glyph/MapleGlyph` | Prefixes the glyph (white text colour so the leaf keeps its own colour) to a name component. |
| Tab list hook | `client/mixin/PlayerTabOverlayMixin` | Injects at the return of `PlayerTabOverlay#getNameForDisplay(PlayerInfo)`. Changes only the returned text. |
| Name tag hook | `client/mixin/EntityRendererMixin` | Injects at the return of `EntityRenderer#getNameTag(Entity)`, players only. Changes only the returned text. |

Both hooks use `require = 0` and the mixin config is `required: false`, so a Minecraft update that renames these methods disables the
glyph instead of crashing the game. The method names were taken from the real 1.21.11 jar (the in-game check logs them as `[maple-dump]`).

## Rules the code enforces

* No glyph unless `MapleIdentity.isVerified(uuid)` says so, and the default source says nobody.
* **Offline / cracked players never get it.** Offline UUIDs are version 3 (derived from the name); `MapleIdentity` refuses them even if a
  provider says yes. Real Mojang account ids are version 4.
* A provider that throws means "not verified".
* The client cannot make itself verified: there is no in-game setting, packet or file that turns the glyph on.

## What is missing (blocked on the backend / launcher; not invented here)

The client has **no real source of verified identities**. Showing the glyph for real players needs, from the Maple backend (Agent 3) and
launcher (Agent 4):

1. A backend-issued, signed statement "account UUID X is a verified Maple user" (or a lookup the launcher performs), which must not be
   forgeable by another player or client.
2. A launcher to Fabric channel that hands the client the set of verified UUIDs for the players it can currently see (the tab list /
   nearby players), with no Microsoft tokens or admin secrets crossing it.
3. A call to `MapleIdentity.setProvider(...)` from the code that receives that data.

Until then, in a real game nobody shows the glyph. The in-game check installs a test-only provider to prove the rendering path; that
provider exists only in `CirrusScreenshotTest`.

## Verifying

`CirrusScreenshotTest#verifyMapleGlyph` (run by the "Fabric in-game check" workflow) checks on the real 1.21.11 client that: nothing is
decorated with no provider; with a test provider the real `getNameForDisplay` and `getNameTag` return the glyph for a verified player
and not for an unverified or offline-UUID player; and it photographs the result (`tab-names-glyph`, `world-nametags`).
