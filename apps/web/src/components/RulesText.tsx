import { tokenizeRulesText } from "@cr/core";
import { domainColor } from "./LegendAvatar";

/** Texto de regras com marcadores trocados por ícones próprios (texto alternativo legível). */
export function RulesText({ text, className }: { text: string; className?: string }) {
  const tokens = tokenizeRulesText(text);
  return (
    <span className={className}>
      {tokens.map((tok, i) => {
        switch (tok.kind) {
          case "text":
            return <span key={i}>{tok.value}</span>;
          case "energy":
            return (
              <span key={i} className="mx-0.5 inline-grid size-[1.25em] place-items-center rounded-full bg-text align-[-0.2em] text-[0.75em] font-bold text-bg" aria-label={`${tok.amount} Energy`} role="img">
                {tok.amount}
              </span>
            );
          case "power":
            return (
              <span
                key={i}
                className="mx-0.5 inline-block size-[1.05em] rotate-45 rounded-[2px] align-[-0.12em]"
                style={{ background: tok.domain === "Any" ? "linear-gradient(135deg, var(--domain-fury), var(--domain-mind), var(--domain-calm))" : domainColor(tok.domain) }}
                aria-label={`${tok.domain} Power`}
                role="img"
              />
            );
          case "might":
            return <span key={i} className="mx-0.5 font-bold text-accent-2" aria-label="Might" role="img">⚔</span>;
          case "exhaust":
            return <span key={i} className="mx-0.5 font-bold text-muted" aria-label="Exhaust" role="img">↻</span>;
          case "arrow":
            return <span key={i} className="mx-0.5 text-muted" aria-hidden>{tok.nested ? "»" : "›"}</span>;
          case "keyword":
            return (
              <span key={i} className="rounded bg-surface-2 px-1 py-px text-[0.9em] font-semibold text-accent">
                {tok.name}
                {tok.value !== null ? ` ${tok.value}` : ""}
              </span>
            );
        }
      })}
    </span>
  );
}
