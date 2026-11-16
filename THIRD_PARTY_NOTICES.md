# Third-party notices

The Fabric companion uses the standard Gradle Wrapper JAR and scripts, licensed under Apache-2.0. See https://github.com/gradle/gradle/blob/master/LICENSE.

The project depends on open-source packages installed from npm and crates.io at build time (including Tauri, React, Vite, Vitest, Testing Library, jsdom, and the Rust crates `sysinfo`, `serde`, `serde_json`, `reqwest`, `sha2`, `zip`, `keyring` and, for tests, `tempfile`). They are licensed by their respective authors, mostly under MIT or Apache-2.0. The exact dependency set and license texts will be listed here once lockfiles are committed and a license report can be generated (for example with `cargo about` and a JavaScript license checker).

Any launcher library adopted later must have its license verified first and its required notices added here before release. See [docs/LIBRARY-EVALUATION.md](docs/LIBRARY-EVALUATION.md).

"Minecraft" is a trademark of Mojang AB / Microsoft. Cirrus Client is not affiliated with or endorsed by Mojang or Microsoft.

## Java runtime downloaded by the app

When the person clicks "Install Java 21", Cirrus Client downloads **Eclipse Temurin 21** (GPLv2 with the Classpath Exception) from Adoptium and unpacks it into its own data folder. Cirrus Client does not bundle or redistribute it. See https://adoptium.net for the license and notices.

## Logo and icons

The Cirrus Client logo, wordmark and icons are artwork supplied by the project owner (see `docs/BRANDING.md`). They do not copy Minecraft, Mojang or other launcher branding.
