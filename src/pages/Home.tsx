import { useEffect, useState } from "react";
import { PlayPanel } from "../components/PlayPanel";
import { Button } from "../components/Button";
import { InstanceCard } from "../components/InstanceCard";
import { SkinHead } from "../components/SkinHead";
import { usePlayerAppearance } from "../hooks/useAppearance";
import { formatAgo, readRecent } from "../core/recent";
import type { PageId } from "../components/Navigation";
import { LibraryIcon, NewsIcon } from "../components/Icons";
import { LogoMark } from "../components/Logo";
import type { AppData } from "../hooks/useAppData";
import { usePlayAs } from "../hooks/usePlayAs";
import { recentlyPlayed } from "../core/instances";
import { Badge } from "../components/ui";
import type { InstanceView } from "../api/types";

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
      <SkinHead uuid={player?.id ?? null} name={player?.name ?? offline ?? null} size={34} />
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
          <Button size="sm" variant="secondary" onClick={onOpenAccount}>
            Sign in
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * The branded hero: the headline, what it will launch, then the one Play button
 * in the middle of the screen. Every other action is a quiet link underneath it.
 */
function Hero({ data, onNavigate, onOpenAccount }: { data: AppData; onNavigate: (page: PageId) => void; onOpenAccount: () => void }) {
  const { selection } = data;
  const playAs = usePlayAs();
  const instance = selection.instance;
  const running = data.game.run.phase === "running" || data.game.run.phase === "starting";
  // When nobody is signed in the Play button already offers sign-in; a second
  // account chip saying the same thing would just repeat it.
  const showIdentity = playAs.mode === "offline" || data.account.state.phase === "signedIn";
  const loader = instance ? instance.loader : selection.loader;
  const versionTitle = instance
    ? `${instance.minecraft} ${loader === "fabric" ? "Fabric" : "Vanilla"}`
    : selection.version
      ? `${selection.version} ${selection.loader === "fabric" ? "Fabric" : "Vanilla"}`
      : "Minecraft: Java Edition";

  return (
    <section className="home-hero" aria-labelledby="hero-title">
      <div className="home-lockup" aria-hidden="true">
        <LogoMark size={46} />
        <span className="home-lockup-name">
          Cirrus <em>Client</em>
        </span>
      </div>
      <h1 id="hero-title" className="home-title">
        Sky is the limit.
      </h1>
      <p className="home-version" aria-label="Selected version">
        {versionTitle}
        {instance ? <span className="home-version-name">{instance.name}</span> : null}
      </p>
      <p className="home-sub">
        {instance ? (
          <>
            Minecraft {instance.minecraft}
            {instance.loader === "fabric" ? ` · Fabric ${instance.loaderVersion ?? ""}`.trimEnd() : " · Vanilla"}
            {instance.lastPlayed > 0 ? ` · ${lastAgo(instance.lastPlayed)}` : ""}
          </>
        ) : selection.version ? (
          <>
            Minecraft {selection.version} · {selection.loader === "fabric" ? "Fabric" : "Vanilla"} · no instance selected
          </>
        ) : (
          "Pick a version and start your first world."
        )}
        {running && <Badge tone="good">Minecraft is running</Badge>}
      </p>

      <div className="home-hero-play">
        <PlayPanel data={data} onNavigate={onNavigate} onOpenAccount={onOpenAccount} variant="quick" />
      </div>

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
      </div>

      {showIdentity && <Identity data={data} onOpenAccount={onOpenAccount} />}
    </section>
  );
}

const lastAgo = (at: number) => formatAgo(at);

