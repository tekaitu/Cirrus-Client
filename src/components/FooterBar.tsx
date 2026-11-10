import type { AppData } from "../hooks/useAppData";
import { HelpIcon, UsersIcon } from "./Icons";
import type { PageId } from "./Sidebar";

export function FooterBar({ data, onNavigate, onLicense }: { data: AppData; onNavigate: (page: PageId) => void; onLicense: () => void }) {
  const version = data.app.status === "ready" ? data.app.data.version : null;
  return (
    <footer className="footbar">
      <button type="button" className="pill pill-button" onClick={() => onNavigate("diagnostics")}>
        <HelpIcon />
        <span>Get help</span>
      </button>
      <div className="foot-right">
        <button type="button" className="pill pill-button" onClick={onLicense}>
          License
        </button>
        <span className="pill">{version ? `v${version} · early build` : "early build"}</span>
        <button type="button" className="pill pill-button" disabled title="No community links yet">
          <UsersIcon />
          <span>Community · soon</span>
        </button>
      </div>
    </footer>
  );
}
