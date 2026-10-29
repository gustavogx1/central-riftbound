import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { decodeDeck, validateDeck, type DeckFormat } from "@cr/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CopyButton } from "@/components/CopyButton";
import { DeckShowcase } from "@/components/deck/DeckShowcase";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getSessionUser } from "@/lib/auth/server";
import { deleteDeckAction, describeDeckAction } from "@/lib/deck-actions";
import { getUserDeck, MAX_DESCRIPTION, poolMap } from "@/lib/decks";
import { makeFormat } from "@/lib/format";
import { getLegends } from "@/lib/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/decks/[id]">): Promise<Metadata> {
  const { id } = await params;
  const deck = await getUserDeck(id, null);
  // Decks não listados abrem pelo link, mas não entram em buscadores.
  return deck ? { title: deck.name, robots: deck.visibility === "public" ? undefined : { index: false } } : { robots: { index: false } };
}

export default async function DeckPage({ params }: PageProps<"/[locale]/decks/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await getSessionUser();
  const row = await getUserDeck(id, user?.id ?? null);
  if (!row) notFound();
  const t = await getTranslations("Decks");
  const tb = await getTranslations("Builder");
  const f = makeFormat(locale);
  const pool = await poolMap();
  const { deck } = decodeDeck(row.code, pool);
  const legends = await getLegends();
  const legend = legends.find((l) => l.cardId === deck.legend);
  const owner = user?.id === row.userId;
  const issues = validateDeck(deck, pool, row.format as DeckFormat);
  const builderQuery = { code: row.code, name: row.name, fmt: row.format, ...(owner ? { deck: row.id, vis: row.visibility } : {}) };
  const btn = "rounded-md border border-border bg-bg/60 px-3 py-1.5 text-sm hover:border-accent";

  return (
    <>
      <DeckShowcase
        deck={deck}
        pool={pool}
        title={row.name}
        titleText={row.name}
        kicker={`${legend ? `${legend.champion}, ${legend.title}` : t("noLegend")} · ${f.date(row.updatedAt)}`}
        byline={t("by", { author: row.author })}
        btnClass={btn}
        meta={
          <p className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-sm text-muted">{t("by", { author: row.author })}</span>
            <span className={`rounded px-1.5 py-0.5 ${row.legal ? "bg-good/15 text-good" : "bg-bad/15 text-bad"}`}>{row.legal ? t("legal") : t("notLegal")}</span>
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-muted">{tb(row.format === "casual" ? "casual" : "constructed")}</span>
            {owner && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-muted">{t(`visibility.${row.visibility}`)}</span>}
          </p>
        }
        actions={
          <>
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
          </>
        }
      >
        {!row.legal && issues.length > 0 && (
          <p className="mt-4 text-sm text-bad">{tb(`issues.${issues[0]!.code}` as "issues.legendMissing", issues[0]!.params)}</p>
        )}
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
      </DeckShowcase>
      <p className="mx-auto max-w-6xl px-4 pb-10 font-mono text-[11px] break-all text-muted">{row.code}</p>
    </>
  );
}
