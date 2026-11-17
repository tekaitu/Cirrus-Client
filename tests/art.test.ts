import { describe, expect, it } from "vitest";
import { cardArt, seedFrom } from "../src/core/art";

describe("cardArt", () => {
  it("gives the same version the same picture and crop every time", () => {
    expect(cardArt("1.21.11")).toEqual(cardArt("1.21.11"));
    expect(seedFrom("a")).toBe(seedFrom("a"));
  });

  it("keeps the crop and zoom in a sensible range", () => {
    for (const v of ["1.21.11", "1.21.1", "1.20.6", "1.8.9", "26.1"]) {
      const a = cardArt(v);
      expect(a.zoom).toBeGreaterThanOrEqual(1.15);
      expect(a.zoom).toBeLessThan(1.45);
      expect(a.src).toBeTruthy();
    }
  });
});
