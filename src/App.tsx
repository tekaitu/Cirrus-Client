import { useEffect, useRef, useState } from "react";
import { AccountPanel } from "./components/AccountPanel";
import { LicenseDialog } from "./components/LicenseDialog";
import { SignInDialog } from "./components/SignInDialog";
import { GameDialog } from "./components/GameDialog";
import { FooterBar } from "./components/FooterBar";
import { AppBackground, type BackdropId } from "./components/Scene";
import { CloseIcon } from "./components/Icons";
import { TopNav, type PageId } from "./components/Navigation";
import { LICENSE_VERSION } from "./content/license";
import { api, errorMessage } from "./api/client";
import { useAppData } from "./hooks/useAppData";
import { DiagnosticsPage } from "./pages/Diagnostics";
import { HomePage } from "./pages/Home";
import { AboutPage } from "./pages/About";
import { AccountsPage } from "./pages/Accounts";
import { ModsPage } from "./pages/Mods";
import { SkinsPage } from "./pages/Skins";
import { ServersPage } from "./pages/Servers";
import { VersionsPage } from "./pages/Versions";
import { ModpacksPage } from "./pages/Modpacks";
import { SettingsPage } from "./pages/Settings";
import { pageForShortcut } from "./core/shortcuts";
import { readDiscordEnabled, writeDiscordEnabled } from "./core/discord";
import { useDiscordPresence } from "./hooks/useDiscordPresence";
import { notify } from "./core/notifications";

/** Which picture sits behind each page. */
const BACKDROPS: Record<PageId, BackdropId> = {
  home: "home",
  versions: "library",
  mods: "library",
  modpacks: "library",
  skins: "library",
  servers: "library",
  browse: "browse",
  accounts: "night",
  settings: "night",
  about: "night",
  diagnostics: "night",
};

