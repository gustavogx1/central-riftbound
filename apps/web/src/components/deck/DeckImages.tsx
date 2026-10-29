import { fullName, listName, type PoolCard } from "@cr/core";
import { DomainDots } from "@/components/DomainDots";
import { cardImage } from "@/lib/images";
import { CardHover } from "./CardHover";

export type DeckRow = readonly [PoolCard, number];
export interface DeckSection {
  id: string;
  title: string;
  rows: DeckRow[];
  total?: number;
}

const cardName = (c: PoolCard) => (c.type === "Legend" ? listName(c) : fullName(c));

/** Uma carta da grade: imagem com o número de cópias; cópias extras aparecem como cartas empilhadas atrás. */
function Tile({ card, count }: { card: PoolCard; count: number }) {
  const landscape = card.type === "Battlefield";
  const img = cardImage(card.id);
  const name = cardName(card);
  const stack = Math.min(count, 3) - 1;
  return (
    <li className="relative" style={{ paddingTop: stack * 5, paddingRight: stack * 5 }}>
      {Array.from({ length: stack }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute rounded-lg border border-border bg-surface-2"
          style={{ top: (stack - 1 - i) * 5, right: (stack - 1 - i) * 5, bottom: (i + 1) * 5, left: (i + 1) * 5 }}
        />
      ))}
      <CardHover src={cardImage(card.id, 744)} lowSrc={img} landscape={landscape} className="relative block">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={name} width={372} height={landscape ? 266 : 519} loading="lazy" className="block w-full rounded-lg" />
        ) : (
          <span className={`flex flex-col rounded-lg border border-border bg-surface p-2 text-xs ${landscape ? "aspect-[372/266]" : "aspect-[372/519]"}`}>
            <span className="flex items-start justify-between gap-1 font-semibold">
              <span>{name}</span>
              {card.energyCost !== null && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-text text-[11px] font-bold text-bg">{card.energyCost}</span>}
            </span>
            <span className="mt-1">
              <DomainDots domains={card.domains} />
            </span>
          </span>
        )}
        {count > 1 && (
          <span className="absolute right-1 bottom-1 rounded-full bg-accent px-2 py-0.5 font-display text-sm font-bold text-accent-ink tabular-nums shadow">×{count}</span>
        )}
      </CardHover>
    </li>
  );
}

/** Deck como grade de imagens, seção por seção. */
export function DeckImages({ sections }: { sections: DeckSection[] }) {
  return (
    <div className="space-y-6">
      {sections.map((s) => {
        const wide = s.rows.some(([c]) => c.type === "Battlefield");
        return (
          <section key={s.id}>
            <h2 className="flex justify-between border-b border-border pb-1 font-display text-sm font-semibold">
              <span>{s.title}</span>
              {s.total !== undefined && <span className="text-muted">{s.total}</span>}
            </h2>
            <ul className={`mt-3 grid gap-3 ${wide ? "grid-cols-[repeat(auto-fill,minmax(170px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(110px,1fr))]"}`}>
              {s.rows.map(([c, n]) => (
                <Tile key={c.id} card={c} count={n} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export { cardName };
