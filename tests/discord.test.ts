import { describe, expect, it } from "vitest";
import { presenceFor } from "../src/core/discord";

describe("Discord presence text", () => {
  it("shows the game, version and loader while Minecraft is running", () => {
    expect(presenceFor({ page: "home", running: true, version: "1.21.11", loader: "fabric", startedAt: 100 })).toEqual({
      details: "Playing Minecraft 1.21.11",
      state: "Fabric",
      startedAt: 100,
    });
    expect(presenceFor({ page: "versions", running: true, version: "1.21.11", loader: "vanilla", startedAt: 5 }).state).toBe("Vanilla");
  });

  it("describes the page when the game is not running", () => {
    expect(presenceFor({ page: "browse", running: false, version: "1.21.11", loader: "fabric", startedAt: 7 })).toEqual({
      details: "Browsing mods",
      state: "Maple Client launcher",
      startedAt: 7,
    });
  });
});
