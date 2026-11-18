import { afterEach, describe, expect, it } from "vitest";
import {
  dismissToast,
  getNotifications,
  getToasts,
  notify,
  resetNotifications,
  resetToasts,
} from "../src/core/notifications";

afterEach(() => resetNotifications());

describe("toasts", () => {
  it("start empty and follow a notification", () => {
    expect(getToasts()).toEqual([]);
    notify({ title: "Game files are ready", body: "Minecraft 1.21.11", tone: "good" });
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]).toMatchObject({ title: "Game files are ready", tone: "good" });
    // The bell keeps the same message as its permanent record.
    expect(getNotifications()[0]?.title).toBe("Game files are ready");
  });

  it("keeps only the three newest and can be dismissed", () => {
    for (const title of ["one", "two", "three", "four"]) notify({ title });
    expect(getToasts().map((t) => t.title)).toEqual(["four", "three", "two"]);
    const id = getToasts()[0]!.id;
    dismissToast(id);
    expect(getToasts().some((t) => t.id === id)).toBe(false);
  });

  it("is cleared together with the notifications", () => {
    notify({ title: "Download failed", tone: "bad" });
    resetNotifications();
    expect(getToasts()).toEqual([]);
    resetToasts();
    expect(getToasts()).toEqual([]);
  });
});
