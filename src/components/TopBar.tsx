import { progressView } from "../core/installer";
import { REQUIRED_JAVA_MAJOR, TARGET_MINECRAFT_VERSION } from "../core/java";
import type { AppData } from "../hooks/useAppData";
import type { PageId } from "./Sidebar";

const PAGE_TITLES: Record<PageId, string> = {
  home: "Home",
  library: "Library",
  mods: "Discover mods",
  settings: "Settings",
  diagnostics: "Diagnostics",
};

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

/** Three pills across the top: game version, Java activity, and the account. */
export function TopBar({ data, page, onAccount, accountOpen }: { data: AppData; page: PageId; onAccount: () => void; accountOpen: boolean }) {
  const java = javaPill(data);
  const acct = data.account.state;
  const name = acct.phase === "signedIn" ? acct.profile.name : "Sign in";
  const sub = acct.phase === "signedIn" ? "Minecraft Java" : "Microsoft account";
  const title = PAGE_TITLES[page];

  return (
    <header className="topbar">
      <p className="crumbs" aria-label="You are here">
        <span className="crumb-root">Cirrus Client</span>
        <span className="crumb-sep" aria-hidden="true">/</span>
        <strong>{title}</strong>
      </p>

      <div className="topbar-pills">
        <div className="pill">
          <span className="dot" aria-hidden="true" />
          <span>Minecraft {TARGET_MINECRAFT_VERSION}</span>
        </div>
        <div className={`pill pill-${java.tone}`}>
          {java.busy ? <span className="mini-spinner" aria-hidden="true" /> : <span className="dot" aria-hidden="true" />}
          <span>{java.text}</span>
        </div>
      </div>

      <button
        type="button"
        className="profile"
        aria-label="Account"
        aria-expanded={accountOpen}
        aria-haspopup="dialog"
        onClick={onAccount}
      >
        <span className="profile-text">
          <strong>{name}</strong>
          <small>{sub}</small>
        </span>
        <span className="avatar avatar-lg" aria-hidden="true">
          {acct.phase === "signedIn" ? acct.profile.name.slice(0, 1).toUpperCase() : "?"}
        </span>
      </button>
    </header>
  );
}
