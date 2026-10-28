/** Resultado agregado de partidas (empates contam à parte). */
export interface Record {
  wins: number;
  losses: number;
  draws: number;
}

export const Z95 = 1.959963984540054;

export function decided(r: Record): number {
  return r.wins + r.losses;
}

/** Vitórias / (vitórias + derrotas). `null` sem partidas decididas. */
export function winRate(r: Record): number | null {
  const n = decided(r);
  return n === 0 ? null : r.wins / n;
}

/**
 * Intervalo de Wilson para uma proporção. `n` pode ser fracionário
 * (tamanho de amostra efetivo), o que permite aplicar a correção de Kish.
 */
export function wilson(successes: number, n: number, z = Z95): { low: number; high: number } {
  if (n <= 0) return { low: 0, high: 1 };
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { low: Math.max(0, center - half), high: Math.min(1, center + half) };
}

/**
 * Win rate puxado para 50% com `priorGames` partidas imaginárias meio a meio.
 * Evita que lendas com poucas partidas apareçam no topo por acaso.
 */
export function shrunkWinRate(r: Record, priorGames = 100): number {
  return (r.wins + priorGames / 2) / (decided(r) + priorGames);
}

/**
 * Efeito de desenho de Kish para partidas agrupadas por evento:
 * deff = 1 + (m − 1)·ρ, com m = Σn²/Σn (tamanho médio ponderado dos grupos)
 * e ρ a correlação dentro do mesmo evento. Partidas no mesmo evento valem um
 * pouco menos que as mesmas partidas espalhadas por vários eventos.
 */
export function designEffect(clusterSizes: number[], rho = 0.05): number {
  let sum = 0;
  let sumSq = 0;
  for (const n of clusterSizes) {
    sum += n;
    sumSq += n * n;
  }
  if (sum === 0) return 1;
  return 1 + (sumSq / sum - 1) * rho;
}

/**
 * Nota de piloto: limite inferior de Wilson 95% com o tamanho de amostra
 * efetivo n / deff. `perEvent` traz vitórias e derrotas de cada evento.
 */
export function pilotScore(perEvent: Pick<Record, "wins" | "losses">[], rho = 0.05): number {
  const sizes = perEvent.map((e) => e.wins + e.losses);
  const n = sizes.reduce((a, b) => a + b, 0);
  if (n === 0) return 0;
  const wins = perEvent.reduce((a, e) => a + e.wins, 0);
  const nEff = n / designEffect(sizes, rho);
  return wilson((wins / n) * nEff, nEff).low;
}
