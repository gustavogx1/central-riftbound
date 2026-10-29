import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { decodeDeck, energyCurve, fullName, mainCount, validateDeck, type DeckFormat, type PoolCard } from "@cr/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CopyButton } from "@/components/CopyButton";
import { CardHover } from "@/components/deck/CardHover";
import { cardName, DeckImages, type DeckRow as Row, type DeckSection } from "@/components/deck/DeckImages";
import { DeckViewToggle } from "@/components/deck/DeckViewToggle";
import { DomainDots } from "@/components/DomainDots";
import { LegendAvatar } from "@/components/LegendAvatar";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getSessionUser } from "@/lib/auth/server";
import { deleteDeckAction, describeDeckAction } from "@/lib/deck-actions";
import { getUserDeck, MAX_DESCRIPTION, poolMap } from "@/lib/decks";
import { makeFormat } from "@/lib/format";
import { cardImage, hasImages } from "@/lib/images";
import { getLegends } from "@/lib/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/decks/[id]">): Promise<Metadata> {
  const { id } = await params;
  const deck = await getUserDeck(id, null);
  // Decks não listados abrem pelo link, mas não entram em buscadores.
  return deck ? { title: deck.name, robots: deck.visibility === "public" ? undefined : { index: false } } : { robots: { index: false } };
}

