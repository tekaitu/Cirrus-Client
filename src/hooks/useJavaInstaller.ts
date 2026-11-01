import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../api/client";
import type { SettingsState } from "../api/types";
import { IDLE, stateFromResult, type InstallerState } from "../core/installer";

export interface JavaInstaller {
  state: InstallerState;
  start: () => void;
  cancel: () => void;
  dismiss: () => void;
}

interface Options {
  /** Called with Settings as the backend saved them after a successful install. */
  onSettings: (state: SettingsState) => void;
  /** Called after a successful install that did not change Settings. */
  onNoSettingsChange: () => void;
}

export function useJavaInstaller({ onSettings, onNoSettingsChange }: Options): JavaInstaller {
  const [state, setState] = useState<InstallerState>(IDLE);
  const running = useRef(false);
  const callbacks = useRef({ onSettings, onNoSettingsChange });
  callbacks.current = { onSettings, onNoSettingsChange };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const start = useCallback(() => {
    if (running.current) return;
    running.current = true;
    setState({ phase: "running", progress: null, cancelling: false });

    void (async () => {
      let unlisten: () => void = () => {};
      try {
        unlisten = await api.onJavaInstallProgress((progress) => {
          if (!mounted.current) return;
          setState((prev) => (prev.phase === "running" ? { ...prev, progress } : prev));
        });
        const result = await api.installJava();
        if (result.status === "installed" || result.status === "alreadyInstalled") {
          if (result.settings) callbacks.current.onSettings(result.settings);
          else callbacks.current.onNoSettingsChange();
        }
        if (mounted.current) setState(stateFromResult(result));
      } catch (e) {
        if (mounted.current) setState({ phase: "error", message: errorMessage(e) });
      } finally {
        unlisten();
        running.current = false;
      }
    })();
  }, []);

  const cancel = useCallback(() => {
    setState((prev) => (prev.phase === "running" ? { ...prev, cancelling: true } : prev));
    api.cancelJavaInstall().catch(() => {
      /* nothing to cancel any more */
    });
  }, []);

  const dismiss = useCallback(() => {
    if (!running.current) setState(IDLE);
  }, []);

  return { state, start, cancel, dismiss };
}
