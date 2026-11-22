import { useEffect, useState } from "react";
import { api, errorMessage } from "../api/client";
import type { UpdateCheck } from "../api/types";
import { CloseIcon, UpdateIcon } from "./Icons";
import { Spinner } from "./ui";

/**
 * One quiet line above the footer when a newer official Cirrus release exists.
 * It never opens by itself a second time: "Later" hides it for this session.
 * Installing is only offered when the build can verify a signed release; this
 * build says so and opens the official release page instead.
 */
export function UpdateNotice() {
  const [check, setCheck] = useState<UpdateCheck | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    // A short delay so start-up is never held up by a network request.
    const timer = window.setTimeout(() => {
      void api
        .checkForUpdates()
        .then((result) => setCheck(result))
        .catch((e) => setError(errorMessage(e)));
    }, 4000);
    return () => window.clearTimeout(timer);
  }, []);

  if (dismissed || error || !check?.available) return null;

  const open = () => {
    if (!check.pageUrl) return;
    setOpening(true);
    void api
      .openUpdatePage(check.pageUrl)
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setOpening(false));
  };

  return (
    <aside className="update-notice" role="status" aria-label="Launcher update available">
      <span className="update-icon" aria-hidden="true">
        <UpdateIcon />
      </span>
      <div className="update-text">
        <strong>Cirrus Launcher update available</strong>
        <span className="muted small">
          v{check.current} → v{check.latest}
          {check.publishedAt ? ` · ${new Date(check.publishedAt).toLocaleDateString()}` : ""}
        </span>
        {check.notes && (
          <details className="update-notes">
            <summary>What changed</summary>
            <p>{check.notes}</p>
          </details>
        )}
        <p className="muted small update-install-note">{check.installMessage}</p>
      </div>
      <div className="update-actions">
        <button type="button" className="btn btn-primary btn-small" onClick={open} disabled={!check.pageUrl || opening}>
          {opening ? <Spinner label="Opening" /> : "Update Now"}
        </button>
        <button type="button" className="btn btn-small" onClick={() => setDismissed(true)}>
          Later
        </button>
        <button type="button" className="icon-btn" aria-label="Dismiss update notice" onClick={() => setDismissed(true)}>
          <CloseIcon />
        </button>
      </div>
    </aside>
  );
}
