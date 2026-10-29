/**
 * Chave do top cut (eliminação simples). As mesas da UVS vêm por seed (1v8, 2v7, 3v6, 4v5),
 * então a vizinhança na chave não sai da ordem das mesas: ela é montada de cima para baixo,
 * seguindo quem jogou com quem. O que ainda não foi jogado cai na posição padrão do seed.
 */

export interface BracketMatchLike {
  p1: number | null;
  p2: number | null;
}

/** Ordem padrão dos seeds na primeira rodada: 8 → [1, 8, 4, 5, 2, 7, 3, 6]. */
export function seedPositions(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order.slice(0, Math.max(size, 0));
}

/**
 * Recebe as rodadas do corte em ordem (primeira → final) e devolve as colunas da chave,
 * cada uma com 2^k posições (`null` = partida ainda sem pairing). `seed` = posição no suíço.
 */
export function buildBracket<T extends BracketMatchLike>(rounds: T[][], seed: (playerId: number) => number | undefined = () => undefined): (T | null)[][] {
  const first = rounds[0]?.length ?? 0;
  if (first === 0) return [];
  const levels = Math.max(rounds.length, Math.ceil(Math.log2(first)) + 1);
  const size = 2 ** levels;
  // Seed → posição na primeira coluna.
  const firstSlot = new Map<number, number>();
  seedPositions(size).forEach((s, i) => firstSlot.set(s, Math.floor(i / 2)));

  const cols: (T | null)[][] = Array.from({ length: levels }, (_, j) => Array<T | null>(2 ** (levels - 1 - j)).fill(null));
  for (let j = levels - 1; j >= 0; j--) {
    const col = cols[j]!;
    const pool = [...(rounds[j] ?? [])];
    const take = (pid: number | null) => {
      if (pid === null) return null;
      const i = pool.findIndex((m) => m.p1 === pid || m.p2 === pid);
      return i < 0 ? null : pool.splice(i, 1)[0]!;
    };
    const parent = cols[j + 1];
    if (parent) {
      parent.forEach((m, i) => {
        if (!m) return;
        col[2 * i] ??= take(m.p1);
        col[2 * i + 1] ??= take(m.p2);
      });
    }
    // Sobras: vão para a posição do seed de algum dos dois jogadores, ou para a primeira vaga.
    for (const m of pool) {
      const wanted = [m.p1, m.p2]
        .map((p) => (p === null ? undefined : seed(p)))
        .map((s) => (s === undefined ? undefined : firstSlot.get(s)))
        .filter((s): s is number => s !== undefined)
        .map((s) => Math.floor(s / 2 ** j));
      const open = (s: number) => col[s] === null && !takenByParent(cols, j, s);
      const slot = wanted.find((s) => s < col.length && open(s)) ?? [...col.keys()].find(open) ?? col.indexOf(null);
      if (slot >= 0) col[slot] = m;
      else col.push(m);
    }
  }
  return cols;
}

/** A vaga já pertence a uma partida da coluna seguinte que ainda espera o jogador dela? */
function takenByParent<T extends BracketMatchLike>(cols: (T | null)[][], j: number, slot: number) {
  return cols[j + 1]?.[Math.floor(slot / 2)] != null;
}

/** Nome da coluna pelo número de jogadores que ainda restam nela (8 → quartas). */
export function bracketStage(slots: number): "final" | "semis" | "quarters" | "top" {
  return slots === 1 ? "final" : slots === 2 ? "semis" : slots === 4 ? "quarters" : "top";
}
