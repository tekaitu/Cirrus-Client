import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../api/client";
import { accountFromStatus, type AccountState, type SignInMethod } from "../core/auth";
import type { AccountRef, AuthStatus } from "../api/types";

export interface Account {
  state: AccountState;
  /** Every account signed in on this PC, newest first. */
  accounts: AccountRef[];
  /** The account the live session belongs to. */
  activeId: string | null;
  /** "window" (default): Microsoft's own page in a window. "code": type a code in your own browser. */
  signIn: (method?: SignInMethod) => void;
  cancel: () => void;
  /** Signs out one saved account, or the active one when no id is given. */
  signOut: (id?: string) => void;
  /** Makes another saved account active. */
  switchAccount: (id: string) => void;
  openLink: (url: string) => void;
  /** Set when opening the browser failed. */
  linkError: string | null;
}

/**
 * Tracks the Microsoft accounts. `ready` is false while Settings are still
 * loading; the saved account is then restored silently from Windows
 * Credential Manager. Nothing here ever receives a token.
 */
export function useAuth(ready: boolean): Account {
  const [state, setState] = useState<AccountState>({ phase: "checking" });
  const [accounts, setAccounts] = useState<AccountRef[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
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

  /** Takes everything a status answer says: the account, the list and the active id. */
  const adopt = useCallback(
    (status: AuthStatus) => {
      set(accountFromStatus(status));
      setAccounts(status.accounts ?? []);
      setActiveId(status.activeId ?? status.profile?.id ?? null);
    },
    [set],
  );

  useEffect(() => {
    if (!ready || busy.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const quick = await api.authStatus();
        if (cancelled) return;
        if (quick.state === "signedIn" || quick.state === "notConfigured" || !quick.savedLogin) {
          set(accountFromStatus(quick));
          setAccounts(quick.accounts ?? []);
          setActiveId(quick.activeId ?? quick.profile?.id ?? null);
          return;
        }
        set({ phase: "checking" });
        const restored = await api.authRestore();
        if (!cancelled) adopt(restored);
      } catch (e) {
        if (!cancelled) set({ phase: "error", message: errorMessage(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, set, adopt]);

  const signIn = useCallback(
    (method: SignInMethod = "window") => {
      if (busy.current) return;
      busy.current = true;
      setLinkError(null);
      set({ phase: "starting", method });
      void (async () => {
        let unlisten: () => void = () => {};
        try {
          if (method === "code") {
            unlisten = await api.onAuthDeviceCode((code) => set({ phase: "waiting", code }));
            adopt(await api.authSignIn());
          } else {
            adopt(await api.authSignInWindow());
          }
        } catch (e) {
          set({ phase: "error", message: errorMessage(e) });
        } finally {
          unlisten();
          busy.current = false;
        }
      })();
    },
    [set, adopt],
  );

  const cancel = useCallback(() => {
    api.authCancel().catch(() => {
      /* nothing to cancel */
    });
  }, []);

  const signOut = useCallback(
    (id?: string) => {
      void (async () => {
        try {
          adopt(await api.authSignOut(id ?? null));
        } catch (e) {
          set({ phase: "error", message: errorMessage(e) });
        }
      })();
    },
    [set, adopt],
  );

  const switchAccount = useCallback(
    (id: string) => {
      if (busy.current) return;
      busy.current = true;
      setLinkError(null);
      set({ phase: "checking" });
      void (async () => {
        try {
          adopt(await api.authSwitch(id));
        } catch (e) {
          set({ phase: "error", message: errorMessage(e) });
        } finally {
          busy.current = false;
        }
      })();
    },
    [set, adopt],
  );

  const openLink = useCallback((url: string) => {
    setLinkError(null);
    api.openMicrosoftLink(url).catch((e: unknown) => setLinkError(errorMessage(e)));
  }, []);

  return { state, accounts, activeId, signIn, cancel, signOut, switchAccount, openLink, linkError };
}
