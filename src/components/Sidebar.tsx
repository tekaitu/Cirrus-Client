import { CompassIcon, DiagnosticsIcon, HomeIcon, LibraryIcon, RefreshIcon, SettingsIcon, UserIcon } from "./Icons";
import { LogoMark } from "./Logo";

export type PageId = "home" | "library" | "mods" | "settings" | "diagnostics";

const ITEMS: Array<{ id: PageId; label: string; icon: JSX.Element }> = [
  { id: "home", label: "Home", icon: <HomeIcon /> },
  { id: "mods", label: "Mods", icon: <CompassIcon /> },
  { id: "library", label: "Library", icon: <LibraryIcon /> },
];
const BOTTOM_ITEMS: Array<{ id: PageId; label: string; icon: JSX.Element }> = [
  { id: "settings", label: "Settings", icon: <SettingsIcon /> },
  { id: "diagnostics", label: "Diagnostics", icon: <DiagnosticsIcon /> },
];

interface Props {
  page: PageId;
  onNavigate: (page: PageId) => void;
  onAccount: () => void;
  onRescan: () => void;
  scanning: boolean;
}

function NavList({ items, page, onNavigate }: { items: typeof ITEMS; page: PageId; onNavigate: (p: PageId) => void }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className={`nav-item ${page === item.id ? "active" : ""}`}
            aria-label={item.label}
            title={item.label}
            aria-current={page === item.id ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
          >
            {item.icon}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Slim icon rail like the Modrinth app: pages on top, tools and account at the bottom. */
export function Sidebar({ page, onNavigate, onAccount, onRescan, scanning }: Props) {
  return (
    <aside className="sidebar">
      <span className="brand-mark">
        <LogoMark size={32} />
      </span>
      <nav aria-label="Main" className="rail-nav">
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
          title="Re-scan Java"
          onClick={onRescan}
          disabled={scanning}
        >
          <RefreshIcon />
        </button>
        <button type="button" className="rail-avatar" aria-label="Open account menu" title="Account" onClick={onAccount}>
          <UserIcon />
        </button>
      </div>
    </aside>
  );
}
