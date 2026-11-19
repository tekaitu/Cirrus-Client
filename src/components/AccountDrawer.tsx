import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { Account } from "../hooks/useAuth";
import { AccountPanel } from "./AccountPanel";
import { CloseIcon } from "./Icons";
import { OfflineAccount } from "./OfflineAccount";

/**
 * The account panel, on the side of the window. The header chip opens it, and
 * it offers the two ways to play: an offline ("cracked") username, or the
 * Microsoft account that owns Minecraft. A portal keeps the fixed panel above
 * every page and out of the scrolling content.
 */
export function AccountDrawer({
  open,
  account,
  onClose,
  onManage,
}: {
  open: boolean;
  account: Account;
  onClose: () => void;
  /** Goes to the full Accounts page. */
  onManage: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="acct-layer">
      <div className="acct-scrim" role="presentation" onClick={onClose} />
      <aside className="acct-drawer" role="dialog" aria-modal="true" aria-labelledby="acct-title">
        <header className="acct-head">
          <div>
            <p className="eyebrow">Play as</p>
            <h2 id="acct-title">Account</h2>
          </div>
          <button type="button" className="icon-btn" aria-label="Close account panel" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <div className="acct-body">
          <AccountPanel account={account} title="Microsoft account" compact onManage={onManage} />
          <OfflineAccount />
        </div>
      </aside>
    </div>,
    document.body,
  );
}
