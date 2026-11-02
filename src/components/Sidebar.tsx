import { DiagnosticsIcon, HomeIcon, SettingsIcon } from "./Icons";
import { LogoMark } from "./Logo";

export type PageId = "home" | "settings" | "diagnostics";

const ITEMS: Array<{ id: PageId; label: string; icon: JSX.Element }> = [
  { id: "home", label: "Home", icon: <HomeIcon /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon /> },
  { id: "diagnostics", label: "Diagnostics", icon: <DiagnosticsIcon /> },
];

/** Slim icon-only navigation. Each button keeps a text label for screen readers and tooltips. */
export function Sidebar({ page, onNavigate }: { page: PageId; onNavigate: (page: PageId) => void }) {
  return (
    <aside className="sidebar">
      <span className="brand-mark">
        <LogoMark size={34} />
      </span>
      <nav aria-label="Main">
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
    </aside>
  );
}
