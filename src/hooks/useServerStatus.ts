import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "../api/client";
import type { ServerStatus } from "../api/types";

/** How long a real answer is reused before the launcher asks the server again. */
const CACHE_MS = 45_000;
/** A page that stays open refreshes its servers on this interval, not per render. */
const REFRESH_MS = 90_000;

const cache = new Map<string, { at: number; status: ServerStatus }>();

/** Tests only: forget every cached answer so each case starts from a real check. */
export function resetServerStatusCache() {
  cache.clear();
}

export type ServerStatusState =
  | { phase: "loading" }
  | { phase: "ready"; status: ServerStatus }
  | { phase: "unavailable"; message: string };

/**
 * One server's live status.
 *
 * The launcher asks the server itself through `server_status`. An answer is
 * reused briefly so switching pages does not ping the server again, and a
 * failed check is shown as unavailable — never as offline, and never with
 * invented numbers.
 */
export function useServerStatus(address: string) {
  const [state, setState] = useState<ServerStatusState>(() => {
    const hit = cache.get(address);
    return hit ? { phase: "ready", status: hit.status } : { phase: "loading" };
  });
  const mounted = useRef(true);
  const checking = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(
    async (force = false) => {
      if (checking.current) return;
      const hit = cache.get(address);
      if (!force && hit && Date.now() - hit.at < CACHE_MS) {
        setState({ phase: "ready", status: hit.status });
        return;
      }
      checking.current = true;
      try {
        const status = await api.serverStatus(address);
        cache.set(address, { at: Date.now(), status });
        if (mounted.current) setState({ phase: "ready", status });
      } catch (e) {
        if (mounted.current) setState({ phase: "unavailable", message: errorMessage(e) });
      } finally {
        checking.current = false;
      }
    },
    [address],
  );

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(true), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { state, refresh };
}
