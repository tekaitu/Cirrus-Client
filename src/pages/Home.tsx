import { PlayPanel } from "../components/PlayPanel";
import { Button } from "../components/Button";
import { SkinHead } from "../components/SkinHead";
import { usePlayerAppearance } from "../hooks/useAppearance";
import { formatAgo, readRecent } from "../core/recent";
import type { PageId } from "../components/Navigation";
import { CubeIcon, LibraryIcon, ModsIcon, NewsIcon, PlayArrowIcon, ShirtIcon, UpdateIcon } from "../components/Icons";
import { LogoMark } from "../components/Logo";
import type { AppData } from "../hooks/useAppData";
import { usePlayAs } from "../hooks/usePlayAs";
import { familyOf, iconGlyph, lastPlayedText, recentlyPlayed } from "../core/instances";
import { Badge } from "../components/ui";

/**
 * Who is playing. The head comes from the real skin cache; the model and cape
 * only appear when the account's appearance was actually fetched. An offline
 * name is shown as exactly that, with no borrowed skin.
 */
function Identity({ data, onOpenAccount }: { data: AppData; onOpenAccount: () => void }) {
  const account = data.account.state;
  const playAs = usePlayAs();
  const offlineMode = playAs.mode === "offline";
  const offline = offlineMode ? playAs.name.trim() : "";
  const player = offlineMode ? null : account.phase === "signedIn" ? account.profile : null;
  const appearance = usePlayerAppearance(player?.id ?? null);
  const facts = player
    ? ["Microsoft connected", appearance.appearance ? `${appearance.appearance.model === "slim" ? "Slim" : "Classic"} model` : null]
        .filter(Boolean)
        .join(" · ")
    : offlineMode
      ? "Unverified offline identity · singleplayer and offline servers"
      : "Not signed in";

  return (
    <div className="home-identity" aria-label="Active account">
      <SkinHead uuid={player?.id ?? null} name={player?.name ?? offline ?? null} size={38} />
      <div className="home-id-text">
        <span className="home-id-name">
          {player ? player.name : offline || (offlineMode ? "No offline name" : "Not signed in")}
          {player && <small>Minecraft: Java Edition</small>}
          {!player && offline && <small>Offline</small>}
        </span>
        <span className="home-id-meta">{facts}</span>
      </div>
      {!player && !offlineMode && (
        <div className="home-id-actions">
          <Button size="sm" variant="primary" onClick={onOpenAccount}>
            Sign in
          </Button>
        </div>
      )}
    </div>
  );
}

/** The branded hero: a headline, not a version string; the details sit underneath. */
function Hero({ data, onNavigate, onOpenAccount }: { data: AppData; onNavigate: (page: PageId) => void; onOpenAccount: () => void }) {
  const { selection } = data;
  const instance = selection.instance;
  const running = data.game.run.phase === "running" || data.game.run.phase === "starting";
  return (
    <section className="home-hero" aria-labelledby="hero-title">
      <div className="home-lockup" aria-hidden="true">
        <LogoMark size={54} />
        <span className="home-lockup-name">
          Cirrus <em>Client</em>
        </span>
      </div>
      <h1 id="hero-title" className="home-title">
        Sky is the limit.
      </h1>
      <p className="home-sub">
        {instance ? (
          <>
            <strong>{instance.name}</strong> · Minecraft {instance.minecraft}
            {instance.loader === "fabric" ? ` · Fabric ${instance.loaderVersion ?? ""}`.trimEnd() : " · Vanilla"}
            {instance.lastPlayed > 0 ? ` · ${lastPlayedText(instance.lastPlayed).toLowerCase()}` : ""}
          </>
        ) : selection.version ? (
          <>
            Minecraft {selection.version} · {selection.loader === "fabric" ? "Fabric" : "Vanilla"} · no instance selected
          </>
        ) : (
          "Pick a version and start your first world."
        )}
      </p>

      <PlayPanel data={data} onNavigate={onNavigate} onOpenAccount={onOpenAccount} variant="quick" />

      <div className="home-hero-links">
        <button type="button" className="link-inline" onClick={() => onNavigate("versions")}>
          {instance ? "Install another version" : "Choose a version"}
        </button>
        <span className="dot-sep" aria-hidden="true">
          ·
        </span>
        <button type="button" className="link-inline" onClick={() => onNavigate("library")}>
          {instance ? "Manage instances" : "Open the Library"}
        </button>
        {running && <Badge tone="good">Minecraft is running</Badge>}
      </div>

      <Identity data={data} onOpenAccount={onOpenAccount} />
    </section>
  );
}

