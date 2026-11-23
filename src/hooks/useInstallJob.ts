import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../api/client";
import type { GameProgress } from "../api/types";
import type { LoaderId } from "../core/game";
import { createSingleFlight } from "../core/singleFlight";

export interface InstallJob {
  phase: "idle" | "running" | "done" | "error" | "cancelled";
  progress: GameProgress | null;
  message: string | null;
  cancelling: boolean;
  /** Downloads one version and loader. A second click while running is ignored. */
  start: (version: string, loader: LoaderId, loaderVersion?: string | null) => void;
  cancel: () => void;
  reset: () => void;
}

/**
 * A single Minecraft download, separate from the selected instance, so the
 * Versions page can install anything it shows while the Library keeps playing
 * what it already has. Progress comes from the backend's real file counts.
 */
export function useInstallJob(onDone?: () => void): InstallJob {
  const [phase, setPhase] = useState<InstallJob["phase"]>("idle");
  const [progress, setProgress] = useState<GameProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const gate = useRef(createSingleFlight()).current;
  const mounted = useRef(true);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const start = useCallback(
    (version: string, loader: LoaderId, loaderVersion: string | null = null) => {
      if (gate.busy) return;
      setPhase("running");
      setProgress(null);
      setMessage(null);
      setCancelling(false);
      void gate.run(async () => {
        let unlisten: () => void = () => {};
        try {
          unlisten = await api.onGameProgress((p) => {
            if (mounted.current) setProgress(p);
          });
          const result = await api.installGame(version, loader, loaderVersion);
          if (!mounted.current) return;
          if (result.status === "installed") {
            setPhase("done");
            doneRef.current?.();
          } else if (result.status === "cancelled") {
            setPhase("cancelled");
          } else {
            setPhase("error");
            setMessage(result.message ?? "The game files could not be downloaded.");
          }
        } catch (e) {
          if (!mounted.current) return;
          setPhase("error");
          setMessage(errorMessage(e));
        } finally {
          if (mounted.current) setCancelling(false);
          unlisten();
        }
      });
    },
    [gate],
  );

  const cancel = useCallback(() => {
    setCancelling(true);
    api.cancelGameInstall().catch(() => {});
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setProgress(null);
    setMessage(null);
  }, []);

  return { phase, progress, message, cancelling, start, cancel, reset };
}
