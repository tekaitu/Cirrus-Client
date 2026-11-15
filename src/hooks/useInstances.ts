import { api } from "../api/client";
import type { InstanceSummary } from "../api/types";
import type { LoaderId } from "../core/game";
import type { AppData } from "./useAppData";
import { useResource, type ResourceHandle } from "./useResource";

/** Every Minecraft version installed on this PC. Reloads when the game finishes installing. */
export function useInstances(data: AppData): ResourceHandle<InstanceSummary[]> {
  const installedNow = data.game.status?.installed ?? null;
  return useResource<InstanceSummary[]>(() => api.listInstances(), String(installedNow));
}

export function loaderOf(i: InstanceSummary): LoaderId {
  return i.loader ? "fabric" : "vanilla";
}

export function loaderLabel(l: LoaderId): string {
  return l === "fabric" ? "Fabric" : "Vanilla";
}
