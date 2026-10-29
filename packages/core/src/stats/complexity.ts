/** Voto de complexidade da comunidade: 1 (simples) a 5 (muito complexa). */
export const COMPLEXITY_MIN = 1;
export const COMPLEXITY_MAX = 5;
/** Votos mínimos para a lenda aparecer no eixo de complexidade do gráfico. */
export const MIN_COMPLEXITY_VOTES = 10;
/** Peso do prior: com poucos votos a média fica perto do meio da escala. */
export const COMPLEXITY_PRIOR_WEIGHT = 5;
export const COMPLEXITY_PRIOR = 3;

/** Média bayesiana dos votos; null quando ainda não há votos suficientes. */
export function complexityScore(sum: number, votes: number): number | null {
  if (votes < MIN_COMPLEXITY_VOTES) return null;
  return (sum + COMPLEXITY_PRIOR * COMPLEXITY_PRIOR_WEIGHT) / (votes + COMPLEXITY_PRIOR_WEIGHT);
}
