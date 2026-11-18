// Shapes returned by the Rust commands in src-tauri/src/lib.rs.

export interface AppInfo {
  name: string;
  version: string;
  target_minecraft: string;
  launcher_ready: boolean;
}

export interface SystemInfo {
  osName: string | null;
  osVersion: string | null;
  osLongVersion: string | null;
  kernelVersion: string | null;
  arch: string;
  cpuBrand: string | null;
  cpuLogicalCores: number;
  cpuPhysicalCores: number | null;
  totalRamMb: number;
  availableRamMb: number;
}

export interface JavaInstallRaw {
  path: string;
  source: string;
  ran: boolean;
  output: string;
  error: string | null;
}

export interface JavaDetectionRaw {
  installs: JavaInstallRaw[];
  candidatesChecked: number;
  /** Plain-language record of every place that was searched. */
  notes?: string[];
}

export interface Settings {
  version: number;
  javaPath: string | null;
  memoryMb: number;
  gameDir: string;
  /** Window size Minecraft opens with. */
  windowWidth: number;
  windowHeight: number;
  /** Extra JVM options, separated by spaces. */
  jvmArgs: string;
  reduceMotion: boolean;
  /** Azure Application (client) ID for Microsoft sign-in; public, not a secret. */
  msClientId: string | null;
}

export type LoadStatus = "loaded" | "createdDefaults" | "recoveredFromCorruption";

export interface SettingsState {
  settings: Settings;
  status: LoadStatus;
  message: string | null;
  filePath: string;
  totalRamMb: number;
  minMemoryMb: number;
  maxMemoryMb: number;
}

export interface FieldError {
  field: "memoryMb" | "javaPath" | "gameDir" | "msClientId" | "windowWidth" | "windowHeight" | "jvmArgs";
  message: string;
}

export interface SaveOutcome {
  ok: boolean;
  errors: FieldError[];
  state: SettingsState | null;
}

export type InstallStage =
  | "checking"
  | "metadata"
  | "downloading"
  | "verifying"
  | "extracting"
  | "testing"
  | "done";

/** Sent by the backend while Java is being installed. */
export interface InstallProgress {
  stage: InstallStage;
  downloaded: number;
  total: number | null;
  message: string;
}

export type InstallStatus = "installed" | "alreadyInstalled" | "cancelled" | "failed";

export interface InstallResult {
  status: InstallStatus;
  message: string | null;
  javaPath: string | null;
  version: string | null;
  source: string | null;
  /** True when Settings now points at the installed runtime. */
  configured: boolean;
  settings: SettingsState | null;
}

export type AuthState = "notConfigured" | "signedOut" | "signedIn" | "cancelled" | "failed";

export interface AuthProfile {
  id: string;
  name: string;
  /** True when Minecraft services returned a profile for this account, which only happens when it owns Java Edition. */
  ownsMinecraft?: boolean;
}

/** An account signed in on this PC, as the account menu lists it. */
export interface AccountRef {
  id: string;
  name: string;
}

/** Account state from the backend. Tokens never cross into the interface. */
export interface AuthStatus {
  state: AuthState;
  configured: boolean;
  /** A login is saved in Windows Credential Manager. */
  savedLogin: boolean;
  profile: AuthProfile | null;
  message: string | null;
  /** Every account signed in on this PC (older backends may leave this out). */
  accounts: AccountRef[];
  /** The account the live session belongs to. */
  activeId: string | null;
}

/** What the person must do on the Microsoft page to finish signing in. */
export interface DeviceCodeInfo {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
}

export interface GameStatus {
  installed: boolean;
  minecraft: string;
  loader: string | null;
  gameDir: string;
  running: boolean;
}

export interface InstanceSummary {
  minecraft: string;
  loader: string | null;
  modCount: number;
}

export interface Profile {
  id: string;
  name: string;
  minecraft: string;
  fabric: boolean;
  /** 0..5, picks the icon colour. */
  color: number;
}

export interface GameProgress {
  stage: "metadata" | "downloading" | "finishing";
  /** Files finished and the number of files to fetch. */
  done: number;
  total: number;
  /** Bytes finished and the size of the whole download, when every size is known. */
  bytesDone?: number;
  bytesTotal?: number;
  message: string;
}

/** One entry of Mojang's version list, as the launcher's catalog reports it. */
export interface VersionEntry {
  id: string;
  /** "release", "snapshot", "old_beta" or "old_alpha". */
  kind: string;
  released: string | null;
  /** True only when this launcher can download and start it. */
  supported: boolean;
  /** The Java major version Mojang's manifest asks for, when it says. */
  javaMajor?: number | null;
}

export interface GameInstallResult {
  status: "installed" | "cancelled" | "failed";
  message: string | null;
  loader: string | null;
}

export interface LaunchResult {
  started: boolean;
  message: string | null;
  logPath: string | null;
}

/** What the game left behind when it closed unexpectedly. */
export interface CrashInfo {
  /** A short, plain explanation of the most likely cause, when one is recognised. */
  hint: string | null;
  /** The newest crash report of that run (Minecraft's own, or Java's hs_err file). */
  report: string | null;
  reportPath: string | null;
  /** The last lines of the launch log. */
  logTail: string;
}

export interface GameExit {
  code: number | null;
  logPath: string;
  /** The person pressed Stop, so this is not a crash. */
  stopped: boolean;
  crash: CrashInfo | null;
}

/** New text of the launch log and where to continue reading. */
export interface GameLogChunk {
  text: string;
  offset: number;
}

export type GameFolder = "logs" | "crash-reports" | "game";

export type ModProvider = "modrinth" | "curseforge";

export interface ModHit {
  provider: ModProvider;
  id: string;
  title: string;
  description: string;
  author: string;
  downloads: number;
  iconUrl: string | null;
  pageUrl: string | null;
}

export interface ModSearchResult {
  hits: ModHit[];
  total: number;
}

export interface ModInstallReport {
  installed: string[];
  present: string[];
}

export interface InstalledMod {
  fileName: string;
  size: number;
  /** `false` for a `.jar.disabled` file: installed but switched off. Treated as on when missing. */
  enabled?: boolean;
  /** What the mod says about itself (fabric.mod.json); missing for jars without it. */
  name?: string | null;
  version?: string | null;
  description?: string | null;
  authors?: string[];
  /** The mod's own icon as a PNG data address. */
  icon?: string | null;
}

export type SkinModel = "classic" | "slim";

/** A player's real Minecraft look: skin, arm model and their own cape. */
export interface PlayerAppearance {
  id: string;
  name: string;
  model: SkinModel;
  /** The skin PNG as a data address. */
  skin: string;
  /** The account's own cape as a data address, when it has one equipped. */
  cape: string | null;
}

export interface SkinEntry {
  id: string;
  name: string;
  model: SkinModel;
  /** "file", "player:<name>" or "url". */
  source: string;
  /** The skin PNG as a data address, ready to draw. */
  dataUrl: string;
}

/** What the launcher shows on the person's Discord profile. */
export interface DiscordPresence {
  details: string;
  state?: string | null;
  /** Unix time in seconds; Discord shows elapsed time from it. */
  startedAt?: number | null;
}
