import { useSyncExternalStore } from "react";

/**
 * Maple draws its own title bar (minimise, maximise, close). If that ever misbehaves on a PC, Settings >
 * Appearance can switch back to the normal Windows frame. The choice is remembered.
 */

const KEY = "cirrus.nativeFrame";
const listeners = new Set<() => void>();

export function insideTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function getNativeFrame(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

async function withWindow(run: (w: import("@tauri-apps/api/window").Window) => Promise<unknown>) {
  if (!insideTauri()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await run(getCurrentWindow());
  } catch {
    /* a window button that cannot act simply does nothing */
  }
}

/** Switches between the Maple title bar and the Windows frame. */
export function setNativeFrame(native: boolean) {
  try {
    window.localStorage.setItem(KEY, native ? "1" : "0");
  } catch {
    /* remembered when possible */
  }
  void withWindow((w) => w.setDecorations(native));
  listeners.forEach((l) => l());
}

/** Call once at start so a saved choice of the Windows frame is restored. */
export function initWindowFrame() {
  if (getNativeFrame()) void withWindow((w) => w.setDecorations(true));
}

export const windowActions = {
  minimize: () => void withWindow((w) => w.minimize()),
  toggleMaximize: () => void withWindow((w) => w.toggleMaximize()),
  close: () => void withWindow((w) => w.close()),
};

/** True while Maple draws its own title bar (inside the desktop app, and not switched to the Windows frame). */
export function useCustomFrame(): boolean {
  const native = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getNativeFrame,
    () => false,
  );
  return insideTauri() && !native;
}

export function useNativeFrame(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getNativeFrame,
    () => false,
  );
}
