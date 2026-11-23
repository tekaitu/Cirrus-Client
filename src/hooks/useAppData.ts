import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { AppInfo, InstanceView, SettingsState, SystemInfo } from "../api/types";
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
  /** Every installed game with its own settings; what the Library lists. */
  instances: ResourceState<InstanceView[]>;
  reloadInstances: () => void;
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

  // The instance list is the source of truth for what is installed. It is fetched
  // again after an install finishes, so a new game appears without a restart.
  const [instancesTick, setInstancesTick] = useState(0);
  const instances = useResource<InstanceView[]>(() => api.listInstanceViews(), String(instancesTick));
  const selection = useSelection(instances.state.status === "ready" ? instances.state.data : null);
  const game = useGame(selection.version, selection.loader, selection.instance?.id ?? null);

  const reloadInstances = useCallback(() => setInstancesTick((n) => n + 1), []);
  const reloadRef = useRef(reloadInstances);
  reloadRef.current = reloadInstances;

  // One extra load when a download settles, so the Library shows the new instance.
  const [lastPhase, setLastPhase] = useState(game.installer.phase);
  useEffect(() => {
    if (game.installer.phase !== lastPhase) {
      setLastPhase(game.installer.phase);
      if (lastPhase === "running" || game.installer.phase === "idle") reloadRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.installer.phase]);

  return {
    installer,
    account,
    game,
    selection,
    instances: instances.state,
    reloadInstances,
    app: app.state,
    system: system.state,
    settings: settings.state,
    java: java.state,
    reloadAll: () => {
      app.reload();
      system.reload();
      settings.reload();
      java.reload();
      reloadInstances();
    },
    reloadSettings: settings.reload,
    reloadJava: java.reload,
    applySettings: settings.set,
  };
}
