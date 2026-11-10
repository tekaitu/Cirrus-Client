import { PlayPanel } from "../components/PlayPanel";
import { JavaInstallPanel } from "../components/JavaInstallPanel";
import { JavaStatusBadge, javaTitle } from "../components/JavaStatus";
import type { PageId } from "../components/Sidebar";
import { CardArt } from "../components/Art";
import { Badge, Banner, Card, Skeleton, type Tone } from "../components/ui";
import { formatMemory, joinParts } from "../core/format";
import { NEWS, formatNewsDate } from "../content/news";
import { REQUIRED_JAVA_MAJOR, TARGET_MINECRAFT_VERSION } from "../core/java";
import type { AppData } from "../hooks/useAppData";

function JavaCard({ data }: { data: AppData }) {
  const state = data.java;
  const needsJava = state.status === "ready" && !state.data.selected;
  return (
    <div className="java-block">
      <h3>Java</h3>
      {state.status === "loading" && <Skeleton label="Detecting Java" lines={2} />}

      {state.status === "error" && (
        <Banner
          tone="bad"
          title="Java detection failed"
          actions={
            <button type="button" className="btn" onClick={data.reloadJava}>
              Try again
            </button>
          }
        >
          {state.message}
        </Banner>
      )}

      {state.status === "ready" && state.data.selected && (
        <>
          <p className="big">{javaTitle(state.data.selected)}</p>
          <p className="muted">
            {joinParts([
              state.data.selected.versionString,
              state.data.selected.is64Bit === true ? "64-bit" : null,
              state.data.selected.runtime,
            ])}
          </p>
          <p>
            <JavaStatusBadge status={state.data.selected.status} />{" "}
            <Badge>{state.data.selected.source}</Badge>
          </p>
        </>
      )}

      {state.status === "ready" && !state.data.selected && state.data.analyses.length > 0 && (
        <Banner tone="warn" title={`No Java ${REQUIRED_JAVA_MAJOR}+ found`}>
          Minecraft {TARGET_MINECRAFT_VERSION} needs Java {REQUIRED_JAVA_MAJOR} or newer. Found only:{" "}
          {state.data.analyses.map((a) => javaTitle(a)).join(", ")}. Open Diagnostics for details.
        </Banner>
      )}

      {state.status === "ready" && state.data.analyses.length === 0 && (
        <div className="empty">
          <p>
            <strong>No Java found</strong>
          </p>
          <p className="muted">
            Checked {state.data.candidatesChecked} location(s). Install a Java {REQUIRED_JAVA_MAJOR} runtime
            (for example Eclipse Temurin {REQUIRED_JAVA_MAJOR}), or set the path in Settings, then detect
            again.
          </p>
          <button type="button" className="btn" onClick={data.reloadJava}>
            Detect again
          </button>
        </div>
      )}

      <JavaInstallPanel installer={data.installer} needed={needsJava} />
    </div>
  );
}

type CheckState = "ok" | "missing" | "checking" | "notInstalled" | "needed";

const CHECK_LABEL: Record<CheckState, { tone: Tone; text: string }> = {
  ok: { tone: "good", text: "Ready" },
  missing: { tone: "warn", text: "Missing" },
  checking: { tone: "neutral", text: "Checking…" },
  notInstalled: { tone: "neutral", text: "Not installed" },
  needed: { tone: "warn", text: "Sign-in needed" },
};

function Hero({ data, onNavigate, onOpenAccount }: { data: AppData; onNavigate: (page: PageId) => void; onOpenAccount: () => void }) {
  const signedIn = data.account.state.phase === "signedIn";
  const java = data.java;
  const javaCheck: CheckState =
    java.status === "loading" ? "checking" : java.status === "ready" && java.data.selected ? "ok" : "missing";

  const gameState: CheckState = data.game.status?.installed ? "ok" : "notInstalled";
  const checks: Array<{ label: string; state: CheckState }> = [
    { label: `Java ${REQUIRED_JAVA_MAJOR} or newer`, state: javaCheck },
    { label: "Microsoft account sign-in", state: signedIn ? "ok" : "needed" },
    { label: "Minecraft game files", state: gameState },
    { label: "Fabric loader", state: gameState },
  ];

  return (
    <section className="hero" aria-labelledby="hero-title">
      <p className="pill eyebrow">Minecraft Java Edition {data.selection.version}</p>
      <h1 id="hero-title">Sword PvP, tuned for low-end PCs</h1>
      <p className="hero-copy">
        A lightweight Fabric launcher built around steady frame rates and low input delay. Early build: the
        game download and launch are new and have not been tried on many PCs yet.
      </p>
      <PlayPanel data={data} onNavigate={onNavigate} onOpenAccount={onOpenAccount} />
      <ul className="chips" aria-label="What Play needs">
        {checks.map((c) => (
          <li key={c.label}>
            <span>{c.label}</span>
            <Badge tone={CHECK_LABEL[c.state].tone}>{CHECK_LABEL[c.state].text}</Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusPanel({ data }: { data: AppData }) {
  const memory =
    data.settings.status === "ready" ? formatMemory(data.settings.data.settings.memoryMb) : null;
  return (
    <Card title="Status" className="status-card">
      <ul className="status-rows">
        <li>
          <div>
            <strong>Minecraft {data.selection.version}</strong>
            {memory && <span className="muted small"> · memory {memory}</span>}
          </div>
          <Badge tone={data.game.status?.installed ? "good" : "neutral"}>
            {data.game.status?.installed ? "Installed" : "Not installed"}
          </Badge>
        </li>
        <li>
          <div>
            <strong>Fabric</strong>
            {data.game.status?.loader && <span className="muted small"> · loader {data.game.status.loader}</span>}
          </div>
          <Badge tone={data.game.status?.installed ? "good" : "neutral"}>
            {data.game.status?.installed ? "Installed" : "Not installed"}
          </Badge>
        </li>
      </ul>
      <JavaCard data={data} />
    </Card>
  );
}

function NewsRow() {
  return (
    <section className="news" aria-labelledby="news-title">
      <header className="news-head">
        <h2 id="news-title">Launcher news</h2>
        <span className="muted small">Local project notes and tips, not live news</span>
      </header>
      <ul className="news-grid">
        {NEWS.map((n) => (
          <li key={n.id}>
            <article className="news-card">
              <CardArt kind={n.art} />
              <div className="news-body">
                <p className="news-meta">
                  <span className={`kind kind-${n.kind.toLowerCase()}`}>{n.kind}</span>
                  {n.date && <time dateTime={n.date}>{formatNewsDate(n.date)}</time>}
                </p>
                <h3>{n.title}</h3>
                <p className="muted small">{n.body}</p>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HomePage({ data, onNavigate, onOpenAccount }: { data: AppData; onNavigate: (page: PageId) => void; onOpenAccount: () => void }) {
  return (
    <div className="home">
      <div className="home-top">
        <Hero data={data} onNavigate={onNavigate} onOpenAccount={onOpenAccount} />
        <div className="home-side">
          <StatusPanel data={data} />
        </div>
      </div>
      <NewsRow />
    </div>
  );
}
