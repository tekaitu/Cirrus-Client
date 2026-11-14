import type { LoaderId } from "./game";

export interface RecentPlay {
  version: string;
  loader: LoaderId;
  profile: string | null;
  /** Milliseconds since 1970. */
  at: number;
}

const KEY = "cirrus.lastPlayed";

export function readRecent(): RecentPlay | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<RecentPlay>;
    if (typeof v.version === "string" && (v.loader === "fabric" || v.loader === "vanilla") && typeof v.at === "number") {
      return { version: v.version, loader: v.loader, profile: typeof v.profile === "string" ? v.profile : null, at: v.at };
    }
  } catch {
    /* an unreadable entry is the same as none */
  }
  return null;
}

export function writeRecent(r: RecentPlay) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* the last-played line is a convenience only */
  }
}

/** "Just now", "12 minutes ago", "3 hours ago", or the date. */
export function formatAgo(at: number, now: number = Date.now()): string {
  const minutes = Math.floor((now - at) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
