import { PlayPanel } from "../components/PlayPanel";
import { Button } from "../components/Button";
import { SkinHead } from "../components/SkinHead";
import { usePlayerAppearance } from "../hooks/useAppearance";
import { formatAgo, readRecent } from "../core/recent";
import { VersionCard } from "../components/VersionCard";
import { loaderLabel, loaderOf, useInstances } from "../hooks/useInstances";
import type { PageId } from "../components/Navigation";
import { GridIcon } from "../components/Icons";
import { LogoMark } from "../components/Logo";
import type { AppData } from "../hooks/useAppData";
import { usePlayAs } from "../hooks/usePlayAs";

/**
 * Who is playing and what state the game is in. The head comes from the real
 * skin cache; the model and cape only appear when the account's appearance was
 * actually fetched, so nothing here is invented. An offline ("cracked") name
 * is shown as exactly that, with no borrowed skin.
 */
function Identity({
  data,
  onOpenAccount,
}: {
  data: AppData;
  onOpenAccount: () => void;
}) {
  const account = data.account.state;
  const playAs = usePlayAs();
  // Offline mode is the identity while it is on, name or not: the Microsoft profile is
  // never shown as if it were the player when the game would start offline.
  const offlineMode = playAs.mode === "offline";
  const offline = offlineMode ? playAs.name.trim() : "";
  const player = offlineMode ? null : account.phase === "signedIn" ? account.profile : null;
  const appearance = usePlayerAppearance(player?.id ?? null);
  const install =
    data.game.installer.phase === "running"
      ? "Downloading game files"
      : data.game.status === null
        ? "Checking game files…"
        : data.game.status.installed
          ? "Game files installed"
          : "Not installed yet";
  const facts = player
    ? [
        "Microsoft connected",
        appearance.appearance ? `${appearance.appearance.model === "slim" ? "Slim" : "Classic"} model` : null,
        appearance.appearance?.cape ? "Cape equipped" : null,
        install,
      ].filter(Boolean).join(" · ")
    : offlineMode
      ? `Offline account${offline ? "" : " · no name chosen yet"} · singleplayer and offline servers · ${install}`
      : `No account chosen · play offline or sign in with Microsoft · ${install}`;

  return (
    <div className="home-identity" aria-label="Active account and game status">
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

/** The mark and the name, centred over the picture the way a game menu opens. */
function Lockup() {
  return (
    <div className="home-lockup" aria-hidden="true">
      <LogoMark size={72} />
      <span className="home-lockup-name">
        Cirrus <em>Client</em>
      </span>
    </div>
  );
}

/** The big title, the Play button and nothing else: what you are about to play and a way to start it. */
function Hero({ data, onNavigate, onOpenAccount }: { data: AppData; onNavigate: (page: PageId) => void; onOpenAccount: () => void }) {
  const { selection } = data;
  const recent = readRecent();
  return (
    <section className="home-hero" aria-labelledby="hero-title">
      <Lockup />
      <h1 id="hero-title" className="home-title">
        {selection.version} {loaderLabel(selection.loader)}
      </h1>
      <p className="home-sub">{selection.profile ? selection.profile.name : "Minecraft Java Edition"}</p>
      <PlayPanel data={data} onNavigate={onNavigate} onOpenAccount={onOpenAccount} variant="quick" />
      <Identity data={data} onOpenAccount={onOpenAccount} />
      {recent && (
        <p className="home-last">
          Last played {recent.version} {loaderLabel(recent.loader)} · {formatAgo(recent.at)}
        </p>
      )}
    </section>
  );
}

/** Installed versions as cards along the bottom. Picking one makes it the version to play. */
function VersionRow({ data, onNavigate }: { data: AppData; onNavigate: (page: PageId) => void }) {
  const { selection } = data;
  const list = useInstances(data);
  const installed = list.state.status === "ready" ? list.state.data : [];
  const hasCurrent = installed.some((i) => i.minecraft === selection.version && loaderOf(i) === selection.loader);
  return (
    <section className="home-versions" aria-label="Your versions">
      <ul className="vrow">
        {installed.map((i) => {
          const l = loaderOf(i);
          return (
            <li key={`${i.minecraft}-${l}`}>
              <VersionCard
                version={i.minecraft}
                loader={loaderLabel(l)}
                selected={selection.version === i.minecraft && selection.loader === l}
                onSelect={() => {
                  selection.setVersion(i.minecraft);
                  selection.setLoader(l);
                }}
              />
            </li>
          );
        })}
        {!hasCurrent && (
          <li>
            <VersionCard
              version={selection.version}
              loader={loaderLabel(selection.loader)}
              line="Not installed yet"
              selected
              onSelect={() => undefined}
              selectLabel={`${selection.version} ${loaderLabel(selection.loader)} (selected, not installed)`}
            />
          </li>
        )}
        <li className="vrow-more">
          <button type="button" className="vc-more" aria-label="All versions" data-tip="All versions" onClick={() => onNavigate("versions")}>
            <GridIcon />
          </button>
        </li>
      </ul>
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
      <div className="home-screen">
        <Hero data={data} onNavigate={onNavigate} onOpenAccount={onOpenAccount} />
        <VersionRow data={data} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
