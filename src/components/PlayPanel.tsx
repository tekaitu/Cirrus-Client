import { useEffect, useRef, useState } from "react";
import { exitText, gameProgressView, usernameError, type LoaderId, type PlayMode } from "../core/game";
import { REQUIRED_JAVA_MAJOR } from "../core/java";
import type { AppData } from "../hooks/useAppData";
import { PackageIcon, PlayArrowIcon, SettingsIcon, ShieldIcon, StopIcon } from "./Icons";
import { Banner } from "./ui";
import type { PageId } from "./Navigation";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* a remembered choice is a convenience only */
  }
}

/** Version, loader and player choice, plus the one button that sets up, signs in, or starts the game. */
export function PlayPanel({
  data,
  onNavigate,
  onOpenAccount,
  variant = "full",
}: {
  data: AppData;
  onNavigate: (page: PageId) => void;
  onOpenAccount: () => void;
  /** "quick" (Home) is the big Play button and a one-line summary; "full" (Play page) adds every choice. */
  variant?: "quick" | "full";
}) {
  const { game, selection } = data;
  const [mode, setMode] = useState<PlayMode>(() => (read("unlimited.playMode") === "offline" ? "offline" : "microsoft"));
  const [name, setName] = useState(() => read("unlimited.username") ?? "");
  const [touched, setTouched] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  // Each setup step is tried once per click, so a step that "succeeds" without changing anything cannot repeat forever.
  const tried = useRef({ java: false, game: false });

  useEffect(() => write("unlimited.playMode", mode), [mode]);
  useEffect(() => write("unlimited.username", name), [name]);

  const acct = data.account.state;
  const signedIn = acct.phase === "signedIn";
  const checkingAccount = acct.phase === "checking";
  // Online play needs the Microsoft account. Offline play needs no sign-in at all.
  const accountReady = mode === "offline" || signedIn;

  const javaState = data.java;
  const java = javaState.status === "ready" ? javaState.data.selected : null;
  const javaLoading = javaState.status === "loading";
  const nameProblem = usernameError(name);
  const running = game.run.phase === "running";
  const javaPhase = data.installer.state.phase;
  const gamePhase = game.installer.phase;
  const installing = gamePhase === "running" || javaPhase === "running";
  const needsSetup = !javaLoading && game.status !== null && (!java || !game.status.installed);

  // "Set up & play": install Java, then the game files, then start, one step after another.
  // `auto` is the real switch; it is cleared before the game starts, so this can never repeat.
  // The effect reads the latest values through `latest` and only reacts to simple values.
  const auto = useRef(false);
  const latest = useRef({ game, installer: data.installer, mode, name, javaPath: java?.path ?? null });
  latest.current = { game, installer: data.installer, mode, name, javaPath: java?.path ?? null };
  const javaPath = java?.path ?? null;
  const gameInstalled = game.status?.installed ?? null;

  useEffect(() => {
    if (!auto.current) return;
    if (javaPhase === "running" || gamePhase === "running" || javaLoading || gameInstalled === null) return;
    const stop = () => {
      auto.current = false;
      setAutoPlay(false);
    };
    if (javaPhase === "error" || javaPhase === "cancelled" || gamePhase === "error" || gamePhase === "cancelled") {
      stop();
      return;
    }
    const now = latest.current;
    if (javaPath === null) {
      if (javaPhase === "idle" && !tried.current.java) {
        tried.current.java = true;
        now.installer.start();
      } else stop();
      return;
    }
    if (!gameInstalled) {
      if (gamePhase === "idle" && !tried.current.game) {
        tried.current.game = true;
        now.game.install();
      } else stop();
      return;
    }
    stop();
    now.game.play(javaPath, now.mode, now.name);
  }, [autoPlay, javaPhase, gamePhase, javaLoading, javaPath, gameInstalled]);

  let action: { label: string; onClick?: () => void; disabled?: boolean; danger?: boolean; hint?: string };
  if (running) {
    action = { label: "Stop Minecraft", onClick: game.stop, danger: true };
  } else if (game.run.phase === "starting") {
    action = { label: "Starting…", disabled: true };
  } else if (mode === "microsoft" && checkingAccount) {
    action = { label: "Checking account…", disabled: true };
  } else if (mode === "microsoft" && !signedIn) {
    action = {
      label: "Sign in to play",
      onClick: onOpenAccount,
      hint: "Sign in to play online with your own account, or switch to “Offline name” to play without signing in.",
    };
  } else if (mode === "offline" && nameProblem) {
    action = { label: "Play", disabled: true, hint: "Choose a valid player name first." };
  } else if (javaLoading || (!game.status && javaState.status !== "error")) {
    action = { label: "Checking…", disabled: true };
  } else if (needsSetup || autoPlay) {
    action = {
      label: autoPlay ? "Setting up…" : "Set up & play",
      onClick: () => {
        tried.current = { java: false, game: false };
        auto.current = true;
        setAutoPlay(true);
      },
      disabled: autoPlay || installing,
      hint: !java
        ? `Installs Java ${REQUIRED_JAVA_MAJOR}${game.status?.installed ? "" : ", Minecraft"}${selection.loader === "fabric" && !game.status?.installed ? " and Fabric" : ""}, then starts the game.`
        : `Downloads Minecraft ${selection.version}${selection.loader === "fabric" ? " with Fabric" : ""}, then starts the game.`,
    };
  } else if (java && game.status) {
    action = { label: "Play", onClick: () => game.play(java.path, mode, name) };
  } else {
    action = { label: "Play", disabled: true, hint: "Game status is only available in the desktop app." };
  }

  const progress = game.installer.phase === "running" ? gameProgressView(game.installer.progress) : null;
  const cancelAll = () => {
    setAutoPlay(false);
    game.cancelInstall();
  };

  const steps: Array<{ label: string; done: boolean; active: boolean }> = [
    { label: mode === "offline" ? "Player" : "Account", done: accountReady, active: !accountReady },
    { label: "Java", done: java !== null, active: accountReady && java === null },
    { label: "Game files", done: game.status?.installed === true, active: accountReady && java !== null && game.status?.installed !== true },
  ];
  const doneCount = steps.filter((x) => x.done).length;

  return (
    <div className="play-panel">
      <ol className="steps" aria-label="Setup progress">
        {steps.map((st, i) => (
          <li key={st.label} className={`${st.done ? "step-done" : ""} ${st.active ? "step-active" : ""}`.trim()}>
            <span className="step-dot" aria-hidden="true">{st.done ? "✓" : i + 1}</span>
            <span className="step-label">{st.label}</span>
          </li>
        ))}
        <li className="steps-meter" aria-hidden="true">
          <span className={`steps-fill steps-fill-${doneCount}`} />
        </li>
      </ol>
      {variant === "quick" && (
        <p className="play-summary">
          <span>
            Minecraft <strong>{selection.version}</strong> · {selection.loader === "fabric" ? "Fabric" : "Vanilla"}
            {selection.profile && <> · profile <strong>{selection.profile.name}</strong></>}
          </span>
          <span className="muted">
            {mode === "offline" ? (
              <>Offline as <strong>{name.trim() || "…"}</strong></>
            ) : signedIn ? (
              <>Playing as <strong>{acct.profile.name}</strong></>
            ) : (
              "Not signed in"
            )}
          </span>
          <button type="button" className="link-inline" onClick={() => onNavigate("play")}>
            Change
          </button>
        </p>
      )}
      {variant === "full" && selection.profile && (
        <div className="profile-chip">
          <PackageIcon />
          <span>
            Profile: <strong>{selection.profile.name}</strong>
          </span>
          <button type="button" className="btn btn-quiet btn-small" onClick={() => selection.selectProfile(null)}>
            Use default
          </button>
        </div>
      )}
      {variant === "full" && (<>
      <div className="pick-row">
        <label className="pick">
          <span>Minecraft version</span>
          <select
            aria-label="Minecraft version"
            value={selection.version}
            disabled={running || installing}
            onChange={(e) => selection.setVersion(e.target.value)}
          >
            {selection.versions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <div className="pick">
          <span id="loader-label">Loader</span>
          <div className="seg" role="radiogroup" aria-labelledby="loader-label">
            {(["fabric", "vanilla"] as LoaderId[]).map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={selection.loader === l}
                className={selection.loader === l ? "seg-on" : ""}
                disabled={running || installing}
                onClick={() => selection.setLoader(l)}
              >
                {l === "fabric" ? "Fabric" : "Vanilla"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <details className="why-optifine">
        <summary>Why is there no OptiFine?</summary>
        <p className="muted small">
          OptiFine can&apos;t be downloaded automatically: its own download page requires a person to click through
          it, and its license does not allow other launchers to redistribute it. On Fabric, the Mods tab can install
          Sodium, Lithium and similar mods, which give the same kind of FPS boost.
        </p>
      </details>

      <div className="seg" role="radiogroup" aria-label="Play as">
        {(["microsoft", "offline"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            className={mode === m ? "seg-on" : ""}
            onClick={() => setMode(m)}
          >
            {m === "microsoft" ? "Microsoft account" : "Offline name"}
          </button>
        ))}
      </div>

      {mode === "offline" ? (
        <div className="name-field">
          <label htmlFor="player-name">Player name</label>
          <input
            id="player-name"
            type="text"
            value={name}
            maxLength={16}
            autoComplete="off"
            spellCheck={false}
            placeholder="Steve"
            aria-invalid={touched && nameProblem ? true : undefined}
            aria-describedby="name-help"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(true)}
          />
          <p id="name-help" className={touched && nameProblem ? "error-text" : "muted small"}>
            {touched && nameProblem
              ? nameProblem
              : "Offline play works for singleplayer and offline-mode servers. Servers that check Microsoft accounts will refuse it."}
          </p>
        </div>
      ) : (
        <p className="play-as muted small">
          {signedIn ? (
            <>
              Playing as <strong>{acct.profile.name}</strong>
            </>
          ) : (
            "Sign in with Microsoft to play online with your own account and skin, or choose Offline name to play without signing in."
          )}
        </p>
      )}
      </>)}

      {progress ? (
        <div className="install-inline" role="status" aria-live="polite">
          <p className="small">
            {game.installer.phase === "running" && game.installer.cancelling ? "Cancelling…" : progress.label}
          </p>
          <progress
            aria-label="Game download progress"
            max={100}
            {...(progress.percent !== null ? { value: progress.percent } : {})}
          />
          <button type="button" className="btn btn-pill" onClick={cancelAll}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="hero-actions">
          <button
            type="button"
            className={`btn btn-pill ${action.danger ? "btn-danger" : "btn-primary btn-glow"}`}
            disabled={action.disabled}
            onClick={action.onClick}
          >
            {action.danger ? <StopIcon /> : action.label.startsWith("Sign in") ? <ShieldIcon /> : !action.disabled && <PlayArrowIcon />}
            {action.label}
          </button>
          <button type="button" className="btn btn-pill" onClick={() => onNavigate(variant === "quick" ? "play" : "settings")}>
            <SettingsIcon />
            {variant === "quick" ? "Launch options" : "Settings"}
          </button>
        </div>
      )}
      {action.hint && !progress && <p className="muted small hero-note">{action.hint}</p>}

      {game.installer.phase === "error" && (
        <Banner tone="bad" title="Game files could not be downloaded">
          {game.installer.message}
        </Banner>
      )}
      {game.installer.phase === "cancelled" && <p className="muted small">Download cancelled. Nothing was changed.</p>}
      {game.run.phase === "error" && (
        <Banner
          tone="bad"
          title="Minecraft could not be started"
          actions={
            <button type="button" className="btn btn-pill" onClick={game.dismissRun}>
              Dismiss
            </button>
          }
        >
          {game.run.message}
        </Banner>
      )}
      {game.run.phase === "ended" && (
        <Banner
          tone={game.run.code === 0 ? "good" : "warn"}
          title="Minecraft closed"
          actions={
            <button type="button" className="btn btn-pill" onClick={game.dismissRun}>
              Dismiss
            </button>
          }
        >
          {exitText(game.run.code)} <span className="path">{game.run.logPath}</span>
        </Banner>
      )}
      {running && <p className="muted small hero-note">Minecraft is running.</p>}
    </div>
  );
}
