import type { SkinModel } from "../api/types";

/**
 * A neutral stand-in character for an account whose skin could not be loaded.
 *
 * Maple does not redistribute Mojang's Steve or Alex textures, so this draws
 * its own simple 64 × 64 skin with the same layout Minecraft uses. It is always
 * labelled as a default look in the interface, never passed off as the player's
 * own skin, and works without a canvas (an SVG data address is enough for the
 * CSS-3D figure).
 */

interface Palette {
  skin: string;
  skinShade: string;
  hair: string;
  shirt: string;
  shirtShade: string;
  trousers: string;
  shoes: string;
  accent: string;
}

const CLASSIC: Palette = {
  skin: "#c2b3a3",
  skinShade: "#a8998a",
  hair: "#3a3229",
  shirt: "#3f7f93",
  shirtShade: "#2f6474",
  trousers: "#3a4560",
  shoes: "#232a3a",
  accent: "#e8eef8",
};

const SLIM: Palette = {
  skin: "#cdb8a8",
  skinShade: "#b19d8e",
  hair: "#4a3b2f",
  shirt: "#6a5aa8",
  shirtShade: "#52458a",
  trousers: "#39405c",
  shoes: "#222838",
  accent: "#f0eaff",
};

function rect(x: number, y: number, w: number, h: number, fill: string): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
}

/** The head, torso, arms and legs at the coordinates a 64 × 64 skin uses. */
function body(p: Palette): string {
  return [
    // Head: all six faces plus the hat layer on the second layer.
    rect(0, 0, 32, 16, p.skin),
    rect(8, 0, 8, 8, p.hair),
    rect(8, 8, 8, 8, p.skin),
    rect(16, 8, 8, 8, p.skinShade),
    rect(24, 8, 8, 8, p.skinShade),
    rect(0, 8, 8, 8, p.skinShade),
    rect(32, 0, 32, 16, p.hair),
    rect(40, 0, 8, 8, p.hair),
    // Hair fringe on the front face.
    rect(8, 8, 8, 2, p.hair),
    // Eyes and mouth, in a two-pixel grid so they stay pixel-crisp.
    rect(10, 11, 1, 1, p.accent),
    rect(13, 11, 1, 1, p.accent),
    rect(11, 14, 2, 1, p.skinShade),
    // Torso: front, back, sides, top and bottom.
    rect(16, 16, 24, 16, p.shirt),
    rect(20, 20, 8, 12, p.shirtShade),
    rect(28, 20, 8, 12, p.shirtShade),
    rect(16, 20, 4, 12, p.shirtShade),
    rect(36, 20, 4, 12, p.shirtShade),
    rect(20, 16, 8, 4, p.shirt),
    rect(28, 16, 8, 4, p.shirtShade),
    // Jacket layer.
    rect(16, 32, 24, 16, p.shirtShade),
    rect(20, 36, 8, 12, p.shirt),
    rect(28, 36, 8, 12, p.shirt),
    // Right arm (front, back, sides, top, bottom) and its sleeve layer.
    rect(40, 16, 16, 16, p.skin),
    rect(44, 20, 4, 12, p.shirt),
    rect(48, 20, 4, 12, p.skinShade),
    rect(40, 20, 4, 12, p.skinShade),
    rect(52, 20, 4, 12, p.skinShade),
    rect(44, 16, 4, 4, p.shirt),
    rect(40, 32, 16, 16, p.shirtShade),
    rect(44, 36, 4, 12, p.skin),
    // Left arm, on the second layer for modern skins.
    rect(32, 48, 16, 16, p.skin),
    rect(36, 52, 4, 12, p.skinShade),
    rect(40, 52, 4, 12, p.shirt),
    rect(44, 52, 4, 12, p.skinShade),
    rect(32, 52, 4, 12, p.skinShade),
    rect(36, 48, 4, 4, p.shirt),
    rect(48, 48, 16, 16, p.shirtShade),
    rect(52, 52, 4, 12, p.skin),
    // Right leg, plus its trouser layer.
    rect(0, 16, 16, 16, p.trousers),
    rect(4, 20, 4, 8, p.trousers),
    rect(8, 20, 4, 4, p.shoes),
    rect(12, 20, 4, 8, p.shirtShade),
    rect(0, 32, 16, 16, p.trousers),
    rect(4, 36, 4, 4, p.shoes),
    rect(8, 36, 4, 8, p.trousers),
    rect(12, 36, 4, 4, p.shoes),
    // Left leg.
    rect(16, 48, 16, 16, p.trousers),
    rect(20, 52, 4, 4, p.shoes),
    rect(24, 52, 4, 8, p.trousers),
    rect(28, 52, 4, 4, p.shoes),
    rect(0, 48, 16, 16, p.trousers),
    rect(4, 52, 4, 4, p.skinShade),
  ].join("");
}

export function fallbackSkin(model: SkinModel): string {
  const palette = model === "slim" ? SLIM : CLASSIC;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" shape-rendering="crispEdges">` +
    body(palette) +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const FALLBACK_LABEL = "Default look";
