import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  SkinEntry,
  SkinModel,
  AppInfo,
  AuthStatus,
  PlayerAppearance,
  DiscordPresence,
  DeviceCodeInfo,
  GameExit,
  GameFolder,
  GameLogChunk,
  GameInstallResult,
  GameProgress,
  GameStatus, InstanceSummary, InstanceView, InstanceContents, FabricLoaderOption, Profile,
  Diagnosis,
  UpdateCheck,
  InstallProgress,
  InstallResult,
  InstalledMod,
  InstalledPack,
  ModInspection,
  ModInstallReport,
  PackDetails,
  PackSearchResult,
  UploadOutcome,
  ModProvider,
  ModSearchResult,
  JavaDetectionRaw,
  JavaInstallRaw,
  LaunchResult,
  SaveOutcome,
  Settings,
  SettingsState,
  SystemInfo,
  VersionEntry,
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
      "This page is not running inside the Maple Client desktop app, so system features are unavailable.",
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
  /** Installs a portable runtime; 8, 17 and 21 are supported. */
  installJava: (major = 21) => call<InstallResult>("install_java", { major }),
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
  /** Makes another saved account active and renews its session. */
  authSwitch: (id: string) => call<AuthStatus>("auth_switch", { id }),
  /** Signs out one account, or the active one when no id is given. */
  authSignOut: (id?: string | null) => call<AuthStatus>("auth_sign_out", { id: id ?? null }),
  openMicrosoftLink: (url: string) => call<void>("open_microsoft_link", { url }),
  onAuthDeviceCode: async (handler: (info: DeviceCodeInfo) => void): Promise<() => void> => {
    if (!insideTauri()) return () => {};
    return listen<DeviceCodeInfo>(AUTH_CODE_EVENT, (event) => handler(event.payload));
  },
  listInstances: () => call<InstanceSummary[]>("list_instances"),
  /** Installed games with their own names, icons, Java, memory and folders. */
  listInstanceViews: () => call<InstanceView[]>("list_instance_views"),
  instanceContents: (id: string) => call<InstanceContents>("instance_contents", { id }),
  /** Saves one instance's settings; the previous file is kept as a backup. */
  saveInstance: (config: {
    id: string;
    minecraft: string;
    loader: "vanilla" | "fabric";
    loaderVersion: string | null;
    name: string;
    icon: number;
    javaPath: string | null;
    memoryMb: number | null;
    gameDir: string | null;
    jvmArgs: string;
    lastPlayed: number;
    clonedFrom: string | null;
  }) => call<InstanceView>("save_instance", { config }),
  cloneInstance: (id: string, name: string, copyData: boolean) =>
    call<InstanceView>("clone_instance", { id, name, copyData }),
  deleteInstance: (id: string, deleteFiles: boolean) =>
    call<void>("delete_instance", { id, deleteFiles }),
  repairInstance: (id: string) => call<GameInstallResult>("repair_instance", { id }),
  switchFabricLoader: (id: string, loaderVersion: string) =>
    call<GameInstallResult>("switch_fabric_loader", { id, loaderVersion }),
  fabricLoaderVersions: (version: string) =>
    call<FabricLoaderOption[]>("fabric_loader_versions", { version }),
  gameStatus: (version: string, loader: string) => call<GameStatus>("game_status", { version, loader }),
  listGameVersions: () => call<string[]>("list_game_versions"),
  /** Mojang's full list, including snapshots and releases this build cannot install. */
  listVersionCatalog: () => call<VersionEntry[]>("list_game_version_catalog"),
  installGame: (version: string, loader: string, loaderVersion: string | null = null) =>
    call<GameInstallResult>("install_game", { version, loader, loaderVersion }),
  cancelGameInstall: () => call<boolean>("cancel_game_install"),
  launchGame: (
    javaPath: string,
    mode: "offline" | "microsoft",
    username: string | null,
    version: string,
    loader: string,
    profile?: string,
    instanceId?: string,
  ) =>
    call<LaunchResult>("launch_game", {
      javaPath,
      mode,
      username,
      version,
      loader,
      profile: profile ?? null,
      instanceId: instanceId ?? null,
    }),
  listProfiles: () => call<Profile[]>("list_profiles"),
  createProfile: (name: string, version: string, loader: string) =>
    call<Profile>("create_profile", { name, version, loader }),
  deleteProfile: (id: string) => call<void>("delete_profile", { id }),
  openCommunity: () => call<void>("open_community"),
  openGithub: () => call<void>("open_github"),
  listSkins: () => call<SkinEntry[]>("list_skins"),
  addSkinFile: (name: string, model: SkinModel, dataBase64: string) =>
    call<SkinEntry>("add_skin_file", { name, model, dataBase64 }),
  addSkinPlayer: (player: string) => call<SkinEntry>("add_skin_player", { player }),
  addSkinUrl: (url: string, name: string, model: SkinModel) => call<SkinEntry>("add_skin_url", { url, name, model }),
  setSkinModel: (id: string, model: SkinModel) => call<SkinEntry>("set_skin_model", { id, model }),
  removeSkin: (id: string) => call<void>("remove_skin", { id }),
  applySkin: (id: string) => call<void>("apply_skin", { id }),
  playerSkin: (player: string) => call<string | null>("player_skin", { player }),
  /** Full skin, arm model and own cape of a player, as data addresses. */
  /** `force` bypasses the five-minute skin cache so Refresh really asks Mojang again. */
  playerAppearance: (player: string, force = false) =>
    call<PlayerAppearance>("player_appearance", { player, force }),
  quitApp: () => call<void>("quit_app"),
  curseforgeAvailable: () => call<boolean>("curseforge_available"),
  searchMods: (provider: ModProvider, query: string, version: string, offset: number, category?: string, sort?: string) =>
    call<ModSearchResult>("search_mods", { provider, query, version, offset, category: category ?? null, sort: sort ?? null }),
  installMod: (provider: ModProvider, id: string, version: string, profile?: string) =>
    call<ModInstallReport>("install_mod", { provider, id, version, profile: profile ?? null }),
  listMods: (version: string, profile?: string) => call<InstalledMod[]>("list_mods", { version, profile: profile ?? null }),
  setModEnabled: (version: string, fileName: string, enabled: boolean, profile?: string) =>
    call<string>("set_mod_enabled", { version, fileName, enabled, profile: profile ?? null }),
  removeMod: (version: string, fileName: string, profile?: string) =>
    call<void>("remove_mod", { version, fileName, profile: profile ?? null }),
  /** Reads a chosen mod jar without writing anything. */
  inspectModFile: (fileName: string, dataBase64: string, version: string, profile?: string) =>
    call<ModInspection>("inspect_mod_file", { fileName, dataBase64, version, profile: profile ?? null }),
  /** Installs one chosen mod jar; `overwrite` must be a confirmed choice. */
  installUploadedMod: (
    fileName: string,
    dataBase64: string,
    version: string,
    profile: string | undefined,
    overwrite: boolean,
  ) =>
    call<UploadOutcome>("install_uploaded_mod", {
      fileName,
      dataBase64,
      version,
      profile: profile ?? null,
      overwrite,
    }),
  searchResourcePacks: (
    provider: ModProvider,
    query: string,
    version: string,
    offset: number,
    resolution?: string,
    sort?: string,
  ) =>
    call<PackSearchResult>("search_resource_packs", {
      provider,
      query,
      version,
      offset,
      resolution: resolution ?? null,
      sort: sort ?? null,
    }),
  resourcePackDetails: (provider: ModProvider, id: string, version: string) =>
    call<PackDetails>("resource_pack_details", { provider, id, version }),
  installResourcePack: (provider: ModProvider, id: string, version: string, profile?: string) =>
    call<InstalledPack>("install_resource_pack", { provider, id, version, profile: profile ?? null }),
  listResourcePacks: (version: string, profile?: string) =>
    call<InstalledPack[]>("list_resource_packs", { version, profile: profile ?? null }),
  setResourcePackEnabled: (version: string, fileName: string, enabled: boolean, profile?: string) =>
    call<boolean>("set_resource_pack_enabled", { version, fileName, enabled, profile: profile ?? null }),
  removeResourcePack: (version: string, fileName: string, profile?: string) =>
    call<void>("remove_resource_pack", { version, fileName, profile: profile ?? null }),
  stopGame: () => call<boolean>("stop_game"),
  readGameLog: (offset: number) => call<GameLogChunk>("read_game_log", { offset }),
  openGameFolder: (kind: GameFolder) => call<void>("open_game_folder", { kind }),
  /** Opens one instance's own game folder. */
  openInstanceFolder: (id: string) => call<void>("open_instance_folder", { id }),
  /** Reads the log end and crash report and explains the most likely cause. */
  diagnoseCrash: (input: {
    logTail: string;
    report: string | null;
    version: string;
    loader: string;
    javaMajor: number | null;
    instanceId: string | null;
  }) => call<Diagnosis>("diagnose_crash", input),
  /** The newest official launcher release, compared with this build. */
  checkForUpdates: () => call<UpdateCheck>("check_for_updates"),
  openUpdatePage: (url: string) => call<void>("open_update_page", { url }),
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
