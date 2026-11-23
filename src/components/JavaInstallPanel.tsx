import { progressView } from "../core/installer";
import { REQUIRED_JAVA_MAJOR } from "../core/java";
import type { JavaInstaller } from "../hooks/useJavaInstaller";
import { Banner } from "./ui";

/**
 * Offers to install Java 21 and shows the installer's progress, result and
 * errors. `needed` is true when detection found no compatible Java.
 */
export function JavaInstallPanel({ installer, needed }: { installer: JavaInstaller; needed: boolean }) {
  const { state } = installer;

  if (state.phase === "running") {
    const view = state.progress ? progressView(state.progress) : null;
    const label = view?.label ?? "Starting";
    return (
      <div className="install-panel" role="status" aria-live="polite">
        <p>
          <strong>{state.cancelling ? "Cancelling…" : `${label}…`}</strong>
        </p>
        {view?.percent != null ? (
          <progress max={100} value={view.percent} aria-label="Java download progress" />
        ) : (
          <progress aria-label="Java installation progress" />
        )}
        <p className="muted small">{view?.detail ?? "Preparing…"}</p>
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={installer.cancel}
            disabled={state.cancelling || (view !== null && !view.canCancel)}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === "done") {
    const r = state.result;
    return (
      <Banner
        tone="good"
        title={r.status === "installed" ? `Java ${REQUIRED_JAVA_MAJOR} installed` : `Java ${REQUIRED_JAVA_MAJOR} is already available`}
        actions={
          <button type="button" className="btn btn-quiet" onClick={installer.dismiss}>
            Dismiss
          </button>
        }
      >
        {r.version ? `Version ${r.version}. ` : ""}
        {r.configured ? "Settings now use it. " : "Nothing in Settings was changed. "}
        {r.javaPath ?? ""}
      </Banner>
    );
  }

  if (state.phase === "cancelled") {
    return (
      <Banner
        tone="info"
        title="Installation cancelled"
        actions={
          <>
            <button type="button" className="btn btn-primary" onClick={() => installer.start()}>
              Install again
            </button>
            <button type="button" className="btn btn-quiet" onClick={installer.dismiss}>
              Dismiss
            </button>
          </>
        }
      >
        Nothing was installed and no files were left behind.
      </Banner>
    );
  }

  if (state.phase === "error") {
    return (
      <Banner
        tone="bad"
        title="Java could not be installed"
        actions={
          <>
            <button type="button" className="btn btn-primary" onClick={() => installer.start()}>
              Retry install
            </button>
            <button type="button" className="btn btn-quiet" onClick={installer.dismiss}>
              Dismiss
            </button>
          </>
        }
      >
        {state.message}
      </Banner>
    );
  }

  if (!needed) return null;

  return (
    <div className="install-panel">
      <p>
        <strong>Install Java {REQUIRED_JAVA_MAJOR} automatically</strong>
      </p>
      <p className="muted small">
        Downloads Eclipse Temurin {REQUIRED_JAVA_MAJOR} (LTS) from Adoptium, checks its SHA-256 checksum, and
        keeps it in Maple Client&apos;s own folder. No administrator rights are needed and Windows settings
        are not changed.
      </p>
      <button type="button" className="btn btn-primary" onClick={() => installer.start()}>
        Install Java {REQUIRED_JAVA_MAJOR}
      </button>
    </div>
  );
}
