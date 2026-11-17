import type { VersionEntry } from "../api/types";

export interface VersionOption {
  id: string;
  kind: "release" | "snapshot" | "other";
  released: string | null;
  supported: boolean;
}

export interface VersionGroups {
  releases: VersionOption[];
  snapshots: VersionOption[];
}

function kindOf(kind: string): VersionOption["kind"] {
  if (kind === "release") return "release";
  if (kind === "snapshot") return "snapshot";
  return "other";
}

export function optionOf(entry: VersionEntry): VersionOption {
  return {
    id: entry.id,
    kind: kindOf(entry.kind),
    released: entry.released ?? null,
    supported: entry.supported,
  };
}

/** Releases newest first, snapshots newest first, everything else left out. */
export function groupVersions(entries: VersionEntry[]): VersionGroups {
  const releases: VersionOption[] = [];
  const snapshots: VersionOption[] = [];
  for (const entry of entries) {
    if (!entry.id) continue;
    const option = optionOf(entry);
    if (option.kind === "release") releases.push(option);
    else if (option.kind === "snapshot") snapshots.push(option);
  }
  return { releases: dedupe(releases), snapshots: dedupe(snapshots) };
}

function dedupe(list: VersionOption[]): VersionOption[] {
  const seen = new Set<string>();
  return list.filter((v) => {
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  });
}

/** Builds catalog entries from the plain release list older backends return. */
export function fromReleaseIds(ids: string[]): VersionOption[] {
  return dedupe(ids.filter(Boolean).map((id) => ({ id, kind: "release" as const, released: null, supported: true })));
}

/** What the version picker says about the chosen version. */
export function versionStatus(option: VersionOption | null, installed: boolean): {
  label: string;
  tone: "good" | "info" | "warn" | "bad";
  detail: string;
} {
  if (!option) {
    return { label: "Unknown version", tone: "bad", detail: "This version is not in Mojang's list." };
  }
  if (!option.supported) {
    return {
      label: "Not supported",
      tone: "warn",
      detail:
        option.kind === "snapshot"
          ? "Snapshots are not installable in this build."
          : "This version needs a different Java, so this build cannot install it.",
    };
  }
  if (installed) return { label: "Installed", tone: "good", detail: "Ready to play." };
  return { label: "Not installed", tone: "info", detail: "Play will download the game files first." };
}

export function releasedText(option: VersionOption): string | null {
  if (!option.released) return null;
  const date = new Date(option.released);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
