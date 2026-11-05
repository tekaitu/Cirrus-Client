import { useEffect, useState } from "react";
import { exitText, gameProgressView, usernameError, type PlayMode } from "../core/game";
import { REQUIRED_JAVA_MAJOR } from "../core/java";
import type { AppData } from "../hooks/useAppData";
import { Banner } from "./ui";
import type { PageId } from "./Sidebar";

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

/** Who to play as, and the one button that installs, signs in, or starts the game. */
export function PlayPanel({
  data,
  onNavigate,
  onOpenAccount,
}: {
  data: AppData;
  onNavigate: (page: PageId) => void;
  onOpenAccount: () => void;
}) {
  const { game } = data;
  const [mode, setMode] = useState<PlayMode>(() => (read("unlimited.playMode") === "offline" ? "offline" : "microsoft"));
  const [name, setName] = useState(() => read("unlimited.username") ?? "");
  const [touched, setTouched] = useState(false);

  useEffect(() => write("unlimited.playMode", mode), [mode]);
  useEffect(() => write("unlimited.username", name), [name]);

  const acct = data.account.state;
  const signedIn = acct.phase === "signedIn";
  const javaState = data.java;
  const java = javaState.status === "ready" ? javaState.data.selected : null;
  const javaLoading = javaState.status === "loading";
  const nameProblem = usernameError(name);
  const running = game.run.phase === "running";
  const installing = game.installer.phase === "running";

  let action: { label: string; onClick?: () => void; disabled?: boolean; danger?: boolean; hint?: string };
  if (running) {
    action = { label: "Stop Minecraft", onClick: game.stop, danger: true };
  } else if (game.run.phase === "starting") {
    action = { label: "Starting…", disabled: true };
  } else if (javaLoading) {
    action = { label: "Checking Java…", disabled: true };
  } else if (!java) {
    action = { label: `Install Java ${REQUIRED_JAVA_MAJOR} first`, disabled: true, hint: "Use the Java panel to install it in one click." };
  } else if (!game.status) {
    action = { label: "Play", disabled: true, hint: "Game status is only available in the desktop app." };
  } else if (!game.status.installed) {
    action = { label: "Install game files", onClick: game.install, disabled: installing };
  } else if (mode === "microsoft" && !signedIn) {
    action = { label: "Sign in to play", onClick: onOpenAccount };
  } else if (mode === "offline" && nameProblem) {
    action = { label: "Play", disabled: true, hint: "Choose a valid player name first." };
  } else {
    action = {
      label: "Play",
      onClick: () => game.play(java.path, mode, name),
    };
  }

  const progress = game.installer.phase === "running" ? gameProgressView(game.installer.progress) : null;

  return (
    <div className="play-panel">
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
            "Sign in with Microsoft to play with your own account and skin."
          )}
        </p>
      )}

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
          <button type="button" className="btn btn-pill" onClick={game.cancelInstall}>
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
            {action.label}
          </button>
          <button type="button" className="btn btn-pill" onClick={() => onNavigate("settings")}>
            Configure
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
        <Banner tone="bad" title="Minecraft could not be started" actions={<button type="button" className="btn btn-pill" onClick={game.dismissRun}>Dismiss</button>}>
          {game.run.message}
        </Banner>
      )}
      {game.run.phase === "ended" && (
        <Banner
          tone={game.run.code === 0 ? "good" : "warn"}
          title="Minecraft closed"
          actions={<button type="button" className="btn btn-pill" onClick={game.dismissRun}>Dismiss</button>}
        >
          {exitText(game.run.code)} <span className="path">{game.run.logPath}</span>
        </Banner>
      )}
      {running && <p className="muted small hero-note">Minecraft is running.</p>}
    </div>
  );
}
