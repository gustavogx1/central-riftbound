import "server-only";
import { cardUsage, decodeDeck, spiciness, type CardUsage, type DeckList, type StatDeck } from "@cr/core";
import { poolMap } from "./decks";
import { getLegendDeckPool } from "./event-decks";

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
