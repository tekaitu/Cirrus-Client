import type { AppData } from "../hooks/useAppData";
import { Wordmark } from "./Logo";
import type { PageId } from "./Sidebar";

/**
 * Slim bar above every page. Every button here does something real; the
 * community entry is disabled and labelled because no community links exist yet.
 */
export function Toolbar({ data, onNavigate }: { data: AppData; onNavigate: (page: PageId) => void }) {
  const version = data.app.status === "ready" ? data.app.data.version : null;
  const scanning = data.java.status === "loading";
  return (
    <div className="toolbar">
      <div className="toolbar-brand">
        <Wordmark height={11} />
        <span className="toolbar-version">{version ? `v${version} · early build` : "early build"}</span>
      </div>
      <div className="toolbar-actions">
        <button type="button" className="tool" onClick={data.reloadJava} disabled={scanning}>
          {scanning ? "Scanning…" : "Re-scan Java"}
        </button>
        <button type="button" className="tool" onClick={() => onNavigate("diagnostics")}>
          Get help
        </button>
        <button type="button" className="tool" disabled title="No community links yet">
          Community · soon
        </button>
      </div>
    </div>
  );
}
