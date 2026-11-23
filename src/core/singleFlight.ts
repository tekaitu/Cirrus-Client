/**
 * One action, one instance.
 *
 * The interface has several fire-and-forget actions (starting the game,
 * opening a folder, launching a browser) where two quick clicks used to reach
 * the desktop layer twice. A single-flight gate belongs at the layer that owns
 * the action: the first call enters, every call made while it is still running
 * is dropped, and the gate opens again when the work settles — successfully or
 * not — so the control never stays stuck.
 */
export interface SingleFlight {
  /** True while a call is in flight. */
  readonly busy: boolean;
  /**
   * Runs `task` unless another one is running. Returns its result, or null when
   * the call was dropped. The gate is always released, even when task throws.
   */
  run<T>(task: () => Promise<T>): Promise<T | null>;
}

export function createSingleFlight(): SingleFlight {
  let busy = false;
  return {
    get busy() {
      return busy;
    },
    async run<T>(task: () => Promise<T>): Promise<T | null> {
      if (busy) return null;
      busy = true;
      try {
        return await task();
      } finally {
        busy = false;
      }
    },
  };
}
