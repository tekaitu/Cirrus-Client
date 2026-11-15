import { api } from "../api/client";
import { progressView } from "../core/installer";
import { REQUIRED_JAVA_MAJOR, TARGET_MINECRAFT_VERSION } from "../core/java";
import type { AppData } from "../hooks/useAppData";
import { ChatIcon, HelpIcon } from "./Icons";
import type { PageId } from "./Navigation";

function javaPill(data: AppData): { text: string; busy: boolean; tone: "good" | "warn" | "idle" } {
  const inst = data.installer.state;
  if (inst.phase === "running") {
    const v = inst.progress ? progressView(inst.progress) : null;
    return { text: v?.percent != null ? `Installing Java… ${v.percent}%` : "Installing Java…", busy: true, tone: "idle" };
  }
  if (data.java.status === "loading") return { text: "Detecting Java…", busy: true, tone: "idle" };
  if (data.java.status === "error") return { text: "Java check failed", busy: false, tone: "warn" };
  if (data.java.status === "ready" && data.java.data.selected) {
    return { text: `Java ${data.java.data.selected.major} · Ready`, busy: false, tone: "good" };
  }
  return { text: `Java ${REQUIRED_JAVA_MAJOR} · not found`, busy: false, tone: "warn" };
}

export function FooterBar({ data, onNavigate, onLicense }: { data: AppData; onNavigate: (page: PageId) => void; onLicense: () => void }) {
  const version = data.app.status === "ready" ? data.app.data.version : null;
  const java = javaPill(data);
  return (
    <footer className="footbar">
      <div className="foot-left">
        <button type="button" className="pill pill-button" onClick={() => onNavigate("diagnostics")}>
          <HelpIcon />
          <span>Get help</span>
        </button>
        <div className="pill">
          <span className="dot" aria-hidden="true" />
          <span>Minecraft {TARGET_MINECRAFT_VERSION}</span>
        </div>
        <div className={`pill pill-${java.tone}`}>
          {java.busy ? <span className="mini-spinner" aria-hidden="true" /> : <span className="dot" aria-hidden="true" />}
          <span>{java.text}</span>
        </div>
      </div>
      <div className="foot-right">
        <button type="button" className="pill pill-button" onClick={onLicense}>
          License
        </button>
        <span className="pill">{version ? `v${version} · early build` : "early build"}</span>
        <button
          type="button"
          className="pill pill-button pill-community"
          title="Join the Cirrus Client community on Discord"
          onClick={() => void api.openCommunity().catch(() => {})}
        >
          <ChatIcon />
          <span>Discord community</span>
        </button>
      </div>
    </footer>
  );
}
