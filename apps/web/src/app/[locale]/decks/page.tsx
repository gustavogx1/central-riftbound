import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DeckCardItem } from "@/components/DeckCardItem";
import { Pagination } from "@/components/Pagination";
import { Link } from "@/i18n/navigation";
import { listPublicDecks } from "@/lib/decks";
import { getLegends } from "@/lib/queries";

const PAGE_SIZE = 30;

export async function generateMetadata({ params }: PageProps<"/[locale]/decks">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Decks" });
  return { title: t("title"), description: t("lead") };
}

export default async function DecksPage({ params, searchParams }: PageProps<"/[locale]/decks">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("Decks");
  const tc = await getTranslations("Common");
  const legends = await getLegends();
  const bySlug = new Map(legends.map((l) => [l.slug, l]));
  const byCard = new Map(legends.map((l) => [l.cardId, l]));
  const legend = typeof sp.legend === "string" ? bySlug.get(sp.legend) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await listPublicDecks({ legendCardId: legend?.cardId, page, pageSize: PAGE_SIZE });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold md:text-4xl">{t("title")}</h1>
          <p className="mt-3 max-w-2xl text-muted">{t("lead")}</p>
        </div>
        <Link href="/builder" className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">{t("newDeck")}</Link>
      </div>
      <form method="get" className="mt-6 flex flex-wrap gap-2">
        <label className="text-sm">
          <span className="sr-only">{tc("legend")}</span>
          <select name="legend" defaultValue={legend?.slug ?? ""} className="rounded-md border border-border bg-surface px-2 py-2">
            <option value="">{t("allLegends")}</option>
            {legends.map((l) => (
              <option key={l.slug} value={l.slug}>{l.champion}, {l.title}</option>
            ))}
          </select>
        </label>
        <button className="rounded-md border border-border px-4 py-2 text-sm hover:border-accent">{tc("search")}</button>
      </form>
      <p className="mt-4 text-sm text-muted">{t("count", { count: total })}</p>
      {rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-border bg-surface p-6 text-muted">{t("empty")}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((d) => (
            <li key={d.id}>
              <DeckCardItem deck={d} legend={d.legendCardId ? byCard.get(d.legendCardId) : undefined} locale={locale} />
            </li>
          ))}
        </ul>
      )}
      <Pagination pathname="/decks" query={{ legend: legend?.slug }} page={page} total={total} pageSize={PAGE_SIZE} />
      <p className="mt-8 text-xs text-muted">{t("tournamentNote")}</p>
    </div>
  );
}
