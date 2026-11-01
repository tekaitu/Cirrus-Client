import { JavaInstallPanel } from "../components/JavaInstallPanel";
import { JavaStatusBadge, javaTitle } from "../components/JavaStatus";
import { LogoMark, Wordmark } from "../components/Logo";
import { Badge, Banner, Card, Skeleton, type Tone } from "../components/ui";
import { formatMemory, joinParts } from "../core/format";
import { REQUIRED_JAVA_MAJOR, TARGET_MINECRAFT_VERSION } from "../core/java";
import type { AppData } from "../hooks/useAppData";

function JavaCard({ data }: { data: AppData }) {
  const state = data.java;
  const needsJava = state.status === "ready" && !state.data.selected;
  return (
    <Card title="Java" className="java-card">
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
    </Card>
  );
}

type CheckState = "ok" | "missing" | "checking" | "unbuilt";

const CHECK_LABEL: Record<CheckState, { tone: Tone; text: string }> = {
  ok: { tone: "good", text: "Ready" },
  missing: { tone: "warn", text: "Missing" },
  checking: { tone: "neutral", text: "Checking…" },
  unbuilt: { tone: "neutral", text: "Not built yet" },
};

function PlayCard({ data }: { data: AppData }) {
  const java = data.java;
  const javaCheck: CheckState =
    java.status === "loading" ? "checking" : java.status === "ready" && java.data.selected ? "ok" : "missing";

  const checks: Array<{ label: string; state: CheckState }> = [
    { label: `Java ${REQUIRED_JAVA_MAJOR} or newer`, state: javaCheck },
    { label: "Microsoft account sign-in", state: "unbuilt" },
    { label: "Minecraft game files", state: "unbuilt" },
    { label: "Fabric loader", state: "unbuilt" },
  ];

  return (
    <Card title="Play" className="play-card">
      <button type="button" className="btn btn-primary btn-play" disabled aria-describedby="play-note">
        Play (not available yet)
      </button>
      <p id="play-note" className="muted">
        Launching Minecraft is not implemented yet. The button is disabled on purpose so it cannot pretend to
        start the game.
      </p>
      <ul className="checklist" aria-label="What Play needs">
        {checks.map((c) => (
          <li key={c.label}>
            <span>{c.label}</span>
            <Badge tone={CHECK_LABEL[c.state].tone}>{CHECK_LABEL[c.state].text}</Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function HomePage({ data }: { data: AppData }) {
  const memory =
    data.settings.status === "ready" ? formatMemory(data.settings.data.settings.memoryMb) : null;

  return (
    <div className="page">
      <header className="hero">
        <span className="hero-mark">
          <LogoMark size={88} />
        </span>
        <div className="hero-text">
          <h1>
            <Wordmark height={30} />
          </h1>
          <p className="hero-sub">Minecraft Java Edition {TARGET_MINECRAFT_VERSION}</p>
          <p className="hero-tag">Low-end-friendly Fabric PvP launcher · early build</p>
        </div>
      </header>

      <div className="grid">
        <Card title="Game">
          <p className="big">Minecraft {TARGET_MINECRAFT_VERSION}</p>
          <p>
            <Badge>Not installed</Badge>
          </p>
          <p className="muted">Downloading game files is not implemented yet.</p>
          {memory && <p className="muted small">Memory setting: {memory}</p>}
        </Card>

        <Card title="Fabric">
          <p className="big">Fabric</p>
          <p>
            <Badge>Not installed</Badge>
          </p>
          <p className="muted">Fabric setup is not implemented yet.</p>
        </Card>

        <JavaCard data={data} />
      </div>

      <PlayCard data={data} />
    </div>
  );
}
