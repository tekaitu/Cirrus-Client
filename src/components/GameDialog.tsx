import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { reportText } from "../core/game";
import type { AppData } from "../hooks/useAppData";
import { CloseIcon, CopyIcon, FolderIcon, WarningIcon } from "./Icons";

type Tab = "report" | "log";

/** The live launch log while the game starts or runs, and the crash screen when it ends unexpectedly. */
export function GameDialog({ data }: { data: AppData }) {
  const { game } = data;
  if (game.panel === "none") return null;
  return game.panel === "crash" && game.run.phase === "ended" ? <CrashView data={data} /> : <LogView data={data} />;
}

function headerLine(data: AppData, extra: string): string {
  const version = data.app.status === "ready" ? data.app.data.version : "";
  const sel = data.selection;
  return `Cirrus Client ${version} · Minecraft ${sel.version} (${sel.loader === "fabric" ? "Fabric" : "Vanilla"}) · ${extra}`;
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(id);
  }, [copied]);
  const copy = (text: string) => {
    void Promise.resolve(navigator.clipboard?.writeText(text))
      .then(() => setCopied(true))
      .catch(() => {});
  };
  return { copied, copy };
}

function openFolder(kind: "logs" | "crash-reports" | "game") {
  void api.openGameFolder(kind).catch(() => {});
}

/** Monospace text that follows the end of the log until the person scrolls up. */
function LogText({ text, label, follow = true }: { text: string; label: string; follow?: boolean }) {
  const ref = useRef<HTMLPreElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (el && follow && stick.current) el.scrollTop = el.scrollHeight;
  }, [text, follow]);
  return (
    <pre
      ref={ref}
      className="log-text"
      tabIndex={0}
      aria-label={label}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      }}
    >
      {text || "Waiting for the game to print something…"}
    </pre>
  );
}

function LogView({ data }: { data: AppData }) {
  const { game } = data;
  const { copied, copy } = useCopy();
  const live = game.run.phase === "starting" || game.run.phase === "running";
  const status =
    game.run.phase === "starting" ? "Starting" : game.run.phase === "running" ? "Running" : "Last launch";
  return (
    <div className="modal-backdrop">
      <div className="modal game-modal" role="dialog" aria-modal="true" aria-label="Launch log">
        <header className="game-modal-head">
          <div>
            <h2 className="modal-title">Launch log</h2>
            <p className="muted small">
              <span className={`dot ${live ? "dot-live" : ""}`} aria-hidden="true" /> {status} · everything Minecraft
              prints is shown here as it happens.
            </p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close dialog" onClick={game.closePanel}>
            <CloseIcon />
          </button>
        </header>
        <LogText text={game.log} label="Launch log text" />
        <div className="row game-modal-actions">
          <button type="button" className="btn" onClick={() => copy(reportText(headerLine(data, "launch log"), game.log))}>
            <CopyIcon /> {copied ? "Copied" : "Copy log"}
          </button>
          <button type="button" className="btn" onClick={() => openFolder("logs")}>
            <FolderIcon /> Open logs folder
          </button>
          {live && (
            <button type="button" className="btn btn-danger" onClick={game.stop}>
              Stop Minecraft
            </button>
          )}
          <button type="button" className="btn btn-primary push-right" onClick={game.closePanel}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function CrashView({ data }: { data: AppData }) {
  const { game } = data;
  const run = game.run;
  const { copied, copy } = useCopy();
  const crash = run.phase === "ended" ? run.crash : null;
  const [tab, setTab] = useState<Tab>(crash?.report ? "report" : "log");
  if (run.phase !== "ended" || !crash) return null;

  const shown = tab === "report" && crash.report ? crash.report : crash.logTail || game.log;
  const code = run.code === null ? "no exit code" : `exit code ${run.code}`;
  return (
    <div className="modal-backdrop">
      <div className="modal game-modal crash-modal" role="dialog" aria-modal="true" aria-label="Minecraft crashed">
        <header className="game-modal-head">
          <span className="crash-icon" aria-hidden="true">
            <WarningIcon />
          </span>
          <div>
            <h2 className="modal-title">Minecraft closed unexpectedly</h2>
            <p className="muted small">It stopped with {code}. The details below show what happened.</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close dialog" onClick={game.closePanel}>
            <CloseIcon />
          </button>
        </header>

        <div className="crash-hint" role="note">
          <strong>Likely cause</strong>
          <p>
            {crash.hint ??
              "No known cause was recognised. The crash report usually names the mod or file involved; copy it when asking for help."}
          </p>
        </div>

        <div className="seg" role="radiogroup" aria-label="Show">
          {crash.report && (
            <button
              type="button"
              role="radio"
              aria-checked={tab === "report"}
              className={tab === "report" ? "seg-on" : ""}
              onClick={() => setTab("report")}
            >
              Crash report
            </button>
          )}
          <button
            type="button"
            role="radio"
            aria-checked={tab === "log"}
            className={tab === "log" ? "seg-on" : ""}
            onClick={() => setTab("log")}
          >
            Game log
          </button>
        </div>

        <LogText text={shown} label={tab === "report" ? "Crash report text" : "Game log text"} follow={tab === "log"} />

        <div className="row game-modal-actions">
          <button type="button" className="btn" onClick={() => copy(reportText(headerLine(data, code), shown))}>
            <CopyIcon /> {copied ? "Copied" : "Copy details"}
          </button>
          <button type="button" className="btn" onClick={() => openFolder(crash.report ? "crash-reports" : "logs")}>
            <FolderIcon /> {crash.report ? "Open crash folder" : "Open logs folder"}
          </button>
          <button type="button" className="btn btn-primary push-right" onClick={game.closePanel}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
