"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import {
  addCard,
  canBeChampion,
  copyLimit,
  DECK_RULES,
  defaultZone,
  grantsExtraLegends,
  inIdentity,
  isBanned,
  isMainCard,
  isSignature,
  legendTag,
  mainCount,
  matchCard,
  parseCardQuery,
  runeCount,
  sideCount,
  validateDeck,
  type DeckList,
  type PoolCard,
  type Zone,
} from "@cr/core";
import { DomainDots } from "@/components/DomainDots";
import { Link } from "@/i18n/navigation";
import { cardImage } from "@/lib/images";
import { DeckPanel } from "./DeckPanel";
import { ExportPanel } from "./ExportPanel";
import { createDraftStore, type Draft, type DraftStore } from "./store";

const TABS = ["auto", "Legend", "Unit", "Spell", "Gear", "Rune", "Battlefield"] as const;
type Tab = (typeof TABS)[number];
const PAGE = 60;

export function DeckBuilder({ cards }: { cards: PoolCard[] }) {
  const t = useTranslations("Builder");
  const pool = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const store = useMemo(() => createDraftStore(pool), [pool]);
  const draft = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  if (!cards.length) return <p className="rounded-xl border border-border bg-surface p-6 text-muted">{t("noCards")}</p>;
  if (!draft) return <p className="text-muted">{t("loading")}</p>;
  return <Builder pool={pool} cards={cards} draft={draft} store={store} />;
}

