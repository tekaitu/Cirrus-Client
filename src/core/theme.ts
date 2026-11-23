/**
 * The launcher's looks.
 *
 * Classic is the older launcher identity: a vertical navigation rail, neutral
 * near-black surfaces and full-bleed Minecraft cards, with maple orange used
 * only for the selected section and the primary action.
 *
 * Colorful keeps the bright Minecraft key art behind the whole window, with
 * translucent dark panels for readability and the same orange accent.
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

export const BRAND_ORANGE = "#e25303";

export const THEMES: readonly ThemeInfo[] = [
  {
    id: "classic",
    label: "Classic",
    blurb: "Deep neutral surfaces, full-bleed instance art and one maple-orange accent",
    swatch: ["#080706", "#141110", "#221d1a"],
    accent: "#e25303",
  },
  {
    id: "colorful",
    label: "Colorful",
    blurb: "The bright Minecraft key art fills the window, with translucent panels and maple orange",
    swatch: ["#0b1524", "#16233a", "#22344f"],
    accent: "#e25303",
  },
  {
    id: "light",
    label: "Light",
    blurb: "Bright and clean",
    swatch: ["#eef1f6", "#ffffff", "#e4e8f0"],
    accent: "#c94803",
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

type ThemeListener = () => void;
const listeners = new Set<ThemeListener>();

/** Notified whenever the look changes, so views that depend on it can redraw. */
export function subscribeTheme(listener: ThemeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
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
  listeners.forEach((listener) => listener());
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
