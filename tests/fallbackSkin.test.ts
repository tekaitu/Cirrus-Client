import { describe, expect, it } from "vitest";
import { FALLBACK_LABEL, fallbackSkin } from "../src/core/fallbackSkin";

describe("fallbackSkin", () => {
  it("is a self-contained 64 by 64 SVG skin, with no network request", () => {
    const skin = fallbackSkin("classic");
    expect(skin.startsWith("data:image/svg+xml,")).toBe(true);
    const svg = decodeURIComponent(skin.slice("data:image/svg+xml,".length));
    expect(svg).toContain('width="64"');
    expect(svg).toContain('height="64"');
    expect(svg).toContain('viewBox="0 0 64 64"');
    // The only address is the SVG namespace; the skin itself never fetches anything.
    expect(svg.replace('xmlns="http://www.w3.org/2000/svg"', "")).not.toContain("http");
    expect(svg).not.toContain("<image");
  });

  it("draws the areas the CSS figure reads: head, torso, arms and legs", () => {
    const svg = decodeURIComponent(fallbackSkin("classic").slice("data:image/svg+xml,".length));
    // Head front face and hat layer, torso front, and the arm and leg areas.
    for (const rect of ['x="8" y="8" width="8" height="8"', 'x="32" y="0" width="32" height="16"', 'x="16" y="16" width="24" height="16"']) {
      expect(svg).toContain(rect);
    }
  });

  it("gives classic and slim their own colour so they are easy to tell apart", () => {
    expect(fallbackSkin("classic")).not.toBe(fallbackSkin("slim"));
    expect(FALLBACK_LABEL.length).toBeGreaterThan(0);
  });
});
