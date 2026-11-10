import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { FALLBACK_VERSION, type LoaderId } from "../core/game";

export interface Selection {
  version: string;
  loader: LoaderId;
  versions: string[];
  setVersion: (v: string) => void;
  setLoader: (l: LoaderId) => void;
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

/** Which Minecraft version and loader the person wants. Remembered between runs. */
export function useSelection(): Selection {
  const [versions, setVersions] = useState<string[]>([FALLBACK_VERSION]);
  const [version, setVersionState] = useState(() => read("unlimited.version") ?? FALLBACK_VERSION);
  const [loader, setLoaderState] = useState<LoaderId>(() => (read("unlimited.loader") === "vanilla" ? "vanilla" : "fabric"));

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

  const setVersion = useCallback((v: string) => {
    setVersionState(v);
    write("unlimited.version", v);
  }, []);
  const setLoader = useCallback((l: LoaderId) => {
    setLoaderState(l);
    write("unlimited.loader", l);
  }, []);

  return { version, loader, versions, setVersion, setLoader };
}
