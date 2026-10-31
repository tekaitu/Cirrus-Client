import { api } from "../api/client";
import type { AppInfo, SettingsState, SystemInfo } from "../api/types";
import { analyzeJava, toJavaView, type JavaView } from "../core/java";
import { useResource, type ResourceState } from "./useResource";

export interface AppData {
  app: ResourceState<AppInfo>;
  system: ResourceState<SystemInfo>;
  settings: ResourceState<SettingsState>;
  java: ResourceState<JavaView>;
  reloadAll: () => void;
  reloadSettings: () => void;
  reloadJava: () => void;
  applySettings: (state: SettingsState) => void;
}

/** Loads everything the pages need once, so switching pages never repeats the work. */
export function useAppData(): AppData {
  const app = useResource(() => api.getAppInfo());
  const system = useResource(() => api.getSystemInfo());
  const settings = useResource(() => api.loadSettings());

  // Java detection waits for settings (a custom Java path changes what is checked)
  // and re-runs when that path changes. If settings failed to load, detect anyway.
  const s = settings.state;
  const javaKey = s.status === "ready" ? (s.data.settings.javaPath ?? "") : s.status === "error" ? "" : null;
  const java = useResource<JavaView>(async () => {
    const raw = await api.detectJava(javaKey ? javaKey : null);
    return toJavaView(raw.installs.map(analyzeJava), raw.candidatesChecked);
  }, javaKey);

  return {
    app: app.state,
    system: system.state,
    settings: settings.state,
    java: java.state,
    reloadAll: () => {
      app.reload();
      system.reload();
      settings.reload();
      java.reload();
    },
    reloadSettings: settings.reload,
    reloadJava: java.reload,
    applySettings: settings.set,
  };
}
