import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../api/client";
import type { GameStatus } from "../api/types";
import type { GameInstallerState, PlayMode, RunState } from "../core/game";

export interface Game {
  status: GameStatus | null;
  installer: GameInstallerState;
  run: RunState;
  install: () => void;
  cancelInstall: () => void;
  play: (javaPath: string, mode: PlayMode, username: string) => void;
  stop: () => void;
  dismissRun: () => void;
  refresh: () => void;
}

export function useGame(): Game {
  const [status, setStatus] = useState<GameStatus | null>(null);
  const [installer, setInstaller] = useState<GameInstallerState>({ phase: "idle" });
  const [run, setRun] = useState<RunState>({ phase: "idle" });
  const installing = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(() => {
    api
      .gameStatus()
      .then((s) => {
        if (!mounted.current) return;
        setStatus(s);
        if (s.running) setRun((r) => (r.phase === "idle" ? { phase: "running" } : r));
      })
      .catch(() => {
        /* outside the desktop app there is no game status */
      });
  }, []);

  useEffect(() => {
    refresh();
    let unlisten: () => void = () => {};
    void api
      .onGameExited((e) => {
        if (mounted.current) setRun({ phase: "ended", code: e.code, logPath: e.logPath });
      })
      .then((u) => {
        unlisten = u;
        if (!mounted.current) u();
      });
    return () => unlisten();
  }, [refresh]);

  const install = useCallback(() => {
    if (installing.current) return;
    installing.current = true;
    setInstaller({ phase: "running", progress: null, cancelling: false });
    void (async () => {
      let unlisten: () => void = () => {};
      try {
        unlisten = await api.onGameProgress((progress) => {
          if (!mounted.current) return;
          setInstaller((prev) => (prev.phase === "running" ? { ...prev, progress } : prev));
        });
        const result = await api.installGame();
        if (!mounted.current) return;
        if (result.status === "installed") {
          setInstaller({ phase: "idle" });
          refresh();
        } else if (result.status === "cancelled") {
          setInstaller({ phase: "cancelled" });
        } else {
          setInstaller({ phase: "error", message: result.message ?? "The game files could not be downloaded." });
        }
      } catch (e) {
        if (mounted.current) setInstaller({ phase: "error", message: errorMessage(e) });
      } finally {
        unlisten();
        installing.current = false;
      }
    })();
  }, [refresh]);

  const cancelInstall = useCallback(() => {
    setInstaller((prev) => (prev.phase === "running" ? { ...prev, cancelling: true } : prev));
    api.cancelGameInstall().catch(() => {});
  }, []);

  const play = useCallback((javaPath: string, mode: PlayMode, username: string) => {
    setRun({ phase: "starting" });
    api
      .launchGame(javaPath, mode, mode === "offline" ? username.trim() : null)
      .then((r) => {
        if (!mounted.current) return;
        setRun(r.started ? { phase: "running" } : { phase: "error", message: r.message ?? "Minecraft could not be started." });
      })
      .catch((e) => {
        if (mounted.current) setRun({ phase: "error", message: errorMessage(e) });
      });
  }, []);

  const stop = useCallback(() => {
    api.stopGame().catch(() => {});
  }, []);

  const dismissRun = useCallback(() => setRun({ phase: "idle" }), []);

  return { status, installer, run, install, cancelInstall, play, stop, dismissRun, refresh };
}
