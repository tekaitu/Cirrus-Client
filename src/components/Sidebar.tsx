import { BrandMark, DiagnosticsIcon, HomeIcon, SettingsIcon } from "./Icons";

export type PageId = "home" | "settings" | "diagnostics";

const ITEMS: Array<{ id: PageId; label: string; icon: JSX.Element }> = [
  { id: "home", label: "Home", icon: <HomeIcon /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon /> },
  { id: "diagnostics", label: "Diagnostics", icon: <DiagnosticsIcon /> },
];

export function Sidebar({
  page,
  onNavigate,
  version,
}: {
  page: PageId;
  onNavigate: (page: PageId) => void;
  version: string | null;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <BrandMark size={32} />
        </span>
        <span className="brand-name">Limited FPS</span>
      </div>
      <nav aria-label="Main">
        <ul>
          {ITEMS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`nav-item ${page === item.id ? "active" : ""}`}
                aria-current={page === item.id ? "page" : undefined}
                onClick={() => onNavigate(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <p className="sidebar-foot muted small">{version ? `v${version} · early build` : "early build"}</p>
    </aside>
  );
}
