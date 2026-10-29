/**
 * Ranking de jogadores por pontos de colocação, no estilo dos Championship Points:
 * cada evento vale uma base pelo nível e o jogador leva uma fração dela pela
 * posição final. Só pontua quem termina no primeiro quarto (no mínimo o top 8).
 */

export type RankingTier = "championship" | "qualifier" | "showdown1" | "showdown2" | "showdown3" | "side" | "community";

export const TIER_POINTS: Record<RankingTier, number> = {
  championship: 1000,
  qualifier: 500,
  showdown1: 300,
  showdown2: 200,
  showdown3: 120,
  side: 60,
  community: 40,
};

/** Fração da base por faixa: [até a posição, fração]. */
export const PLACEMENT_SHARES: readonly (readonly [number, number])[] = [
  [1, 1],
  [2, 0.7],
  [4, 0.5],
  [8, 0.35],
  [16, 0.22],
  [32, 0.14],
  [64, 0.09],
  [128, 0.05],
  [256, 0.03],
];

/** Última posição que pontua num evento com `players` jogadores. */
export function pointsCutoff(players: number): number {
  return Math.max(8, Math.ceil(players / 4));
}

/** Nível do evento. Showdown Series segue os tiers oficiais (I 512+, II 256+, III menor). */
export function rankingTier(kind: string, name: string, players: number): RankingTier {
  if (kind === "main") return /regional championship/i.test(name) ? "championship" : "qualifier";
  if (kind === "showdown") return players >= 512 ? "showdown1" : players >= 256 ? "showdown2" : "showdown3";
  if (kind === "side") return "side";
  return "community";
}

export function placementPoints(tier: RankingTier, rank: number, players: number): number {
  if (rank < 1 || rank > pointsCutoff(players)) return 0;
  const band = PLACEMENT_SHARES.find(([upTo]) => rank <= upTo);
  return band ? Math.round(TIER_POINTS[tier] * band[1]) : 0;
}

export interface RankingResult {
  playerId: number;
  eventId: number;
  kind: string;
  eventName: string;
  players: number;
  rank: number;
}

export interface RankedPlayer {
  playerId: number;
  /** Posição no ranking; empates em pontos dividem a posição. */
  position: number;
  points: number;
  /** Eventos que deram pontos. */
  events: number;
  wins: number;
  bestRank: number;
}

/**
 * Soma os pontos de cada jogador. Desempate: mais títulos, depois melhor
 * colocação; quem continua empatado divide a posição.
 */
export function rankPlayers(results: RankingResult[]): RankedPlayer[] {
  const by = new Map<number, Omit<RankedPlayer, "position">>();
  for (const r of results) {
    const pts = placementPoints(rankingTier(r.kind, r.eventName, r.players), r.rank, r.players);
    if (pts <= 0) continue;
    const cur = by.get(r.playerId) ?? { playerId: r.playerId, points: 0, events: 0, wins: 0, bestRank: Infinity };
    cur.points += pts;
    cur.events++;
    if (r.rank === 1) cur.wins++;
    cur.bestRank = Math.min(cur.bestRank, r.rank);
    by.set(r.playerId, cur);
  }
  const sorted = [...by.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.bestRank - b.bestRank || a.playerId - b.playerId);
  const out: RankedPlayer[] = [];
  sorted.forEach((p, i) => {
    const prev = out[i - 1];
    const tied = prev && prev.points === p.points && prev.wins === p.wins && prev.bestRank === p.bestRank;
    out.push({ ...p, position: tied ? prev.position : i + 1 });
  });
  return out;
}