export default function App() {
  const data = useAppData();
  const [page, setPage] = useState<PageId>("home");
  const [section, setSection] = useState<string | undefined>(undefined);
  const [accountOpen, setAccountOpen] = useState(false);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [accepted, setAccepted] = useState(() => {
    try {
      return window.localStorage.getItem("unlimited.license") === LICENSE_VERSION;
    } catch {
      return false;
    }
  });
  const accept = () => {
    try {
      window.localStorage.setItem("unlimited.license", LICENSE_VERSION);
    } catch {
      /* it will be asked again next time */
    }
    setAccepted(true);
  };

  const reduceMotion = data.settings.status === "ready" && data.settings.data.settings.reduceMotion;
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = reduceMotion ? "true" : "false";
  }, [reduceMotion]);

  useEffect(() => {
    if (!accountOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAccountOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [accountOpen]);

  const navigate = (next: PageId, nextSection?: string) => {
    setPage(next);
    setSection(nextSection);
    setAccountOpen(false);
  };
  // The Accounts page already shows the account, so the account button does not also open a menu there.
  const toggleAccount = () => (page === "accounts" ? undefined : setAccountOpen((v) => !v));

  // Alt + 1..9 jumps between pages (listed under Settings > Keybinds).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = pageForShortcut(e);
      if (!target) return;
      e.preventDefault();
      setPage(target);
      setSection(undefined);
      setAccountOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const runPhase = data.game.run.phase;

  // Tell the bell about the things that matter: the game starting, ending or crashing.
  const prevRun = useRef(runPhase);
  const runState = data.game.run;
  useEffect(() => {
    if (prevRun.current === runPhase) return;
    prevRun.current = runPhase;
    if (runPhase === "running") notify({ title: "Minecraft started", body: `Minecraft ${data.selection.version}`, tone: "good" });
    else if (runPhase === "ended") {
      if (runState.phase === "ended" && runState.crash) notify({ title: "Minecraft crashed", body: "Open the crash report from Home or Versions.", tone: "bad" });
      else if (runState.phase === "ended") notify({ title: "Minecraft closed", tone: "info" });
    } else if (runPhase === "error" && runState.phase === "error") notify({ title: "Minecraft could not start", body: runState.message, tone: "bad" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runPhase]);

  const instPhase = data.game.installer.phase;
  const prevInst = useRef(instPhase);
  useEffect(() => {
    if (prevInst.current === instPhase) return;
    const was = prevInst.current;
    prevInst.current = instPhase;
    if (was === "running" && instPhase === "idle") notify({ title: "Game files are ready", body: `Minecraft ${data.selection.version}`, tone: "good" });
    else if (instPhase === "error") notify({ title: "Game files could not be downloaded", tone: "bad" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instPhase]);

  // Discord status ("Playing Minecraft 1.21.11", "Browsing mods", ...). On by default, can be switched off.
  const [discordOn, setDiscordOn] = useState(readDiscordEnabled);
  const toggleDiscord = () =>
    setDiscordOn((v) => {
      writeDiscordEnabled(!v);
      return !v;
    });
  useDiscordPresence({
    enabled: discordOn,
    page,
    running: runPhase === "running",
    version: data.selection.version,
    loader: data.selection.loader,
  });

  /** Saves the pasted Azure app ID so sign-in can start right away. Returns an error message or null. */
  const saveClientId = async (id: string): Promise<string | null> => {
    if (data.settings.status !== "ready") return "Settings are not loaded yet. Try again in a moment.";
    try {
      const outcome = await api.saveSettings({ ...data.settings.data.settings, msClientId: id });
      if (outcome.ok && outcome.state) {
        data.applySettings(outcome.state);
        return null;
      }
      return outcome.errors[0]?.message ?? "The app ID could not be saved.";
    } catch (e) {
      return errorMessage(e);
    }
  };

  return (
    <div className="layout">
      <AppBackground id={BACKDROPS[page]} />
      <div className="workspace">
        <TopNav
          page={page}
          onNavigate={navigate}
          onAccount={toggleAccount}
          accountOpen={accountOpen}
          player={data.account.state.phase === "signedIn" ? data.account.state.profile : null}
        />
        <main className="content">
          <div key={page} className="page-enter">
          {page === "home" && (
            <HomePage data={data} onNavigate={navigate} onOpenAccount={() => navigate("accounts")} />
          )}
          {page === "versions" && <VersionsPage data={data} onNavigate={navigate} onOpenAccount={() => navigate("accounts")} />}
          {page === "browse" && <ModsPage data={data} mode="browse" onNavigate={navigate} />}
          {page === "mods" && <ModsPage data={data} mode="manage" onNavigate={navigate} />}
          {page === "modpacks" && <ModpacksPage data={data} onNavigate={navigate} />}
          {page === "skins" && <SkinsPage data={data} />}
          {page === "servers" && <ServersPage />}
          {page === "accounts" && <AccountsPage data={data} onNavigate={navigate} onSaveClientId={saveClientId} />}
          {page === "settings" && <SettingsPage data={data} section={section} onNavigate={navigate} discord={{ enabled: discordOn, onToggle: toggleDiscord }} />}
          {page === "about" && <AboutPage data={data} onLicense={() => setLicenseOpen(true)} />}
          {page === "diagnostics" && <DiagnosticsPage data={data} />}
          </div>
        </main>
        <FooterBar data={data} onNavigate={navigate} />
      </div>
      {!accepted && (
        <LicenseDialog mode="gate" onAccept={accept} onDecline={() => void api.quitApp().catch(() => {})} />
      )}
      {accepted && <SignInDialog account={data.account} />}
      {accepted && <GameDialog data={data} />}
      {accepted && licenseOpen && <LicenseDialog mode="view" onClose={() => setLicenseOpen(false)} />}
      {accountOpen && (
        <div className="popover" role="dialog" aria-label="Account">
          <button type="button" className="popover-close" aria-label="Close account menu" onClick={() => setAccountOpen(false)}>
            <CloseIcon />
          </button>
          <AccountPanel
            account={data.account}
            onNavigate={navigate}
            onSaveClientId={saveClientId}
            onManage={() => navigate("accounts")}
          />
        </div>
      )}
    </div>
  );
}
