/**
 * Capes the character preview can show.
 *
 * Only two kinds exist, and they are deliberately different:
 * - "account": the cape the Minecraft account already owns and has equipped.
 *   Cirrus reads it from the account's profile; it cannot change it.
 * - "cirrus": an original Cirrus cosmetic, drawn locally. It is a preview only
 *   and never claims to equip anything on the Minecraft account.
 *
 * Future Cirrus cosmetics are added here as new ids; the viewer takes any
 * texture, so nothing else has to change.
 */

export type CapeId = "none" | "account" | "cirrus";

export interface CapeOption {
  id: CapeId;
  label: string;
  detail: string;
  /** True when choosing it does not touch the Minecraft account. */
  localOnly: boolean;
}

/** The options to offer for this account. "account" only appears when one exists. */
export function capeOptions(hasAccountCape: boolean): CapeOption[] {
  const options: CapeOption[] = [];
  if (hasAccountCape) {
    options.push({ id: "account", label: "Your Minecraft cape", detail: "From your account", localOnly: false });
  }
  options.push({ id: "cirrus", label: "Cirrus Cloud", detail: "Local preview only", localOnly: true });
  options.push({ id: "none", label: "No cape", detail: "Bare shoulders", localOnly: true });
  return options;
}

/** The texture to draw for a choice, or null for bare shoulders. */
export function capeTexture(choice: CapeId, accountCape: string | null, cirrusCape: string): string | null {
  if (choice === "account") return accountCape;
  if (choice === "cirrus") return cirrusCape;
  return null;
}
