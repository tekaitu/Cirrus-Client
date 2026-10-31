import type { JavaInstallRaw } from "../api/types";

/** Minecraft Java Edition 1.21.11 requires Java 21 or newer (see docs/ARCHITECTURE.md). */
export const TARGET_MINECRAFT_VERSION = "1.21.11";
export const REQUIRED_JAVA_MAJOR = 21;

/**
 * Extract the Java major version from `java -version` output.
 * Handles modern ("21.0.4", "17") and legacy ("1.8.0_392") version strings.
 * Returns null when no version can be found.
 */
export function parseJavaMajor(output: string): number | null {
  const match = /version\s+"(\d+)(?:\.(\d+))?/.exec(output);
  if (!match) return null;
  const first = Number(match[1]);
  if (first === 1 && match[2] !== undefined) return Number(match[2]);
  return first;
}

export interface JavaCheck {
  ok: boolean;
  major: number | null;
  message: string;
}

export function checkJava(output: string): JavaCheck {
  const major = parseJavaMajor(output);
  if (major === null) {
    return { ok: false, major, message: "Could not read a Java version from the output." };
  }
  if (major < REQUIRED_JAVA_MAJOR) {
    return {
      ok: false,
      major,
      message: `Java ${major} found, but Minecraft ${TARGET_MINECRAFT_VERSION} needs Java ${REQUIRED_JAVA_MAJOR} or newer.`,
    };
  }
  return { ok: true, major, message: `Java ${major} is compatible.` };
}

export type JavaStatus = "compatible" | "too-old" | "unreadable" | "failed";

export interface JavaAnalysis {
  path: string;
  source: string;
  status: JavaStatus;
  major: number | null;
  versionString: string | null;
  runtime: string | null;
  is64Bit: boolean | null;
  message: string;
}

/** What the UI keeps after detection has run and been analysed. */
export interface JavaView {
  analyses: JavaAnalysis[];
  selected: JavaAnalysis | null;
  candidatesChecked: number;
}

/** Turn the raw `java -version` result from the backend into something displayable. */
export function analyzeJava(raw: JavaInstallRaw): JavaAnalysis {
  const base = {
    path: raw.path,
    source: raw.source,
    major: null,
    versionString: null,
    runtime: null,
    is64Bit: null,
  };
  if (!raw.ran) {
    return { ...base, status: "failed", message: raw.error ?? "This file could not be run." };
  }

  const check = checkJava(raw.output);
  const versionString = /version\s+"([^"]+)"/.exec(raw.output)?.[1] ?? null;
  const runtime = /^.*Runtime Environment.*$/m.exec(raw.output)?.[0].trim() ?? null;
  let is64Bit: boolean | null = null;
  if (/64-Bit/i.test(raw.output)) is64Bit = true;
  else if (/32-Bit/i.test(raw.output)) is64Bit = false;

  const status: JavaStatus = check.ok ? "compatible" : check.major === null ? "unreadable" : "too-old";
  return { ...base, status, major: check.major, versionString, runtime, is64Bit, message: check.message };
}

/**
 * The first compatible installation wins. The backend lists candidates in
 * priority order: Settings, JAVA_HOME, PATH, common folders, launcher runtimes.
 */
export function selectJava(analyses: JavaAnalysis[]): JavaAnalysis | null {
  return analyses.find((a) => a.status === "compatible") ?? null;
}

export function toJavaView(analyses: JavaAnalysis[], candidatesChecked: number): JavaView {
  return { analyses, selected: selectJava(analyses), candidatesChecked };
}
