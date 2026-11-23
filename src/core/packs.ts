import type { InstalledPack, ModProvider, PackSearchResult } from "../api/types";

/** Resolutions both sites use as categories for texture packs. */
export const PACK_RESOLUTIONS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "", label: "Any" },
  { id: "16x", label: "16x" },
  { id: "32x", label: "32x" },
  { id: "64x", label: "64x" },
  { id: "128x", label: "128x" },
  { id: "256x", label: "256x" },
  { id: "512x", label: "512x" },
];

export const PACK_SORTS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "", label: "Most downloaded" },
  { id: "relevance", label: "Best match" },
  { id: "newest", label: "Newest" },
  { id: "updated", label: "Recently updated" },
];

/** How many packs one page of the browser shows. Matches the backend's page size. */
export const PACK_PAGE_SIZE = 20;

export function packSiteName(provider: ModProvider): string {
  return provider === "curseforge" ? "CurseForge" : "Modrinth";
}

export function packSiteHost(provider: ModProvider): string {
  return provider === "curseforge" ? "curseforge.com" : "modrinth.com";
}

/** A stable key for one page of results, so revisiting it costs no request. */
export function packSearchKey(input: {
  provider: ModProvider;
  query: string;
  version: string;
  resolution: string;
  sort: string;
  offset: number;
}): string {
  return [input.provider, input.version, input.resolution, input.sort, input.offset, input.query.trim().toLowerCase()].join("|");
}

export function packDetailsKey(provider: ModProvider, id: string, version: string): string {
  return `${provider}|${version}|${id}`;
}

/**
 * A small time-limited cache for browsing results.
 *
 * Looking at a result, opening it and coming back should not ask the site
 * again, but a pack that was updated should not be stale for the whole
 * session. Entries are capped so a long browsing session cannot grow without
 * limit, and expired ones are dropped when the cache is read.
 */
export class BrowsingCache<Value> {
  private entries = new Map<string, { value: Value; at: number }>();

  constructor(
    private readonly ttlMs = 5 * 60 * 1000,
    private readonly limit = 40,
  ) {}

  get(key: string, now = Date.now()): Value | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (now - entry.at >= this.ttlMs) {
      this.entries.delete(key);
      return null;
    }
    // Reading an entry makes it the most recently used one.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: Value, now = Date.now()): void {
    this.entries.delete(key);
    this.entries.set(key, { value, at: now });
    while (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

/** Search results and pack details share one cache; both are browsing data. */
export const packCache = new BrowsingCache<PackSearchResult | unknown>(5 * 60 * 1000, 40);

/** A pack is on only when Minecraft's own options list it. */
export function activePacks(packs: InstalledPack[]): InstalledPack[] {
  return packs.filter((pack) => pack.enabled);
}

/** "2 of 4 on", or "none on yet" when nothing is active. */
export function activeSummary(packs: InstalledPack[]): string {
  const on = activePacks(packs).length;
  if (packs.length === 0) return "No packs installed";
  return on === 0 ? "None on yet" : `${on} of ${packs.length} on`;
}

/** The line under a pack's name: format, size and state. */
export function packMetaLine(pack: InstalledPack, size: string): string {
  const parts = [pack.packFormat ? `Pack format ${pack.packFormat}` : null, size];
  if (pack.enabled) parts.push("On in Minecraft");
  return parts.filter(Boolean).join(" · ");
}

/** Packs look the same for every version, so a poor match is still worth listing. */
export function resolutionText(resolution: string | null): string {
  return resolution ?? "Resolution not listed";
}
