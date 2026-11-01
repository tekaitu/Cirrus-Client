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
  reduceMotion: boolean;
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
  field: "memoryMb" | "javaPath" | "gameDir";
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
