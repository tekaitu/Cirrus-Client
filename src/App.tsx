import { useEffect, useRef, useState } from "react";
import { AccountDrawer } from "./components/AccountDrawer";
import { LogoMark } from "./components/Logo";
import { LicenseDialog } from "./components/LicenseDialog";
import { SignInDialog } from "./components/SignInDialog";
import { GameDialog } from "./components/GameDialog";
import { FooterBar } from "./components/FooterBar";
import { AppBackground, type BackdropId } from "./components/Scene";
import { TopNav, type PageId } from "./components/Navigation";
import { LICENSE_VERSION } from "./content/license";
import { api } from "./api/client";
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
import { Toasts } from "./components/Toasts";
import { REQUIRED_JAVA_MAJOR } from "./core/java";
import { writeRecent } from "./core/recent";
import { usePlayAs } from "./hooks/usePlayAs";

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
  const playAs = usePlayAs();
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

  // The startup screen: the logo on black until settings are in, plus a short beat so it never flashes.
  const booted = data.settings.status !== "loading";
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    if (!booted) return;
    const timer = window.setTimeout(() => setBooting(false), 700);
    return () => window.clearTimeout(timer);
  }, [booted]);

  const navigate = (next: PageId, nextSection?: string) => {
    setPage(next);
    setSection(nextSection);
    setAccountOpen(false);
  };
  const openAccount = () => setAccountOpen(true);
  // The Accounts page already shows the account, so the account button does not also open the panel there.
  const toggleAccount = () => (page === "accounts" ? undefined : setAccountOpen((v) => !v));

  const accountState = data.account.state;
  const microsoftName = accountState.phase === "signedIn" ? accountState.profile : null;
  const offlineName = playAs.mode === "offline" ? playAs.name.trim() : "";
  // The chosen offline name is what the game uses, so it is what the header shows.
  const identity = offlineName
    ? { name: offlineName, id: null, offline: true }
    : microsoftName
      ? { name: microsoftName.name, id: microsoftName.id }
      : null;

  // Signing in means playing online from now on; choosing a name in the panel switches it back.
  const accountPhase = data.account.state.phase;
  useEffect(() => {
    if (accountPhase === "signedIn") playAs.useMicrosoft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountPhase]);

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

  // Sign-in results and an expired login get a notification of their own.
  const prevAccount = useRef(accountPhase);
  useEffect(() => {
    const was = prevAccount.current;
    prevAccount.current = accountPhase;
    const state = data.account.state;
    if (state.phase === "signedIn" && (was === "starting" || was === "waiting")) {
      notify({ title: "Signed in to Minecraft", body: state.profile.name, tone: "good" });
    } else if (state.phase === "signedOut" && was !== "signedOut" && state.message?.trim()) {
      notify({ title: "Microsoft sign-in expired", body: state.message, tone: "warn" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountPhase]);

  // Java missing is worth saying once, when the scan has finished and nothing is installing.
  const javaMissing =
    data.java.status === "ready" && !data.java.data.selected && data.installer.state.phase !== "running";
  const saidJavaMissing = useRef(false);
  useEffect(() => {
    if (!javaMissing) {
      saidJavaMissing.current = false;
      return;
    }
    if (saidJavaMissing.current) return;
    saidJavaMissing.current = true;
    notify({
      title: `Java ${REQUIRED_JAVA_MAJOR} is needed`,
      body: "Set up & play can install it for you, or pick a Java in Settings.",
      tone: "warn",
    });
  }, [javaMissing]);

  const runPhase = data.game.run.phase;

  // Tell the bell about the things that matter: the game starting, ending or crashing.
  const prevRun = useRef(runPhase);
  const runState = data.game.run;
  useEffect(() => {
    if (prevRun.current === runPhase) return;
    prevRun.current = runPhase;
    if (runPhase === "running") {
      notify({ title: "Minecraft started", body: `Minecraft ${data.selection.version}`, tone: "good" });
      writeRecent({
        version: data.selection.version,
        loader: data.selection.loader,
        profile: data.selection.profile?.name ?? null,
        at: Date.now(),
      });
    }
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

  return (
    <div className="layout">
      <AppBackground id={BACKDROPS[page]} />
      <div className="workspace">
        <TopNav
          page={page}
          onNavigate={navigate}
          onAccount={toggleAccount}
          accountOpen={accountOpen}
          player={identity}
        />
        <main className="content">
          <div key={page} className="page-enter">
          {page === "home" && <HomePage data={data} onNavigate={navigate} onOpenAccount={openAccount} />}
          {page === "versions" && <VersionsPage data={data} onNavigate={navigate} onOpenAccount={openAccount} />}
          {page === "browse" && <ModsPage data={data} mode="browse" onNavigate={navigate} />}
          {page === "mods" && <ModsPage data={data} mode="manage" onNavigate={navigate} />}
          {page === "modpacks" && <ModpacksPage data={data} onNavigate={navigate} />}
          {page === "skins" && <SkinsPage data={data} onNavigate={navigate} />}
          {page === "servers" && <ServersPage />}
          {page === "accounts" && <AccountsPage data={data} onNavigate={navigate} />}
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
      <Toasts />
      <AccountDrawer
        open={accountOpen}
        account={data.account}
        onClose={() => setAccountOpen(false)}
        onManage={() => navigate("accounts")}
      />
      {booting && (
        <div className="boot" role="status" aria-live="polite" aria-label="Loading Cirrus Client">
          <LogoMark size={76} />
          <span className="boot-spinner" aria-hidden="true" />
          <p className="boot-text">Starting Cirrus Client…</p>
        </div>
      )}
    </div>
  );
}
