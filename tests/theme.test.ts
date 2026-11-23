// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_THEME, THEMES, WELCOME_THEMES, getTheme, hasThemeChoice, initTheme, setTheme } from "../src/core/theme";
import { getNativeFrame, insideTauri, setNativeFrame } from "../src/core/windowFrame";

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("appearance", () => {
  it("offers Classic first, then Colorful, and keeps Light for existing users", () => {
    expect(WELCOME_THEMES.map((t) => t.id)).toEqual(["classic", "colorful"]);
    expect(THEMES.map((t) => t.id)).toEqual(["classic", "colorful", "light"]);
    expect(DEFAULT_THEME).toBe("classic");
  });

  it("starts classic, applies a choice and remembers it", () => {
    expect(hasThemeChoice()).toBe(false);
    expect(getTheme()).toBe("classic");
    setTheme("colorful");
    expect(document.documentElement.dataset.theme).toBe("colorful");
    expect(window.localStorage.getItem("unlimited.theme")).toBe("colorful");
    expect(hasThemeChoice()).toBe(true);
    document.documentElement.dataset.theme = "classic";
    initTheme();
    expect(document.documentElement.dataset.theme).toBe("colorful");
  });

  it("keeps Light selectable and treats it as a light colour scheme", () => {
    setTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    setTheme("classic");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("ignores names of the looks that were removed", () => {
    for (const old of ["ocean", "sunset", "forest", "midnight", ""]) {
      window.localStorage.setItem("unlimited.theme", old);
      expect(getTheme()).toBe("classic");
    }
    window.localStorage.setItem("unlimited.theme", "dark");
    expect(getTheme()).toBe("classic");
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

  it("only reports a custom frame inside the desktop app", () => {
    expect(insideTauri()).toBe(false);
  });
});
