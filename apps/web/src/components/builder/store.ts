import { decodeDeck, emptyDeck, type DeckFormat, type DeckList, type PoolCard } from "@cr/core";

/** Rascunho do deckbuilder. Fica no navegador (localStorage); só vai para o servidor quando o usuário salva. */
export interface Draft {
  name: string;
  format: DeckFormat;
  deck: DeckList;
  /** Id do deck salvo na conta que este rascunho edita, se houver. */
  savedId: string | null;
  visibility: "private" | "unlisted" | "public";
}

const KEY = "cr:deck";
const blank = (): Draft => ({ name: "", format: "constructed", deck: emptyDeck(), savedId: null, visibility: "private" });
const VIS = ["private", "unlisted", "public"] as const;

let current: Draft | null = null;
const listeners = new Set<() => void>();

function load(pool: Map<string, PoolCard>): Draft {
  // Um link com ?code= abre aquele deck por cima do rascunho.
  const code = new URLSearchParams(window.location.search).get("code");
  if (code) {
    try {
      const { deck } = decodeDeck(code, pool);
      const params = new URLSearchParams(window.location.search);
      const name = params.get("name") ?? "";
      const savedId = params.get("deck");
      const vis = params.get("vis");
      const draft: Draft = {
        ...blank(),
        name: name.slice(0, 80),
        deck,
        format: params.get("fmt") === "casual" ? "casual" : "constructed",
        savedId: savedId && /^[a-z0-9]{6,20}$/.test(savedId) ? savedId : null,
        visibility: VIS.includes(vis as never) ? (vis as Draft["visibility"]) : "private",
      };
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
        savedId: typeof d.savedId === "string" ? d.savedId : null,
        visibility: VIS.includes(d.visibility as never) ? d.visibility! : "private",
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
