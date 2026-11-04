import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../api/client";
import { accountFromStatus, type AccountState } from "../core/auth";

export interface Account {
  state: AccountState;
  signIn: () => void;
  cancel: () => void;
  signOut: () => void;
  openLink: (url: string) => void;
  /** Set when opening the browser failed. */
  linkError: string | null;
}

/**
 * Tracks the Microsoft account. `clientId` is the saved Azure client ID (or
 * null); the status is re-read whenever it changes. `ready` is false while
 * Settings are still loading.
 */
export function useAuth(clientId: string | null, ready: boolean): Account {
  const [state, setState] = useState<AccountState>({ phase: "checking" });
  const [linkError, setLinkError] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const set = useCallback((next: AccountState) => {
    if (mounted.current) setState(next);
  }, []);

  useEffect(() => {
    if (!ready || busy.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const quick = await api.authStatus();
        if (cancelled) return;
        if (quick.state === "signedIn" || quick.state === "notConfigured" || !quick.savedLogin) {
          set(accountFromStatus(quick));
          return;
        }
        set({ phase: "checking" });
        const restored = await api.authRestore();
        if (!cancelled) set(accountFromStatus(restored));
      } catch (e) {
        if (!cancelled) set({ phase: "error", message: errorMessage(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, ready, set]);

  const signIn = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    setLinkError(null);
    set({ phase: "starting" });
    void (async () => {
      let unlisten: () => void = () => {};
      try {
        unlisten = await api.onAuthDeviceCode((code) => set({ phase: "waiting", code }));
        set(accountFromStatus(await api.authSignIn()));
      } catch (e) {
        set({ phase: "error", message: errorMessage(e) });
      } finally {
        unlisten();
        busy.current = false;
      }
    })();
  }, [set]);

  const cancel = useCallback(() => {
    api.authCancel().catch(() => {
      /* nothing to cancel */
    });
  }, []);

  const signOut = useCallback(() => {
    void (async () => {
      try {
        set(accountFromStatus(await api.authSignOut()));
      } catch (e) {
        set({ phase: "error", message: errorMessage(e) });
      }
    })();
  }, [set]);

  const openLink = useCallback((url: string) => {
    setLinkError(null);
    api.openMicrosoftLink(url).catch((e: unknown) => setLinkError(errorMessage(e)));
  }, []);

  return { state, signIn, cancel, signOut, openLink, linkError };
}
