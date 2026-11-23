import { describe, expect, it } from "vitest";
import type { InstalledPack } from "../src/api/types";
import {
  BrowsingCache,
  PACK_RESOLUTIONS,
  activeSummary,
  packDetailsKey,
  packMetaLine,
  packSearchKey,
  packSiteName,
  resolutionText,
} from "../src/core/packs";

const pack = (over: Partial<InstalledPack> = {}): InstalledPack => ({
  fileName: "Clean.zip",
  size: 2 * 1024 * 1024,
  description: "Clean skies",
  packFormat: 34,
  enabled: false,
  icon: null,
  ...over,
});

describe("texture pack browsing helpers", () => {
  it("offers only the resolutions both sites actually use", () => {
    const ids = PACK_RESOLUTIONS.map((r) => r.id);
    expect(ids[0]).toBe("");
    expect(ids).toContain("16x");
    expect(ids).toContain("512x");
    expect(ids).not.toContain("1x");
  });

  it("builds one cache key per page, site and filter set", () => {
    const base = { provider: "modrinth" as const, query: "clean", version: "1.21.11", resolution: "64x", sort: "", offset: 0 };
    expect(packSearchKey(base)).toBe(packSearchKey({ ...base, query: "  CLEAN " }));
    expect(packSearchKey(base)).not.toBe(packSearchKey({ ...base, offset: 20 }));
    expect(packSearchKey(base)).not.toBe(packSearchKey({ ...base, provider: "curseforge" }));
    expect(packDetailsKey("modrinth", "abc", "1.21.11")).toBe("modrinth|1.21.11|abc");
  });

  it("names the sites the way the interface does", () => {
    expect(packSiteName("modrinth")).toBe("Modrinth");
    expect(packSiteName("curseforge")).toBe("CurseForge");
  });

  it("summarises how many installed packs are on", () => {
    expect(activeSummary([])).toBe("No packs installed");
    expect(activeSummary([pack()])).toBe("None on yet");
    expect(activeSummary([pack({ enabled: true }), pack({ fileName: "B.zip" })])).toBe("1 of 2 on");
    expect(activeSummary([pack({ enabled: true })])).toBe("1 of 1 on");
  });

  it("describes an installed pack in one line", () => {
    expect(packMetaLine(pack(), "2.0 MB")).toBe("Pack format 34 · 2.0 MB");
    expect(packMetaLine(pack({ enabled: true, packFormat: null }), "2.0 MB")).toBe("2.0 MB · On in Minecraft");
  });

  it("never invents a resolution", () => {
    expect(resolutionText("64x")).toBe("64x");
    expect(resolutionText(null)).toBe("Resolution not listed");
  });
});

describe("browsing cache", () => {
  it("returns a value until its five minutes are up", () => {
    const cache = new BrowsingCache<string>(1000, 5);
    cache.set("k", "value", 1000);
    expect(cache.get("k", 1500)).toBe("value");
    expect(cache.get("k", 2001)).toBeNull();
    expect(cache.size).toBe(0);
  });

  it("keeps the most recently read entries when it is full", () => {
    const cache = new BrowsingCache<number>(60_000, 3);
    cache.set("a", 1, 0);
    cache.set("b", 2, 0);
    cache.set("c", 3, 0);
    expect(cache.get("a", 1)).toBe(1);
    cache.set("d", 4, 2);
    expect(cache.get("a", 3)).toBe(1);
    expect(cache.get("b", 3)).toBeNull();
    expect(cache.get("d", 3)).toBe(4);
  });

  it("can be cleared, and says nothing about keys it never saw", () => {
    const cache = new BrowsingCache<string>();
    cache.set("k", "v");
    expect(cache.get("missing")).toBeNull();
    cache.clear();
    expect(cache.get("k")).toBeNull();
  });
});
