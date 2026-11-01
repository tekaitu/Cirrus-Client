import type { InstallProgress, InstallResult, InstallStage } from "../api/types";

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "unknown";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const STAGE_LABEL: Record<InstallStage, string> = {
  checking: "Checking for an existing Java 21",
  metadata: "Asking Adoptium for the current download",
  downloading: "Downloading",
  verifying: "Verifying the checksum",
  extracting: "Unpacking",
  testing: "Testing the new Java",
  done: "Finished",
};

export interface ProgressView {
  label: string;
  /** 0–100 while the size is known, otherwise null (shows an indeterminate bar). */
  percent: number | null;
  detail: string;
  /** Cancelling is only offered while it is safe: before the final move into place. */
  canCancel: boolean;
}

export function progressView(p: InstallProgress): ProgressView {
  const label = STAGE_LABEL[p.stage] ?? p.message;
  let percent: number | null = null;
  let detail = p.message;
  if (p.stage === "downloading" && p.total && p.total > 0) {
    percent = Math.min(100, Math.max(0, Math.round((p.downloaded / p.total) * 100)));
    detail = `${formatBytes(p.downloaded)} of ${formatBytes(p.total)}`;
  } else if (p.stage === "downloading" && p.downloaded > 0) {
    detail = `${formatBytes(p.downloaded)} downloaded`;
  }
  return { label, percent, detail, canCancel: p.stage !== "testing" && p.stage !== "done" };
}

export type InstallerState =
  | { phase: "idle" }
  | { phase: "running"; progress: InstallProgress | null; cancelling: boolean }
  | { phase: "done"; result: InstallResult }
  | { phase: "cancelled" }
  | { phase: "error"; message: string };

export const IDLE: InstallerState = { phase: "idle" };

/** Turn the backend's final answer into the state the panel shows. */
export function stateFromResult(result: InstallResult): InstallerState {
  switch (result.status) {
    case "installed":
    case "alreadyInstalled":
      return { phase: "done", result };
    case "cancelled":
      return { phase: "cancelled" };
    default:
      return { phase: "error", message: result.message ?? "Java could not be installed." };
  }
}
