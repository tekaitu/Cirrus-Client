import { describe, expect, it } from "vitest";
import { SKIN_PRESETS, presetBase64 } from "../src/core/skinPresets";

describe("Cirrus skin presets", () => {
  it("ships four distinct, original skins", () => {
    expect(SKIN_PRESETS).toHaveLength(4);
    expect(new Set(SKIN_PRESETS.map((p) => p.id)).size).toBe(4);
    expect(new Set(SKIN_PRESETS.map((p) => p.name)).size).toBe(4);
    expect(SKIN_PRESETS.some((p) => p.model === "classic")).toBe(true);
    expect(SKIN_PRESETS.some((p) => p.model === "slim")).toBe(true);
  });

  it("uses real PNG bytes that can be stored and uploaded", () => {
    for (const preset of SKIN_PRESETS) {
      const base64 = presetBase64(preset);
      expect(preset.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
      expect(base64.startsWith("iVBORw0KGgo")).toBe(true);
      // 64 x 64 is the only size Minecraft accepts for a skin.
      expect(base64.length).toBeGreaterThan(300);
    }
  });
});

describe("presetBase64", () => {
  it("returns nothing for a preset that is not shipped", () => {
    expect(presetBase64({ id: "unknown", name: "Unknown", model: "classic", dataUrl: "" })).toBe("");
  });
});
