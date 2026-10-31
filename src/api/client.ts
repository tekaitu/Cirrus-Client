import { invoke } from "@tauri-apps/api/core";
import type {
  AppInfo,
  JavaDetectionRaw,
  JavaInstallRaw,
  SaveOutcome,
  Settings,
  SettingsState,
  SystemInfo,
} from "./types";

export function errorMessage(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  return "Something went wrong.";
}

function insideTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!insideTauri()) {
    throw new Error(
      "This page is not running inside the Limited FPS desktop app, so system features are unavailable.",
    );
  }
  try {
    return await invoke<T>(command, args);
  } catch (e) {
    throw new Error(errorMessage(e));
  }
}

export const api = {
  getAppInfo: () => call<AppInfo>("get_app_info"),
  getSystemInfo: () => call<SystemInfo>("get_system_info"),
  detectJava: (configuredPath: string | null) =>
    call<JavaDetectionRaw>("detect_java", { configuredPath }),
  inspectJava: (path: string) => call<JavaInstallRaw>("inspect_java", { path }),
  loadSettings: () => call<SettingsState>("load_settings"),
  saveSettings: (settings: Settings) => call<SaveOutcome>("save_settings", { settings }),
  resetSettings: () => call<SettingsState>("reset_settings"),
};
