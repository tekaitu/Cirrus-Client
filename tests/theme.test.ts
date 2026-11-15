import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_THEME, THEMES, getTheme, initTheme, setTheme } from "../src/core/theme";
import { getNativeFrame, insideTauri, setNativeFrame } from "../src/core/windowFrame";

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("appearance", () => {
  it("has exactly two looks, dark first", () => {
    expect(THEMES.map((t) => t.id)).toEqual(["dark", "light"]);
    expect(DEFAULT_THEME).toBe("dark");
  });

  it("starts dark, applies a choice and remembers it", () => {
    expect(getTheme()).toBe("dark");
    setTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("unlimited.theme")).toBe("light");
    document.documentElement.dataset.theme = "dark";
    initTheme();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("ignores names of the looks that were removed", () => {
    for (const old of ["ocean", "sunset", "forest", "midnight", ""]) {
      window.localStorage.setItem("unlimited.theme", old);
      expect(getTheme()).toBe("dark");
    }
  });
});

describe("window frame choice", () => {
  it("is off by default and remembered", () => {
    expect(getNativeFrame()).toBe(false);
    setNativeFrame(true);
    expect(getNativeFrame()).toBe(true);
    setNativeFrame(false);
    expect(getNativeFrame()).toBe(false);
  });

  it("knows it is not running inside the desktop app during tests", () => {
    expect(insideTauri()).toBe(false);
  });
});
