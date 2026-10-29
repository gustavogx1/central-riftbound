"use client";

import { useTranslations } from "next-intl";
import {
  addCard,
  canBeChampion,
  energyCurve,
  fullName,
  listName,
  makeChampion,
  moveCard,
  removeCard,
  type DeckList as Deck,
  type PoolCard,
} from "@cr/core";
import { DomainDots } from "@/components/DomainDots";

const TYPE_ORDER = ["Unit", "Spell", "Gear"] as const;

export function DeckPanel({ deck, pool, needsExtra, update }: { deck: Deck; pool: Map<string, PoolCard>; needsExtra: boolean; update: (fn: (d: Deck) => Deck) => void }) {
  const t = useTranslations("Builder");
  const tt = useTranslations("Types");
  const legend = deck.legend ? pool.get(deck.legend) ?? null : null;
  const champion = deck.champion ? pool.get(deck.champion) ?? null : null;
  const sorted = (r: Record<string, number>) =>
    Object.entries(r)
      .map(([id, n]) => [pool.get(id), n] as const)
      .filter((x): x is readonly [PoolCard, number] => !!x[0])
      .sort(([a], [b]) => (a.energyCost ?? 99) - (b.energyCost ?? 99) || fullName(a).localeCompare(fullName(b)));
  const main = sorted(deck.main);
  const curve = energyCurve(deck, pool);
  const peak = Math.max(1, ...curve);
  // Runas da identidade da lenda, mesmo com zero cópias, para ajustar com +/−.
  const runeCards = [...pool.values()].filter((c) => c.type === "Rune" && (!legend || c.domains.every((d) => legend.domains.includes(d))));
  const runeIds = [...new Set([...runeCards.map((c) => c.id), ...Object.keys(deck.runes)])];

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <Section title={t("legend")}>
        {legend ? (
          <Row card={legend} label={listName(legend)} count={1} onRemove={() => update((d) => removeCard(d, legend.id, "legend"))} />
        ) : (
          <Empty>{t("emptyLegend")}</Empty>
        )}
      </Section>

      {needsExtra && (
        <Section title={t("extraLegends", { count: deck.extraLegends.length, max: 3 })}>
          {deck.extraLegends.length ? (
            deck.extraLegends.map((id) => pool.get(id)).filter(Boolean).map((c) => (
              <Row key={c!.id} card={c!} label={listName(c!)} count={1} onRemove={() => update((d) => removeCard(d, c!.id, "extraLegends"))} />
            ))
          ) : (
            <Empty>{t("emptyExtra")}</Empty>
          )}
        </Section>
      )}

      <Section title={t("champion")}>
        {champion ? (
          <Row card={champion} count={1} onRemove={() => update((d) => removeCard(d, champion.id, "champion"))} onAdd={() => update((d) => addCard(d, champion, "main"))} />
        ) : (
          <Empty>{t("emptyChampion")}</Empty>
        )}
      </Section>

      <Section title={`${t("main")} (${main.reduce((a, [, n]) => a + n, 0) + (champion ? 1 : 0)})`}>
        {main.length === 0 && <Empty>{t("emptyMain")}</Empty>}
        {TYPE_ORDER.map((type) => {
          const rows = main.filter(([c]) => c.type === type);
          if (!rows.length) return null;
          return (
            <div key={type} className="mt-1">
              <p className="text-[11px] tracking-wide text-muted uppercase">
                {tt(type)} · {rows.reduce((a, [, n]) => a + n, 0)}
              </p>
              {rows.map(([c, n]) => (
                <Row
                  key={c.id}
                  card={c}
                  count={n}
                  onAdd={() => update((d) => addCard(d, c, "main"))}
                  onRemove={() => update((d) => removeCard(d, c.id, "main"))}
                  onMove={() => update((d) => moveCard(d, c.id, "main"))}
                  moveLabel={t("toSide")}
                  onChampion={legend && canBeChampion(c, legend) && deck.champion !== c.id ? () => update((d) => makeChampion(d, c.id)) : undefined}
                />
              ))}
            </div>
          );
        })}
      </Section>

      <div aria-label={t("curve")} role="img" className="flex h-16 items-end gap-1">
        {curve.map((n, cost) => (
          <div key={cost} className="flex flex-1 flex-col items-center gap-0.5 text-[10px] text-muted">
            <span>{n || ""}</span>
            <span className="w-full rounded-t bg-accent/70" style={{ height: `${(n / peak) * 36}px` }} />
            <span>{cost === 7 ? "7+" : cost}</span>
          </div>
        ))}
      </div>
      <p className="sr-only">{curve.map((n, c) => `${c === 7 ? "7+" : c}: ${n}`).join(", ")}</p>

      <Section title={`${t("battlefields")} (${deck.battlefields.length}/3)`}>
        {deck.battlefields.length === 0 && <Empty>{t("emptyBattlefields")}</Empty>}
        {deck.battlefields.map((id) => pool.get(id)).filter(Boolean).map((c) => (
          <Row key={c!.id} card={c!} count={1} onRemove={() => update((d) => removeCard(d, c!.id, "battlefields"))} />
        ))}
      </Section>

      <Section title={`${t("runes")} (${Object.values(deck.runes).reduce((a, b) => a + b, 0)}/12)`}>
        {runeIds.map((id) => pool.get(id)).filter(Boolean).map((c) => (
          <Row key={c!.id} card={c!} count={deck.runes[c!.id] ?? 0} onAdd={() => update((d) => addCard(d, c!, "runes"))} onRemove={() => update((d) => removeCard(d, c!.id, "runes"))} />
        ))}
      </Section>

      <Section title={`${t("side")} (${Object.values(deck.side).reduce((a, b) => a + b, 0)}/10)`}>
        {Object.keys(deck.side).length === 0 && <Empty>{t("emptySide")}</Empty>}
        {sorted(deck.side).map(([c, n]) => (
          <Row
            key={c.id}
            card={c}
            count={n}
            onAdd={() => update((d) => addCard(d, c, "side"))}
            onRemove={() => update((d) => removeCard(d, c.id, "side"))}
            onMove={() => update((d) => moveCard(d, c.id, "side"))}
            moveLabel={t("toMain")}
          />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 font-display text-sm font-semibold">{title}</h3>
      <ul className="space-y-0.5">{children}</ul>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <li className="text-sm text-muted">{children}</li>;
}

function Row({
  card,
  label,
  count,
  onAdd,
  onRemove,
  onMove,
  moveLabel,
  onChampion,
}: {
  card: PoolCard;
  label?: string;
  count: number;
  onAdd?: () => void;
  onRemove?: () => void;
  onMove?: () => void;
  moveLabel?: string;
  onChampion?: () => void;
}) {
  const t = useTranslations("Builder");
  const name = label ?? fullName(card);
  const btn = "grid size-6 place-items-center rounded border border-border text-sm leading-none hover:border-accent";
  return (
    <li className="flex items-center gap-2 text-sm" title={card.rulesText || undefined}>
      <span className="w-5 text-right font-display font-bold tabular-nums">{count}</span>
      <span className="w-4 text-center text-xs text-muted">{card.energyCost ?? ""}</span>
      <DomainDots domains={card.domains} />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {onChampion && (
        <button onClick={onChampion} className={btn} aria-label={t("makeChampion", { name })} title={t("makeChampion", { name })}>
          ★
        </button>
      )}
      {onMove && (
        <button onClick={onMove} className={btn} aria-label={`${moveLabel}: ${name}`} title={moveLabel}>
          ⇄
        </button>
      )}
      {onRemove && (
        <button onClick={onRemove} className={btn} aria-label={t("remove", { name })}>
          −
        </button>
      )}
      {onAdd && (
        <button onClick={onAdd} className={btn} aria-label={t("addCard", { name })}>
          +
        </button>
      )}
    </li>
  );
}
