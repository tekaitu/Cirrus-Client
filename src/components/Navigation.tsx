import {
  CloseIcon,
  CubeIcon,
  HomeIcon,
  LibraryIcon,
  MaximizeIcon,
  MinimizeIcon,
  ModsIcon,
  NewsIcon,
  PackageIcon,
  ServerIcon,
  SettingsIcon,
  ShirtIcon,
} from "./Icons";
import { LogoMark } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { SkinHead } from "./SkinHead";
import { useCustomFrame, windowActions } from "../core/windowFrame";
import { usePlayAs } from "../hooks/usePlayAs";

export type PageId =
  | "home"
  | "versions"
  | "library"
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
  home: "Play",
  versions: "Add version",
  library: "Instances",
  browse: "Mods",
  mods: "Mods",
  modpacks: "Modpacks",
  skins: "Character",
  servers: "Servers",
  accounts: "Accounts",
  settings: "Settings",
  about: "About",
  diagnostics: "Diagnostics",
};

interface NavItem {
  id: PageId;
  label: string;
  icon: JSX.Element;
  /** Home's news section is reached with this anchor. */
  section?: string;
}

/**
 * The main destinations, in the order the sidebar shows them. Chat and Media
 * have no page or backend in this build, so no placeholder is listed for them.
 */
export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Play", icon: <HomeIcon /> },
  { id: "library", label: "Instances", icon: <LibraryIcon /> },
  { id: "versions", label: "Versions", icon: <CubeIcon /> },
  { id: "servers", label: "Servers", icon: <ServerIcon /> },
  { id: "mods", label: "Mods", icon: <ModsIcon /> },
  { id: "modpacks", label: "Modpacks", icon: <PackageIcon /> },
  { id: "skins", label: "Character", icon: <ShirtIcon /> },
  { id: "home", label: "News", icon: <NewsIcon />, section: "news" },
];

interface SidebarProps {
  page: PageId;
  /** Where inside the page to land; Home's news is the one anchor today. */
  section?: string;
  onNavigate: (page: PageId, section?: string) => void;
}

/**
 * The vertical navigation: the logo, one labelled icon per section, and
 * Settings pinned to the bottom. Each item is a real button with its label as
 * its accessible name; the current page is marked with `aria-current`.
 *
 * Only sections that exist are listed — there is no Chat or Media page, so no
 * placeholder is invented for them.
 */
export function Sidebar({ page, section, onNavigate }: SidebarProps) {
  const isCurrent = (item: NavItem) =>
    item.section ? page === item.id && section === item.section : page === item.id && !section;

  return (
    <aside className="side">
      <button type="button" className="side-brand" onClick={() => onNavigate("home")} aria-label="Maple Client home">
        <LogoMark size={30} />
        <span className="side-brand-name" aria-hidden="true">
          MAPLE
        </span>
      </button>

      <nav aria-label="Main" className="side-nav">
        <ul>
          {NAV_ITEMS.map((item) => {
            const active = isCurrent(item);
            return (
              <li key={`${item.id}-${item.label}`}>
                <button
                  type="button"
                  className={`side-item ${active ? "active" : ""}`}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => onNavigate(item.id, item.section)}
                >
                  <span className="side-marker" aria-hidden="true" />
                  <span className="side-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="side-label">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="side-foot">
          <button
            type="button"
            className={`side-item ${page === "settings" ? "active" : ""}`}
            aria-label="Settings"
            aria-current={page === "settings" ? "page" : undefined}
            onClick={() => onNavigate("settings")}
          >
            <span className="side-marker" aria-hidden="true" />
            <span className="side-icon" aria-hidden="true">
              <SettingsIcon />
            </span>
            <span className="side-label">Settings</span>
          </button>
        </div>
      </nav>
    </aside>
  );
}

interface HeaderProps {
  onAccount: () => void;
  /** Opens the account panel, used when Offline is chosen without a name yet. */
  onOpenAccount: () => void;
  accountOpen: boolean;
  /** The account Minecraft will start as; `offline` names have no Minecraft id or skin. */
  player: { name: string; id: string | null; offline?: boolean } | null;
}

/**
 * The strip above the content: play mode, notifications, the player and (in the
 * desktop app) the window buttons. Navigation lives in the sidebar.
 */
export function Header({ onAccount, onOpenAccount, accountOpen, player }: HeaderProps) {
  const customFrame = useCustomFrame();
  const playAs = usePlayAs();
  const offline = playAs.mode === "offline";

  return (
    <header className="hdr hdr-lite" data-tauri-drag-region>
      <div className="hdr-right" data-tauri-drag-region>
        <div className="mode-switch" role="radiogroup" aria-label="Play mode">
          <button
            type="button"
            role="radio"
            aria-checked={!offline}
            aria-label="Online mode (Microsoft account)"
            data-tip="Online: Microsoft account"
            className={!offline ? "is-on" : ""}
            onClick={() => playAs.useMicrosoft()}
          >
            Online
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={offline}
            aria-label="Offline mode"
            data-tip="Offline: unverified name, no account skin"
            className={offline ? "is-on" : ""}
            onClick={() => {
              playAs.setMode("offline");
              // Without a name the game cannot start, so the account panel opens on the field.
              if (!playAs.name.trim()) onOpenAccount();
            }}
          >
            Offline
          </button>
        </div>
        <NotificationBell />
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
            {player?.offline && <small>Offline</small>}
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

/** Kept for the icon-only navigation inside compact layouts. */
export function CompactNav({ page, onNavigate }: { page: PageId; onNavigate: (page: PageId) => void }) {
  return (
    <nav aria-label="Main compact" className="hdr-tabs">
      <ul>
        {NAV_ITEMS.filter((i) => !i.section).map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`hdr-tab ${page === item.id ? "active" : ""}`}
              aria-label={item.label}
              aria-current={page === item.id ? "page" : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <span className="hdr-tab-icon" aria-hidden="true">
                {item.icon}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
