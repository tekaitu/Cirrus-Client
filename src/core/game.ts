import type { GameProgress } from "../api/types";

export type PlayMode = "microsoft" | "offline";

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
  | { phase: "ended"; code: number | null; logPath: string }
  | { phase: "error"; message: string };

/** A non-zero exit is reported as a crash, except 1 after the person pressed Stop. */
export function exitText(code: number | null): string {
  if (code === 0) return "Minecraft closed normally.";
  if (code === null) return "Minecraft was stopped.";
  return `Minecraft closed with an error (code ${code}). The launch log has details.`;
}
