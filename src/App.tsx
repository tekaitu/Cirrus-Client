import { useEffect, useRef, useState } from "react";
import { AccountPanel } from "./components/AccountPanel";
import { LicenseDialog } from "./components/LicenseDialog";
import { SignInDialog } from "./components/SignInDialog";
import { FooterBar } from "./components/FooterBar";
import { CloseIcon } from "./components/Icons";
import { Sidebar, type PageId } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { LICENSE_VERSION } from "./content/license";
import { api, errorMessage } from "./api/client";
import { useAppData } from "./hooks/useAppData";
import { DiagnosticsPage } from "./pages/Diagnostics";
import { HomePage } from "./pages/Home";
import { AboutPage } from "./pages/About";
import { AccountsPage } from "./pages/Accounts";
import { ModsPage } from "./pages/Mods";
import { PlayPage } from "./pages/Play";
import { SettingsPage } from "./pages/Settings";
import { pageForShortcut } from "./core/shortcuts";
import { readRecent, writeRecent, type RecentPlay } from "./core/recent";
import { readDiscordEnabled, writeDiscordEnabled } from "./core/discord";
import { useDiscordPresence } from "./hooks/useDiscordPresence";

export default function App() {
  const data = useAppData();
  const [page, setPage] = useState<PageId>("home");
  const [section, setSection] = useState<string | undefined>(undefined);
  const [recent, setRecent] = useState<RecentPlay | null>(readRecent);
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

  // Alt + 1..6 jumps between pages (listed under Settings > Keybinds).
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

  // Remember when the game last started, for "Recent activity" on Home.
  const runPhase = data.game.run.phase;
  const wasRunning = useRef(false);
  useEffect(() => {
    if (runPhase === "running" && !wasRunning.current) {
      const entry: RecentPlay = {
        version: data.selection.version,
        loader: data.selection.loader,
        profile: data.selection.profile?.name ?? null,
        at: Date.now(),
      };
      writeRecent(entry);
      setRecent(entry);
    }
    wasRunning.current = runPhase === "running";
  }, [runPhase, data.selection.version, data.selection.loader, data.selection.profile]);
  const scanning = data.java.status === "loading";

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
      <Sidebar
        page={page}
        onNavigate={navigate}
        onAccount={toggleAccount}
        onRescan={data.reloadJava}
        scanning={scanning}
        playerName={data.account.state.phase === "signedIn" ? data.account.state.profile.name : null}
      />
      <div className="workspace">
        <TopBar
          data={data}
          page={page}
          onAccount={toggleAccount}
          accountOpen={accountOpen}
          discord={{ enabled: discordOn, onToggle: toggleDiscord }}
        />
        <main className="content">
          <div key={page} className="page-enter">
          {page === "home" && (
            <HomePage data={data} recent={recent} onNavigate={navigate} onOpenAccount={() => navigate("accounts")} />
          )}
          {page === "play" && <PlayPage data={data} onNavigate={navigate} onOpenAccount={() => navigate("accounts")} />}
          {page === "mods" && <ModsPage data={data} />}
          {page === "accounts" && <AccountsPage data={data} onNavigate={navigate} onSaveClientId={saveClientId} />}
          {page === "settings" && <SettingsPage data={data} section={section} onNavigate={navigate} />}
          {page === "about" && <AboutPage data={data} onLicense={() => setLicenseOpen(true)} />}
          {page === "diagnostics" && <DiagnosticsPage data={data} />}
          </div>
        </main>
        <FooterBar data={data} onNavigate={navigate} onLicense={() => setLicenseOpen(true)} />
      </div>
      {!accepted && (
        <LicenseDialog mode="gate" onAccept={accept} onDecline={() => void api.quitApp().catch(() => {})} />
      )}
      {accepted && <SignInDialog account={data.account} />}
      {accepted && licenseOpen && <LicenseDialog mode="view" onClose={() => setLicenseOpen(false)} />}
      {accountOpen && (
        <div className="popover" role="dialog" aria-label="Account">
          <button type="button" className="popover-close" aria-label="Close account menu" onClick={() => setAccountOpen(false)}>
            <CloseIcon />
          </button>
          <AccountPanel account={data.account} onNavigate={navigate} onSaveClientId={saveClientId} />
        </div>
      )}
    </div>
  );
}
