import {
  CloseIcon,
  CompassIcon,
  CubeIcon,
  HomeIcon,
  MaximizeIcon,
  MinimizeIcon,
  ModsIcon,
  PackageIcon,
  ServerIcon,
  SettingsIcon,
  ShirtIcon,
} from "./Icons";
import { LogoMark } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { SkinHead } from "./SkinHead";
import { useCustomFrame, windowActions } from "../core/windowFrame";
import { useRef } from "react";

export type PageId =
  | "home"
  | "versions"
  | "browse"
  | "mods"
  | "modpacks"
  | "skins"
  | "servers"
  | "accounts"
  | "settings"
  | "about"
  | "diagnostics";

export const PAGE_TITLES: Record<PageId, string> = {
  home: "Home",
  versions: "Versions",
  browse: "Browse",
  mods: "Mods",
  modpacks: "Modpacks",
  skins: "Character",
  servers: "Servers",
  accounts: "Accounts",
  settings: "Settings",
  about: "About",
  diagnostics: "Diagnostics",
};

interface Item {
  id: PageId;
  icon: JSX.Element;
}

const TABS: Item[] = [
  { id: "home", icon: <HomeIcon /> },
  { id: "versions", icon: <CubeIcon /> },
  { id: "browse", icon: <CompassIcon /> },
  { id: "mods", icon: <ModsIcon /> },
  { id: "modpacks", icon: <PackageIcon /> },
  { id: "skins", icon: <ShirtIcon /> },
  { id: "servers", icon: <ServerIcon /> },
];

interface Props {
  page: PageId;
  onNavigate: (page: PageId) => void;
  onAccount: () => void;
  accountOpen: boolean;
  player: { name: string; id: string } | null;
}

/**
 * The top bar: brand, page icons, notifications, settings, the player and (in
 * the desktop app) the window buttons.
 *
 * Each page is one recognizable icon with the page name as its tooltip and its
 * accessible name, so the bar stays compact without losing any destination.
 * Tab reaches the row, the arrow keys move between icons, and Enter or Space
 * opens the page; the current page is marked with `aria-current` and a visible
 * selected tile.
 */
export function TopNav({ page, onNavigate, onAccount, accountOpen, player }: Props) {
  const customFrame = useCustomFrame();
  const tabsRef = useRef<HTMLUListElement>(null);

  const moveFocus = (event: React.KeyboardEvent<HTMLUListElement>) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const buttons = Array.from(tabsRef.current?.querySelectorAll<HTMLButtonElement>("button.hdr-tab") ?? []);
    const from = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (from === -1) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (from + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return (
    <header className="hdr" data-tauri-drag-region>
      <button type="button" className="hdr-brand" data-tauri-drag-region onClick={() => onNavigate("home")} aria-label="Cirrus Client home">
        <LogoMark size={30} />
        <span className="hdr-brand-name" aria-hidden="true">
          CIRRUS
        </span>
      </button>

      <nav aria-label="Main" className="hdr-tabs" data-tauri-drag-region>
        <ul ref={tabsRef} role="list" onKeyDown={moveFocus}>
          {TABS.map((item) => {
            const active = page === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`hdr-tab ${active ? "active" : ""}`}
                  aria-label={PAGE_TITLES[item.id]}
                  data-tip={PAGE_TITLES[item.id]}
                  aria-current={active ? "page" : undefined}
                  onClick={() => onNavigate(item.id)}
                >
                  <span className="hdr-tab-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="hdr-right" data-tauri-drag-region>
        <NotificationBell />
        <button
          type="button"
          className={`hdr-tool ${page === "settings" ? "active" : ""}`}
          aria-label="Settings"
          aria-current={page === "settings" ? "page" : undefined}
          data-tip="Settings"
          onClick={() => onNavigate("settings")}
        >
          <SettingsIcon />
        </button>

        <button
          type="button"
          className="hdr-account"
          aria-label="Account"
          aria-expanded={accountOpen}
          aria-haspopup="dialog"
          onClick={onAccount}
        >
          <SkinHead uuid={player?.id ?? null} name={player?.name ?? null} size={30} />
          <span className="hdr-account-text">
            <strong>{player ? player.name : "Sign in"}</strong>
          </span>
        </button>

        {customFrame && (
          <div className="hdr-win" role="group" aria-label="Window">
            <button type="button" aria-label="Minimize window" onClick={windowActions.minimize}>
              <MinimizeIcon />
            </button>
            <button type="button" aria-label="Maximize or restore window" onClick={windowActions.toggleMaximize}>
              <MaximizeIcon />
            </button>
            <button type="button" className="hdr-win-close" aria-label="Close window" onClick={windowActions.close}>
              <CloseIcon />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
