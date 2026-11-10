import { useEffect, useState } from "react";
import { AccountPanel } from "./components/AccountPanel";
import { LicenseDialog } from "./components/LicenseDialog";
import { HeroArt } from "./components/Art";
import { FooterBar } from "./components/FooterBar";
import { CloseIcon } from "./components/Icons";
import { Sidebar, type PageId } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { LICENSE_VERSION } from "./content/license";
import { api } from "./api/client";
import { useAppData } from "./hooks/useAppData";
import { DiagnosticsPage } from "./pages/Diagnostics";
import { HomePage } from "./pages/Home";
import { ModsPage } from "./pages/Mods";
import { SettingsPage } from "./pages/Settings";

export default function App() {
  const data = useAppData();
  const [page, setPage] = useState<PageId>("home");
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

  const navigate = (next: PageId) => {
    setPage(next);
    setAccountOpen(false);
  };
  const toggleAccount = () => setAccountOpen((v) => !v);
  const scanning = data.java.status === "loading";

  return (
    <div className="layout">
      <HeroArt />
      <div className="scene-shade" />
      <Sidebar page={page} onNavigate={navigate} onAccount={toggleAccount} onRescan={data.reloadJava} scanning={scanning} />
      <div className="workspace">
        <TopBar data={data} onAccount={toggleAccount} accountOpen={accountOpen} />
        <main className="content">
          {page === "home" && <HomePage data={data} onNavigate={navigate} onOpenAccount={() => setAccountOpen(true)} />}
          {page === "mods" && <ModsPage data={data} />}
          {page === "settings" && <SettingsPage data={data} />}
          {page === "diagnostics" && <DiagnosticsPage data={data} />}
        </main>
        <FooterBar data={data} onNavigate={navigate} onLicense={() => setLicenseOpen(true)} />
      </div>
      {!accepted && (
        <LicenseDialog mode="gate" onAccept={accept} onDecline={() => void api.quitApp().catch(() => {})} />
      )}
      {accepted && licenseOpen && <LicenseDialog mode="view" onClose={() => setLicenseOpen(false)} />}
      {accountOpen && (
        <div className="popover" role="dialog" aria-label="Account">
          <button type="button" className="popover-close" aria-label="Close account menu" onClick={() => setAccountOpen(false)}>
            <CloseIcon />
          </button>
          <AccountPanel account={data.account} onNavigate={navigate} />
        </div>
      )}
    </div>
  );
}
