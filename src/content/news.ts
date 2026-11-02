/**
 * Local launcher content for the Home news row. Nothing here is fetched and none
 * of it is live news: project notes describe what this build actually contains
 * (dates are the commit dates), and tips are general advice written for the app.
 */
export type NewsKind = "Update" | "Tip" | "Roadmap";

export interface NewsItem {
  id: string;
  kind: NewsKind;
  /** ISO date (YYYY-MM-DD) the note refers to; omitted for evergreen tips. */
  date: string | null;
  title: string;
  body: string;
  art: "blocks" | "speed" | "sword";
}

export const NEWS: NewsItem[] = [
  {
    id: "java-installer",
    kind: "Update",
    date: "2026-11-01",
    title: "Java 21 installer and better detection",
    body: "Limited FPS can now find Java in more places and install a checked, portable Java 21 for you.",
    art: "speed",
  },
  {
    id: "settings-diagnostics",
    kind: "Update",
    date: "2026-10-31",
    title: "Saved settings and live diagnostics",
    body: "Memory, game folder and Java path are saved between runs. Diagnostics shows your real PC and Java results.",
    art: "blocks",
  },
  {
    id: "tip-memory",
    kind: "Tip",
    date: null,
    title: "Don't over-allocate memory",
    body: "On a 16 GB PC, 4 GB is a sensible starting point. Giving the game far more can make pauses longer, not shorter.",
    art: "sword",
  },
  {
    id: "roadmap-launch",
    kind: "Roadmap",
    date: null,
    title: "Next: sign-in, game files, Fabric",
    body: "Microsoft sign-in, downloading Minecraft 1.21.11 and setting up Fabric come before real launching. None of it exists yet.",
    art: "blocks",
  },
];

/** "2026-11-01" -> "1 Nov 2026" without depending on the PC's locale or time zone. */
export function formatNewsDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month} ${m[1]}` : iso;
}
