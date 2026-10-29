"use client";

import { useSyncExternalStore, type ReactNode } from "react";

type View = "list" | "images";
const KEY = "deck-view";
const listeners = new Set<() => void>();
/** Escolha desta visita, para quando o navegador não deixa gravar. */
let memory: View | null = null;

function read(): View | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "images" || v === "list" ? v : null;
  } catch {
    // Sem armazenamento local: fica no padrão.
    return null;
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}

function write(v: View) {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    // Idem: a troca vale só até sair da página.
  }
  memory = v;
  listeners.forEach((fn) => fn());
}

/** Alterna entre a grade de imagens e a lista em texto; a escolha fica lembrada neste navegador. */
export function DeckViewToggle({
  list,
  images,
  defaultView = "images",
  labels,
}: {
  list: ReactNode;
  images: ReactNode;
  defaultView?: View;
  labels: { view: string; list: string; images: string };
}) {
  const view = useSyncExternalStore(subscribe, () => memory ?? read() ?? defaultView, () => defaultView);
  return (
    <div className="mt-8">
      <div role="group" aria-label={labels.view} className="inline-flex rounded-full border border-border p-0.5 text-sm">
        {(["images", "list"] as const).map((v) => (
          <button
            key={v}
            onClick={() => write(v)}
            aria-pressed={view === v}
            className={`rounded-full px-3 py-1 ${view === v ? "bg-accent text-accent-ink" : "text-muted hover:text-text"}`}
          >
            {labels[v]}
          </button>
        ))}
      </div>
      <div className="mt-5">{view === "list" ? list : images}</div>
    </div>
  );
}
