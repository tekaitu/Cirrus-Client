import { useEffect, useMemo, useState } from "react";
import type { PartnerServer } from "../core/servers";
import { canJoinDirectly, formatCount, matchesServer, serverTags, visibleServers } from "../core/servers";
import type { ServerStatus } from "../api/types";
import type { AppData } from "../hooks/useAppData";
import { useServerStatus, type ServerStatusState } from "../hooks/useServerStatus";
import { usePlayAs } from "../hooks/usePlayAs";
import { usernameError } from "../core/game";
import { ART } from "../core/art";
import { Button } from "../components/Button";
import { CopyIcon, RefreshArrowIcon, SearchIcon, ServerIcon, UsersIcon } from "../components/Icons";
import type { PageId } from "../components/Navigation";
import { Banner } from "../components/ui";

function statusLine(state: ServerStatusState, server: PartnerServer) {
  if (state.phase === "loading") {
    return { tone: "busy", text: "Checking the server…", detail: null as string | null };
  }
  if (state.phase === "unavailable") {
    return { tone: "unknown", text: "Status unavailable", detail: state.message };
  }
  const status = state.status;
  if (!status) {
    return { tone: "unknown", text: "Status unavailable", detail: null };
  }
  if (!status.online) {
    return {
      tone: "offline",
      text: "Offline",
      detail: status.error ?? "The server did not answer.",
    };
  }
  const players =
    status.playersOnline !== null && status.playersMax !== null
      ? `${formatCount(status.playersOnline)} / ${formatCount(status.playersMax)} players`
      : status.playersOnline !== null
        ? `${formatCount(status.playersOnline)} players`
        : null;
  const detail = [players, status.version ? `${status.version}` : null, status.latencyMs !== null ? `${status.latencyMs} ms` : null]
    .filter(Boolean)
    .join(" · ");
  return { tone: "online", text: "Online", detail: detail || `Checked ${server.address}` };
}

/** A live status dot, a real player count and whatever else the server itself sent. */
function LiveStatus({ state }: { state: ServerStatusState }) {
  const status: ServerStatus | null = state.phase === "ready" ? state.status : null;
  const line = status ? null : state.phase === "loading" ? "Checking…" : "Status unavailable";
  // An unanswered check is not the same as a server that said it is offline.
  const dot = !status ? (state.phase === "loading" ? "busy" : "unknown") : status.online ? "online" : "offline";
  return (
    <span className={`sv-live sv-live-${dot}`} aria-live="polite">
      <span className="sv-dot" aria-hidden="true" />
      {line ?? (status?.online ? "Online" : "Offline")}
    </span>
  );
}

/** One partnered server: official icon, published details, live numbers, Join. */
function PartnerCard({
  server,
  joining,
  onJoin,
  onCopy,
  copied,
  onOpenVersions,
}: {
  server: PartnerServer;
  joining: boolean;
  onJoin: () => void;
  onCopy: () => void;
  copied: boolean;
  onOpenVersions: () => void;
}) {
  const { state, refresh } = useServerStatus(server.address);
  const line = statusLine(state, server);

  return (
    <article className="sv-card" aria-label={server.name}>
      <div className="sv-art">
        {server.banner ? (
          <img className="sv-art-img" src={server.banner} alt="" />
        ) : (
          <img className="sv-art-img sv-art-neutral" src={ART.wilderness.full} alt="" />
        )}
        <span className="sv-art-shade" aria-hidden="true" />
        <div className="sv-art-id">
          {server.icon ? (
            <img className="sv-icon" src={server.icon} alt="" width={56} height={56} />
          ) : (
            <span className="sv-icon sv-icon-fallback" aria-hidden="true">
              <ServerIcon />
            </span>
          )}
          <div className="sv-art-text">
            <h2 className="sv-name">{server.name}</h2>
            <p className="sv-sub">
              {[server.software, server.region, server.language].filter(Boolean).join(" · ")}
            </p>
          </div>
          {server.featured && <span className="sv-featured">Partnered</span>}
        </div>
      </div>

      <div className="sv-body">
        <p className="sv-desc">{server.description}</p>

        <div className="sv-status" role="status">
          <LiveStatus state={state} />
          <span className="sv-status-detail">{line.detail ?? ""}</span>
          <button
            type="button"
            className="sv-refresh icon-btn"
            aria-label={`Check ${server.name} again`}
            title="Check again"
            onClick={() => void refresh(true)}
          >
            <RefreshArrowIcon />
          </button>
        </div>

        <ul className="sv-tags" aria-label="Server tags">
          {server.version && <li className="chip chip-accent">Minecraft {server.version}</li>}
          {server.tags.map((tag) => (
            <li key={tag} className="chip">
              {tag}
            </li>
          ))}
        </ul>

        <div className="sv-actions">
          <Button
            variant="primary"
            size="lg"
            block
            loading={joining}
            loadingLabel="Starting Minecraft…"
            onClick={onJoin}
            icon={<ServerIcon />}
          >
            Join server
          </Button>
          <button type="button" className="sv-address" onClick={onCopy} title="Copy the server address">
            <CopyIcon />
            <span>{copied ? "Address copied" : server.address}</span>
          </button>
        </div>

        <p className="muted small sv-join-note">
          Join starts Minecraft{server.version ? ` ${server.version}` : ""} straight into this server.
          <button type="button" className="link-inline" onClick={onOpenVersions}>
            Install or switch version
          </button>
        </p>
      </div>
    </article>
  );
}

