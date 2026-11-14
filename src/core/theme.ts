/** Look and feel choices. They are applied at once and remembered on this PC. */

export interface ThemeInfo {
  id: string;
  label: string;
  blurb: string;
  /** Preview colours: page, card, raised card. */
  swatch: [string, string, string];
}

export const THEMES: readonly ThemeInfo[] = [
  { id: "cirrus", label: "Cirrus", blurb: "Black and white", swatch: ["#09090b", "#111113", "#232327"] },
  { id: "midnight", label: "Midnight", blurb: "Deep violet-black", swatch: ["#14121a", "#1b1923", "#2e2a3b"] },
  { id: "graphite", label: "Graphite", blurb: "Neutral grey", swatch: ["#151618", "#1e2023", "#2f3236"] },
  { id: "ocean", label: "Ocean", blurb: "Deep blue", swatch: ["#0c1422", "#121c2e", "#1f2d45"] },
  { id: "forest", label: "Forest", blurb: "Dark green", swatch: ["#0e1612", "#14201a", "#22332a"] },
  { id: "sunset", label: "Sunset", blurb: "Warm and dark", swatch: ["#1a1214", "#241a1c", "#38282b"] },
  { id: "light", label: "Light", blurb: "Bright and clean", swatch: ["#f3f2f8", "#ffffff", "#e7e5f0"] },
];

export interface AccentInfo {
  id: string;
  label: string;
  color: string;
  /** Colour of a check mark drawn on top of the swatch. */
  ink: string;
}

export const ACCENTS: readonly AccentInfo[] = [
  { id: "white", label: "White", color: "#f4f4f5", ink: "#0a0a0b" },
  { id: "violet", label: "Violet", color: "#8b5cf6", ink: "#fff" },
  { id: "blue", label: "Blue", color: "#3b82f6", ink: "#fff" },
  { id: "cyan", label: "Cyan", color: "#06b6d4", ink: "#fff" },
  { id: "green", label: "Green", color: "#22c55e", ink: "#fff" },
  { id: "pink", label: "Pink", color: "#ec4899", ink: "#fff" },
  { id: "orange", label: "Orange", color: "#f97316", ink: "#fff" },
];

export const DEFAULT_THEME = "cirrus";
export const DEFAULT_ACCENT = "white";

const THEME_KEY = "unlimited.theme";
const ACCENT_KEY = "unlimited.accent";

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

export function getTheme(): string {
  const saved = read(THEME_KEY);
  return THEMES.some((t) => t.id === saved) ? (saved as string) : DEFAULT_THEME;
}

export function getAccent(): string {
  const saved = read(ACCENT_KEY);
  return ACCENTS.some((a) => a.id === saved) ? (saved as string) : DEFAULT_ACCENT;
}

function apply(theme: string, accent: string) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.accent = accent;
}

export function setTheme(id: string) {
  if (!THEMES.some((t) => t.id === id)) return;
  write(THEME_KEY, id);
  apply(id, getAccent());
}

export function setAccent(id: string) {
  if (!ACCENTS.some((a) => a.id === id)) return;
  write(ACCENT_KEY, id);
  apply(getTheme(), id);
}

/** Call once before the first render so the window never flashes the wrong colours. */
export function initTheme() {
  apply(getTheme(), getAccent());
}
