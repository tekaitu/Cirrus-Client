// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { readAutoUpdateCheck, writeAutoUpdateCheck } from "../src/core/updates";

beforeEach(() => {
  window.localStorage.clear();
});

describe("launcher update checks", () => {
  it("checks on start-up unless the player switches it off", () => {
    expect(readAutoUpdateCheck()).toBe(true);
    writeAutoUpdateCheck(false);
    expect(readAutoUpdateCheck()).toBe(false);
    expect(window.localStorage.getItem("unlimited.updates.auto")).toBe("off");
    writeAutoUpdateCheck(true);
    expect(readAutoUpdateCheck()).toBe(true);
  });

  it("still checks when the preference cannot be read", () => {
    window.localStorage.setItem("unlimited.updates.auto", "nonsense");
    expect(readAutoUpdateCheck()).toBe(true);
  });
});
