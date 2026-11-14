import type { AppInfo, SettingsState, SystemInfo } from "../api/types";
import { formatMemory, joinParts } from "./format";
import { REQUIRED_JAVA_MAJOR, TARGET_MINECRAFT_VERSION, type JavaView } from "./java";

export interface ReportInput {
  app: AppInfo | null;
  system: SystemInfo | null;
  java: JavaView | null;
  settings: SettingsState | null;
  generatedAt: Date;
}

const UNAVAILABLE = "unavailable";

/** Plain-text diagnostics report, safe to paste into a support request (it does contain file paths). */
export function buildReport(input: ReportInput): string {
  const { app, system, java, settings } = input;
  const lines: string[] = [];

  lines.push("Cirrus Client diagnostics report");
  lines.push(`Generated: ${input.generatedAt.toISOString()}`);
  lines.push("");

  lines.push("App");
  lines.push(
    app
      ? `  ${app.name} v${app.version} (launching ${app.launcher_ready ? "implemented" : "not implemented yet"})`
      : `  ${UNAVAILABLE}`,
  );
  lines.push(`  Target: Minecraft Java ${TARGET_MINECRAFT_VERSION} with Fabric, needs Java ${REQUIRED_JAVA_MAJOR}+`);
  lines.push("");

  lines.push("System");
  if (system) {
    lines.push(`  OS: ${joinParts([system.osLongVersion ?? system.osName, system.osVersion, system.arch], " ")}`);
    if (system.kernelVersion) lines.push(`  Kernel: ${system.kernelVersion}`);
    lines.push(`  CPU: ${system.cpuBrand ?? "unknown"}`);
    lines.push(
      `  Cores: ${system.cpuLogicalCores} logical${
        system.cpuPhysicalCores ? `, ${system.cpuPhysicalCores} physical` : ""
      }`,
    );
    lines.push(
      `  RAM: ${formatMemory(system.totalRamMb)} total, ${formatMemory(system.availableRamMb)} available`,
    );
  } else {
    lines.push(`  ${UNAVAILABLE}`);
  }
  lines.push("");

  lines.push("Java");
  if (java) {
    lines.push(`  ${java.analyses.length} found, ${java.candidatesChecked} location(s) checked`);
    for (const a of java.analyses) {
      const label = a.major !== null ? `Java ${a.major}` : "unknown version";
      lines.push(`  [${a.status}] ${label} - ${a.path} (${a.source})`);
      if (a.status !== "compatible") lines.push(`      ${a.message}`);
    }
    lines.push(
      `  Selected: ${java.selected ? `Java ${java.selected.major} at ${java.selected.path}` : "none (no compatible Java)"}`,
    );
    if (java.selected?.versionString) lines.push(`  Selected version: ${java.selected.versionString}`);
    if (java.notes.length > 0) {
      lines.push("  Searched:");
      for (const n of java.notes) lines.push(`    - ${n}`);
    }
  } else {
    lines.push(`  ${UNAVAILABLE}`);
  }
  lines.push("");

  lines.push("Settings");
  if (settings) {
    const s = settings.settings;
    lines.push(`  Memory: ${s.memoryMb} MB`);
    lines.push(`  Java path: ${s.javaPath ?? "automatic"}`);
    lines.push(`  Game directory: ${s.gameDir}`);
    lines.push(`  Reduce motion: ${s.reduceMotion ? "on" : "off"}`);
    lines.push(`  File: ${settings.filePath} (${settings.status})`);
    if (settings.message) lines.push(`  Note: ${settings.message}`);
  } else {
    lines.push(`  ${UNAVAILABLE}`);
  }

  return lines.join("\n");
}
