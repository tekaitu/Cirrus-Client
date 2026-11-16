# Cirrus external UI assets

This directory is the versioned asset source for the Fabric companion. The client reads `manifest.json` from the exact HTTPS raw GitHub path encoded in `AssetManager`; each file is independently size and SHA-256 checked before installation. The current source is the existing `codex/cirrus-fabric-foundation` PR #4 branch, so it is available without creating a release or a second PR. Keep the path stable and publish a new manifest version for changes. The companion also contains verified fallback copies for first launch when the host is unavailable.

The directory layout is intentionally outside `fabric-mod/`, so downloaded originals are not packaged as the mod's primary asset store. Never add executable code or archives here.

