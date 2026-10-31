/**
 * Jogadores seguidos: ficam num cookie do navegador (sem conta), valendo para todos os eventos.
 * O servidor lê o cookie para montar a aba "Seguindo".
 */
export const FOLLOW_COOKIE = "cr_follow";
export const FOLLOW_MAX = 100;

export function parseFollow(value: string | undefined | null): number[] {
  if (!value) return [];
  const ids = decodeURIComponent(value)
    .split(/[.,]/)
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n) && n !== 0);
  return [...new Set(ids)].slice(0, FOLLOW_MAX);
}

export function toggleFollow(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids].slice(0, FOLLOW_MAX);
}

export function serializeFollow(ids: number[]): string {
  return ids.join(".");
}
