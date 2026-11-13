import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Profile } from "../api/types";
import { FALLBACK_VERSION, type LoaderId } from "../core/game";

export interface Selection {
  version: string;
  loader: LoaderId;
  versions: string[];
  /** The named profile being played, if any. Choosing a version or loader by hand clears it. */
  profile: Profile | null;
  setVersion: (v: string) => void;
  setLoader: (l: LoaderId) => void;
  selectProfile: (p: Profile | null) => void;
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
export function useSelection(profiles: Profile[] | null = null): Selection {
  const [versions, setVersions] = useState<string[]>([FALLBACK_VERSION]);
  const [version, setVersionState] = useState(() => read("unlimited.version") ?? FALLBACK_VERSION);
  const [loader, setLoaderState] = useState<LoaderId>(() => (read("unlimited.loader") === "vanilla" ? "vanilla" : "fabric"));
  const [profileId, setProfileId] = useState<string | null>(() => read("unlimited.profile"));

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

  const rememberProfile = useCallback((id: string | null) => {
    setProfileId(id);
    write("unlimited.profile", id ?? "");
  }, []);
  const setVersion = useCallback(
    (v: string) => {
      setVersionState(v);
      write("unlimited.version", v);
      rememberProfile(null);
    },
    [rememberProfile],
  );
  const setLoader = useCallback(
    (l: LoaderId) => {
      setLoaderState(l);
      write("unlimited.loader", l);
      rememberProfile(null);
    },
    [rememberProfile],
  );
  const selectProfile = useCallback(
    (p: Profile | null) => {
      if (p) {
        setVersionState(p.minecraft);
        write("unlimited.version", p.minecraft);
        const l: LoaderId = p.fabric ? "fabric" : "vanilla";
        setLoaderState(l);
        write("unlimited.loader", l);
      }
      rememberProfile(p ? p.id : null);
    },
    [rememberProfile],
  );

  // A saved profile only counts while it still exists and still matches the chosen game.
  const profile =
    (profiles ?? []).find((p) => p.id === profileId && p.minecraft === version && p.fabric === (loader === "fabric")) ?? null;

  return { version, loader, versions, profile, setVersion, setLoader, selectProfile };
}
