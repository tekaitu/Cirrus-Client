import type { ModInspection, UploadIssue } from "../api/types";

/** The backend reads up to 64 MiB; refusing earlier gives a clearer message. */
export const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;

/** Why a chosen file cannot even be read, or null when it is worth inspecting. */
export function fileProblem(file: { name: string; size: number }): string | null {
  if (!/\.jar$/i.test(file.name)) {
    return `“${file.name}” is not a .jar file. Minecraft mods are .jar files.`;
  }
  if (file.size === 0) {
    return `“${file.name}” is empty.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `“${file.name}” is larger than 64 MB, which is far bigger than a Minecraft mod.`;
  }
  return null;
}

/** Reads a chosen file as base64 (without the "data:" prefix) for the backend. */
export function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`“${file.name}” could not be read.`));
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const comma = text.indexOf(",");
      resolve(comma >= 0 ? text.slice(comma + 1) : text);
    };
    reader.readAsDataURL(file);
  });
}

export interface ProblemGroups {
  errors: string[];
  warnings: string[];
}

/** Splits an inspection's problems into the ones that block and the ones that only warn. */
export function groupProblems(problems: UploadIssue[]): ProblemGroups {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const problem of problems) {
    if (problem.severity === "error") errors.push(problem.message);
    else warnings.push(problem.message);
  }
  return { errors, warnings };
}

/** A second copy of a mod, or the same file name, needs a confirmed replace. */
export function needsConfirmation(inspection: ModInspection): boolean {
  return Boolean(inspection.duplicateOf) || inspection.sameFile;
}

/** The single line under a chosen file's name. */
export function inspectionLine(inspection: ModInspection): string {
  const parts: string[] = [];
  if (inspection.version) parts.push(`v${inspection.version}`);
  if (inspection.modId) parts.push(inspection.modId);
  parts.push(formatBytes(inspection.size));
  if (inspection.minecraft) parts.push(`Minecraft ${inspection.minecraft}`);
  return parts.join(" · ");
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${bytes} B`;
}

/**
 * What to say when an install finishes: every file either went in or was
 * refused with a reason, and a partial result is never reported as a success.
 */
export function installSummary(results: Array<{ fileName: string; status: string; message: string | null }>): {
  tone: "good" | "bad" | "warn";
  text: string;
  installed: number;
} {
  const installed = results.filter((r) => r.status === "installed");
  const rest = results.filter((r) => r.status !== "installed");
  if (rest.length === 0) {
    return {
      tone: "good",
      text:
        installed.length === 1
          ? installed[0].message ?? "Mod installed."
          : `${installed.length} mods installed. Start the game to use them.`,
      installed: installed.length,
    };
  }
  const why = rest.map((r) => `${r.fileName}: ${r.message ?? "not installed"}`).join("; ");
  if (installed.length === 0) {
    return { tone: "bad", text: `Nothing was installed. ${why}`, installed: 0 };
  }
  return {
    tone: "warn",
    text: `${installed.length} of ${results.length} mods installed. ${why}`,
    installed: installed.length,
  };
}
