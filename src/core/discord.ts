import type { DiscordPresence } from "../api/types";
import type { PageId } from "../components/Navigation";

const KEY = "cirrus.discordPresence";

/** Discord Presence is on unless the person switched it off. */
export function readDiscordEnabled(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeDiscordEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* it just resets to "on" next time */
  }
}

const PAGE_LINES: Record<PageId, string> = {
  home: "On the home screen",
  versions: "Choosing a version to play",
  browse: "Browsing mods",
  mods: "Managing mods",
  modpacks: "Managing modpacks",
  skins: "Choosing a skin",
  accounts: "Managing accounts",
  settings: "Tuning settings",
  about: "Reading about Cirrus Client",
  diagnostics: "Checking diagnostics",
};

export interface PresenceInput {
  page: PageId;
  running: boolean;
  version: string;
  loader: string;
  /** Unix seconds: when the game started (if running) or when the launcher opened. */
  startedAt: number;
}

/** Pure: what to show on Discord for the current state of the launcher. */
export function presenceFor(i: PresenceInput): DiscordPresence {
  if (i.running) {
    const loader = i.loader.toLowerCase() === "vanilla" ? "Vanilla" : i.loader.charAt(0).toUpperCase() + i.loader.slice(1);
    return { details: `Playing Minecraft ${i.version}`, state: loader, startedAt: i.startedAt };
  }
  return { details: PAGE_LINES[i.page], state: "Cirrus Client launcher", startedAt: i.startedAt };
}
