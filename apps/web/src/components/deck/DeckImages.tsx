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

export const cardName = (c: PoolCard) => (c.type === "Legend" ? listName(c) : fullName(c));

/** Título de seção: caixa alta, contagem numa pílula e um fio até a borda. */
export function SectionTitle({ title, total }: { title: string; total?: number }) {
  return (
    <h2 className="flex items-center gap-3 font-display text-sm font-semibold tracking-[0.18em] text-accent-2 uppercase">
      <span>{title}</span>
      {total !== undefined && <span className="rounded-full border border-border px-2 py-0.5 text-xs tracking-normal text-muted tabular-nums">{total}</span>}
      <span aria-hidden className="h-px flex-1 bg-border" />
    </h2>
  );
}

/** Uma carta da grade: imagem com o número de cópias no canto. */
function Tile({ card, count }: { card: PoolCard; count: number }) {
  const landscape = card.type === "Battlefield";
  const img = cardImage(card.id);
  const name = cardName(card);
  return (
    <li>
      <CardHover src={cardImage(card.id, 744)} lowSrc={img} landscape={landscape} className="relative block rounded-xl border border-border bg-surface p-1.5 transition hover:border-accent">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={name} width={372} height={landscape ? 266 : 519} loading="lazy" className="block w-full rounded-lg" />
        ) : (
          <span className={`flex flex-col rounded-lg bg-surface-2 p-2 text-xs ${landscape ? "aspect-[372/266]" : "aspect-[372/519]"}`}>
            <span className="flex items-start justify-between gap-1 font-semibold">
              <span>{name}</span>
              {card.energyCost !== null && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-text text-[11px] font-bold text-bg">{card.energyCost}</span>}
            </span>
            <span className="mt-1">
              <DomainDots domains={card.domains} />
            </span>
          </span>
        )}
        <span className="absolute top-2.5 right-2.5 rounded-md border border-accent/60 bg-bg/85 px-1.5 py-0.5 font-display text-xs font-bold text-text tabular-nums">×{count}</span>
      </CardHover>
    </li>
  );
}

/** Deck como grade de imagens, seção por seção. */
export function DeckImages({ sections }: { sections: DeckSection[] }) {
  return (
    <div className="space-y-8">
      {sections
        .filter((s) => s.rows.length)
        .map((s) => {
          const wide = s.rows.some(([c]) => c.type === "Battlefield");
          return (
            <section key={s.id}>
              <SectionTitle title={s.title} total={s.total} />
              <ul className={`mt-4 grid gap-3 ${wide ? "grid-cols-[repeat(auto-fill,minmax(200px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(100px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(125px,1fr))]"}`}>
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
