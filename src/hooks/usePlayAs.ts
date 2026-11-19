import { useCallback, useSyncExternalStore } from "react";
import type { PlayMode } from "../core/game";

/**
 * Who Minecraft starts as: a Microsoft account, or a name typed in for offline
 * ("cracked") play.
 *
 * The choice lives in localStorage so it survives a restart and is read by the
 * same keys the Play panel always used. Every part of the window that shows the
 * player listens here, so choosing a name in the account panel also changes the
 * Home screen and the header at once.
 */

const MODE_KEY = "unlimited.playMode";
const NAME_KEY = "unlimited.username";
const CHANGE = "cirrus:play-as";

export interface PlayAs {
  /** "microsoft" uses the signed-in account; "offline" uses `name`. */
  mode: PlayMode;
  name: string;
  setMode: (mode: PlayMode) => void;
  setName: (name: string) => void;
  /** Switches to offline play as this name. */
  useOffline: (name: string) => void;
  /** Switches back to the Microsoft account. */
  useMicrosoft: () => void;
}

function read(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* the choice is a convenience only */
  }
}

function announce() {
  window.dispatchEvent(new Event(CHANGE));
}

function readMode(): PlayMode {
  return read(MODE_KEY) === "offline" ? "offline" : "microsoft";
}

// useSyncExternalStore needs the same object back until something changed, so
// the last answer is kept and only replaced when the stored values differ.
let cached = { mode: "microsoft" as PlayMode, name: "" };

function snapshot(): { mode: PlayMode; name: string } {
  const mode = readMode();
  const name = read(NAME_KEY);
  if (mode !== cached.mode || name !== cached.name) cached = { mode, name };
  return cached;
}

function subscribe(onChange: () => void) {
  const on = () => onChange();
  window.addEventListener(CHANGE, on);
  window.addEventListener("storage", on);
  return () => {
    window.removeEventListener(CHANGE, on);
    window.removeEventListener("storage", on);
  };
}

export function usePlayAs(): PlayAs {
  const { mode, name } = useSyncExternalStore(subscribe, snapshot, snapshot);

  const setMode = useCallback((next: PlayMode) => {
    write(MODE_KEY, next);
    announce();
  }, []);

  const setName = useCallback((next: string) => {
    write(NAME_KEY, next);
    announce();
  }, []);

  const useOffline = useCallback((next: string) => {
    write(NAME_KEY, next);
    write(MODE_KEY, "offline");
    announce();
  }, []);

  const useMicrosoft = useCallback(() => {
    write(MODE_KEY, "microsoft");
    announce();
  }, []);

  return { mode, name, setMode, setName, useOffline, useMicrosoft };
}
