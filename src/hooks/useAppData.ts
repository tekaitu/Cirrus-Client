import { api } from "../api/client";
import type { AppInfo, Profile, SettingsState, SystemInfo } from "../api/types";
import { analyzeJava, toJavaView, type JavaView } from "../core/java";
import { useAuth, type Account } from "./useAuth";
import { useGame, type Game } from "./useGame";
import { useSelection, type Selection } from "./useSelection";
import { useJavaInstaller, type JavaInstaller } from "./useJavaInstaller";
import { useResource, type ResourceState } from "./useResource";

export interface AppData {
  app: ResourceState<AppInfo>;
  system: ResourceState<SystemInfo>;
  settings: ResourceState<SettingsState>;
  java: ResourceState<JavaView>;
  installer: JavaInstaller;
  account: Account;
  game: Game;
  selection: Selection;
  profiles: ResourceState<Profile[]>;
  reloadProfiles: () => void;
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
    return toJavaView(raw.installs.map(analyzeJava), raw.candidatesChecked, raw.notes ?? []);
  }, javaKey);

  const installer = useJavaInstaller({
    onSettings: settings.set,
    onNoSettingsChange: java.reload,
  });

  const account = useAuth(s.status !== "loading");

  const profiles = useResource<Profile[]>(() => api.listProfiles());
  const selection = useSelection(profiles.state.status === "ready" ? profiles.state.data : null);
  const game = useGame(selection.version, selection.loader, selection.profile?.id ?? null);

  return {
    installer,
    account,
    game,
    selection,
    profiles: profiles.state,
    reloadProfiles: profiles.reload,
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
