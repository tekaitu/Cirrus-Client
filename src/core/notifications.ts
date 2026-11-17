import { useSyncExternalStore } from "react";

export type NoticeTone = "info" | "good" | "warn" | "bad";

export interface AppNotification {
  id: string;
  title: string;
  body?: string;
  tone: NoticeTone;
  at: number;
  read: boolean;
}

const KEY = "cirrus.notifications";
const MAX = 30;

function load(): AppNotification[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as AppNotification[]) : [];
    return Array.isArray(list) ? list.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

let items: AppNotification[] = load();
const listeners = new Set<() => void>();

function commit(next: AppNotification[]) {
  items = next.slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* the list just will not survive a restart */
  }
  listeners.forEach((l) => l());
}

/** Adds a notification to the bell. Only call this for something that really happened. */
export function notify(n: { title: string; body?: string; tone?: NoticeTone }): void {
  commit([{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: n.title, body: n.body, tone: n.tone ?? "info", at: Date.now(), read: false }, ...items]);
}

export function markAllRead(): void {
  if (items.some((i) => !i.read)) commit(items.map((i) => ({ ...i, read: true })));
}

export function clearNotifications(): void {
  commit([]);
}

/** Test helper. */
export function resetNotifications(): void {
  commit([]);
}

export function useNotifications(): AppNotification[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
    () => items,
  );
}

export function getNotifications(): AppNotification[] {
  return items;
}

export function unreadCount(): number {
  return items.filter((i) => !i.read).length;
}
