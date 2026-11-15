/** Look and feel: two appearances, Dark and Light. The choice is applied at once and remembered on this PC. */

export interface ThemeInfo {
  id: "dark" | "light";
  label: string;
  blurb: string;
  /** Preview colours: page, card, raised card. */
  swatch: [string, string, string];
}

export const THEMES: readonly ThemeInfo[] = [
  { id: "dark", label: "Dark", blurb: "Near-black with Cirrus blue", swatch: ["#0d0e11", "#16181d", "#20232a"] },
  { id: "light", label: "Light", blurb: "Bright and clean", swatch: ["#eef1f6", "#ffffff", "#e4e8f0"] },
];

export type ThemeId = ThemeInfo["id"];

export const DEFAULT_THEME: ThemeId = "dark";

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

/** Anything saved by an older build (Ocean, Forest, …) becomes Dark. */
export function getTheme(): ThemeId {
  return read(THEME_KEY) === "light" ? "light" : DEFAULT_THEME;
}

function apply(theme: ThemeId) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  delete root.dataset.accent;
  root.style.colorScheme = theme;
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
