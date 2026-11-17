import { afterEach, describe, expect, it } from "vitest";
import { clearNotifications, getNotifications, markAllRead, notify, resetNotifications, unreadCount } from "../src/core/notifications";

afterEach(() => resetNotifications());

describe("notifications", () => {
  it("starts empty", () => {
    expect(getNotifications()).toEqual([]);
    expect(unreadCount()).toBe(0);
  });

  it("adds newest first and counts unread", () => {
    notify({ title: "One" });
    notify({ title: "Two", tone: "good" });
    expect(getNotifications().map((n) => n.title)).toEqual(["Two", "One"]);
    expect(unreadCount()).toBe(2);
    markAllRead();
    expect(unreadCount()).toBe(0);
    expect(getNotifications()).toHaveLength(2);
  });

  it("keeps only the latest 30 and can be cleared", () => {
    for (let i = 0; i < 40; i++) notify({ title: `n${i}` });
    expect(getNotifications()).toHaveLength(30);
    expect(getNotifications()[0]?.title).toBe("n39");
    clearNotifications();
    expect(getNotifications()).toEqual([]);
  });
});
