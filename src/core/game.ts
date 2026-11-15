import type { CrashInfo, GameProgress } from "../api/types";

export type PlayMode = "microsoft" | "offline";
export type LoaderId = "fabric" | "vanilla";

export const FALLBACK_VERSION = "1.21.11";

/** Same rules Minecraft uses for a player name. Returns an error message or null. */
export function usernameError(name: string): string | null {
  const n = name.trim();
  if (n.length === 0) return "Choose a player name.";
  if (n.length < 3 || n.length > 16) return "A player name must be 3 to 16 characters long.";
  if (!/^[A-Za-z0-9_]+$/.test(n)) return "Use only letters, numbers and underscores.";
  return null;
}

export interface GameProgressView {
  label: string;
  percent: number | null;
}

export function gameProgressView(p: GameProgress | null): GameProgressView {
  if (!p) return { label: "Starting…", percent: null };
  if (p.stage === "downloading" && p.total > 0) {
    return { label: p.message, percent: Math.min(100, Math.floor((p.done / p.total) * 100)) };
  }
  return { label: p.message || "Working…", percent: null };
}

export type GameInstallerState =
  | { phase: "idle" }
  | { phase: "running"; progress: GameProgress | null; cancelling: boolean }
  | { phase: "cancelled" }
  | { phase: "error"; message: string };

export type RunState =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "running" }
  | { phase: "ended"; code: number | null; logPath: string; stopped: boolean; crash: CrashInfo | null }
  | { phase: "error"; message: string };

/** One line about how a game session ended. */
export function exitText(code: number | null, stopped = false): string {
  if (stopped) return "You stopped Minecraft.";
  if (code === 0) return "Minecraft closed normally.";
  if (code === null) return "Minecraft was stopped.";
  return `Minecraft closed unexpectedly (code ${code}).`;
}

/** The text shown on the log screen is capped so a long session cannot slow the app down. */
export const MAX_LOG_CHARS = 400_000;

export function appendLog(log: string, more: string): string {
  const next = log + more;
  if (next.length <= MAX_LOG_CHARS) return next;
  const cut = next.slice(next.length - MAX_LOG_CHARS);
  return cut.slice(cut.indexOf("\n") + 1);
}

/** What is copied from the crash or log screen: a header that says what was running, then the text. */
export function reportText(header: string, body: string): string {
  return `${header}\n${"-".repeat(40)}\n${body.trim()}\n`;
}
