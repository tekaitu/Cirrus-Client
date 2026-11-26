import vanguardsIcon from "../assets/servers/vanguards-icon.webp";

/**
 * The partnered servers the launcher lists.
 *
 * This is configuration, not content: every field is either published by the
 * server itself (its Modrinth listing or its own status answer) or absent. The
 * same shape is what a Maple Dashboard entry would write later, so nothing here
 * has to change when partner management moves server-side.
 *
 * Live numbers — online state, player counts, version, MOTD, icon — are never
 * stored here. They come from `server_status`, the game's own ping, at runtime.
 */
export interface PartnerServer {
  id: string;
  name: string;
  /** The published Minecraft hostname, never a resolved numeric address. */
  address: string;
  description: string;
  /** Official artwork for the wide card; null when the listing has none. */
  banner: string | null;
  /** Official server icon, used beside the name. */
  icon: string | null;
  /** The Minecraft version the server recommends, as published. */
  version: string | null;
  software: string | null;
  region: string | null;
  language: string | null;
  tags: string[];
  featured: boolean;
  visible: boolean;
  displayOrder: number;
  /** Where the details above were published, so they can be checked. */
  source: string;
}

export const PARTNER_SERVERS: PartnerServer[] = [
  {
    id: "vanguards",
    name: "Vanguards",
    address: "vanguards.ggwp.cc",
    description:
      "A semi-vanilla SMP built around guilds, territorial expansion, diplomacy and wars. Build your kingdom, forge alliances, and compete fairly with no pay-to-win perks.",
    // The Modrinth listing publishes a server icon but no wide banner; the card
    // uses Minecraft artwork as a neutral backdrop rather than stretching it.
    banner: null,
    icon: vanguardsIcon,
    version: "1.21.11",
    software: "Paper",
    region: "Europe",
    language: "English",
    tags: ["Survival", "SMP", "PvP", "Towns", "Economy", "Anarchy", "PvE", "Vanilla-like"],
    featured: true,
    visible: true,
    displayOrder: 1,
    source: "https://modrinth.com/server/vanguards",
  },
];

/** The servers the launcher may show, in the order the configuration asks for. */
export function visibleServers(list: PartnerServer[] = PARTNER_SERVERS): PartnerServer[] {
  return list
    .filter((server) => server.visible)
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/** Every tag that at least one shown server actually carries; nothing is invented. */
export function serverTags(list: PartnerServer[]): string[] {
  const seen: string[] = [];
  for (const server of list) {
    for (const tag of server.tags) {
      if (!seen.some((t) => t.toLowerCase() === tag.toLowerCase())) seen.push(tag);
    }
  }
  return seen;
}

/** Search matches the name, the address and the server's own tags. */
export function matchesServer(server: PartnerServer, query: string, tag: string | null): boolean {
  if (tag && !server.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [server.name, server.address, server.description, ...server.tags]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

/** `1.20` and newer can open a server from the launcher (`--quickPlayMultiplayer`). */
export function canJoinDirectly(version: string): boolean {
  const [, minor] = version.split(".");
  const value = Number.parseInt(minor ?? "", 10);
  return version.startsWith("1.") && Number.isFinite(value) && value >= 20;
}

/** "1,234" — grouped the same way everywhere the launcher shows a count. */
export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}
