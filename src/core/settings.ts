import type { Settings } from "../api/types";

export type { Settings };

export interface MemoryLimits {
  min: number;
  max: number;
}

export type SettingsErrors = Partial<
  Record<"memoryMb" | "javaPath" | "gameDir" | "msClientId" | "windowWidth" | "windowHeight" | "jvmArgs", string>
>;

export const MEMORY_STEP_MB = 256;
export const MIN_WINDOW_WIDTH = 640;
export const MIN_WINDOW_HEIGHT = 480;
export const MAX_WINDOW_SIZE = 7680;
export const MAX_JVM_ARGS_CHARS = 2000;

/** Trim text fields and turn a blank Java path into null ("detect automatically"). */
export function normalizeDraft(s: Settings): Settings {
  const javaPath = s.javaPath?.trim() ? s.javaPath.trim() : null;
  const msClientId = s.msClientId?.trim() ? s.msClientId.trim() : null;
  return { ...s, javaPath, msClientId, gameDir: s.gameDir.trim(), jvmArgs: s.jvmArgs.trim() };
}

export function settingsEqual(a: Settings, b: Settings): boolean {
  return (
    a.javaPath === b.javaPath &&
    a.memoryMb === b.memoryMb &&
    a.gameDir === b.gameDir &&
    a.windowWidth === b.windowWidth &&
    a.windowHeight === b.windowHeight &&
    a.jvmArgs === b.jvmArgs &&
    a.reduceMotion === b.reduceMotion &&
    a.msClientId === b.msClientId
  );
}

/** Azure application (client) IDs are GUIDs. */
export const CLIENT_ID_PATTERN = /^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/;

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
    errors.gameDir = "Use a full path, for example C:\\Users\\you\\MapleClient.";
  }
  if (!Number.isFinite(s.windowWidth) || s.windowWidth < MIN_WINDOW_WIDTH || s.windowWidth > MAX_WINDOW_SIZE) {
    errors.windowWidth = `Window width must be between ${MIN_WINDOW_WIDTH} and ${MAX_WINDOW_SIZE} pixels.`;
  }
  if (!Number.isFinite(s.windowHeight) || s.windowHeight < MIN_WINDOW_HEIGHT || s.windowHeight > MAX_WINDOW_SIZE) {
    errors.windowHeight = `Window height must be between ${MIN_WINDOW_HEIGHT} and ${MAX_WINDOW_SIZE} pixels.`;
  }
  if (s.jvmArgs.length > MAX_JVM_ARGS_CHARS) {
    errors.jvmArgs = `Extra JVM options can be at most ${MAX_JVM_ARGS_CHARS} characters.`;
  }
  const id = s.msClientId?.trim();
  if (id && !CLIENT_ID_PATTERN.test(id)) {
    errors.msClientId =
      "This should look like 00000000-0000-0000-0000-000000000000 (the Application (client) ID from Azure).";
  }
  return errors;
}

export function hasErrors(errors: SettingsErrors): boolean {
  return Object.keys(errors).length > 0;
}
