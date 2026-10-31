import type { Settings } from "../api/types";

export type { Settings };

export interface MemoryLimits {
  min: number;
  max: number;
}

export type SettingsErrors = Partial<Record<"memoryMb" | "javaPath" | "gameDir", string>>;

export const MEMORY_STEP_MB = 256;

/** Trim text fields and turn a blank Java path into null ("detect automatically"). */
export function normalizeDraft(s: Settings): Settings {
  const javaPath = s.javaPath?.trim() ? s.javaPath.trim() : null;
  return { ...s, javaPath, gameDir: s.gameDir.trim() };
}

export function settingsEqual(a: Settings, b: Settings): boolean {
  return (
    a.javaPath === b.javaPath &&
    a.memoryMb === b.memoryMb &&
    a.gameDir === b.gameDir &&
    a.reduceMotion === b.reduceMotion
  );
}

export function clampMemory(value: number, limits: MemoryLimits): number {
  if (!Number.isFinite(value)) return limits.min;
  return Math.min(limits.max, Math.max(limits.min, Math.round(value)));
}

const WINDOWS_ABSOLUTE = /^([a-zA-Z]:[\\/]|\\\\)/;

/**
 * Quick checks for instant feedback while typing. The backend repeats these
 * and also checks the file system (does the Java file exist, is the folder a file).
 */
export function validateDraft(s: Settings, limits: MemoryLimits): SettingsErrors {
  const errors: SettingsErrors = {};
  if (!Number.isFinite(s.memoryMb) || s.memoryMb < limits.min) {
    errors.memoryMb = `Memory must be at least ${limits.min} MB.`;
  } else if (s.memoryMb > limits.max) {
    errors.memoryMb = `Memory can't exceed ${limits.max} MB on this PC (the rest is left for Windows).`;
  }
  if (s.gameDir.trim() === "") {
    errors.gameDir = "Game directory is required.";
  } else if (!WINDOWS_ABSOLUTE.test(s.gameDir.trim()) && !s.gameDir.trim().startsWith("/")) {
    errors.gameDir = "Use a full path, for example C:\\Users\\you\\LimitedFPS.";
  }
  return errors;
}

export function hasErrors(errors: SettingsErrors): boolean {
  return Object.keys(errors).length > 0;
}
