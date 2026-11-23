/**
 * The launcher's looks. Classic brings back the older Cirrus identity: a vertical
 * navigation rail and monochrome surfaces behind full-bleed Minecraft cards.
 * Colorful keeps the brighter, blue-accented treatment with vivid artwork.
 *
 * Light is still offered in Settings for anyone who chose it before; the
 * first-launch chooser asks between the two themes this release introduces.
 */

export interface ThemeInfo {
  id: "classic" | "colorful" | "light";
  label: string;
  blurb: string;
  /** Preview colours: page, card, raised card. */
  swatch: [string, string, string];
  /** Accent used for the preview's button. */
  accent: string;
}

export const THEMES: readonly ThemeInfo[] = [
  {
    id: "classic",
    label: "Classic",
    blurb: "Sidebar navigation, monochrome panels, full-bleed instance cards",
    swatch: ["#050505", "#101010", "#1e1e1e"],
    accent: "#ffffff",
  },
  {
    id: "colorful",
    label: "Colorful",
    blurb: "Bright Minecraft artwork, blue highlights, the same launcher underneath",
    swatch: ["#0a1020", "#13203a", "#1d2f52"],
    accent: "#4f8cff",
  },
  {
    id: "light",
    label: "Light",
    blurb: "Bright and clean",
    swatch: ["#eef1f6", "#ffffff", "#e4e8f0"],
    accent: "#0c0c0c",
  },
];

/** The two themes the first-launch screen offers, in order. */
export const WELCOME_THEMES = THEMES.filter((t) => t.id !== "light");

export type ThemeId = ThemeInfo["id"];

export const DEFAULT_THEME: ThemeId = "classic";

const THEME_KEY = "unlimited.theme";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* the look is remembered when possible, never required */
  }
}

/** Anything an older build saved (Dark, Ocean, Forest, …) becomes Classic. */
export function getTheme(): ThemeId {
  const saved = read(THEME_KEY);
  if (saved === "light" || saved === "colorful") return saved;
  return DEFAULT_THEME;
}

/** False until the player has chosen or an older build has saved a look. */
export function hasThemeChoice(): boolean {
  return read(THEME_KEY) !== null;
}

function apply(theme: ThemeId) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  delete root.dataset.accent;
  root.style.colorScheme = theme === "light" ? "light" : "dark";
}

export function setTheme(id: ThemeId) {
  if (!THEMES.some((t) => t.id === id)) return;
  write(THEME_KEY, id);
  apply(id);
}

/** Call once before the first render so the window never flashes the wrong colours. */
export function initTheme() {
  apply(getTheme());
}
