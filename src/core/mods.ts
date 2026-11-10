/** Mods that make Minecraft smoother on weak PCs. Modrinth project slugs; required mods come along automatically. */
export const FPS_PACK: Array<{ slug: string; name: string; why: string }> = [
  { slug: "sodium", name: "Sodium", why: "Much faster rendering" },
  { slug: "lithium", name: "Lithium", why: "Smoother game logic" },
  { slug: "ferrite-core", name: "FerriteCore", why: "Uses less memory" },
  { slug: "entityculling", name: "Entity Culling", why: "Skips drawing what you can't see" },
  { slug: "immediatelyfast", name: "ImmediatelyFast", why: "Faster menus and text" },
];

export function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
