import { describe, expect, it } from "vitest";
import { MAX_LOG_CHARS, appendLog, exitText, gameProgressView, reportText, usernameError } from "../src/core/game";

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

describe("exitText when the person stopped the game", () => {
  it("never calls a stop a crash", () => {
    expect(exitText(1, true)).toBe("You stopped Minecraft.");
    expect(exitText(0, true)).toMatch(/stopped/);
    expect(exitText(137, false)).toMatch(/code 137/);
  });
});

describe("the launch log text", () => {
  it("is appended and kept to a sensible size, dropping the oldest lines first", () => {
    expect(appendLog("a\n", "b\n")).toBe("a\nb\n");
    const big = appendLog("x".repeat(MAX_LOG_CHARS), "tail\n");
    expect(big.length).toBeLessThanOrEqual(MAX_LOG_CHARS + 20);
    expect(big.endsWith("tail\n")).toBe(true);
  });
  it("is copied with a header line", () => {
    const text = reportText("Cirrus Client · Minecraft 1.21.11", "line 1\nline 2");
    expect(text.startsWith("Cirrus Client · Minecraft 1.21.11")).toBe(true);
    expect(text).toContain("line 2");
  });
});
