/** Whether Maple looks for a newer official release on start-up. On unless switched off. */

const KEY = "unlimited.updates.auto";

export function readAutoUpdateCheck(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeAutoUpdateCheck(enabled: boolean) {
  try {
    window.localStorage.setItem(KEY, enabled ? "on" : "off");
  } catch {
    /* a preference that cannot be stored still applies for this session */
  }
}
