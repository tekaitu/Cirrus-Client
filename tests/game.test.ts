import { describe, expect, it } from "vitest";
import { exitText, gameProgressView, usernameError } from "../src/core/game";

describe("usernameError", () => {
  it("accepts what Minecraft accepts", () => {
    for (const ok of ["Steve", "abc", "a_b_1234567890ab", "UPPER_lower_09"]) expect(usernameError(ok)).toBeNull();
  });
  it("explains what is wrong", () => {
    expect(usernameError("")).toMatch(/Choose/);
    expect(usernameError("ab")).toMatch(/3 to 16/);
    expect(usernameError("x".repeat(17))).toMatch(/3 to 16/);
    expect(usernameError("bad name")).toMatch(/letters, numbers/);
    expect(usernameError("naïve")).toMatch(/letters, numbers/);
  });
});

describe("gameProgressView", () => {
  it("shows a percentage while downloading", () => {
    expect(gameProgressView({ stage: "downloading", done: 1, total: 4, message: "x" })).toEqual({ label: "x", percent: 25 });
  });
  it("has no percentage for lookups or before the first event", () => {
    expect(gameProgressView(null).percent).toBeNull();
    expect(gameProgressView({ stage: "metadata", done: 0, total: 0, message: "Looking up Fabric…" })).toEqual({
      label: "Looking up Fabric…",
      percent: null,
    });
  });
});

describe("exitText", () => {
  it("separates a normal close, a stop and a crash", () => {
    expect(exitText(0)).toMatch(/normally/);
    expect(exitText(null)).toMatch(/stopped/);
    expect(exitText(1)).toMatch(/code 1/);
  });
});
