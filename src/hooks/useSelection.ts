import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { InstanceView } from "../api/types";
import { FALLBACK_VERSION, type LoaderId } from "../core/game";

export interface Selection {
  /** The Minecraft version to install or play when no instance is chosen. */
  version: string;
  loader: LoaderId;
  versions: string[];
  /** The installed instance the Play button uses, when one is chosen. */
  instance: InstanceView | null;
  setVersion: (v: string) => void;
  setLoader: (l: LoaderId) => void;
  selectInstance: (i: InstanceView | null) => void;
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* remembered choices are a convenience only */
  }
}

/**
 * Which instance the launcher is working with. The choice survives restarts; a
 * saved instance that no longer exists is ignored, and a version/loader picked
 * by hand clears it so the two can never disagree.
 */
export function useSelection(instances: InstanceView[] | null = null): Selection {
  const [versions, setVersions] = useState<string[]>([FALLBACK_VERSION]);
  const [version, setVersionState] = useState(() => read("unlimited.version") ?? FALLBACK_VERSION);
  const [loader, setLoaderState] = useState<LoaderId>(() => (read("unlimited.loader") === "vanilla" ? "vanilla" : "fabric"));
  const [instanceId, setInstanceId] = useState<string | null>(() => read("unlimited.instance") || null);

  useEffect(() => {
    let alive = true;
    void Promise.resolve()
      .then(() => api.listGameVersions())
      .then((list) => {
        if (!alive || !Array.isArray(list) || list.length === 0) return;
        setVersions(list);
        setVersionState((current) => (list.includes(current) ? current : list[0]));
      })
      .catch(() => {
        /* outside the desktop app the built-in version is used */
      });
    return () => {
      alive = false;
    };
  }, []);

  const rememberInstance = useCallback((id: string | null) => {
    setInstanceId(id);
    write("unlimited.instance", id ?? "");
  }, []);

  const setVersion = useCallback(
    (v: string) => {
      setVersionState(v);
      write("unlimited.version", v);
      rememberInstance(null);
    },
    [rememberInstance],
  );
  const setLoader = useCallback(
    (l: LoaderId) => {
      setLoaderState(l);
      write("unlimited.loader", l);
      rememberInstance(null);
    },
    [rememberInstance],
  );
  const selectInstance = useCallback(
    (i: InstanceView | null) => {
      if (i) {
        setVersionState(i.minecraft);
        write("unlimited.version", i.minecraft);
        setLoaderState(i.loader);
        write("unlimited.loader", i.loader);
      }
      rememberInstance(i ? i.id : null);
    },
    [rememberInstance],
  );

  const instance = (instances ?? []).find((i) => i.id === instanceId) ?? null;

  // A saved instance that is gone (or renamed by a loader change) must not leave
  // the launcher pointing at something that is not there. Matching the saved
  // version and loader keeps the card selected across a loader switch.
  useEffect(() => {
    if (!instances || instances.length === 0 || instance) return;
    if (!instanceId) return;
    const match = instances.find((i) => i.minecraft === version && i.loader === loader);
    if (match) rememberInstance(match.id);
    else rememberInstance(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instances, instance, instanceId]);

  return { version, loader, versions, instance, setVersion, setLoader, selectInstance };
}