function Builder({ pool, cards, draft, store }: { pool: Map<string, PoolCard>; cards: PoolCard[]; draft: Draft; store: DraftStore }) {
  const t = useTranslations("Builder");
  const tt = useTranslations("Types");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("auto");
  const [legalOnly, setLegalOnly] = useState(true);
  const [limit, setLimit] = useState(PAGE);

  const { deck, format } = draft;
  const legend = deck.legend ? pool.get(deck.legend) ?? null : null;
  const issues = useMemo(() => validateDeck(deck, pool, format), [deck, pool, format]);
  const needsExtra = useMemo(
    () => [deck.champion, ...Object.keys(deck.main)].some((id) => id && pool.get(id) && grantsExtraLegends(pool.get(id)!)),
    [deck, pool],
  );
  const update = (fn: (d: DeckList) => DeckList) => store.set((s) => ({ ...s, deck: fn(s.deck) }));

  const activeTab: Tab = tab === "auto" ? (legend ? "auto" : "Legend") : tab;
  const parsed = useMemo(() => parseCardQuery(q), [q]);
  const results = useMemo(() => {
    return cards.filter((c) => {
      if (activeTab !== "auto" && c.type !== activeTab) return false;
      if (activeTab === "auto" && c.type === "Legend") return false;
      if (legalOnly && legend) {
        if (!inIdentity(c, legend)) return false;
        if (format === "constructed" && isBanned(c)) return false;
        if (isSignature(c) && !c.tags.includes(legendTag(legend) ?? "")) return false;
      }
      return matchCard(c, parsed);
    });
  }, [cards, activeTab, legalOnly, legend, format, parsed]);

  const inDeck = (id: string) =>
    (deck.legend === id ? 1 : 0) + (deck.champion === id ? 1 : 0) + (deck.main[id] ?? 0) + (deck.runes[id] ?? 0) + (deck.battlefields.includes(id) ? 1 : 0);

  const add = (c: PoolCard, zone?: Zone) => update((d) => addCard(d, c, zone ?? defaultZone(c, d, pool)));

  return (
    <div className="grid gap-6 pb-16 lg:grid-cols-[minmax(0,1fr)_420px] lg:pb-0">
      <section aria-label={t("searchLabel")} className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <label className="min-w-0 flex-1 basis-full sm:basis-auto">
            <span className="sr-only">{t("searchLabel")}</span>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setLimit(PAGE);
              }}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-md border border-border bg-surface px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={legalOnly} onChange={(e) => setLegalOnly(e.target.checked)} />
            {t("legalOnly")}
          </label>
        </div>
        <p className="mt-1 text-xs text-muted">
          {t.rich("syntaxHint", { link: (chunks) => <Link href="/cards/syntax" className="text-accent underline">{chunks}</Link> })}
          {parsed.errors.length > 0 && <span className="ml-2 text-bad">{t("syntaxErrors", { terms: parsed.errors.join(" ") })}</span>}
        </p>

        <div role="tablist" aria-label={t("typeTabs")} className="mt-3 flex flex-wrap gap-1">
          {TABS.map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={activeTab === k}
              onClick={() => {
                setTab(k);
                setLimit(PAGE);
              }}
              className={`rounded-full border px-3 py-1 text-sm ${activeTab === k ? "border-accent bg-accent text-accent-ink" : "border-border text-muted hover:text-text"}`}
            >
              {k === "auto" ? t("tabDeck") : tt(k)}
            </button>
          ))}
        </div>

        {!legend && <p className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm">{t("pickLegend")}</p>}
        <p className="mt-3 text-sm text-muted">{t("results", { count: results.length })}</p>

        <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
          {results.slice(0, limit).map((c) => (
            <ResultTile
              key={c.id}
              card={c}
              count={inDeck(c.id)}
              banned={format === "constructed" && isBanned(c)}
              outside={!!legend && !inIdentity(c, legend)}
              onAdd={() => add(c)}
              onSide={isMainCard(c) && legend ? () => add(c, "side") : undefined}
              onExtra={c.type === "Legend" && needsExtra && legend && legend.id !== c.id ? () => add(c, "extraLegends") : undefined}
              championHint={!deck.champion && !!legend && canBeChampion(c, legend)}
            />
          ))}
        </ul>
        {results.length > limit && (
          <button onClick={() => setLimit((n) => n + PAGE)} className="mt-4 w-full rounded-md border border-border py-2 text-sm text-muted hover:text-text">
            {t("showMore", { count: results.length - limit })}
          </button>
        )}
      </section>

      <aside id="deck" aria-label={t("deckLabel")} className="min-w-0 scroll-mt-4 space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">{t("deckName")}</span>
              <input
                value={draft.name}
                maxLength={80}
                onChange={(e) => store.set((s) => ({ ...s, name: e.target.value }))}
                placeholder={t("deckName")}
                className="w-full rounded-md border border-border bg-bg px-3 py-1.5 font-display font-semibold"
              />
            </label>
            <label>
              <span className="sr-only">{t("format")}</span>
              <select
                value={format}
                onChange={(e) => store.set((s) => ({ ...s, format: e.target.value === "casual" ? "casual" : "constructed" }))}
                className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
              >
                <option value="constructed">{t("constructed")}</option>
                <option value="casual">{t("casual")}</option>
              </select>
            </label>
          </div>
          <dl className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
            {[
              [t("main"), mainCount(deck), DECK_RULES.mainSize],
              [t("runes"), runeCount(deck), DECK_RULES.runes],
              [t("battlefields"), deck.battlefields.length, DECK_RULES.battlefields],
              [t("side"), sideCount(deck), DECK_RULES.side],
            ].map(([label, n, max]) => (
              <div key={label as string} className="rounded-md bg-bg px-1 py-1.5">
                <dt className="text-muted">{label}</dt>
                <dd className={`font-display text-base font-bold ${n === max ? "text-good" : ""}`}>
                  {n}/{max}
                </dd>
              </div>
            ))}
          </dl>
          <Issues issues={issues} />
        </div>

        <DeckPanel deck={deck} pool={pool} needsExtra={needsExtra} update={update} />
        <ExportPanel draft={draft} pool={pool} store={store} legal={issues.every((i) => i.severity !== "error")} />
      </aside>

      {/* No celular o deck fica embaixo da busca: esta barra mostra o resumo e leva até ele. */}
      <a
        href="#deck"
        className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-between rounded-full border border-border bg-surface-2/95 px-4 py-2 text-sm shadow-lg backdrop-blur lg:hidden"
      >
        <span>
          {t("main")} {mainCount(deck)}/{DECK_RULES.mainSize} · {t("runes")} {runeCount(deck)}/{DECK_RULES.runes}
        </span>
        <span className={issues.some((i) => i.severity === "error") ? "text-bad" : "text-good"}>
          {issues.some((i) => i.severity === "error") ? t("issuesCount", { count: issues.filter((i) => i.severity === "error").length }) : t("legalShort")} ↓
        </span>
      </a>
    </div>
  );
}

