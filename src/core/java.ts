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
