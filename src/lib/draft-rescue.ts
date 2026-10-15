"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * A net under a session that expired mid-entry.
 *
 * A server action that fails because the session is gone leaves the entry
 * sitting in React state — intact, but only until the page reloads. The
 * honest message tells the person not to refresh; this covers them when they
 * refresh anyway, or close the tab, or the browser does it for them.
 *
 * It is deliberately small: the draft is written to this browser's own
 * storage and read back when the desk next opens. Nothing is sent anywhere,
 * nothing touches the database, and the stash is dropped the moment the
 * entry saves for real or the person says they do not want it.
 *
 * Scope worth knowing: per browser. A draft stashed on the office PC will not
 * appear on another machine. For a net under a refresh, that is the right
 * reach — anything wider would mean storing half-finished bills on the server.
 */

const PREFIX = "mapps.draft.";
/* an entry older than this is more likely to confuse than to help */
const KEEP_MS = 2 * 24 * 60 * 60 * 1000;

export type RescuedDraft<T> = { at: number; data: T };

/* Same-tab writes do not raise a storage event, so listeners are kept here
   as well and notified directly. */
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  sweepStale();
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Drop anything too old to be worth offering back. */
function sweepStale() {
  try {
    const cutoff = Date.now() - KEEP_MS;
    const stale: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const name = window.localStorage.key(i);
      if (!name || !name.startsWith(PREFIX)) continue;
      const raw = window.localStorage.getItem(name);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as { at?: number };
        if (typeof parsed?.at !== "number" || parsed.at < cutoff) stale.push(name);
      } catch {
        stale.push(name);
      }
    }
    for (const name of stale) window.localStorage.removeItem(name);
  } catch {
    /* storage unavailable; nothing to sweep */
  }
}

/** The raw stored string, which is stable enough to be a snapshot. */
function readRaw(key: string) {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    /* private windows, blocked site data: there is simply no net */
    return null;
  }
}

export function stashDraft<T>(key: string, data: T) {
  try {
    window.localStorage.setItem(
      PREFIX + key,
      JSON.stringify({ at: Date.now(), data }),
    );
    notify();
  } catch {
    /* out of quota or storage blocked; the entry is still on screen */
  }
}

export function clearDraft(key: string) {
  try {
    window.localStorage.removeItem(PREFIX + key);
    notify();
  } catch {
    /* nothing to clear */
  }
}

/**
 * The draft waiting for this desk, or null.
 *
 * Read through useSyncExternalStore rather than an effect, so it is correct
 * on the server (where there is no storage) without setting state during a
 * render pass.
 */
export function useRescuedDraft<T>(key: string): RescuedDraft<T> | null {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null,
  );

  return useMemo(() => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as RescuedDraft<T>;
      if (!parsed || typeof parsed.at !== "number" || !parsed.data) return null;
      return parsed;
    } catch {
      return null;
    }
  }, [raw]);
}

/** "just now", "12 minutes ago", "3 hours ago", "yesterday". */
export function describeAge(at: number) {
  const minutes = Math.floor((Date.now() - at) / 60000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "a minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "an hour ago";
  if (hours < 24) return `${hours} hours ago`;
  return hours < 48 ? "yesterday" : `${Math.floor(hours / 24)} days ago`;
}
