import { useEffect, useState } from "react";
import type { GameProgress } from "../api/types";
import { formatElapsed, formatRemaining, formatSpeed, gameInstallView } from "../core/installProgress";
import { Button } from "./Button";

/**
 * The download panel. It shows what the backend reported (stage, files, bytes)
 * and works the percentage, average speed and time left out of those numbers.
 * When a size is not known the bar is indeterminate and no speed is shown.
 */
export function InstallProgress({
  progress,
  startedAt,
  cancelling,
  onCancel,
}: {
  progress: GameProgress | null;
  startedAt: number;
  cancelling: boolean;
  onCancel: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const view = gameInstallView(progress, startedAt, now);
  const percentText = view.percent === null ? null : `${view.percent}%`;
  const remaining = formatRemaining(view.remainingSeconds);
  const rate = view.speed === null ? null : formatSpeed(view.speed);

  return (
    <div className="install-card" role="status" aria-live="polite">
      <div className="install-head">
        <span className="install-stage">
          <span className="install-pulse" aria-hidden="true" />
          {view.stageLabel}
        </span>
        {percentText && <strong className="install-percent">{percentText}</strong>}
      </div>

      <div className={`install-bar ${view.percent === null ? "is-indeterminate" : ""}`}>
        <progress
          aria-label="Game download progress"
          max={100}
          {...(view.percent !== null ? { value: view.percent } : {})}
        />
      </div>

      <p className="install-message">{cancelling ? "Cancelling…" : view.message}</p>

      <dl className="install-facts">
        {view.bytesTotal > 0 && (
          <div>
            <dt>Downloaded</dt>
            <dd>
              {formatSize(view.bytesDone)} of {formatSize(view.bytesTotal)}
            </dd>
          </div>
        )}
        {rate && (
          <div>
            <dt>Speed</dt>
            <dd>{rate}</dd>
          </div>
        )}
        {remaining && (
          <div>
            <dt>Time left</dt>
            <dd>{remaining}</dd>
          </div>
        )}
        <div>
          <dt>Elapsed</dt>
          <dd>{formatElapsed(view.elapsedSeconds)}</dd>
        </div>
      </dl>

      <div className="install-actions">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={cancelling || !view.canCancel}>
          {cancelling ? "Cancelling…" : "Cancel"}
        </Button>
        {!view.canCancel && <span className="muted small">The last step cannot be stopped safely.</span>}
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
