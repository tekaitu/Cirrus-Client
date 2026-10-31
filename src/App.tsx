import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { REQUIRED_JAVA_MAJOR, TARGET_MINECRAFT_VERSION } from "./core/java";

interface AppInfo {
  name: string;
  version: string;
  target_minecraft: string;
  launcher_ready: boolean;
}

export default function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<AppInfo>("get_app_info")
      .then(setInfo)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  return (
    <main className="shell">
      <h1>Limited FPS</h1>
      <p className="muted">
        Target: Minecraft Java {TARGET_MINECRAFT_VERSION} with Fabric (Java {REQUIRED_JAVA_MAJOR}+).
      </p>
      <section className="card" aria-live="polite">
        <h2>Status</h2>
        <p>
          <strong>Foundation build.</strong> Minecraft launching, Microsoft sign-in and Fabric setup
          are not implemented yet, so there is no Play button.
        </p>
        {info && (
          <p className="muted">
            {info.name} v{info.version} · launcher ready: {info.launcher_ready ? "yes" : "no"}
          </p>
        )}
        {error && <p className="error">Could not read app info: {error}</p>}
      </section>
    </main>
  );
}
