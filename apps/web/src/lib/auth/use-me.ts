"use client";

import { useSyncExternalStore } from "react";

export interface Me {
  enabled: boolean;
  user: { name: string } | null;
}

let me: Me | null = null;
let started = false;
const listeners = new Set<() => void>();

function start() {
  if (started) return;
  started = true;
  fetch("/api/me", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Me>) : { enabled: false, user: null }))
    .catch(() => ({ enabled: false, user: null }))
    .then((v) => {
      me = v;
      for (const fn of listeners) fn();
    });
}

/** Quem está logado, buscado uma vez por página. `null` enquanto carrega (e no servidor). */
export function useMe(): Me | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      start();
      return () => listeners.delete(fn);
    },
    () => me,
    () => null,
  );
}
