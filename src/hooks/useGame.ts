import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../api/client";
import type { GameStatus } from "../api/types";
import { appendLog, type GameInstallerState, type LoaderId, type PlayMode, type RunState } from "../core/game";
import { createSingleFlight } from "../core/singleFlight";

export interface Game {
  status: GameStatus | null;
  installer: GameInstallerState;
  run: RunState;
  /** Downloads this version. `loaderVersion` pins a Fabric loader. */
  install: (loaderVersion?: string | null) => void;
  cancelInstall: () => void;
  play: (javaPath: string, mode: PlayMode, username: string) => void;
  stop: () => void;
  dismissRun: () => void;
  refresh: () => void;
  /** Everything the game printed during the latest launch. */
  log: string;
  /** Which window is open: nothing, the live launch log, or the crash details. */
  panel: "none" | "log" | "crash";
  openLog: () => void;
  openCrash: () => void;
  closePanel: () => void;
}

export function useGame(version: string, loader: LoaderId, instanceId: string | null = null): Game {
  const [status, setStatus] = useState<GameStatus | null>(null);
  const [installer, setInstaller] = useState<GameInstallerState>({ phase: "idle" });
  const [run, setRun] = useState<RunState>({ phase: "idle" });
  // One action, one instance: a second click while a download, launch or stop is
  // still in flight is dropped at this layer, and the gate opens when it settles.
  const installGate = useRef(createSingleFlight()).current;
  const playGate = useRef(createSingleFlight()).current;
  const stopGate = useRef(createSingleFlight()).current;
  const mounted = useRef(true);
  const [log, setLog] = useState("");
  const [panel, setPanel] = useState<"none" | "log" | "crash">("none");
  const logOffset = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(() => {
    void Promise.resolve()
      .then(() => api.gameStatus(version, loader))
      .then((s) => {
        if (!mounted.current) return;
        setStatus(s);
        if (s.running) setRun((r) => (r.phase === "idle" ? { phase: "running" } : r));
      })
      .catch(() => {
        /* outside the desktop app there is no game status */
      });
  }, [version, loader]);

  useEffect(() => {
    setStatus(null);
  }, [version, loader]);

  /** Reads whatever the game has printed since the last read. */
  const readLog = useCallback(async () => {
    try {
      const chunk = await api.readGameLog(logOffset.current);
      if (!mounted.current) return;
      if (chunk.offset < logOffset.current) setLog(chunk.text);
      else if (chunk.text) setLog((prev) => appendLog(prev, chunk.text));
      logOffset.current = chunk.offset;
    } catch {
      /* outside the desktop app there is no log */
    }
  }, []);

  const polling = run.phase === "starting" || run.phase === "running";
  useEffect(() => {
    if (!polling) return;
    void readLog();
    const id = window.setInterval(() => void readLog(), 700);
    return () => window.clearInterval(id);
  }, [polling, readLog]);

  useEffect(() => {
    refresh();
    let unlisten: () => void = () => {};
    void api
      .onGameExited((e) => {
        if (!mounted.current) return;
        // One last read so the log ends with the game's final lines.
        void readLog().finally(() => {
          if (!mounted.current) return;
          setRun({ phase: "ended", code: e.code, logPath: e.logPath, stopped: e.stopped === true, crash: e.crash ?? null });
          if (e.crash) setPanel("crash");
        });
      })
      .then((u) => {
        unlisten = u;
        if (!mounted.current) u();
      });
    return () => unlisten();
  }, [refresh, readLog]);

  const install = useCallback(
    (loaderVersion: string | null = null) => {
    if (installGate.busy) return;
    setInstaller({ phase: "running", progress: null, cancelling: false });
    void installGate.run(async () => {
      let unlisten: () => void = () => {};
      try {
        unlisten = await api.onGameProgress((progress) => {
          if (!mounted.current) return;
          setInstaller((prev) => (prev.phase === "running" ? { ...prev, progress } : prev));
        });
        const result = await api.installGame(version, loader, loaderVersion);
        if (!mounted.current) return;
        if (result.status === "installed") {
          // Update the status first so nothing sees "idle" with stale "not installed".
          try {
            const fresh = await api.gameStatus(version, loader);
            if (mounted.current) setStatus(fresh);
          } catch {
            /* the next refresh will correct it */
          }
          if (mounted.current) setInstaller({ phase: "idle" });
        } else if (result.status === "cancelled") {
          setInstaller({ phase: "cancelled" });
        } else {
          setInstaller({ phase: "error", message: result.message ?? "The game files could not be downloaded." });
        }
      } catch (e) {
        if (mounted.current) setInstaller({ phase: "error", message: errorMessage(e) });
      } finally {
        unlisten();
      }
    });
    },
    [version, loader, installGate],
  );

  const cancelInstall = useCallback(() => {
    setInstaller((prev) => (prev.phase === "running" ? { ...prev, cancelling: true } : prev));
    api.cancelGameInstall().catch(() => {});
  }, []);

  const play = useCallback((javaPath: string, mode: PlayMode, username: string) => {
    if (playGate.busy) return;
    setRun({ phase: "starting" });
    setLog("");
    logOffset.current = 0;
    const who = mode === "offline" ? username.trim() : null;
    void playGate
      .run(() => api.launchGame(javaPath, mode, who, version, loader, undefined, instanceId ?? undefined))
      .then((r) => {
        if (!mounted.current || !r) return;
        setRun(r.started ? { phase: "running" } : { phase: "error", message: r.message ?? "Minecraft could not be started." });
      })
      .catch((e) => {
        if (mounted.current) setRun({ phase: "error", message: errorMessage(e) });
      });
  }, [version, loader, instanceId, playGate]);

  const stop = useCallback(() => {
    void stopGate.run(() => api.stopGame()).catch(() => {});
  }, [stopGate]);

  const dismissRun = useCallback(() => {
    setRun({ phase: "idle" });
    setPanel((p) => (p === "crash" ? "none" : p));
  }, []);
  const openLog = useCallback(() => setPanel("log"), []);
  const openCrash = useCallback(() => setPanel("crash"), []);
  const closePanel = useCallback(() => setPanel("none"), []);

  return { status, installer, run, install, cancelInstall, play, stop, dismissRun, refresh, log, panel, openLog, openCrash, closePanel };
}
