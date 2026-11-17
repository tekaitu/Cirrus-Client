import { describe, expect, it } from "vitest";
import {
  clampMemory,
  hasErrors,
  normalizeDraft,
  settingsEqual,
  validateDraft,
} from "../src/core/settings";
import { settingsState } from "./helpers/fixtures";

const limits = { min: 1024, max: 13568 };
const base = settingsState().settings;

describe("validateDraft", () => {
  it("accepts the default-looking settings", () => {
    expect(hasErrors(validateDraft(base, limits))).toBe(false);
  });

  it("rejects memory below the minimum and above the maximum", () => {
    expect(validateDraft({ ...base, memoryMb: 512 }, limits).memoryMb).toContain("at least 1024");
    expect(validateDraft({ ...base, memoryMb: 20000 }, limits).memoryMb).toContain("13568");
  });

  it("rejects a blank or non-numeric memory value", () => {
    expect(validateDraft({ ...base, memoryMb: Number.NaN }, limits).memoryMb).toBeDefined();
  });

  it("checks the game window size", () => {
    expect(validateDraft({ ...base, windowWidth: 320 }, limits).windowWidth).toContain("between 640");
    expect(validateDraft({ ...base, windowWidth: 9000 }, limits).windowWidth).toBeDefined();
    expect(validateDraft({ ...base, windowHeight: 200 }, limits).windowHeight).toContain("between 480");
    expect(validateDraft({ ...base, windowWidth: 1600, windowHeight: 900 }, limits)).toEqual({});
  });

  it("limits extra JVM options but keeps ordinary ones", () => {
    expect(validateDraft({ ...base, jvmArgs: "-XX:+UseG1GC" }, limits)).toEqual({});
    expect(validateDraft({ ...base, jvmArgs: "x".repeat(2001) }, limits).jvmArgs).toContain("2000");
  });

  it("requires an absolute game directory", () => {
    expect(validateDraft({ ...base, gameDir: "" }, limits).gameDir).toContain("required");
    expect(validateDraft({ ...base, gameDir: "games\\mc" }, limits).gameDir).toContain("full path");
    expect(validateDraft({ ...base, gameDir: "D:/Games/mc" }, limits).gameDir).toBeUndefined();
    expect(validateDraft({ ...base, gameDir: "\\\\server\\share\\mc" }, limits).gameDir).toBeUndefined();
  });
});

describe("normalizeDraft / settingsEqual", () => {
  it("turns a blank Java path into null and trims text", () => {
    const n = normalizeDraft({ ...base, javaPath: "   ", gameDir: "  C:\\mc  " });
    expect(n.javaPath).toBeNull();
    expect(n.gameDir).toBe("C:\\mc");
  });

  it("keeps a real Java path, trimmed", () => {
    expect(normalizeDraft({ ...base, javaPath: "  C:\\j\\java.exe " }).javaPath).toBe("C:\\j\\java.exe");
  });

  it("compares the editable fields", () => {
    expect(settingsEqual(base, { ...base })).toBe(true);
    expect(settingsEqual(base, { ...base, memoryMb: 2048 })).toBe(false);
    expect(settingsEqual(base, { ...base, reduceMotion: true })).toBe(false);
    expect(settingsEqual(base, { ...base, javaPath: "x" })).toBe(false);
    expect(settingsEqual(base, { ...base, windowWidth: 1920 })).toBe(false);
    expect(settingsEqual(base, { ...base, jvmArgs: "-XX:+UseG1GC" })).toBe(false);
  });

  it("trims the extra JVM options", () => {
    expect(normalizeDraft({ ...base, jvmArgs: "  -XX:+UseG1GC " }).jvmArgs).toBe("-XX:+UseG1GC");
  });
});

describe("clampMemory", () => {
  it("keeps values inside the limits", () => {
    expect(clampMemory(10, limits)).toBe(1024);
    expect(clampMemory(99999, limits)).toBe(13568);
    expect(clampMemory(4096.4, limits)).toBe(4096);
    expect(clampMemory(Number.NaN, limits)).toBe(1024);
  });
});
