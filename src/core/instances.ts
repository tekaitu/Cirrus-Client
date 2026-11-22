import type { InstanceView, VersionEntry } from "../api/types";
import { formatAgo, type RecentPlay } from "./recent";
import art121 from "../assets/art/families/v121.jpg";
import art120 from "../assets/art/families/v120.jpg";
import art119 from "../assets/art/families/v119.jpg";
import art118 from "../assets/art/families/v118.jpg";
import art117 from "../assets/art/families/v117.jpg";
import art116 from "../assets/art/families/v116.jpg";
import art112 from "../assets/art/families/v112.jpg";
import art18 from "../assets/art/families/v18.jpg";
import artLegacy from "../assets/art/families/legacy.jpg";

/** One group of Minecraft releases on the Versions page. */
export interface VersionFamily {
  key: string;
  title: string;
  blurb: string;
  art: string;
  /** The minor version this family is about (`1.21`, `1.8`, ...), or `other`. */
  minor: number | "other";
}

/**
 * Version families, newest first. Each has its own picture, so the page never
 * looks like one template repeated: the artwork is chosen by the family, not by
 * a hash of the version.
 */
export const FAMILIES: VersionFamily[] = [
  {
    key: "1.21",
    title: "Minecraft 1.21",
    blurb: "The newest releases: bundles, trial chambers and the latest engine.",
    art: art121,
    minor: 21,
  },
  {
    key: "1.20",
    title: "Minecraft 1.20",
    blurb: "Trails & Tales: cherry groves, archaeology and camels.",
    art: art120,
    minor: 20,
  },
  {
    key: "1.19",
    title: "Minecraft 1.19",
    blurb: "The Wild Update: the deep dark, ancient cities and mangroves.",
    art: art119,
    minor: 19,
  },
  {
    key: "1.18",
    title: "Minecraft 1.18",
    blurb: "Caves & Cliffs part two: taller mountains and bigger caves.",
    art: art118,
    minor: 18,
  },
  {
    key: "1.17",
    title: "Minecraft 1.17",
    blurb: "Caves & Cliffs part one: copper, axolotls and goats.",
    art: art117,
    minor: 17,
  },
  {
    key: "1.16",
    title: "Minecraft 1.16",
    blurb: "The Nether Update: new biomes, bastions and netherite.",
    art: art116,
    minor: 16,
  },
  {
    key: "1.12",
    title: "Minecraft 1.12",
    blurb: "The classic modding era, still the home of many packs.",
    art: art112,
    minor: 12,
  },
  {
    key: "1.8",
    title: "Minecraft 1.8",
    blurb: "The PvP standard: combat, practice servers and old clients.",
    art: art18,
    minor: 8,
  },
  {
    key: "other",
    title: "Other releases",
    blurb: "Everything else from 1.9 to 1.15, for older worlds and servers.",
    art: artLegacy,
    minor: "other",
  },
];

/** Which family a Minecraft version belongs to. */
export function familyOf(version: string): VersionFamily {
  const minor = Number(version.split(".")[1] ?? NaN);
  const family = FAMILIES.find((f) => f.minor === minor);
  if (family) return family;
  // 1.13 - 1.15 have no family card of their own; they live with the older releases.
  return FAMILIES[FAMILIES.length - 1];
}

export interface FamilyGroup {
  family: VersionFamily;
  versions: VersionEntry[];
}

/**
 * Groups Mojang's catalogue into the family cards. Only installable releases
 * are offered; snapshots stay out of the group lists (they cannot be installed
 * by this build) and are counted so the page can say so.
 */
