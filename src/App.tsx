import { useEffect, useState } from "react";
import { Sidebar, type PageId } from "./components/Sidebar";
import { useAppData } from "./hooks/useAppData";
import { DiagnosticsPage } from "./pages/Diagnostics";
import { HomePage } from "./pages/Home";
import { SettingsPage } from "./pages/Settings";

export default function App() {
  const data = useAppData();
  const [page, setPage] = useState<PageId>("home");

  const reduceMotion = data.settings.status === "ready" && data.settings.data.settings.reduceMotion;
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = reduceMotion ? "true" : "false";
  }, [reduceMotion]);

  return (
    <div className="layout">
      <Sidebar
        page={page}
        onNavigate={setPage}
        version={data.app.status === "ready" ? data.app.data.version : null}
      />
      <main className="content">
        {page === "home" && <HomePage data={data} />}
        {page === "settings" && <SettingsPage data={data} />}
        {page === "diagnostics" && <DiagnosticsPage data={data} />}
      </main>
    </div>
  );
}
