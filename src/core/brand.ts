/** The launcher's identity, in one place. */

export const APP_NAME = "Maple Client";
/** Kept from the Maple build so the updater and saved preferences still line up. */
export const LEGACY_NAME = "Maple Client";
export const BRAND_COLOR = "#e25303";

export const MAPLE_ABOUT = {
  /** Shown in About and Settings: what updates look like today, honestly. */
  updateSummary:
    "Maple checks a signed release feed over HTTPS and only offers a strictly newer version. " +
    "There is no GitHub page to visit: this build reports when an update exists, and installing it " +
    "waits until the signed release feed is configured.",
};