export function groupByFamily(entries: VersionEntry[]): { groups: FamilyGroup[]; snapshots: number } {
  const byFamily = new Map<string, VersionEntry[]>();
  let snapshots = 0;
  for (const entry of entries) {
    if (entry.kind === "snapshot") {
      snapshots += 1;
      continue;
    }
    if (!entry.supported) continue;
    const family = familyOf(entry.id);
    const list = byFamily.get(family.key) ?? [];
    list.push(entry);
    byFamily.set(family.key, list);
  }
  const groups = FAMILIES.map((family) => ({
    family,
    versions: (byFamily.get(family.key) ?? []).slice().sort((a, b) => compareVersions(b.id, a.id)),
  })).filter((g) => g.versions.length > 0);
  return { groups, snapshots };
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((p) => Number(p) || 0);
  const pb = b.split(".").map((p) => Number(p) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

/** The most recently played instances, newest first, without duplicates. */
export function recentlyPlayed(instances: InstanceView[], fallback: RecentPlay | null, limit = 4): InstanceView[] {
  const played = instances.filter((i) => i.lastPlayed > 0).sort((a, b) => b.lastPlayed - a.lastPlayed);
  const out = played.slice(0, limit);
  if (out.length === 0 && fallback) {
    // Before the first launch in this build the instance store has no timestamp yet;
    // the remembered last launch still describes a real session.
    const match = instances.find(
      (i) => i.minecraft === fallback.version && i.loader === fallback.loader,
    );
    if (match) out.push(match);
  }
  return out;
}

/** Everything a search box should match for one instance. */
export function recentSearchText(i: InstanceView): string {
  return [i.name, i.minecraft, i.loader, i.loaderVersion ?? "", i.loader === "fabric" ? "fabric" : "vanilla"]
    .join(" ")
    .toLowerCase();
}

export type LibrarySort = "recent" | "name" | "version";

/** Library order: recently played first, then name or newest Minecraft version. */
export function sortInstances(list: InstanceView[], sort: LibrarySort): InstanceView[] {
  const out = list.slice();
  if (sort === "name") {
    out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  } else if (sort === "version") {
    out.sort((a, b) => compareVersions(b.minecraft, a.minecraft) || a.name.localeCompare(b.name));
  } else {
    out.sort((a, b) => b.lastPlayed - a.lastPlayed || a.name.localeCompare(b.name));
  }
  return out;
}

export function lastPlayedText(at: number): string {
  if (!at) return "Never played";
  return `Played ${formatAgo(at)}`;
}

export const INSTANCE_ICONS = [
  { label: "Grass block", glyph: "⛰" },
  { label: "Pickaxe", glyph: "⛏" },
  { label: "Sword", glyph: "⚔" },
  { label: "Compass", glyph: "✦" },
  { label: "Apple", glyph: "●" },
  { label: "Ender pearl", glyph: "◈" },
  { label: "Diamond", glyph: "◆" },
  { label: "Creeper", glyph: "▚" },
] as const;

export function iconLabel(icon: number): string {
  return INSTANCE_ICONS[Math.abs(icon) % INSTANCE_ICONS.length].label;
}

export function iconGlyph(icon: number): string {
  return INSTANCE_ICONS[Math.abs(icon) % INSTANCE_ICONS.length].glyph;
}

/** Which Java a Minecraft version needs, used where no install marker exists yet. */
export function requiredJava(version: string): number {
  const minor = Number(version.split(".")[1] ?? 0);
  if (minor >= 21 || (minor === 20 && Number(version.split(".")[2] ?? 0) >= 5)) return 21;
  if (minor >= 17) return 17;
  return 8;
}

/** Instances whose Java is missing or too old for their Minecraft version. */
export function javaProblem(instance: InstanceView, detected: { path: string; major: number | null }[]): string | null {
  const needed = instance.javaMajor ?? requiredJava(instance.minecraft);
  const chosen = instance.javaPath ? detected.find((d) => d.path === instance.javaPath) : null;
  if (instance.javaPath && !chosen) return "The Java saved for this instance is no longer there.";
  if (chosen?.major != null && chosen.major < needed) {
    return `This instance needs Java ${needed}, but Java ${chosen.major} is selected.`;
  }
  return null;
}
