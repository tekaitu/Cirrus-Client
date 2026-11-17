import { describe, expect, it } from "vitest";
import { capeOptions, capeTexture } from "../src/core/capes";

describe("cape options", () => {
  it("only offers the account cape when the account owns one", () => {
    expect(capeOptions(false).map((o) => o.id)).toEqual(["cirrus", "none"]);
    expect(capeOptions(true).map((o) => o.id)).toEqual(["account", "cirrus", "none"]);
  });

  it("is honest about which choices change the Minecraft account", () => {
    expect(capeOptions(true).find((o) => o.id === "account")?.localOnly).toBe(false);
    expect(capeOptions(true).find((o) => o.id === "cirrus")?.localOnly).toBe(true);
    expect(capeOptions(true).find((o) => o.id === "none")?.localOnly).toBe(true);
  });

  it("resolves textures and never invents one", () => {
    expect(capeTexture("account", "account-cape", "cirrus-cape")).toBe("account-cape");
    expect(capeTexture("account", null, "cirrus-cape")).toBeNull();
    expect(capeTexture("cirrus", null, "cirrus-cape")).toBe("cirrus-cape");
    expect(capeTexture("none", "account-cape", "cirrus-cape")).toBeNull();
  });
});
