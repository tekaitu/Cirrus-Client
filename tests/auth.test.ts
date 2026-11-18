import { describe, expect, it } from "vitest";
import { accountFromStatus, formatUuid, isMicrosoftLink, minutesLeft } from "../src/core/auth";
import { CLIENT_ID_PATTERN, hasErrors, validateDraft } from "../src/core/settings";
import type { AuthStatus } from "../src/api/types";
import { settingsState } from "./helpers/fixtures";

const base: AuthStatus = {
  state: "signedOut",
  configured: true,
  savedLogin: false,
  profile: null,
  message: null,
  accounts: [],
  activeId: null,
};

describe("accountFromStatus", () => {
  it("maps every backend state", () => {
    expect(accountFromStatus({ ...base, state: "notConfigured", configured: false }).phase).toBe("notConfigured");
    expect(accountFromStatus(base).phase).toBe("signedOut");
    expect(accountFromStatus({ ...base, state: "cancelled" }).phase).toBe("signedOut");
    const signedIn = accountFromStatus({ ...base, state: "signedIn", profile: { id: "x", name: "Steve" } });
    expect(signedIn).toEqual({
      phase: "signedIn",
      profile: { id: "x", name: "Steve", ownsMinecraft: false },
      note: null,
    });
    const owned = accountFromStatus({
      ...base,
      state: "signedIn",
      profile: { id: "x", name: "Steve", ownsMinecraft: true },
    });
    expect(owned.phase === "signedIn" && owned.profile.ownsMinecraft).toBe(true);
    expect(accountFromStatus({ ...base, state: "failed", message: "boom" })).toEqual({ phase: "error", message: "boom" });
  });

  it("never reports signed-in without a profile", () => {
    expect(accountFromStatus({ ...base, state: "signedIn" }).phase).toBe("error");
  });

  it("gives failures a readable message", () => {
    const s = accountFromStatus({ ...base, state: "failed" });
    expect(s.phase === "error" && s.message.length > 0).toBe(true);
  });
});

describe("helpers", () => {
  it("formats Minecraft ids as UUIDs and leaves other text alone", () => {
    expect(formatUuid("0123456789abcdef0123456789abcdef")).toBe("01234567-89ab-cdef-0123-456789abcdef");
    expect(formatUuid("short")).toBe("short");
  });

  it("accepts only microsoft.com sign-in pages", () => {
    expect(isMicrosoftLink("https://www.microsoft.com/link")).toBe(true);
    expect(isMicrosoftLink("https://login.microsoftonline.com/common/oauth2/deviceauth")).toBe(true);
    for (const bad of [
      "http://www.microsoft.com/link",
      "https://microsoft.com.evil.net/",
      "https://user@www.microsoft.com/",
      "https://www.microsoft.com:444/",
      "javascript:alert(1)",
      "not a url",
    ]) {
      expect(isMicrosoftLink(bad)).toBe(false);
    }
  });

  it("rounds the code lifetime to whole minutes, at least one", () => {
    expect(minutesLeft(900)).toBe(15);
    expect(minutesLeft(10)).toBe(1);
  });
});

describe("client id validation", () => {
  const limits = { min: 1024, max: 13568 };
  const base2 = settingsState().settings;

  it("accepts GUIDs and blank", () => {
    expect(CLIENT_ID_PATTERN.test("12345678-90AB-cdef-1234-567890abcdef")).toBe(true);
    expect(hasErrors(validateDraft({ ...base2, msClientId: "12345678-90ab-cdef-1234-567890abcdef" }, limits))).toBe(false);
    expect(hasErrors(validateDraft({ ...base2, msClientId: "  " }, limits))).toBe(false);
    expect(hasErrors(validateDraft({ ...base2, msClientId: null }, limits))).toBe(false);
  });

  it("rejects anything else", () => {
    expect(validateDraft({ ...base2, msClientId: "hello" }, limits).msClientId).toContain("Application (client) ID");
  });
});