function Block({ title, rows, total }: DeckSection) {
  return (
    <section>
      <h2 className="flex justify-between border-b border-border pb-1 font-display text-sm font-semibold">
        <span>{title}</span>
        {total !== undefined && <span className="text-muted">{total}</span>}
      </h2>
      <ul className="mt-1 space-y-0.5 text-sm">
        {rows.map(([c, n]) => (
          <li key={c.id} className="flex items-center gap-2" title={hasImages ? undefined : c.rulesText || undefined}>
            <span className="w-5 text-right font-display font-bold tabular-nums">{n}</span>
            <span className="w-4 text-center text-xs text-muted">{c.energyCost ?? ""}</span>
            <DomainDots domains={c.domains} />
            <CardHover src={cardImage(c.id, 744)} landscape={c.type === "Battlefield"} className="truncate">
              {cardName(c)}
            </CardHover>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function DeckPage({ params }: PageProps<"/[locale]/decks/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await getSessionUser();
  const row = await getUserDeck(id, user?.id ?? null);
  if (!row) notFound();
  const t = await getTranslations("Decks");
  const tb = await getTranslations("Builder");
  const tt = await getTranslations("Types");
  const f = makeFormat(locale);
  const pool = await poolMap();
  const { deck } = decodeDeck(row.code, pool);
  const legends = await getLegends();
  const legend = legends.find((l) => l.cardId === deck.legend);
  const owner = user?.id === row.userId;
  const issues = validateDeck(deck, pool, row.format as DeckFormat);

  const rows = (r: Record<string, number>): Row[] =>
    Object.entries(r)
      .map(([cid, n]) => [pool.get(cid), n] as const)
      .filter((x): x is Row => !!x[0])
      .sort(([a], [b]) => (a.energyCost ?? 99) - (b.energyCost ?? 99) || fullName(a).localeCompare(fullName(b)));
  const one = (ids: (string | null)[]): Row[] => ids.map((cid) => (cid ? pool.get(cid) : undefined)).filter((c): c is PoolCard => !!c).map((c) => [c, 1] as const);
  const main = rows(deck.main);
  const sum = (r: Row[]) => r.reduce((a, [, n]) => a + n, 0);
  const curve = energyCurve(deck, pool);
  const peak = Math.max(1, ...curve);
  const builderQuery = { code: row.code, name: row.name, fmt: row.format, ...(owner ? { deck: row.id, vis: row.visibility } : {}) };
  const runes = rows(deck.runes);
  const side = rows(deck.side);
  const byType = (["Unit", "Spell", "Gear"] as const).flatMap((type): DeckSection[] => {
    const r = main.filter(([c]) => c.type === type);
    return r.length ? [{ id: type, title: tt(type), rows: r, total: sum(r) }] : [];
  });
  const top: DeckSection[] = [
    { id: "legend", title: tb("legend"), rows: one([deck.legend]) },
    ...(deck.extraLegends.length ? [{ id: "extra", title: tb("extraLegendsTitle"), rows: one(deck.extraLegends) }] : []),
    { id: "champion", title: tb("champion"), rows: one([deck.champion]) },
    { id: "battlefields", title: tb("battlefields"), rows: one(deck.battlefields), total: deck.battlefields.length },
  ];
  const tail: DeckSection[] = [
    { id: "runes", title: tb("runes"), rows: runes, total: sum(runes) },
    ...(side.length ? [{ id: "side", title: tb("side"), rows: side, total: sum(side) }] : []),
  ];
  // Na grade, lenda e campeão dividem uma linha; o resto segue a ordem da lista.
  const imageSections: DeckSection[] = [
    { id: "core", title: `${tb("legend")} · ${tb("champion")}`, rows: [...one([deck.legend]), ...one(deck.extraLegends), ...one([deck.champion])] },
    top.at(-1)!,
    ...byType,
    ...tail,
  ];

  const list = (
    <div className="grid gap-8 md:grid-cols-[1fr_1.4fr]">
      <div className="space-y-5">
        {[...top, ...tail].map((s) => (
          <Block key={s.id} {...s} />
        ))}
      </div>
      <div className="space-y-5">
        <div aria-label={tb("curve")} role="img" className="flex h-24 items-end gap-1 rounded-xl border border-border bg-surface p-3">
          {curve.map((n, cost) => (
            <div key={cost} className="flex flex-1 flex-col items-center gap-0.5 text-[11px] text-muted">
              <span>{n || ""}</span>
              <span className="w-full rounded-t bg-accent/70" style={{ height: `${(n / peak) * 44}px` }} />
              <span>{cost === 7 ? "7+" : cost}</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted">{tb("printMainTotal", { count: mainCount(deck) })}</p>
        {byType.map((s) => (
          <Block key={s.id} {...s} />
        ))}
      </div>
    </div>
  );
  const btn = "rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-4">
        {legend && <LegendAvatar cardId={legend.cardId} champion={legend.champion} domains={legend.domains} size={64} />}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-bold break-words">{row.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {legend ? `${legend.champion}, ${legend.title}` : t("noLegend")} · {t("by", { author: row.author })} · {f.date(row.updatedAt)}
          </p>
          <p className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className={`rounded px-1.5 py-0.5 ${row.legal ? "bg-good/15 text-good" : "bg-bad/15 text-bad"}`}>{row.legal ? t("legal") : t("notLegal")}</span>
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-muted">{tb(row.format === "casual" ? "casual" : "constructed")}</span>
            {owner && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-muted">{t(`visibility.${row.visibility}`)}</span>}
          </p>
        </div>
      </div>

      {owner ? (
        <form action={describeDeckAction} className="mt-6 max-w-3xl">
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="next" value={getPathname({ href: `/decks/${row.id}`, locale: locale as Locale })} />
          <label className="block text-sm text-muted">
            {t("description")}
            <textarea name="description" defaultValue={row.description} maxLength={MAX_DESCRIPTION} rows={3} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-text" />
          </label>
          <button className="mt-2 rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent">{t("saveDescription")}</button>
        </form>
      ) : (
        row.description && <p className="mt-6 max-w-3xl whitespace-pre-line text-muted">{row.description}</p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href={{ pathname: "/builder", query: builderQuery }} className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink">
          {owner ? t("edit") : t("copyToBuilder")}
        </Link>
        <CopyButton value={row.code} label={tb("copyCode")} done={tb("copied")} className={btn} />
        <Link href={{ pathname: "/builder/print", query: { code: row.code, name: row.name } }} className={btn}>
          {tb("print")}
        </Link>
        {owner && (
          <form action={deleteDeckAction}>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="next" value={getPathname({ href: "/account", locale: locale as Locale })} />
            <button className={`${btn} text-bad`}>{t("delete")}</button>
          </form>
        )}
      </div>
      {!row.legal && issues.length > 0 && (
        <p className="mt-3 text-sm text-bad">{tb(`issues.${issues[0]!.code}` as "issues.legendMissing", issues[0]!.params)}</p>
      )}

      {hasImages ? (
        <DeckViewToggle list={list} images={<DeckImages sections={imageSections} />} labels={{ view: t("view"), list: t("viewList"), images: t("viewImages") }} />
      ) : (
        <div className="mt-8">{list}</div>
      )}
      <p className="mt-8 font-mono text-[11px] break-all text-muted">{row.code}</p>
    </div>
  );
}
