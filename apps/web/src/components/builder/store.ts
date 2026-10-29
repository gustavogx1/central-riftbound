import { decodeDeck, emptyDeck, type DeckFormat, type DeckList, type PoolCard } from "@cr/core";

/** Rascunho do deckbuilder. Fica no navegador (localStorage); nada vai para o servidor. */
export interface Draft {
  name: string;
  format: DeckFormat;
  deck: DeckList;
}

const KEY = "cr:deck";
const blank = (): Draft => ({ name: "", format: "constructed", deck: emptyDeck() });

let current: Draft | null = null;
const listeners = new Set<() => void>();

function load(pool: Map<string, PoolCard>): Draft {
  // Um link com ?code= abre aquele deck por cima do rascunho.
  const code = new URLSearchParams(window.location.search).get("code");
  if (code) {
    try {
      const { deck } = decodeDeck(code, pool);
      const name = new URLSearchParams(window.location.search).get("name") ?? "";
      const draft = { ...blank(), name: name.slice(0, 80), deck };
      save(draft);
      window.history.replaceState(null, "", window.location.pathname);
      return draft;
    } catch {
      // Código inválido: segue com o rascunho salvo.
    }
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<Draft>;
      const deck = { ...emptyDeck(), ...d.deck };
      // Descarta cartas que saíram do banco.
      const known = (id: string | null) => (id && pool.has(id) ? id : null);
      const keep = (r: Record<string, number>) => Object.fromEntries(Object.entries(r ?? {}).filter(([id, n]) => pool.has(id) && n > 0));
      return {
        name: typeof d.name === "string" ? d.name : "",
        format: d.format === "casual" ? "casual" : "constructed",
        deck: {
          legend: known(deck.legend),
          champion: known(deck.champion),
          main: keep(deck.main),
          side: keep(deck.side),
          runes: keep(deck.runes),
          battlefields: (deck.battlefields ?? []).filter((id) => pool.has(id)),
          extraLegends: (deck.extraLegends ?? []).filter((id) => pool.has(id)),
        },
      };
    }
  } catch {
    // Navegação privada ou JSON estragado: começa do zero.
  }
  return blank();
}

function save(d: Draft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // Sem localStorage: o deck vale só nesta aba.
  }
}

export function createDraftStore(pool: Map<string, PoolCard>) {
  return {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSnapshot(): Draft {
      if (!current) current = load(pool);
      return current;
    },
    getServerSnapshot(): Draft | null {
      return null;
    },
    set(update: (d: Draft) => Draft) {
      current = update(current ?? load(pool));
      save(current);
      for (const fn of listeners) fn();
    },
  };
}

export type DraftStore = ReturnType<typeof createDraftStore>;
