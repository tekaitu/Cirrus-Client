import summer from "../assets/art/summer.jpg";
import summerCard from "../assets/art/summer-card.jpg";
import trials from "../assets/art/trials.jpg";
import trialsCard from "../assets/art/trials-card.jpg";
import wilderness from "../assets/art/wilderness.jpg";
import wildernessCard from "../assets/art/wilderness-card.jpg";
import family121 from "../assets/art/families/v121.jpg";
import family120 from "../assets/art/families/v120.jpg";
import family119 from "../assets/art/families/v119.jpg";
import family118 from "../assets/art/families/v118.jpg";
import family117 from "../assets/art/families/v117.jpg";
import family116 from "../assets/art/families/v116.jpg";
import family112 from "../assets/art/families/v112.jpg";
import family18 from "../assets/art/families/v18.jpg";
import familyLegacy from "../assets/art/families/legacy.jpg";

/** The key art Cirrus uses. `full` is for backgrounds, `card` is a small copy for version cards. */
export const ART = {
  summer: { full: summer, card: summerCard },
  trials: { full: trials, card: trialsCard },
  wilderness: { full: wilderness, card: wildernessCard },
} as const;

export type ArtId = keyof typeof ART;
const ART_IDS: ArtId[] = ["summer", "trials", "wilderness"];

export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Which picture and which crop a version card shows. The same version always gets the same one. */
/** Each Minecraft family keeps its own key art, so 1.21 never shows 1.16 artwork. */
const FAMILY_ART: ReadonlyArray<{ minor: number; src: string }> = [
  { minor: 21, src: family121 },
  { minor: 20, src: family120 },
  { minor: 19, src: family119 },
  { minor: 18, src: family118 },
  { minor: 17, src: family117 },
  { minor: 16, src: family116 },
  { minor: 12, src: family112 },
  { minor: 8, src: family18 },
];

/** The picture that belongs to a version, or null for snapshots and unusual numbers. */
export function versionArt(version: string): string | null {
  const parts = version.split(".");
  const minor = Number(parts[1]);
  if (parts[0] !== "1" || !Number.isFinite(minor)) return null;
  return FAMILY_ART.find((entry) => entry.minor === minor)?.src ?? familyLegacy;
}

export function cardArt(version: string, extra = ""): { src: string; position: string; zoom: number } {
  const art = versionArt(version);
  if (art) return { src: art, position: "50% 44%", zoom: 1.18 };
  const h2 = seedFrom(`${version}${extra}`);
  const id = ART_IDS[(h2 >>> 4) % ART_IDS.length];
  const x = 15 + (h2 % 71);
  const y = 25 + ((h2 >>> 8) % 51);
  const zoom = 1.15 + ((h2 >>> 16) % 30) / 100;
  return { src: ART[id].card, position: `${x}% ${y}%`, zoom };
}
