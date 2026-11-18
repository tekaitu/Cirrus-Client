import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "../api/client";
import type { PlayerAppearance } from "../api/types";

export interface AppearanceState {
  appearance: PlayerAppearance | null;
  loading: boolean;
  error: string | null;
  /** Fetches the skin again, for when it was changed in game. */
  reload: () => void;
}

/**
 * One shared copy of each player's appearance.
 *
 * The header, dashboard, account menu and Character page all show the same
 * player. Keeping one cache with one in-flight request per player means they
 * cannot disagree, Mojang is not asked four times at once, and Refresh in any
 * of them updates every head and the 3D figure immediately.
 */
interface Entry {
  appearance: PlayerAppearance | null;
  error: string | null;
  at: number;
}

const TTL = 5 * 60 * 1000;
const entries = new Map<string, Entry>();
const inflight = new Map<string, Promise<void>>();
const pending = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

const keyOf = (player: string) => player.trim().toLowerCase();

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot() {
  return version;
}

async function load(player: string, force: boolean): Promise<void> {
  const key = keyOf(player);
  if (!key) return;

  const cached = entries.get(key);
  if (!force) {
    if (cached && Date.now() - cached.at < TTL) return;
    const running = inflight.get(key);
    if (running) return running;
  } else {
    entries.delete(key);
  }

  pending.add(key);
  emit();
  let request: Promise<void>;
  request = api
    .playerAppearance(player, force)
    .then((next) => {
      entries.set(key, {
        appearance: next ?? null,
        error: next ? null : "The skin could not be loaded.",
        at: Date.now(),
      });
    })
    .catch((e: unknown) => {
      entries.set(key, {
        appearance: null,
        error: e instanceof Error ? e.message : "The skin could not be loaded.",
        at: Date.now(),
      });
    })
    .finally(() => {
      pending.delete(key);
      if (inflight.get(key) === request) inflight.delete(key);
      emit();
    });
  if (!force) inflight.set(key, request);
  return request;
}

/** Forgets every remembered appearance. Used by tests and sign-out. */
export function resetAppearanceCache() {
  entries.clear();
  inflight.clear();
  pending.clear();
  emit();
}

/** The real Minecraft look of a player, shared by every place that shows it. */
export function usePlayerAppearance(player: string | null): AppearanceState {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    if (player) void load(player, false);
  }, [player]);

  const key = player ? keyOf(player) : "";
  const entry = key ? entries.get(key) : undefined;
  const loading = Boolean(key) && (pending.has(key) || !entry);
  const reload = useCallback(() => {
    if (player) void load(player, true);
  }, [player]);

  return {
    appearance: entry?.appearance ?? null,
    loading,
    error: entry?.error ?? null,
    reload,
  };
}
