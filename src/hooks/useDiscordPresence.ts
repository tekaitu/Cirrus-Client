import { useEffect, useRef } from "react";
import { api } from "../api/client";
import { presenceFor } from "../core/discord";
import type { PageId } from "../components/Navigation";

interface Options {
  enabled: boolean;
  page: PageId;
  running: boolean;
  version: string;
  loader: string;
}

/**
 * Keeps the Discord status in step with the launcher. Failures are ignored on
 * purpose: Discord not being open must never get in the way of playing.
 */
export function useDiscordPresence({ enabled, page, running, version, loader }: Options): void {
  const openedAt = useRef(Math.floor(Date.now() / 1000));
  const gameStartedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      void Promise.resolve()
        .then(() => api.discordClearPresence())
        .catch(() => {});
      return;
    }
    if (running && gameStartedAt.current === null) gameStartedAt.current = Math.floor(Date.now() / 1000);
    if (!running) gameStartedAt.current = null;
    const presence = presenceFor({
      page,
      running,
      version,
      loader,
      startedAt: gameStartedAt.current ?? openedAt.current,
    });
    void Promise.resolve()
      .then(() => api.discordSetPresence(presence))
      .catch(() => {});
  }, [enabled, page, running, version, loader]);
}
