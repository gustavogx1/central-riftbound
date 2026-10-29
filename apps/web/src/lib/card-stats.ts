import "server-only";
import { cardUsage, decodeDeck, spiciness, zoneCounts, type CardUsage, type CardZone, type DeckList, type StatDeck } from "@cr/core";
import { poolMap } from "./decks";
import { getAllDecks, getLegendDeckPool, type AnyDeck } from "./event-decks";

export interface LegendCardStats {
  /** Listas usadas na conta. */
  total: number;
  /** Partidas somadas dessas listas (sem byes nem empates). */
  matches: number;
  wins: number;
  usage: CardUsage[];
  keys: Set<string>;
}

/** Uso das cartas nas decklists de torneio de uma lenda, num set (ou em todos). */
export async function getLegendCardStats(legend: string, metagame: string | null): Promise<LegendCardStats> {
  const [rows, pool] = await Promise.all([getLegendDeckPool(legend, metagame), poolMap()]);
  const decks: StatDeck[] = [];
  const keys = new Set<string>();
  for (const r of rows) {
    try {
      decks.push({ deck: decodeDeck(r.code, pool).deck, wins: r.wins, losses: r.losses });
      keys.add(`${r.eventId}|${r.key}`);
    } catch {
      // Código que não lemos mais (carta removida do catálogo): fica fora da conta.
    }
  }
  const wins = decks.reduce((a, d) => a + d.wins, 0);
  const matches = decks.reduce((a, d) => a + d.wins + d.losses, 0);
  return { total: decks.length, matches, wins, usage: cardUsage(decks), keys };
}

/**
 * "Tempero" de uma lista comparada às listas de torneio da mesma lenda no set. `self` identifica
 * a lista quando ela própria é de torneio (para tirá-la da comparação).
 */
export async function getDeckSpice(deck: DeckList, legend: string | null, metagame: string | null, self?: { eventId: number; key: string }) {
  if (!legend) return null;
  const stats = await getLegendCardStats(legend, metagame);
  const includesSelf = self ? stats.keys.has(`${self.eventId}|${self.key}`) : false;
  const value = spiciness(deck, stats.usage, stats.total, includesSelf);
  return value === null ? null : { value, compared: stats.total - (includesSelf ? 1 : 0) };
}

export interface CardLegendUse {
  legend: string;
  /** Listas da lenda (no recorte) e quantas usam a carta. */
  total: number;
  decks: number;
  avgCopies: number;
}

export interface CardTournamentUse {
  /** Listas que usam a carta em qualquer zona. */
  decks: number;
  /** Listas olhadas (todas as lendas). */
  total: number;
  byLegend: CardLegendUse[];
  /** Listas mais recentes com a carta, com a zona e as cópias. */
  recent: (AnyDeck & { zone: CardZone; copies: number })[];
}

/** Uso de uma carta em todas as decklists de torneio: por lenda e as listas mais recentes. */
export async function getCardTournamentUse(cardId: string, recentLimit = 12): Promise<CardTournamentUse> {
  const [rows, pool] = await Promise.all([getAllDecks(), poolMap()]);
  const perLegend = new Map<string, { total: number; decks: number; copies: number }>();
  const recent: CardTournamentUse["recent"] = [];
  let decks = 0;
  let total = 0;
  for (const r of rows) {
    let deck: DeckList;
    try {
      deck = decodeDeck(r.code, pool).deck;
    } catch {
      continue;
    }
    total++;
    const zones = zoneCounts(deck);
    const zone = (["main", "battlefields", "side"] as const).find((z) => zones[z].has(cardId));
    const legend = r.legend ?? "";
    const l = perLegend.get(legend) ?? { total: 0, decks: 0, copies: 0 };
    l.total++;
    if (zone) {
      decks++;
      l.decks++;
      l.copies += zones[zone].get(cardId)!;
      if (recent.length < recentLimit) recent.push({ ...r, zone, copies: zones[zone].get(cardId)! });
    }
    perLegend.set(legend, l);
  }
  const byLegend = [...perLegend.entries()]
    .filter(([legend, l]) => legend && l.decks > 0)
    .map(([legend, l]) => ({ legend, total: l.total, decks: l.decks, avgCopies: l.copies / l.decks }))
    .sort((a, b) => b.decks - a.decks || b.decks / b.total - a.decks / a.total);
  return { decks, total, byLegend, recent };
}
