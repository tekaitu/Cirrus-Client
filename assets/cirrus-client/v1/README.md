# Cirrus UI asset pack v1

Original, reusable Cirrus artwork for the Fabric companion. All imagery is UI art or texture; no complete interface screenshots are used. Sources are generated reproducibly by `tools/AssetPackGenerator.java`. The Minecraft client downloads the PNGs from the manifest and registers them as textures. SVG is retained as editable source for the icon atlas; Minecraft's GUI renderer does not consume SVG directly.

| Asset | Source size | Use |
|---|---:|---|
| `backgrounds/main-menu-ambient.png` | 2048 × 1152 | Cropped-to-cover title and shared Cirrus screen backdrop |
| `backgrounds/dashboard-ambient.png` | 1600 × 900 | Transparent orbital light accents on Dashboard |
| `textures/glass-panel-frame.png` | 96 × 96 | Nine-slice panel border and glass highlights |
| `textures/button-states.png` | 384 × 64 | Three 128 × 64 nine-slice idle, hover, and active states |
| `icons/ui-symbols.png` | 1024 × 256 | 16 × 64 px symbols with neutral, cyan, dark, and gold rows |
| `animations/loading-ring.png` | 512 × 64 | Eight 64 px loading frames |
| `illustrations/empty-library.png` | 640 × 384 | Functional empty-results state in Mods |

The generated UI art is original and has no third-party asset license. The official Cirrus mark is the project's supplied logo. Inter regular and semibold are distributed under the SIL Open Font License; the license text is included in `fonts/OFL-Inter.txt` and in the mod resources. The external source is the existing `codex/cirrus-fabric-foundation` PR #4 branch. Each manifest entry records exact size and SHA-256; a bundled byte-for-byte fallback ships with the mod.