/**
 * Servers: the partnered servers Maple lists, each with the live status the
 * server itself reports. Nothing is hardcoded beyond what the server publishes,
 * and Join uses the real launch flow with the address passed to Minecraft.
 */
export function ServersPage({
  data,
  onNavigate,
  onOpenAccount,
}: {
  data: AppData;
  onNavigate: (page: PageId) => void;
  onOpenAccount: () => void;
}) {
  const playAs = usePlayAs();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "good" | "warn"; text: string } | null>(null);
  const [joining, setJoining] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const all = useMemo(() => visibleServers(), []);
  const tags = useMemo(() => serverTags(all), [all]);
  const shown = all.filter((server) => matchesServer(server, query, tag));

  const version = data.selection.instance?.minecraft ?? data.selection.version;
  const java = data.java.status === "ready" ? data.java.data.selected : null;

  // A launch that settles clears the button; the game's own state stays the source of truth.
  const runPhase = data.game.run.phase;
  useEffect(() => {
    if (!joining) return;
    if (runPhase === "running" || runPhase === "error" || runPhase === "ended") setJoining(null);
  }, [joining, runPhase]);

  const join = (server: PartnerServer) => {
    setNotice(null);
    if (runPhase === "running" || runPhase === "starting") {
      setNotice({ tone: "warn", text: "Minecraft is already running. Close it before joining a server." });
      return;
    }
    if (!data.game.status) {
      setNotice({ tone: "warn", text: "Launching is only available in the Maple Client desktop app." });
      return;
    }
    if (!data.game.status.installed) {
      setNotice({
        tone: "warn",
        text: `Minecraft ${version ?? ""} is not installed yet, so there is nothing to join with. Install it on the Versions page first.`.trim(),
      });
      return;
    }
    if (!version) {
      setNotice({ tone: "warn", text: "Choose a Minecraft version first, then join the server." });
      return;
    }
    if (!java) {
      setNotice({ tone: "warn", text: "Java is needed before Minecraft can start. Set it up in Settings." });
      return;
    }
    const nameProblem = playAs.mode === "offline" ? usernameError(playAs.name) : null;
    if (nameProblem) {
      setNotice({ tone: "warn", text: nameProblem });
      onOpenAccount();
      return;
    }
    if (!canJoinDirectly(version)) {
      setNotice({
        tone: "warn",
        text: `Minecraft ${version} cannot be opened straight into a server. Joining from here works on 1.20 and newer; add ${server.address} in Multiplayer with this version instead.`,
      });
      return;
    }
    setJoining(server.id);
    data.game.play(java.path, playAs.mode, playAs.name, server.address);
  };

  const copy = async (server: PartnerServer) => {
    try {
      await navigator.clipboard.writeText(server.address);
      setCopied(server.id);
      window.setTimeout(() => setCopied((id) => (id === server.id ? null : id)), 1800);
    } catch {
      setNotice({ tone: "warn", text: `The address could not be copied. It is ${server.address}.` });
    }
  };

  return (
    <div className="page servers-page">
      <header className="page-head page-head-row sv-head">
        <div>
          <p className="eyebrow">Community</p>
          <h1>Servers</h1>
          <p>Partnered Minecraft servers, with the status each one reports right now.</p>
        </div>
        <div className="sv-tools">
          <div className="search-box sv-search">
            <SearchIcon />
            <input
              type="search"
              aria-label="Search servers"
              placeholder="Search servers…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      {notice && (
        <Banner tone={notice.tone} title="Before Minecraft starts">
          {notice.text}
        </Banner>
      )}

      {tags.length > 0 && (
        <div className="sv-filter" role="group" aria-label="Filter servers by tag">
          <button
            type="button"
            className={`chip ${tag === null ? "chip-on" : ""}`}
            aria-pressed={tag === null}
            onClick={() => setTag(null)}
          >
            All
          </button>
          {tags.map((name) => (
            <button
              key={name}
              type="button"
              className={`chip ${tag === name ? "chip-on" : ""}`}
              aria-pressed={tag === name}
              onClick={() => setTag(tag === name ? null : name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <section className="sv-section" aria-labelledby="partnered-title">
        <header className="sv-section-head">
          <h2 id="partnered-title">
            <ServerIcon /> Partnered servers
          </h2>
          <span className="muted small">
            <UsersIcon /> Live player counts come from the server itself
          </span>
        </header>

        {shown.length > 0 ? (
          <div className="sv-grid">
            {shown.map((server) => (
              <PartnerCard
                key={server.id}
                server={server}
                joining={joining === server.id}
                onJoin={() => join(server)}
                onCopy={() => void copy(server)}
                copied={copied === server.id}
                onOpenVersions={() => onNavigate("versions")}
              />
            ))}
          </div>
        ) : (
          <div className="sv-empty">
            <SearchIcon />
            <h3>No server matches</h3>
            <p className="muted small">Try another name or clear the tag filter.</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setQuery("");
                setTag(null);
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </section>

      <p className="muted small sv-foot">
        Partners are configured by Maple, not collected automatically. Live fields — online state, player counts,
        version, MOTD and icon — are read from each server's own status answer; anything it does not send is left out.
      </p>
    </div>
  );
}
