/** Ícones de títulos: troféu (campeão do evento) e coroa ("best of" de uma lenda). */

export function TrophyIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={`shrink-0 text-gold ${className}`} aria-hidden>
      <path d="M6 2h12v2h3v3a5 5 0 0 1-4.6 5A6 6 0 0 1 13 15.9V18h3a2 2 0 0 1 2 2v2H6v-2a2 2 0 0 1 2-2h3v-2.1A6 6 0 0 1 7.6 12 5 5 0 0 1 3 7V4h3V2Zm0 4H5v1a3 3 0 0 0 1.5 2.6A6 6 0 0 1 6 8V6Zm12 0v2c0 .6-.1 1.1-.2 1.6A3 3 0 0 0 19 7V6h-1Z" />
    </svg>
  );
}

export function CrownIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={`shrink-0 text-gold ${className}`} aria-hidden>
      <path d="M3 7.5a1.5 1.5 0 1 1 2.3 1.3L7.5 13l3.3-6.3a1.5 1.5 0 1 1 2.4 0l3.3 6.3 2.2-4.2A1.5 1.5 0 1 1 20 9l-1.5 9h-13L4 9a1.5 1.5 0 0 1-1-1.5ZM5.5 19.5h13V21h-13v-1.5Z" />
    </svg>
  );
}
