import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AppInfo,
  AuthStatus,
  DeviceCodeInfo,
  InstallProgress,
  InstallResult,
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

export const AUTH_CODE_EVENT = "auth-device-code";
export const JAVA_INSTALL_PROGRESS_EVENT = "java-install-progress";

export const api = {
  getAppInfo: () => call<AppInfo>("get_app_info"),
  getSystemInfo: () => call<SystemInfo>("get_system_info"),
  detectJava: (configuredPath: string | null) =>
    call<JavaDetectionRaw>("detect_java", { configuredPath }),
  inspectJava: (path: string) => call<JavaInstallRaw>("inspect_java", { path }),
  installJava: () => call<InstallResult>("install_java"),
  cancelJavaInstall: () => call<boolean>("cancel_java_install"),
  /** Subscribe to installer progress. Resolves to an unsubscribe function. */
  onJavaInstallProgress: async (handler: (p: InstallProgress) => void): Promise<() => void> => {
    if (!insideTauri()) return () => {};
    return listen<InstallProgress>(JAVA_INSTALL_PROGRESS_EVENT, (event) => handler(event.payload));
  },
  authStatus: () => call<AuthStatus>("auth_status"),
  authRestore: () => call<AuthStatus>("auth_restore"),
  authSignIn: () => call<AuthStatus>("auth_sign_in"),
  authSignInWindow: () => call<AuthStatus>("auth_sign_in_window"),
  authCancel: () => call<boolean>("auth_cancel"),
  authSignOut: () => call<AuthStatus>("auth_sign_out"),
  openMicrosoftLink: (url: string) => call<void>("open_microsoft_link", { url }),
  onAuthDeviceCode: async (handler: (info: DeviceCodeInfo) => void): Promise<() => void> => {
    if (!insideTauri()) return () => {};
    return listen<DeviceCodeInfo>(AUTH_CODE_EVENT, (event) => handler(event.payload));
  },
  loadSettings: () => call<SettingsState>("load_settings"),
  saveSettings: (settings: Settings) => call<SaveOutcome>("save_settings", { settings }),
  resetSettings: () => call<SettingsState>("reset_settings"),
};
