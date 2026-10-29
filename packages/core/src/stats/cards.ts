import type { DeckList } from "../deck/types";

/** Carta em pelo menos 75% das listas da lenda = staple. */
export const STAPLE_INCLUSION = 0.75;
/** Abaixo disso, "tempero" e win rate por carta não aparecem (amostra pequena demais). */
export const MIN_CARD_STAT_DECKS = 5;
/** Win rate "com a carta" só aparece com partidas suficientes. */
export const MIN_CARD_MATCHES = 30;

export type CardZone = "main" | "battlefields" | "side";

/** Uma lista de torneio e a campanha do jogador naquele evento (sem byes). */
export interface StatDeck {
  deck: DeckList;
  wins: number;
  losses: number;
}

export interface CardUsage {
  cardId: string;
  zone: CardZone;
  /** Listas que têm a carta nesta zona. */
  decks: number;
  /** decks / total de listas. */
  inclusion: number;
  /** Média de cópias entre as listas que têm a carta. */
  avgCopies: number;
  /** Campanha somada dos jogadores que usaram a carta. */
  wins: number;
  losses: number;
}

/** Cópias de cada carta por zona. O campeão escolhido conta como cópia do deck principal. */
export function zoneCounts(deck: DeckList): Record<CardZone, Map<string, number>> {
  const main = new Map(Object.entries(deck.main).filter(([, n]) => n > 0));
  if (deck.champion) main.set(deck.champion, (main.get(deck.champion) ?? 0) + 1);
  const battlefields = new Map<string, number>();
  for (const id of deck.battlefields) battlefields.set(id, (battlefields.get(id) ?? 0) + 1);
  const side = new Map(Object.entries(deck.side).filter(([, n]) => n > 0));
  return { main, battlefields, side };
}

/** Uso de cada carta num conjunto de listas (normalmente as de uma lenda), da mais usada para a menos. */
export function cardUsage(decks: StatDeck[]): CardUsage[] {
  const acc = new Map<string, CardUsage & { copies: number }>();
  for (const d of decks) {
    const zones = zoneCounts(d.deck);
    for (const zone of ["main", "battlefields", "side"] as const) {
      for (const [cardId, n] of zones[zone]) {
        const key = `${zone}|${cardId}`;
        const u = acc.get(key) ?? { cardId, zone, decks: 0, inclusion: 0, avgCopies: 0, wins: 0, losses: 0, copies: 0 };
        u.decks++;
        u.copies += n;
        u.wins += d.wins;
        u.losses += d.losses;
        acc.set(key, u);
      }
    }
  }
  const total = decks.length;
  return [...acc.values()]
    .map(({ copies, ...u }) => ({ ...u, inclusion: total ? u.decks / total : 0, avgCopies: u.decks ? copies / u.decks : 0 }))
    .sort((a, b) => b.decks - a.decks || b.avgCopies - a.avgCopies || a.cardId.localeCompare(b.cardId));
}

/**
 * "Tempero" de uma lista (0–100): quanto as cartas do deck principal fogem do que as outras
 * listas da mesma lenda usam. Para cada carta, 1 − fração das *outras* listas que a usam
 * (a própria lista fica de fora), com peso pelo número de cópias. 0 = só staples; 100 = nenhuma
 * carta em comum. `null` quando há menos de MIN_CARD_STAT_DECKS outras listas.
 *
 * `usage` e `total` descrevem o conjunto de listas; `includesSelf` diz se a lista está nele.
 */
export function spiciness(deck: DeckList, usage: CardUsage[], total: number, includesSelf: boolean): number | null {
  const others = total - (includesSelf ? 1 : 0);
  if (others < MIN_CARD_STAT_DECKS) return null;
  const inMain = new Map(usage.filter((u) => u.zone === "main").map((u) => [u.cardId, u.decks]));
  let weight = 0;
  let spice = 0;
  for (const [id, n] of zoneCounts(deck).main) {
    const withCard = (inMain.get(id) ?? 0) - (includesSelf ? 1 : 0);
    spice += n * (1 - Math.max(0, withCard) / others);
    weight += n;
  }
  return weight ? Math.round((100 * spice) / weight) : null;
}
