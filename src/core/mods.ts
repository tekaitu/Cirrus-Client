export interface PackMod {
  slug: string;
  name: string;
  why: string;
}

export interface ModPack {
  id: "performance" | "hud";
  title: string;
  description: string;
  mods: PackMod[];
}

/**
 * Ready-made sets of Fabric mods, like the built-in modules of a PvP client.
 * Modrinth project slugs; required mods (Fabric API and so on) come along automatically.
 * A mod that has no build for the chosen Minecraft version is skipped and reported.
 */
export const MOD_PACKS: ModPack[] = [
  {
    id: "performance",
    title: "Performance pack",
    description: "More FPS and smoother play on low-end PCs.",
    mods: [
      { slug: "sodium", name: "Sodium", why: "Much faster rendering" },
      { slug: "lithium", name: "Lithium", why: "Smoother game logic" },
      { slug: "ferrite-core", name: "FerriteCore", why: "Uses less memory" },
      { slug: "entityculling", name: "Entity Culling", why: "Skips drawing what you can't see" },
      { slug: "immediatelyfast", name: "ImmediatelyFast", why: "Faster menus and text" },
      { slug: "modernfix", name: "ModernFix", why: "Faster start-up and less lag" },
      { slug: "dynamic-fps", name: "Dynamic FPS", why: "Saves power when the window is idle" },
    ],
  },
  {
    id: "hud",
    title: "HUD & PvP pack",
    description: "On-screen info and tools: FPS, keystrokes, clicks per second, zoom.",
    mods: [
      { slug: "sodium-extra", name: "Sodium Extra", why: "FPS and coordinates overlay" },
      { slug: "modern-keystrokes", name: "Modern Keystrokes", why: "Shows the keys you press" },
      { slug: "cps-plus", name: "CPS+", why: "Clicks per second counter" },
      { slug: "zoomify", name: "Zoomify", why: "Zoom key with smooth zoom" },
      { slug: "modmenu", name: "Mod Menu", why: "In-game menu to change mod settings" },
    ],
  },
];

/** Kept for the performance set on its own. */
export const FPS_PACK: PackMod[] = MOD_PACKS[0].mods;

export function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Modrinth's categories for mods, in the order they are listed in the filter. */
export const MOD_CATEGORIES: ReadonlyArray<{ id: string; label: string }> = [
  { id: "optimization", label: "Optimization" },
  { id: "utility", label: "Utility" },
  { id: "game-mechanics", label: "Game mechanics" },
  { id: "decoration", label: "Decoration" },
  { id: "equipment", label: "Equipment" },
  { id: "library", label: "Library" },
  { id: "adventure", label: "Adventure" },
  { id: "mobs", label: "Mobs" },
  { id: "worldgen", label: "World generation" },
  { id: "magic", label: "Magic" },
  { id: "technology", label: "Technology" },
  { id: "storage", label: "Storage" },
  { id: "transportation", label: "Transportation" },
  { id: "food", label: "Food" },
  { id: "management", label: "Management" },
  { id: "social", label: "Social" },
  { id: "economy", label: "Economy" },
  { id: "minigame", label: "Minigame" },
  { id: "cursed", label: "Cursed" },
];

/** How many results one page of the browser shows (the same number the search asks for). */
export const PAGE_SIZE = 20;

export const MOD_SORTS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "", label: "Best match" },
  { id: "downloads", label: "Most downloaded" },
  { id: "newest", label: "Newest" },
  { id: "updated", label: "Recently updated" },
];

/** The page numbers to show: always the first and last, and a few around the current one. `null` is a gap ("…"). */
export function pageWindow(page: number, pages: number): Array<number | null> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => keep.add(n));
  if (page >= pages - 2) [pages - 3, pages - 2, pages - 1].forEach((n) => keep.add(n));
  const list = [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: Array<number | null> = [];
  list.forEach((n, i) => {
    if (i > 0 && n - list[i - 1] > 1) out.push(null);
    out.push(n);
  });
  return out;
}
