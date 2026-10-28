/** Base pública das imagens WebP (R2 em produção). Vazia = mostrar só texto. */
const BASE = (process.env.NEXT_PUBLIC_IMAGE_BASE_URL ?? "").replace(/\/$/, "");

export const hasImages = BASE !== "";

export function cardImage(printId: string, size: 372 | 744 = 372): string | null {
  return hasImages ? `${BASE}/${size}/${printId}.webp` : null;
}

export function legendAvatar(cardId: string): string | null {
  return hasImages ? `${BASE}/avatar/${cardId}.webp` : null;
}
