import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../api/client";

export type ResourceState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

export interface ResourceHandle<T> {
  state: ResourceState<T>;
  reload: () => void;
  set: (data: T) => void;
}

/**
 * Runs `load` on mount and whenever `key` changes or `reload()` is called.
 * A `null` key keeps the resource in the loading state without running `load`.
 */
export function useResource<T>(load: () => Promise<T>, key: string | null = ""): ResourceHandle<T> {
  const [state, setState] = useState<ResourceState<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    setState({ status: "loading" });
    if (key === null) return undefined;
    let cancelled = false;
    loadRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ status: "error", message: errorMessage(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const set = useCallback((data: T) => setState({ status: "ready", data }), []);
  return { state, reload, set };
}
