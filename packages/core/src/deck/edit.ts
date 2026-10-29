import { canBeChampion, DECK_RULES } from "./rules";
import type { DeckList, PoolCard } from "./types";

export type Zone = "legend" | "champion" | "main" | "side" | "runes" | "battlefields" | "extraLegends";

/** Para onde vai uma carta clicada, se o usuário não escolher. */
export function defaultZone(c: PoolCard, deck: DeckList, pool: Map<string, PoolCard>): Zone {
  if (c.type === "Legend") return "legend";
  if (c.type === "Rune") return "runes";
  if (c.type === "Battlefield") return "battlefields";
  const legend = deck.legend ? pool.get(deck.legend) ?? null : null;
  if (!deck.champion && legend && canBeChampion(c, legend)) return "champion";
  return "main";
}

const bump = (r: Record<string, number>, id: string, by: number) => {
  const next = { ...r };
  const n = (next[id] ?? 0) + by;
  if (n > 0) next[id] = n;
  else delete next[id];
  return next;
};

/** Adiciona uma cópia na zona. Não valida: o deck pode ficar ilegal e o painel mostra o porquê. */
export function addCard(deck: DeckList, c: PoolCard, zone: Zone): DeckList {
  switch (zone) {
    case "legend":
      return { ...deck, legend: c.id, extraLegends: deck.extraLegends.filter((id) => id !== c.id) };
    case "champion":
      // O campeão antigo continua no deck como cópia comum.
      return { ...deck, champion: c.id, main: deck.champion ? bump(deck.main, deck.champion, 1) : deck.main };
    case "main":
      return { ...deck, main: bump(deck.main, c.id, 1) };
    case "side":
      return { ...deck, side: bump(deck.side, c.id, 1) };
    case "runes":
      return { ...deck, runes: bump(deck.runes, c.id, 1) };
    case "battlefields":
      return deck.battlefields.includes(c.id) || deck.battlefields.length >= DECK_RULES.battlefields ? deck : { ...deck, battlefields: [...deck.battlefields, c.id] };
    case "extraLegends":
      return deck.extraLegends.includes(c.id) || deck.legend === c.id || deck.extraLegends.length >= DECK_RULES.extraLegends
        ? deck
        : { ...deck, extraLegends: [...deck.extraLegends, c.id] };
  }
}

/** Tira uma cópia da zona. */
export function removeCard(deck: DeckList, id: string, zone: Zone): DeckList {
  switch (zone) {
    case "legend":
      return deck.legend === id ? { ...deck, legend: null } : deck;
    case "champion":
      if (deck.champion !== id) return deck;
      // Se há outra cópia no deck, ela vira o campeão.
      return deck.main[id] ? { ...deck, main: bump(deck.main, id, -1) } : { ...deck, champion: null };
    case "main":
      return { ...deck, main: bump(deck.main, id, -1) };
    case "side":
      return { ...deck, side: bump(deck.side, id, -1) };
    case "runes":
      return { ...deck, runes: bump(deck.runes, id, -1) };
    case "battlefields":
      return { ...deck, battlefields: deck.battlefields.filter((b) => b !== id) };
    case "extraLegends":
      return { ...deck, extraLegends: deck.extraLegends.filter((b) => b !== id) };
  }
}

/** Passa uma cópia entre o deck principal e o sideboard. */
export function moveCard(deck: DeckList, id: string, from: "main" | "side"): DeckList {
  const src = from === "main" ? deck.main : deck.side;
  if (!src[id]) return deck;
  return from === "main"
    ? { ...deck, main: bump(deck.main, id, -1), side: bump(deck.side, id, 1) }
    : { ...deck, side: bump(deck.side, id, -1), main: bump(deck.main, id, 1) };
}

/** Marca uma carta do deck como campeão escolhido (a cópia sai do deck principal). */
export function makeChampion(deck: DeckList, id: string): DeckList {
  if (deck.champion === id || !deck.main[id]) return deck;
  const main = bump(deck.main, id, -1);
  return { ...deck, champion: id, main: deck.champion ? bump(main, deck.champion, 1) : main };
}

/** Curva de energia do deck principal (campeão incluído): custo → cópias; 7+ juntos. */
export function energyCurve(deck: DeckList, pool: Map<string, PoolCard>): number[] {
  const curve = Array.from({ length: 8 }, () => 0);
  const add = (id: string, n: number) => {
    const c = pool.get(id);
    if (!c || c.energyCost === null) return;
    curve[Math.min(c.energyCost, 7)]! += n;
  };
  if (deck.champion) add(deck.champion, 1);
  for (const [id, n] of Object.entries(deck.main)) add(id, n);
  return curve;
}
