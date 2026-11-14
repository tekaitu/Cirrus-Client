import {
  DiagnosticsIcon,
  HomeIcon,
  InfoIcon,
  ModsIcon,
  PlayArrowIcon,
  RefreshIcon,
  SettingsIcon,
  UserIcon,
} from "./Icons";
import { LogoMark } from "./Logo";

export type PageId = "home" | "play" | "mods" | "accounts" | "settings" | "about" | "diagnostics";

export const PAGE_TITLES: Record<PageId, string> = {
  home: "Home",
  play: "Play",
  mods: "Mods",
  accounts: "Accounts",
  settings: "Settings",
  about: "About",
  diagnostics: "Diagnostics",
};

interface Item {
  id: PageId;
  icon: JSX.Element;
}

const ITEMS: Item[] = [
  { id: "home", icon: <HomeIcon /> },
  { id: "play", icon: <PlayArrowIcon /> },
  { id: "mods", icon: <ModsIcon /> },
  { id: "accounts", icon: <UserIcon /> },
  { id: "settings", icon: <SettingsIcon /> },
];
const BOTTOM_ITEMS: Item[] = [
  { id: "about", icon: <InfoIcon /> },
  { id: "diagnostics", icon: <DiagnosticsIcon /> },
];

interface Props {
  page: PageId;
  onNavigate: (page: PageId) => void;
  onAccount: () => void;
  onRescan: () => void;
  scanning: boolean;
  /** Name shown on the account button at the bottom. */
  playerName: string | null;
}

function NavList({ items, page, onNavigate }: { items: Item[]; page: PageId; onNavigate: (p: PageId) => void }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className={`nav-item ${page === item.id ? "active" : ""}`}
            // "Play" alone would clash with the big Play button, so the page button says "Play page".
            aria-label={item.id === "play" ? "Play page" : PAGE_TITLES[item.id]}
            data-tip={PAGE_TITLES[item.id]}
            aria-current={page === item.id ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
          >
            {item.icon}
            <span className="nav-label" aria-hidden="true">
              {PAGE_TITLES[item.id]}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Labelled sidebar: the five places you play from on top, then About and Diagnostics, then the account.
 * Below 960px wide it folds down to icons only (the labels stay as tooltips and screen-reader names).
 */
export function Sidebar({ page, onNavigate, onAccount, onRescan, scanning, playerName }: Props) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <LogoMark size={30} />
        </span>
        <span className="brand-name" aria-hidden="true">
          Cirrus <b>Client</b>
        </span>
      </div>
      <nav aria-label="Main" className="rail-nav rail-main">
        <NavList items={ITEMS} page={page} onNavigate={onNavigate} />
      </nav>
      <div className="rail-bottom">
        <nav aria-label="Tools" className="rail-nav">
          <NavList items={BOTTOM_ITEMS} page={page} onNavigate={onNavigate} />
        </nav>
        <button
          type="button"
          className="nav-item"
          aria-label="Re-scan Java"
          data-tip="Re-scan Java"
          onClick={onRescan}
          disabled={scanning}
        >
          <RefreshIcon />
          <span className="nav-label" aria-hidden="true">
            Re-scan Java
          </span>
        </button>
        <button type="button" className="rail-account" aria-label="Open account menu" data-tip="Account" onClick={onAccount}>
          <span className="rail-avatar-dot" aria-hidden="true">
            {playerName ? playerName.slice(0, 1).toUpperCase() : <UserIcon />}
          </span>
          <span className="nav-label rail-account-name" aria-hidden="true">
            {playerName ?? "Guest"}
          </span>
        </button>
      </div>
    </aside>
  );
}
