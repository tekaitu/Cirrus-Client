import type { PageId } from "../components/Navigation";

/** Alt + number jumps to a page. Fixed, and shown on the Keybinds tab in Settings. */
export const PAGE_SHORTCUTS: Array<{ key: string; page: PageId; label: string }> = [
  { key: "1", page: "home", label: "Go to Home" },
  { key: "2", page: "versions", label: "Go to Versions" },
  { key: "3", page: "browse", label: "Go to Browse" },
  { key: "4", page: "mods", label: "Go to Mods" },
  { key: "5", page: "modpacks", label: "Go to Modpacks" },
  { key: "6", page: "skins", label: "Go to Skins" },
  { key: "7", page: "servers", label: "Go to Servers" },
  { key: "8", page: "settings", label: "Go to Settings" },
  { key: "9", page: "about", label: "Go to About" },
];

export function pageForShortcut(e: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey" | "key">): PageId | null {
  if (!e.altKey || e.ctrlKey || e.metaKey) return null;
  return PAGE_SHORTCUTS.find((s) => s.key === e.key)?.page ?? null;
}
