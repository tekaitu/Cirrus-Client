import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../api/client";
import type { Diagnosis, DiagnosedFix } from "../api/types";
import { reportText } from "../core/game";
import { createSingleFlight } from "../core/singleFlight";
import type { AppData } from "../hooks/useAppData";
import type { PageId } from "./Navigation";
import { Badge, Spinner } from "./ui";
import { CloseIcon, CopyIcon, FolderIcon, WarningIcon, WrenchIcon } from "./Icons";

type Tab = "report" | "log";

/** The live launch log while the game starts or runs, and the crash screen when it ends unexpectedly. */
export function GameDialog({ data, onNavigate }: { data: AppData; onNavigate?: (page: PageId) => void }) {
  const { game } = data;
  if (game.panel === "none") return null;
  return game.panel === "crash" && game.run.phase === "ended" ? (
    <CrashView data={data} onNavigate={onNavigate} />
  ) : (
    <LogView data={data} />
  );
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

// One click opens one window: a second click while the desktop is still opening
// the folder is dropped, and the gate opens again as soon as it answers.
const folderGate = createSingleFlight();
function openFolder(kind: "logs" | "crash-reports" | "game") {
  void folderGate.run(() => api.openGameFolder(kind)).catch(() => {});
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

const CONFIDENCE: Record<string, { tone: "good" | "warn" | "neutral"; label: string }> = {
  high: { tone: "good", label: "Strong evidence" },
  medium: { tone: "warn", label: "Likely cause" },
  low: { tone: "neutral", label: "Possible cause" },
};

/**
 * The crash screen: the cause in plain words, the lines it is based on, and a
 * fix that says exactly what it will change before it changes anything. The raw
 * report is still one click away, never forced in front of the person.
 */
function CrashView({ data, onNavigate }: { data: AppData; onNavigate?: (page: PageId) => void }) {
  const { game } = data;
  const run = game.run;
  const { copied, copy } = useCopy();
  const crash = run.phase === "ended" ? run.crash : null;
  const [tab, setTab] = useState<Tab>(crash?.report ? "report" : "log");
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [diagnosing, setDiagnosing] = useState(true);
  const [diagnoseError, setDiagnoseError] = useState<string | null>(null);
  const [pending, setPending] = useState<DiagnosedFix | null>(null);
  const [fixing, setFixing] = useState(false);
  const [fixed, setFixed] = useState<string | null>(null);

  const instance = data.selection.instance;
  const version = data.selection.version;
  const loader = data.selection.loader;

  useEffect(() => {
    if (!crash) return;
    let alive = true;
    setDiagnosing(true);
    void api
      .diagnoseCrash({
        logTail: crash.logTail ?? game.log,
        report: crash.report,
        version,
        loader,
        javaMajor: instance?.javaPath
          ? data.java.status === "ready"
            ? data.java.data.analyses.find((j) => j.path === instance.javaPath)?.major ?? null
            : null
          : data.java.status === "ready"
            ? data.java.data.selected?.major ?? null
            : null,
        instanceId: instance?.id ?? null,
      })
      .then((d) => alive && setDiagnosis(d))
      .catch((e) => alive && setDiagnoseError(errorMessage(e)))
      .finally(() => alive && setDiagnosing(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crash?.report, version, loader]);

  if (run.phase !== "ended" || !crash) return null;

  const shown = tab === "report" && crash.report ? crash.report : crash.logTail || game.log;
  const code = run.code === null ? "no exit code" : `exit code ${run.code}`;
  const confidence = CONFIDENCE[diagnosis?.confidence ?? "low"] ?? CONFIDENCE.low;

  const applyFix = (fix: DiagnosedFix) => {
    setFixing(true);
    setFixed(null);
    const done = (message: string) => {
      setFixed(message);
      setPending(null);
      data.reloadInstances();
    };
    if (fix.kind === "memory" && instance) {
      void api
        .saveInstance({
          id: instance.id,
          minecraft: instance.minecraft,
          loader: instance.loader,
          loaderVersion: instance.loaderVersion,
          name: instance.name,
          icon: instance.icon,
          javaPath: instance.javaPath,
          memoryMb: Number(fix.value),
          gameDir: instance.customGameDir ? instance.gameDir : null,
          jvmArgs: instance.jvmArgs,
          lastPlayed: instance.lastPlayed,
          clonedFrom: instance.clonedFrom,
        })
        .then(() => done(`Memory for “${instance.name}” is now ${fix.value} MB. Start the game again to check.`))
        .catch((e) => setDiagnoseError(errorMessage(e)))
        .finally(() => setFixing(false));
    } else if (fix.kind === "repair" && instance) {
      void api
        .repairInstance(instance.id)
        .then((r) =>
          r.status === "installed"
            ? done("Game files checked and repaired. Worlds and mods were not touched.")
            : setDiagnoseError(r.message ?? "The files could not be repaired."),
        )
        .catch((e) => setDiagnoseError(errorMessage(e)))
        .finally(() => setFixing(false));
    } else {
      setFixing(false);
      setPending(null);
      onNavigate?.(fix.kind === "mods" ? "mods" : fix.kind === "java" ? "settings" : "library");
    }
  };

  const applyLabel = (fix: DiagnosedFix) => {
    if (fix.kind === "memory") return "Change the memory limit";
    if (fix.kind === "repair") return "Repair the game files";
    if (fix.kind === "mods") return "Open the mods";
    if (fix.kind === "java") return "Open Java settings";
    if (fix.kind === "loader") return "Open the instance";
    return "Show me";
  };

  return (
    <div className="modal-backdrop">
      <div className="modal game-modal crash-modal" role="dialog" aria-modal="true" aria-label="Minecraft crashed">
        <header className="game-modal-head">
          <span className="crash-icon" aria-hidden="true">
            <WarningIcon />
          </span>
          <div>
            <h2 className="modal-title">Minecraft closed unexpectedly</h2>
            <p className="muted small">It stopped with {code}.</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close dialog" onClick={game.closePanel}>
            <CloseIcon />
          </button>
        </header>

        <div className={`crash-hint ${diagnosis?.unknown ? "is-unknown" : ""}`} role="note">
          <div className="crash-hint-head">
            <strong>{diagnosis?.unknown ? "No known cause recognised" : "What likely happened"}</strong>
            {diagnosis && <Badge tone={confidence.tone}>{confidence.label}</Badge>}
          </div>
          {diagnosing ? (
            <p className="muted small">
              <Spinner label="Reading the crash report" /> Reading the log and crash report…
            </p>
          ) : (
            <p>
              {diagnosis?.cause ??
                crash.hint ??
                "The launcher could not read the crash details. The report below is the best thing to share."}
            </p>
          )}
          {diagnoseError && <p className="muted small">{diagnoseError}</p>}
          {diagnosis?.evidence && diagnosis.evidence.length > 0 && (
            <details className="crash-evidence">
              <summary>What this is based on</summary>
              <ul>
                {diagnosis.evidence.map((line, i) => (
                  <li key={i}>
                    <code>{line}</code>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {diagnosis && diagnosis.fixes.length > 0 && (
          <section className="crash-fixes" aria-label="Suggested fixes">
            <h3>
              <WrenchIcon /> Suggested fixes
            </h3>
            <ul>
              {diagnosis.fixes.map((fix) => (
                <li key={`${fix.kind}-${fix.label}`}>
                  <div>
                    <strong>{fix.label}</strong>
                    <p className="muted small">{fix.detail}</p>
                  </div>
                  {pending?.label === fix.label ? (
                    <div className="fix-confirm" role="group" aria-label="Confirm fix">
                      <p className="small">
                        {fix.kind === "memory"
                          ? `Memory for this instance becomes ${fix.value} MB. The previous settings file is kept as a backup.`
                          : "Cirrus will do exactly what is described above, and nothing else."}
                      </p>
                      <div className="row">
                        <button type="button" className="btn btn-small" onClick={() => setPending(null)} disabled={fixing}>
                          Cancel
                        </button>
                        <button type="button" className="btn btn-primary btn-small" onClick={() => applyFix(fix)} disabled={fixing}>
                          {fixing ? <Spinner label="Applying" /> : "Apply fix"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={!!fixed}
                      onClick={() => {
                        if (fix.kind === "driver") {
                          setFixed("Update your graphics driver from your card maker's app, then try again.");
                          return;
                        }
                        setPending(fix);
                      }}
                    >
                      {applyLabel(fix)}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {fixed && (
              <p className="notice-text" role="status">
                {fixed}
              </p>
            )}
          </section>
        )}

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
            <CopyIcon /> {copied ? "Copied" : "Copy technical details"}
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
