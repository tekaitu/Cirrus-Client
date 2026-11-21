import type { SkinModel } from "../api/types";

/**
 * The boxes a Minecraft player model is made of, and where each one's pixels
 * live in the 64 × 64 skin.
 *
 * Positions are in skin pixels and measured from the middle of the figure, with
 * y growing downwards, so the head sits at -12 and the legs at +10. A 64 × 32
 * ("legacy") skin has one arm and one leg, and no second layer except the hat.
 */
export interface SkinPart {
  /** Stable name, used as the React key and to tell base from outer boxes. */
  id: string;
  /** "base" is the skin itself, "outer" the jacket, sleeves, trousers and hat. */
  layer: "base" | "outer";
  /** Where this box's texture starts in the skin picture. */
  u: number;
  v: number;
  /** Box size in skin pixels (the texture is laid out around these). */
  w: number;
  h: number;
  d: number;
  /** Centre of the box, from the middle of the figure. */
  x: number;
  y: number;
  z: number;
  /** How much bigger than the base box the outer layer is (0 for the base layer). */
  grow: number;
}

/** A slim (Alex) arm is 3 pixels wide; a classic (Steve) arm is 4. */
export function armWidth(model: SkinModel): number {
  return model === "slim" ? 3 : 4;
}

/** The height of the figure in skin pixels, used to keep it centred in its stage. */
export const FIGURE_HEIGHT = 32;

/** How much bigger an outer layer box is than the body underneath it (0.25 per side). */
export const OUTER_GROW = 0.5;

export function skinParts(model: SkinModel, legacy: boolean): SkinPart[] {
  const aw = armWidth(model);
  const head = { w: 8, h: 8, d: 8, x: 0, y: -12, z: 0 };
  const body = { w: 8, h: 12, d: 4, x: 0, y: -2, z: 0 };
  const rightArm = { w: aw, h: 12, d: 4, x: -(4 + aw / 2), y: -2, z: 0 };
  const leftArm = { w: aw, h: 12, d: 4, x: 4 + aw / 2, y: -2, z: 0 };
  const rightLeg = { w: 4, h: 12, d: 4, x: -2, y: 10, z: 0 };
  const leftLeg = { w: 4, h: 12, d: 4, x: 2, y: 10, z: 0 };
  const base = (id: string, box: Omit<SkinPart, "id" | "layer" | "grow" | "u" | "v">, u: number, v: number): SkinPart => ({
    id: `${id}:base`,
    layer: "base",
    u,
    v,
    ...box,
    grow: 0,
  });
  const outer = (id: string, box: Omit<SkinPart, "id" | "layer" | "grow" | "u" | "v">, u: number, v: number): SkinPart => ({
    id: `${id}:outer`,
    layer: "outer",
    u,
    v,
    ...box,
    grow: OUTER_GROW,
  });

  const parts: SkinPart[] = [
    base("right-leg", rightLeg, 0, 16),
    base("left-leg", leftLeg, legacy ? 0 : 16, legacy ? 16 : 48),
    base("body", body, 16, 16),
    base("right-arm", rightArm, 40, 16),
    base("left-arm", leftArm, legacy ? 40 : 32, legacy ? 16 : 48),
    base("head", head, 0, 0),
  ];

  // The hat layer exists in both layouts; the jacket, sleeves and trousers only
  // in the modern 64 × 64 one.
  parts.push(outer("head", head, 32, 0));
  if (!legacy) {
    parts.push(
      outer("right-leg", rightLeg, 0, 32),
      outer("left-leg", leftLeg, 0, 48),
      outer("body", body, 16, 32),
      outer("right-arm", rightArm, 40, 32),
      outer("left-arm", leftArm, 48, 48),
    );
  }
  return parts;
}

/** The outer layer is drawn slightly in front of the base layer, never through it. */
export function partDepth(part: SkinPart): number {
  return part.layer === "outer" ? 0.5 : 0;
}

/** How much darker a side of a box is, as it turns away from the light. */
export const FACE_SHADE: Record<string, number> = {
  front: 0,
  right: 0.14,
  left: 0.2,
  back: 0.34,
  top: -0.07,
  bottom: 0.42,
};

/** Where a face's pixels start, and how big the face is, in skin pixels. */
export function faceRect(part: SkinPart, face: "front" | "back" | "right" | "left" | "top" | "bottom"): {
  u: number;
  v: number;
  w: number;
  h: number;
} {
  const { u, v, w, h, d } = part;
  switch (face) {
    case "front":
      return { u: u + d, v: v + d, w, h };
    case "back":
      return { u: u + 2 * d + w, v: v + d, w, h };
    case "right":
      return { u, v: v + d, w: d, h };
    case "left":
      return { u: u + d + w, v: v + d, w: d, h };
    case "top":
      return { u: u + d, v, w, h: d };
    case "bottom":
      return { u: u + d + w, v, w, h: d };
  }
}

/** The three sizes of a box, with its outer layer included. */
export function partSize(part: SkinPart): { w: number; h: number; d: number } {
  return {
    w: part.w + part.grow,
    h: part.h + part.grow,
    d: part.d + part.grow,
  };
}
