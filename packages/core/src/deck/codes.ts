import { getCodeFromDeck, getDeckFromCode, type Deck } from "@piltoverarchive/riftbound-deck-codes";
import { emptyDeck, type DeckList, type PoolCard } from "./types";

/**
 * Códigos de deck no formato aberto do Piltover Archive (Apache-2.0), o mesmo de
 * outros sites da comunidade. A lenda, as runas e os campos de batalha vão junto
 * das cartas do deck principal; o campeão escolhido vai marcado à parte.
 */
export function encodeDeck(deck: DeckList, pool: Map<string, PoolCard>): string {
  const code = (id: string) => {
    const c = pool.get(id);
    if (!c) throw new Error(`Carta desconhecida: ${id}`);
    return c.code;
  };
  const counts = new Map<string, number>();
  const put = (id: string, n: number) => n > 0 && counts.set(code(id), (counts.get(code(id)) ?? 0) + n);
  if (deck.legend) put(deck.legend, 1);
  if (deck.champion) put(deck.champion, 1);
  for (const [id, n] of Object.entries(deck.main)) put(id, n);
  for (const [id, n] of Object.entries(deck.runes)) put(id, n);
  for (const id of deck.battlefields) put(id, 1);
  const main: Deck = [...counts].map(([cardCode, count]) => ({ cardCode, count }));
  const side: Deck = Object.entries(deck.side)
    .filter(([, n]) => n > 0)
    .map(([id, count]) => ({ cardCode: code(id), count }));
  if (!main.length && !side.length) return "";
  const extra = deck.extraLegends.map(code);
  return getCodeFromDeck(main, side, deck.champion ? code(deck.champion) : undefined, extra.length ? extra : undefined);
}

export interface DecodedDeck {
  deck: DeckList;
  /** Códigos que não existem no nosso banco de cartas. */
  unknown: string[];
}

/** Lê um código de deck. Lança erro se o código for inválido. */
export function decodeDeck(input: string, pool: Map<string, PoolCard>): DecodedDeck {
  const byCode = new Map<string, PoolCard>();
  for (const c of pool.values()) for (const k of [c.code, ...c.codes]) byCode.set(k.toUpperCase(), c);
  const decoded = getDeckFromCode(input.trim());
  const deck = emptyDeck();
  const unknown: string[] = [];
  const find = (k: string) => {
    // "s" e "*" marcam a versão assinada; a carta base é a mesma.
    const c = byCode.get(k.toUpperCase()) ?? byCode.get(k.toUpperCase().replace(/[S*]$/, ""));
    if (!c) unknown.push(k);
    return c;
  };
  const champion = decoded.chosenChampion ? find(decoded.chosenChampion) : undefined;
  let championTaken = false;
  for (const { cardCode, count } of decoded.mainDeck) {
    const c = find(cardCode);
    if (!c) continue;
    if (c.type === "Legend" && !deck.legend) {
      deck.legend = c.id;
      if (count > 1) deck.main[c.id] = count - 1;
    } else if (c.type === "Rune") deck.runes[c.id] = (deck.runes[c.id] ?? 0) + count;
    else if (c.type === "Battlefield") for (let i = 0; i < count; i++) deck.battlefields.push(c.id);
    else {
      let n = count;
      if (champion && c.id === champion.id && !championTaken) {
        deck.champion = c.id;
        championTaken = true;
        n -= 1;
      }
      if (n > 0) deck.main[c.id] = (deck.main[c.id] ?? 0) + n;
    }
  }
  for (const { cardCode, count } of decoded.sideboard) {
    const c = find(cardCode);
    if (c) deck.side[c.id] = (deck.side[c.id] ?? 0) + count;
  }
  for (const k of decoded.additionalLegends ?? []) {
    const c = find(k);
    if (c) deck.extraLegends.push(c.id);
  }
  return { deck, unknown };
}
