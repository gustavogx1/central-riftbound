import { legendAvatar } from "@/lib/images";

const DOMAIN_VAR: Record<string, string> = {
  Fury: "var(--domain-fury)",
  Calm: "var(--domain-calm)",
  Mind: "var(--domain-mind)",
  Body: "var(--domain-body)",
  Chaos: "var(--domain-chaos)",
  Order: "var(--domain-order)",
};

export function domainColor(domain: string | undefined): string {
  return (domain && DOMAIN_VAR[domain]) || "var(--border)";
}

export function domainGradient(domains: string[]): string {
  const [a, b] = [domainColor(domains[0]), domainColor(domains[1] ?? domains[0])];
  return `conic-gradient(${a} 0 50%, ${b} 50% 100%)`;
}

/** Avatar redondo da lenda, com anel nas cores dos domínios. Sem imagem, mostra a inicial. */
export function LegendAvatar({ cardId, champion, domains, size = 40 }: { cardId: string; champion: string; domains: string[]; size?: number }) {
  const src = legendAvatar(cardId);
  return (
    <span className="inline-grid shrink-0 place-items-center rounded-full p-[2px]" style={{ width: size, height: size, background: domainGradient(domains) }} aria-hidden>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size - 4} height={size - 4} loading="lazy" className="size-full rounded-full bg-surface-2 object-cover" />
      ) : (
        <span className="grid size-full place-items-center rounded-full bg-surface-2 font-display font-bold" style={{ fontSize: size * 0.42 }}>
          {champion.slice(0, 1)}
        </span>
      )}
    </span>
  );
}
