import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { PlayerAppearance } from "../api/types";

export interface AppearanceState {
  appearance: PlayerAppearance | null;
  loading: boolean;
  error: string | null;
}

/**
 * The real Minecraft look of a player (skin, model and own cape), or a fallback.
 *
 * Repeated lookups are cheap: the backend keeps a short-lived in-memory cache
 * per player, so opening the account menu and the Skins page does not download
 * the same skin again, while a skin changed in game still appears within five
 * minutes. The interface itself keeps no stale copy.
 */
export function usePlayerAppearance(player: string | null): AppearanceState {
  const [appearance, setAppearance] = useState<PlayerAppearance | null>(null);
  const [loading, setLoading] = useState(Boolean(player));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!player) {
      setAppearance(null);
      setLoading(false);
      setError(null);
      return;
    }
    let live = true;
    setLoading(true);
    setError(null);
    void Promise.resolve(api.playerAppearance(player))
      .then((next) => {
        if (!live) return;
        setAppearance(next ?? null);
        setError(next ? null : "The skin could not be loaded.");
      })
      .catch((e: unknown) => {
        if (!live) return;
        setAppearance(null);
        setError(e instanceof Error ? e.message : "The skin could not be loaded.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [player]);

  return { appearance, loading, error };
}
