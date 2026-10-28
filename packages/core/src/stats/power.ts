export const TIERS = ["S", "A", "B", "C", "D"] as const;
export type Tier = (typeof TIERS)[number];

export interface PowerConfig {
  /** Peso do win rate ajustado; o resto vai para a conversão. */
  winRateWeight: number;
  /** Percentil mínimo (0–100) de poder para cada tier, do S ao D. */
  tierCuts: [number, number, number, number, number];
}

export const DEFAULT_POWER_CONFIG: PowerConfig = {
  winRateWeight: 0.6,
  tierCuts: [90, 70, 40, 15, 0],
};

export interface PowerInput {
  id: string;
  shrunkWinRate: number;
  /** Conversão relativa (1 = média). */
  conversion: number;
}

function zScores(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / n);
  return values.map((v) => (sd === 0 ? 0 : (v - mean) / sd));
}

/**
 * Poder 0–100 = percentil da combinação z(win rate ajustado) e z(conversão).
 * Empates recebem o mesmo percentil (média das posições).
 */
export function computePower(rows: PowerInput[], config = DEFAULT_POWER_CONFIG): Map<string, { power: number; tier: Tier }> {
  const zw = zScores(rows.map((r) => r.shrunkWinRate));
  const zc = zScores(rows.map((r) => r.conversion));
  const combined = rows.map((r, i) => ({
    id: r.id,
    score: config.winRateWeight * zw[i]! + (1 - config.winRateWeight) * zc[i]!,
  }));
  const sorted = [...combined].sort((a, b) => a.score - b.score);
  const out = new Map<string, { power: number; tier: Tier }>();
  const n = sorted.length;
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && sorted[j + 1]!.score === sorted[i]!.score) j++;
    const rank = (i + j) / 2;
    const power = n === 1 ? 50 : Math.round((rank / (n - 1)) * 100);
    for (let k = i; k <= j; k++) out.set(sorted[k]!.id, { power, tier: tierFor(power, config) });
    i = j + 1;
  }
  return out;
}

export function tierFor(power: number, config = DEFAULT_POWER_CONFIG): Tier {
  const idx = config.tierCuts.findIndex((cut) => power >= cut);
  return TIERS[idx === -1 ? TIERS.length - 1 : idx]!;
}
