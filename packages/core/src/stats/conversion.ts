/** Colocação de um jogador num evento, com a lenda que usou. */
export interface Placement {
  eventId: string;
  legend: string;
  rank: number;
  fieldSize: number;
}

/**
 * Conversão relativa ao Top `fraction` (ex. 0,25 = Top 25%): fração dos pilotos
 * da lenda que terminaram dentro do corte, dividida pela fração esperada.
 * 1,00 = como a média; 2,00 = o dobro.
 */
export function conversionRate(placements: Placement[], fraction = 0.25): Map<string, { entries: number; hits: number; conversion: number }> {
  const byLegend = new Map<string, { entries: number; hits: number; expected: number }>();
  for (const p of placements) {
    const cut = Math.max(1, Math.floor(p.fieldSize * fraction));
    const s = byLegend.get(p.legend) ?? { entries: 0, hits: 0, expected: 0 };
    s.entries += 1;
    if (p.rank <= cut) s.hits += 1;
    s.expected += cut / p.fieldSize;
    byLegend.set(p.legend, s);
  }
  const out = new Map<string, { entries: number; hits: number; conversion: number }>();
  for (const [legend, s] of byLegend) {
    out.set(legend, { entries: s.entries, hits: s.hits, conversion: s.expected === 0 ? 0 : s.hits / s.expected });
  }
  return out;
}

/**
 * Conversão puxada para 1,0 com `priorEntries` entradas imaginárias na média,
 * para lendas com poucos pilotos não dominarem o ranking.
 */
export function shrunkConversion(hits: number, expectedHits: number, priorEntries = 20, fraction = 0.25): number {
  const prior = priorEntries * fraction;
  return (hits + prior) / (expectedHits + prior);
}
