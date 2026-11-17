import { api } from "../api/client";
import type { AppData } from "../hooks/useAppData";
import { BrandIcon } from "./BrandIcon";
import type { PageId } from "./Navigation";

/** Quiet footer: the version, a way to About, and the Discord community. A warning shows only when Java is a problem. */
export function FooterBar({ data, onNavigate }: { data: AppData; onNavigate: (page: PageId) => void; onLicense?: () => void }) {
  const version = data.app.status === "ready" ? data.app.data.version : null;
  const javaProblem =
    data.java.status === "error" || (data.java.status === "ready" && !data.java.data.selected && data.installer.state.phase !== "running");
  return (
    <footer className="footbar">
      <div className="foot-left">
        <span className="pill">{version ? `Cirrus Client ${version}` : "Cirrus Client"}</span>
        <button type="button" className="pill pill-button" onClick={() => onNavigate("about")}>
          About
        </button>
        {javaProblem && (
          <button type="button" className="pill pill-button pill-warn" onClick={() => onNavigate("diagnostics")}>
            <span className="dot" aria-hidden="true" />
            Java needs attention
          </button>
        )}
      </div>
      <div className="foot-right">
        <button
          type="button"
          className="pill pill-button pill-community"
          title="Join the Cirrus Client community on Discord"
          onClick={() => void api.openCommunity().catch(() => {})}
        >
          <BrandIcon name="discord" />
          <span>Discord</span>
        </button>
      </div>
    </footer>
  );
}