/** The selected instance and the ones played recently — the quick way back in. */
function QuickJoin({ data, onNavigate }: { data: AppData; onNavigate: (page: PageId) => void }) {
  const instance = data.selection.instance;
  const recent = recentlyPlayed(data.instances.status === "ready" ? data.instances.data : [], readRecent());
  return (
    <section className="quick-join" aria-label="Quick join">
      <header className="quick-head">
        <div>
          <p className="eyebrow">Quick join</p>
          <h2 id="quick-title">{instance ? instance.name : "Your next world"}</h2>
          <p className="muted small">
            {instance
              ? `Minecraft ${instance.minecraft} · ${instance.loader === "fabric" ? "Fabric" : "Vanilla"} · ${
                  instance.modCount > 0 ? `${instance.modCount} ${instance.modCount === 1 ? "mod" : "mods"}` : "no mods"
                }`
              : "Everything starts from here. Pick an instance in the Library or install a version."}
          </p>
        </div>
        <button type="button" className="link-inline" onClick={() => onNavigate(instance ? "library" : "versions")}>
          {instance ? "Change" : "Get started"}
        </button>
      </header>

      {recent.length > 0 ? (
        <div className="quick-recents">
          <span className="quick-recents-label">Jump back in</span>
          <div className="quick-recents-row">
            {recent.slice(0, 4).map((item) => (
              <button
                key={item.id}
                type="button"
                className={`quick-recent ${instance?.id === item.id ? "is-on" : ""}`}
                aria-pressed={instance?.id === item.id}
                onClick={() => data.selection.selectInstance(item)}
              >
                <strong>{item.name}</strong>
                <small>
                  {item.minecraft} · {item.loader === "fabric" ? "Fabric" : "Vanilla"}
                </small>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="quick-empty">
          <p className="muted small">Played instances show up here, one click away.</p>
          <Button variant="secondary" size="sm" onClick={() => onNavigate("versions")}>
            Install a version
          </Button>
        </div>
      )}
    </section>
  );
}

/** Instances played recently, newest first, as the older image cards. */
function RecentlyPlayed({
  data,
  onNavigate,
}: {
  data: AppData;
  onNavigate: (page: PageId) => void;
}) {
  const playAs = usePlayAs();
  const instances = data.instances.status === "ready" ? data.instances.data : [];
  const recent = recentlyPlayed(instances, readRecent());
  const { selection, game } = data;
  const java = data.java.status === "ready" ? data.java.data.selected : null;
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const running = game.run.phase === "running" || game.run.phase === "starting";

  // The card selects first; the launch runs once the selected instance's status is known.
  useEffect(() => {
    if (!pending) return;
    if (selection.instance?.id !== pending) return;
    if (!game.status) return;
    setPending(null);
    if (!java || !game.status.installed) {
      setActionError(!java ? "Java is needed before Minecraft can start. Set it up in Settings." : "The game files are not ready yet.");
      return;
    }
    game.play(java.path, playAs.mode, playAs.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, selection.instance?.id, game.status, java, playAs.mode, playAs.name]);

  const launch = (instance: InstanceView) => {
    setActionError(null);
    if (running) {
      setActionError("Minecraft is already starting or running.");
      return;
    }
    selection.selectInstance(instance);
    setPending(instance.id);
  };

  const openMods = (instance: InstanceView) => {
    selection.selectInstance(instance);
    onNavigate("mods");
  };

  return (
    <section id="recent" className="home-section recently" aria-labelledby="recent-title">
      <header className="home-section-head">
        <div>
          <h2 id="recent-title">Recently played</h2>
          <p className="muted small">Jump back into the instance you played last.</p>
        </div>
        <button type="button" className="link-inline" onClick={() => onNavigate("library")}>
          View library
        </button>
      </header>

      {actionError && <p className="recent-error small">{actionError}</p>}

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
        <div className="instance-grid">
          {recent.slice(0, 4).map((instance) => (
            <InstanceCard
              key={instance.id}
              instance={instance}
              selected={selection.instance?.id === instance.id}
              onSelect={() => selection.selectInstance(instance)}
              onLaunch={() => launch(instance)}
              onMods={() => openMods(instance)}
              launchDisabled={running}
              launchTitle={running ? "Minecraft is already running." : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** Launcher news, written by the project itself — no invented third-party feed. */
function News({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  return (
    <section id="news" className="home-section news" aria-labelledby="news-title">
      <header className="home-section-head">
        <div>
          <h2 id="news-title">
            <NewsIcon /> News
          </h2>
          <p className="muted small">What changed in this build.</p>
        </div>
      </header>
      <ul className="news-list">
        <li className="news-item">
          <span className="news-tag">Layout</span>
          <div>
            <strong>Classic is back</strong>
            <p className="muted small">
              The sidebar and the big image cards return, with Play in the middle of the screen. Pick Classic or
              Colorful on first launch; change it later in Settings.
            </p>
          </div>
        </li>
        <li className="news-item">
          <span className="news-tag">v0.3.3</span>
          <div>
            <strong>Library and Versions are two places</strong>
            <p className="muted small">
              Browse every Minecraft family in Versions, and manage the instances you actually installed in the Library —
              each with its own Java, memory and folder.
            </p>
          </div>
        </li>
        <li className="news-item">
          <span className="news-tag">Update</span>
          <div>
            <strong>Launcher updates, checked securely</strong>
            <p className="muted small">
              Cirrus checks the official GitHub releases over HTTPS and only offers a strictly newer version. Installing
              from inside the app waits until signed builds are configured.
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
      <RecentlyPlayed data={data} onNavigate={onNavigate} />
      <div className="home-lower">
        <QuickJoin data={data} onNavigate={onNavigate} />
        <News onNavigate={onNavigate} />
      </div>
    </div>
  );
}
