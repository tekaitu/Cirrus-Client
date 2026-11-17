import { useState } from "react";
import { api, errorMessage } from "../api/client";
import { BrandIcon } from "../components/BrandIcon";
import { DownloadIcon, InfoIcon, SparkIcon } from "../components/Icons";
import { CloudMark, Wordmark } from "../components/Logo";
import { Banner, Card } from "../components/ui";
import type { AppData } from "../hooks/useAppData";

const CREDITS: Array<{ name: string; what: string }> = [
  { name: "Fabric", what: "The mod loader Cirrus installs for you" },
  { name: "Modrinth and CurseForge", what: "Where the Mods page finds mods" },
  { name: "Eclipse Temurin (Adoptium)", what: "The Java runtime Cirrus can install" },
  { name: "Tauri, React and Rust", what: "What Cirrus Client is built with" },
];

/** Version, update information, credits and links. */
export function AboutPage({ data, onLicense }: { data: AppData; onLicense: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const version = data.app.status === "ready" ? data.app.data.version : null;
  const target = data.app.status === "ready" ? data.app.data.target_minecraft : null;

  const open = (action: () => Promise<void>) => {
    setError(null);
    void action().catch((e: unknown) => setError(errorMessage(e)));
  };

  return (
    <div className="page about-page">
      <header className="page-head">
        <h1>About</h1>
        
      </header>

      <section className="about-hero" aria-label="Cirrus Client">
        <span className="about-mark" aria-hidden="true">
          <CloudMark size={72} />
        </span>
        <div>
          <Wordmark height={30} />
          <p className="about-tagline">The sky is the limit.</p>
          <p className="muted small">
            {version ? `Version ${version}` : "Version unknown"}
            {target ? ` · built for Minecraft ${target}` : ""}
          </p>
        </div>
      </section>

      {error && <Banner tone="bad" title="The link could not be opened">{error}</Banner>}

      <div className="about-grid">
        <Card title="Updates" icon={<DownloadIcon />} description="How you get a newer version.">
          <p className="muted small">New versions are published on GitHub. Your settings and worlds are kept when you update.</p>
          <button type="button" className="btn btn-primary" onClick={() => open(() => api.openGithub())}>
            <DownloadIcon />
            Open the GitHub page
          </button>
        </Card>

        <Card title="Links" icon={<SparkIcon />} description="Community and source code.">
          <div className="link-rows">
            <div>
              <div>
                <strong>Discord</strong>
                <p className="muted small">Questions, bug reports and ideas.</p>
              </div>
              <button type="button" className="btn" onClick={() => open(() => api.openCommunity())}>
                <BrandIcon name="discord" />
                Open Discord
              </button>
            </div>
            <div>
              <div>
                <strong>GitHub</strong>
                <p className="muted small">Source code and builds.</p>
              </div>
              <button type="button" className="btn" onClick={() => open(() => api.openGithub())}>
                <BrandIcon name="github" />
                Open GitHub
              </button>
            </div>
          </div>
        </Card>

        <Card title="Credits" icon={<InfoIcon />} description="Projects Cirrus Client relies on.">
          <ul className="credit-list">
            {CREDITS.map((c) => (
              <li key={c.name}>
                <strong>{c.name}</strong>
                <span className="muted small">{c.what}</span>
              </li>
            ))}
          </ul>
          <p className="about-notice">
            NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
          </p>
          <button type="button" className="btn" onClick={onLicense}>
            Read the license
          </button>
        </Card>
      </div>
    </div>
  );
}
