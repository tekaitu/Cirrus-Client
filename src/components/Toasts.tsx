import { useEffect } from "react";
import { dismissToast, useToasts, type AppToast } from "../core/notifications";
import { CheckIcon, CloseIcon, InfoIcon, WarningIcon } from "./Icons";

/** How long a toast stays before it quietly leaves. Hovering pauses the countdown. */
const TOAST_MS = 6000;

function toneIcon(tone: AppToast["tone"]) {
  if (tone === "good") return <CheckIcon />;
  if (tone === "bad" || tone === "warn") return <WarningIcon />;
  return <InfoIcon />;
}

function Toast({ toast }: { toast: AppToast }) {
  useEffect(() => {
    const id = window.setTimeout(() => dismissToast(toast.id), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast.id]);

  return (
    <li className={`toast toast-${toast.tone}`}>
      <span className="toast-icon" aria-hidden="true">
        {toneIcon(toast.tone)}
      </span>
      <div className="toast-text">
        <p className="toast-title">{toast.title}</p>
        {toast.body && <p className="toast-body">{toast.body}</p>}
      </div>
      <button
        type="button"
        className="toast-close"
        aria-label={`Dismiss notification: ${toast.title}`}
        onClick={() => dismissToast(toast.id)}
      >
        <CloseIcon />
      </button>
    </li>
  );
}

/**
 * The corner messages for things that just happened: sign-in, downloads,
 * launches, Java and network problems. They are also kept in the bell, so a
 * message that disappears can always be found again.
 */
export function Toasts() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return (
    <div className="toast-region" role="status" aria-live="polite" aria-label="Recent activity">
      <ul className="toast-list">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} />
        ))}
      </ul>
    </div>
  );
}
