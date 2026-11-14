import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AppInfo,
  AuthStatus,
  DiscordPresence,
  DeviceCodeInfo,
  GameExit,
  GameInstallResult,
  GameProgress,
  GameStatus, InstanceSummary, Profile,
  InstallProgress,
  InstallResult,
  InstalledMod,
  ModInstallReport,
  ModProvider,
  ModSearchResult,
  JavaDetectionRaw,
  JavaInstallRaw,
  LaunchResult,
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
      "This page is not running inside the Cirrus Client desktop app, so system features are unavailable.",
    );
  }
  try {
    return await invoke<T>(command, args);
  } catch (e) {
    throw new Error(errorMessage(e));
  }
}

export const AUTH_CODE_EVENT = "auth-device-code";
export const GAME_PROGRESS_EVENT = "game-install-progress";
export const GAME_EXITED_EVENT = "game-exited";
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
  listInstances: () => call<InstanceSummary[]>("list_instances"),
  gameStatus: (version: string, loader: string) => call<GameStatus>("game_status", { version, loader }),
  listGameVersions: () => call<string[]>("list_game_versions"),
  installGame: (version: string, loader: string) => call<GameInstallResult>("install_game", { version, loader }),
  cancelGameInstall: () => call<boolean>("cancel_game_install"),
  launchGame: (
    javaPath: string,
    mode: "offline" | "microsoft",
    username: string | null,
    version: string,
    loader: string,
    profile?: string,
  ) => call<LaunchResult>("launch_game", { javaPath, mode, username, version, loader, profile: profile ?? null }),
  listProfiles: () => call<Profile[]>("list_profiles"),
  createProfile: (name: string, version: string, loader: string) =>
    call<Profile>("create_profile", { name, version, loader }),
  deleteProfile: (id: string) => call<void>("delete_profile", { id }),
  openCommunity: () => call<void>("open_community"),
  openGithub: () => call<void>("open_github"),
  quitApp: () => call<void>("quit_app"),
  curseforgeAvailable: () => call<boolean>("curseforge_available"),
  searchMods: (provider: ModProvider, query: string, version: string, offset: number) =>
    call<ModSearchResult>("search_mods", { provider, query, version, offset }),
  installMod: (provider: ModProvider, id: string, version: string, profile?: string) =>
    call<ModInstallReport>("install_mod", { provider, id, version, profile: profile ?? null }),
  listMods: (version: string, profile?: string) => call<InstalledMod[]>("list_mods", { version, profile: profile ?? null }),
  setModEnabled: (version: string, fileName: string, enabled: boolean, profile?: string) =>
    call<string>("set_mod_enabled", { version, fileName, enabled, profile: profile ?? null }),
  removeMod: (version: string, fileName: string, profile?: string) =>
    call<void>("remove_mod", { version, fileName, profile: profile ?? null }),
  stopGame: () => call<boolean>("stop_game"),
  onGameProgress: async (handler: (p: GameProgress) => void): Promise<() => void> => {
    if (!insideTauri()) return () => {};
    return listen<GameProgress>(GAME_PROGRESS_EVENT, (event) => handler(event.payload));
  },
  onGameExited: async (handler: (e: GameExit) => void): Promise<() => void> => {
    if (!insideTauri()) return () => {};
    return listen<GameExit>(GAME_EXITED_EVENT, (event) => handler(event.payload));
  },
  /** Resolves to "shown", "notConfigured" or "discordClosed". */
  discordSetPresence: (presence: DiscordPresence) => call<string>("discord_set_presence", { presence }),
  discordClearPresence: () => call<void>("discord_clear_presence"),
  discordAvailable: () => call<boolean>("discord_available"),
  loadSettings: () => call<SettingsState>("load_settings"),
  saveSettings: (settings: Settings) => call<SaveOutcome>("save_settings", { settings }),
  resetSettings: () => call<SettingsState>("reset_settings"),
};
