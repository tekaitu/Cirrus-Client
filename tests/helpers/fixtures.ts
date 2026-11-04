import type {
  AppInfo,
  JavaInstallRaw,
  Settings,
  SettingsState,
  SystemInfo,
} from "../../src/api/types";

export const appInfo: AppInfo = {
  name: "Limited FPS",
  version: "0.1.0",
  target_minecraft: "1.21.11",
  launcher_ready: false,
};

export const systemInfo: SystemInfo = {
  osName: "Windows",
  osVersion: "10 (19045)",
  osLongVersion: "Windows 10 Pro",
  kernelVersion: "19045",
  arch: "x86_64",
  cpuBrand: "AMD Ryzen 5 PRO 4650G with Radeon Graphics",
  cpuLogicalCores: 12,
  cpuPhysicalCores: 6,
  totalRamMb: 15800,
  availableRamMb: 9000,
};

export const JAVA_21_OUTPUT = [
  'openjdk version "21.0.4" 2024-07-16 LTS',
  "OpenJDK Runtime Environment Temurin-21.0.4+7 (build 21.0.4+7-LTS)",
  "OpenJDK 64-Bit Server VM Temurin-21.0.4+7 (build 21.0.4+7-LTS, mixed mode, sharing)",
].join("\n");

export const JAVA_17_OUTPUT = [
  'openjdk version "17.0.9" 2023-10-17',
  "OpenJDK Runtime Environment Temurin-17.0.9+9 (build 17.0.9+9)",
  "OpenJDK 64-Bit Server VM Temurin-17.0.9+9 (build 17.0.9+9, mixed mode, sharing)",
].join("\n");

export const java21Raw: JavaInstallRaw = {
  path: "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.4.7-hotspot\\bin\\java.exe",
  source: "Common install folder",
  ran: true,
  output: JAVA_21_OUTPUT,
  error: null,
};

export const java17Raw: JavaInstallRaw = {
  path: "C:\\Program Files\\Java\\jdk-17\\bin\\java.exe",
  source: "PATH",
  ran: true,
  output: JAVA_17_OUTPUT,
  error: null,
};

export function settingsState(
  settings: Partial<Settings> = {},
  extra: Partial<SettingsState> = {},
): SettingsState {
  return {
    settings: {
      version: 1,
      javaPath: null,
      memoryMb: 4096,
      gameDir: "C:\\Users\\player\\AppData\\Roaming\\com.limitedfps.app\\game",
      reduceMotion: false,
      msClientId: null,
      ...settings,
    },
    status: "loaded",
    message: null,
    filePath: "C:\\Users\\player\\AppData\\Roaming\\com.limitedfps.app\\settings.json",
    totalRamMb: 15800,
    minMemoryMb: 1024,
    maxMemoryMb: 13568,
    ...extra,
  };
}
