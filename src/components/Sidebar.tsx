import { DiagnosticsIcon, HomeIcon, RefreshIcon, SettingsIcon, UserIcon } from "./Icons";
import { LogoMark } from "./Logo";

export type PageId = "home" | "settings" | "diagnostics";

const ITEMS: Array<{ id: PageId; label: string; icon: JSX.Element }> = [
  { id: "home", label: "Home", icon: <HomeIcon /> },
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

/** Slim icon rail. Every button has a text label for screen readers and tooltips. */
export function Sidebar({ page, onNavigate, onAccount, onRescan, scanning }: Props) {
  return (
    <aside className="sidebar">
      <span className="brand-mark">
        <LogoMark size={30} />
      </span>

      <div className="rail-middle">
        <button type="button" className="rail-circle" aria-label="Open account menu" title="Account" onClick={onAccount}>
          <UserIcon />
        </button>
        <nav aria-label="Main" className="rail-pill">
          <ul>
            {ITEMS.map((item) => (
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
        </nav>
      </div>

      <button
        type="button"
        className="rail-circle"
        aria-label="Re-scan Java"
        title="Re-scan Java"
        onClick={onRescan}
        disabled={scanning}
      >
        <RefreshIcon />
      </button>
    </aside>
  );
}
