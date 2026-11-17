import { useEffect, useRef, useState } from "react";
import { clearNotifications, markAllRead, useNotifications } from "../core/notifications";
import { formatAgo } from "../core/recent";
import { BellIcon } from "./Icons";

/** The bell in the top bar: a dot when there is something new, a list of what happened when opened. */
export function NotificationBell() {
  const items = useNotifications();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const unread = items.filter((i) => !i.read).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    setOpen((o) => {
      if (o) markAllRead();
      return !o;
    });
  };

  return (
    <div className="bell" ref={root}>
      <button
        type="button"
        className={`hdr-tool ${open ? "active" : ""}`}
        aria-label={unread > 0 ? `Notifications, ${unread} new` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-tip="Notifications"
        onClick={toggle}
      >
        <BellIcon />
        {unread > 0 && <span className="bell-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Notifications">
          <div className="bell-head">
            <strong>Notifications</strong>
            {items.length > 0 && (
              <button type="button" className="link-inline" onClick={clearNotifications}>
                Clear all
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="bell-empty">You&apos;re all caught up.</p>
          ) : (
            <ul className="bell-list">
              {items.map((n) => (
                <li key={n.id} className={`bell-item bell-${n.tone}`}>
                  <span className="bell-tone" aria-hidden="true" />
                  <div>
                    <p className="bell-title">{n.title}</p>
                    {n.body && <p className="bell-body">{n.body}</p>}
                    <p className="bell-time">{formatAgo(n.at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