function Issues({ issues }: { issues: ReturnType<typeof validateDeck> }) {
  const t = useTranslations("Builder");
  const ti = useTranslations("Builder.issues");
  if (!issues.length) return <p className="mt-3 rounded-md bg-good/15 px-3 py-2 text-sm text-good">{t("legal")}</p>;
  const errors = issues.filter((i) => i.severity === "error");
  return (
    <details className="mt-3 rounded-md bg-bad/10 px-3 py-2 text-sm" open={errors.length <= 4}>
      <summary className="cursor-pointer font-medium text-bad">{t("issuesCount", { count: errors.length || issues.length })}</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-text">
        {issues.map((i, n) => (
          <li key={`${i.code}-${n}`} className={i.severity === "warning" ? "text-muted" : ""}>
            {ti(i.code as "legendMissing", i.params)}
          </li>
        ))}
      </ul>
    </details>
  );
}

function ResultTile({
  card,
  count,
  banned,
  outside,
  onAdd,
  onSide,
  onExtra,
  championHint,
}: {
  card: PoolCard;
  count: number;
  banned: boolean;
  outside: boolean;
  onAdd: () => void;
  onSide?: () => void;
  onExtra?: () => void;
  championHint: boolean;
}) {
  const t = useTranslations("Builder");
  const tt = useTranslations("Types");
  const img = cardImage(card.id);
  const name = card.subtitle ? `${card.name}, ${card.subtitle}` : card.name;
  const max = copyLimit(card);
  return (
    <li className={`group relative overflow-hidden rounded-lg border bg-surface ${championHint ? "border-accent-2" : "border-border"} ${outside || banned ? "opacity-60" : ""}`}>
      <button onClick={onAdd} className="block w-full text-left" title={`${name}${card.rulesText ? `\n\n${card.rulesText}` : ""}`} aria-label={t("addCard", { name })}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" width={372} height={card.type === "Battlefield" ? 266 : 519} loading="lazy" className="w-full" />
        ) : (
          <span className="block min-h-28 p-2">
            <span className="flex items-start justify-between gap-1 text-sm font-semibold">
              <span>{name}</span>
              {card.energyCost !== null && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-text text-[11px] font-bold text-bg">{card.energyCost}</span>}
            </span>
            <span className="mt-1 flex items-center gap-1 text-[11px] text-muted">
              <DomainDots domains={card.domains} />
              {card.type ? tt(card.type) : ""}
              {card.might !== null && ` · ${card.might}`}
            </span>
            {card.rulesText && <span className="mt-1 line-clamp-4 block text-[11px] leading-snug text-muted">{card.rulesText}</span>}
          </span>
        )}
      </button>
      {count > 0 && (
        <span className="pointer-events-none absolute top-1 right-1 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-ink">
          {count}
          {Number.isFinite(max) && card.type !== "Rune" ? `/${max}` : ""}
        </span>
      )}
      {banned && <span className="pointer-events-none absolute top-1 left-1 rounded bg-bad px-1.5 py-0.5 text-[10px] font-bold text-bg">{t("bannedTag")}</span>}
      {championHint && <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-accent-2 px-1.5 py-0.5 text-[10px] font-bold text-accent-ink">{t("championTag")}</span>}
      {(onSide || onExtra) && (
        <span className="absolute right-1 bottom-1 flex gap-1">
          {onSide && (
            <button onClick={onSide} className="rounded bg-bg/90 px-1.5 py-0.5 text-[10px] font-semibold" aria-label={t("addSide", { name })}>
              {t("sideShort")}
            </button>
          )}
          {onExtra && (
            <button onClick={onExtra} className="rounded bg-bg/90 px-1.5 py-0.5 text-[10px] font-semibold" aria-label={t("addExtra", { name })}>
              {t("extraShort")}
            </button>
          )}
        </span>
      )}
    </li>
  );
}