/** Instances played recently, newest first, with the action that matters on each. */
function RecentlyPlayed({ data, onNavigate }: { data: AppData; onNavigate: (page: PageId) => void }) {
  const instances = data.instances.status === "ready" ? data.instances.data : [];
  const recent = recentlyPlayed(instances, readRecent());
  const selection = data.selection;

  return (
    <section className="home-section recently" aria-labelledby="recent-title">
      <header className="home-section-head">
        <div>
          <h2 id="recent-title">Recently played</h2>
          <p className="muted small">Jump back into the instance you played last.</p>
        </div>
        <button type="button" className="link-inline" onClick={() => onNavigate("library")}>
          View library
        </button>
      </header>

      {recent.length === 0 ? (
        <div className="recent-empty">
          <LibraryIcon />
          <div>
            <strong>Nothing played yet</strong>
            <p className="muted small">
              After your first launch the instance you used appears here, so getting back into it is one click.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => onNavigate("versions")}>
            Install a version
          </Button>
        </div>
      ) : (
        <ul className="recent-grid">
          {recent.map((instance) => {
            const art = familyOf(instance.minecraft).art;
            const selected = selection.instance?.id === instance.id;
            return (
              <li key={instance.id} className={`recent-card ${selected ? "is-selected" : ""}`}>
                <img src={art} alt="" aria-hidden="true" loading="lazy" className="recent-art" />
                <span className="recent-shade" aria-hidden="true" />
                <div className="recent-text">
                  <span className="recent-name">{instance.name}</span>
                  <span className="recent-meta">
                    {instance.minecraft} · {instance.loader === "fabric" ? "Fabric" : "Vanilla"} ·{" "}
                    {instance.lastPlayed ? formatAgo(instance.lastPlayed) : "just now"}
                  </span>
                </div>
                <div className="recent-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-small"
                    onClick={() => {
                      selection.selectInstance(instance);
                      if (instance.lastPlayed === 0) onNavigate("library");
                    }}
                  >
                    {instance.lastPlayed === 0 ? "Select" : <><PlayArrowIcon /> Select &amp; play</>}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Manage ${instance.name}`}
                    data-tip="Manage"
                    onClick={() => onNavigate("library")}
                  >
                    <CubeIcon />
                  </button>
                </div>
                <span className="recent-icon" aria-hidden="true">
                  {iconGlyph(instance.icon)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Launcher news, written by the project itself — no invented third-party feed. */
function News({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  return (
    <section className="home-section news" aria-labelledby="news-title">
      <header className="home-section-head">
        <div>
          <h2 id="news-title">
            <NewsIcon /> In Cirrus
          </h2>
          <p className="muted small">What changed in this build.</p>
        </div>
      </header>
      <ul className="news-list">
        <li className="news-item">
          <span className="news-tag">v0.3.3</span>
          <div>
            <strong>Library and Versions are now two places</strong>
            <p className="muted small">
              Browse every Minecraft family in Versions, and manage the instances you actually installed in the Library —
              each with its own Java, memory and folder.
            </p>
          </div>
        </li>
        <li className="news-item">
          <span className="news-tag">Java</span>
          <div>
            <strong>Java 8, 17 and 21</strong>
            <p className="muted small">
              Older versions now install and run too. Each instance can use its own Java, and missing runtimes can be
              installed from Settings.
            </p>
          </div>
        </li>
        <li className="news-item">
          <span className="news-tag">Recovery</span>
          <div>
            <strong>Crashes explained, not dumped</strong>
            <p className="muted small">
              A crash now names the likely cause, quotes the lines it used, and offers a fix that changes one thing after
              asking.
            </p>
          </div>
        </li>
      </ul>
      <div className="news-links">
        <button type="button" className="link-inline" onClick={() => onNavigate("about")}>
          About Cirrus
        </button>
        <button type="button" className="link-inline" onClick={() => onNavigate("settings")}>
          Check for launcher updates
        </button>
      </div>
    </section>
  );
}

/** The few places worth reaching in one click. */
function Shortcuts({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const items: Array<{ page: PageId; label: string; hint: string; icon: JSX.Element }> = [
    { page: "versions", label: "Versions", hint: "Install another release", icon: <UpdateIcon /> },
    { page: "library", label: "Library", hint: "Your instances", icon: <LibraryIcon /> },
    { page: "mods", label: "Mods", hint: "Manage or upload", icon: <ModsIcon /> },
    { page: "skins", label: "Character", hint: "Skin, cape and model", icon: <ShirtIcon /> },
  ];
  return (
    <nav className="home-shortcuts" aria-label="Shortcuts">
      {items.map((item) => (
        <button key={item.page} type="button" className="shortcut" onClick={() => onNavigate(item.page)}>
          <span className="shortcut-icon" aria-hidden="true">
            {item.icon}
          </span>
          <span>
            <strong>{item.label}</strong>
            <small className="muted">{item.hint}</small>
          </span>
        </button>
      ))}
    </nav>
  );
}

export function HomePage({
  data,
  onNavigate,
  onOpenAccount,
}: {
  data: AppData;
  onNavigate: (page: PageId) => void;
  onOpenAccount: () => void;
}) {
  return (
    <div className="home">
      <Hero data={data} onNavigate={onNavigate} onOpenAccount={onOpenAccount} />
      <Shortcuts onNavigate={onNavigate} />
      <div className="home-lower">
        <RecentlyPlayed data={data} onNavigate={onNavigate} />
        <News onNavigate={onNavigate} />
      </div>
    </div>
  );
}
