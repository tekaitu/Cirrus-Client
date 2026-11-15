import type { PageId } from "../components/Navigation";

/** Alt + number jumps to a page. Fixed, and shown on the Keybinds tab in Settings. */
export const PAGE_SHORTCUTS: Array<{ key: string; page: PageId; label: string }> = [
  { key: "1", page: "home", label: "Go to Home" },
  { key: "2", page: "play", label: "Go to Play" },
  { key: "3", page: "mods", label: "Go to Mods" },
  { key: "4", page: "skins", label: "Go to Skins" },
  { key: "5", page: "accounts", label: "Go to Accounts" },
  { key: "6", page: "settings", label: "Go to Settings" },
  { key: "7", page: "about", label: "Go to About" },
];

export function pageForShortcut(e: Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey" | "key">): PageId | null {
  if (!e.altKey || e.ctrlKey || e.metaKey) return null;
  return PAGE_SHORTCUTS.find((s) => s.key === e.key)?.page ?? null;
}
