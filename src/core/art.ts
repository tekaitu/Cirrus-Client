import summer from "../assets/art/summer.jpg";
import summerCard from "../assets/art/summer-card.jpg";
import trials from "../assets/art/trials.jpg";
import trialsCard from "../assets/art/trials-card.jpg";
import wilderness from "../assets/art/wilderness.jpg";
import wildernessCard from "../assets/art/wilderness-card.jpg";

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
export function cardArt(version: string, extra = ""): { src: string; position: string; zoom: number } {
  const h = seedFrom(version);
  const id = ART_IDS[h % ART_IDS.length];
  const h2 = seedFrom(`${version}${extra}`);
  const x = 15 + (h2 % 71);
  const y = 25 + ((h2 >>> 8) % 51);
  const zoom = 1.15 + ((h2 >>> 16) % 30) / 100;
  return { src: ART[id].card, position: `${x}% ${y}%`, zoom };
}
