/** Mínimo de jogadores com a mesma lenda no evento para valer "best of" (sozinho não conta). */
export const MIN_BEST_OF_PILOTS = 2;

export interface FinalEntry {
  playerId: number;
  rank: number;
  legend: string | null;
}

/**
 * "Best of" de cada lenda num evento: quem terminou mais bem colocado com ela
 * na classificação final. Devolve lenda → jogador.
 */
export function bestOfByLegend(entries: FinalEntry[], minPilots = MIN_BEST_OF_PILOTS): Map<string, number> {
  const by = new Map<string, { best: FinalEntry; pilots: number }>();
  for (const e of entries) {
    if (!e.legend) continue;
    const cur = by.get(e.legend);
    if (!cur) by.set(e.legend, { best: e, pilots: 1 });
    else {
      cur.pilots++;
      if (e.rank < cur.best.rank) cur.best = e;
    }
  }
  const out = new Map<string, number>();
  for (const [legend, { best, pilots }] of by) if (pilots >= minPilots) out.set(legend, best.playerId);
  return out;
}
