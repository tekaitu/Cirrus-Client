import type { AuthProfile, AuthStatus, DeviceCodeInfo } from "../api/types";

export type AccountState =
  | { phase: "checking" }
  | { phase: "notConfigured" }
  | { phase: "signedOut"; message: string | null }
  | { phase: "starting" }
  | { phase: "waiting"; code: DeviceCodeInfo }
  | { phase: "signedIn"; profile: AuthProfile; note: string | null }
  | { phase: "error"; message: string };

/** Map the backend's answer to what the Account panel shows. */
export function accountFromStatus(s: AuthStatus): AccountState {
  switch (s.state) {
    case "notConfigured":
      return { phase: "notConfigured" };
    case "signedIn":
      return s.profile
        ? { phase: "signedIn", profile: s.profile, note: s.message }
        : { phase: "error", message: "Signed in, but no profile was returned." };
    case "failed":
      return { phase: "error", message: s.message ?? "Sign-in failed." };
    default:
      // signedOut and cancelled
      return { phase: "signedOut", message: s.message };
  }
}

/** "0123456789abcdef0123456789abcdef" -> "01234567-89ab-cdef-0123-456789abcdef" */
export function formatUuid(id: string): string {
  if (!/^[0-9a-fA-F]{32}$/.test(id)) return id;
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

/** Only real Microsoft pages are offered as clickable sign-in links. */
export function isMicrosoftLink(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      u.port === "" &&
      u.username === "" &&
      ["microsoft.com", "www.microsoft.com", "login.microsoftonline.com", "login.live.com", "aka.ms"].includes(
        u.hostname.toLowerCase(),
      )
    );
  } catch {
    return false;
  }
}

export function minutesLeft(expiresInSeconds: number): number {
  return Math.max(1, Math.round(expiresInSeconds / 60));
}
