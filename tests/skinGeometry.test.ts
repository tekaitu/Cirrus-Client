import { describe, expect, it } from "vitest";
import {
  FACE_SHADE,
  FIGURE_HEIGHT,
  OUTER_GROW,
  armWidth,
  faceRect,
  partSize,
  skinParts,
} from "../src/core/skinGeometry";

describe("skin geometry", () => {
  it("gives a slim model narrower arms than a classic one", () => {
    expect(armWidth("classic")).toBe(4);
    expect(armWidth("slim")).toBe(3);
    const classic = skinParts("classic", false).find((p) => p.id === "right-arm:base");
    const slim = skinParts("slim", false).find((p) => p.id === "right-arm:base");
    expect(classic?.w).toBe(4);
    expect(slim?.w).toBe(3);
    // A slim arm is also one pixel closer to the body.
    expect(slim!.x).toBeGreaterThan(classic!.x);
  });

  it("builds six body parts and a second layer for each of them", () => {
    const parts = skinParts("classic", false);
    expect(parts.filter((p) => p.layer === "base")).toHaveLength(6);
    expect(parts.filter((p) => p.layer === "outer")).toHaveLength(6);
    for (const base of parts.filter((p) => p.layer === "base")) {
      const outer = parts.find((p) => p.id === `${base.id.split(":")[0]}:outer`);
      expect(outer, `outer layer for ${base.id}`).toBeDefined();
      expect(outer!.grow).toBe(OUTER_GROW);
      // The outer layer is the same box, only bigger, so it sits exactly over it.
      expect([outer!.x, outer!.y, outer!.z]).toEqual([base.x, base.y, base.z]);
    }
  });

  it("keeps the modern layout in a 64 x 32 skin but only a hat on top", () => {
    const legacy = skinParts("classic", true);
    expect(legacy.filter((p) => p.layer === "base")).toHaveLength(6);
    const outer = legacy.filter((p) => p.layer === "outer");
    expect(outer.map((p) => p.id)).toEqual(["head:outer"]);
    // One arm and one leg share the pixels of the other side.
    const rightArm = legacy.find((p) => p.id === "right-arm:base")!;
    const leftArm = legacy.find((p) => p.id === "left-arm:base")!;
    expect(leftArm.u).toBe(rightArm.u);
    expect(leftArm.v).toBe(rightArm.v);
  });

  it("puts every body part where a Minecraft player has it", () => {
    const part = (id: string) => skinParts("classic", false).find((p) => p.id === id)!;
    expect(part("head:base")).toMatchObject({ w: 8, h: 8, d: 8, y: -12 });
    expect(part("body:base")).toMatchObject({ w: 8, h: 12, d: 4, y: -2 });
    expect(part("right-leg:base")).toMatchObject({ w: 4, h: 12, d: 4, x: -2, y: 10 });
    expect(part("left-leg:base")).toMatchObject({ x: 2, y: 10 });
    expect(FIGURES_FIT()).toBe(true);
    function FIGURES_FIT() {
      // The head starts at -16 and the feet end at 16, which is FIGURE_HEIGHT tall.
      return part("head:base").y - part("head:base").h / 2 === -FIGURE_HEIGHT / 2;
    }
  });

  it("maps each face to the right pixels of the skin", () => {
    const head = skinParts("classic", false).find((p) => p.id === "head:base")!;
    expect(faceRect(head, "front")).toEqual({ u: 8, v: 8, w: 8, h: 8 });
    expect(faceRect(head, "back")).toEqual({ u: 24, v: 8, w: 8, h: 8 });
    expect(faceRect(head, "right")).toEqual({ u: 0, v: 8, w: 8, h: 8 });
    expect(faceRect(head, "left")).toEqual({ u: 16, v: 8, w: 8, h: 8 });
    expect(faceRect(head, "top")).toEqual({ u: 8, v: 0, w: 8, h: 8 });
    expect(faceRect(head, "bottom")).toEqual({ u: 16, v: 0, w: 8, h: 8 });
  });

  it("sizes an outer box half a pixel wider on every side", () => {
    const head = skinParts("classic", false).find((p) => p.id === "head:outer")!;
    expect(partSize(head)).toEqual({ w: 8.5, h: 8.5, d: 8.5 });
    const body = skinParts("classic", false).find((p) => p.id === "body:base")!;
    expect(partSize(body)).toEqual({ w: 8, h: 12, d: 4 });
  });

  it("lights the front brightest and the bottom darkest", () => {
    expect(FACE_SHADE.front).toBeLessThan(FACE_SHADE.right);
    expect(FACE_SHADE.right).toBeLessThan(FACE_SHADE.back);
    expect(FACE_SHADE.bottom).toBeGreaterThan(FACE_SHADE.back);
    expect(FACE_SHADE.top).toBeLessThan(0);
  });
});
