import type { GameProgress } from "../api/types";
import { formatBytes } from "./installer";

/**
 * Everything the download panel shows, worked out from what the backend really
 * reports. A percentage, a speed and a time left only appear when the numbers
 * behind them are known: nothing here guesses.
 */
export interface GameInstallView {
  stage: "preparing" | "downloading" | "finishing";
  stageLabel: string;
  message: string;
  /** 0–100, or null while the size is not known yet. */
  percent: number | null;
  bytesDone: number;
  bytesTotal: number;
  /** Average bytes per second so far, once there is enough to average. */
  speed: number | null;
  /** Seconds left at the average speed, when both sizes and a speed exist. */
  remainingSeconds: number | null;
  elapsedSeconds: number;
  canCancel: boolean;
}

const STAGE_LABEL = {
  preparing: "Preparing",
  downloading: "Downloading game files",
  finishing: "Finishing up",
} as const;

/** Speed is only shown after this long, so the first second cannot look wrong. */
const MIN_SPEED_MS = 1500;

export function gameInstallView(
  progress: GameProgress | null,
  startedAt: number,
  now: number,
): GameInstallView {
  const elapsedMs = Math.max(0, now - startedAt);
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  if (!progress) {
    return {
      stage: "preparing",
      stageLabel: STAGE_LABEL.preparing,
      message: "Starting…",
      percent: null,
      bytesDone: 0,
      bytesTotal: 0,
      speed: null,
      remainingSeconds: null,
      elapsedSeconds,
      canCancel: true,
    };
  }

  const stage = progress.stage === "metadata" ? "preparing" : progress.stage;
  const bytesDone = Math.max(0, progress.bytesDone ?? 0);
  const bytesTotal = Math.max(0, progress.bytesTotal ?? 0);
  const knownBytes = bytesTotal > 0;

  let percent: number | null = null;
  if (knownBytes) {
    percent = clampPercent((bytesDone / bytesTotal) * 100);
  } else if (progress.total > 0) {
    percent = clampPercent((progress.done / progress.total) * 100);
  }

  let speed: number | null = null;
  let remainingSeconds: number | null = null;
  if (stage === "downloading" && knownBytes && bytesDone > 0 && elapsedMs >= MIN_SPEED_MS) {
    speed = bytesDone / (elapsedMs / 1000);
    const left = bytesTotal - bytesDone;
    if (speed > 0 && left > 0) remainingSeconds = Math.ceil(left / speed);
  }

  return {
    stage,
    stageLabel: STAGE_LABEL[stage],
    message: progress.message || STAGE_LABEL[stage],
    percent,
    bytesDone,
    bytesTotal,
    speed,
    remainingSeconds,
    elapsedSeconds,
    canCancel: stage !== "finishing",
  };
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** "1.4 MB/s", using the same sizes as the rest of the installer. */
export function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "0 B/s";
  return `${formatBytes(bytesPerSecond)}/s`;
}

/** "about 2 min left". Only ever given a remaining time that was really worked out. */
export function formatRemaining(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 10) return "less than 10 s left";
  if (seconds < 60) return `about ${Math.round(seconds)} s left`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `about ${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `about ${hours} hr left` : `about ${hours} hr ${rest} min left`;
}

/** "12s" or "1m 04s", for the elapsed time under the bar. */
export function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m < 60) return `${m}m ${String(rest).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}
