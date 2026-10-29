import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DomainDots } from "@/components/DomainDots";
import { LegendAvatar } from "@/components/LegendAvatar";
import { ScopeFilter } from "@/components/ScopeFilter";
import { TierBadge } from "@/components/TierBadge";
import { Link } from "@/i18n/navigation";
import { makeFormat } from "@/lib/format";
import { getLegends, getLegendStats } from "@/lib/queries";
import { resolveScope } from "@/lib/scope";

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[locale]/legends">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legends" });
  return { title: t("title"), description: t("lead") };
}

export default async function LegendsPage({ params, searchParams }: PageProps<"/[locale]/legends">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Legends");
  const tc = await getTranslations("Common");
  const f = makeFormat(locale);
  const { metagames, meta, kind, scope } = await resolveScope(await searchParams);
  const [legends, stats] = await Promise.all([getLegends(), getLegendStats(scope)]);
  const bySlug = new Map(stats.map((s) => [s.slug, s]));
  const sorted = [...legends].sort((a, b) => (bySlug.get(b.slug)?.power ?? -1) - (bySlug.get(a.slug)?.power ?? -1) || a.champion.localeCompare(b.champion));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold md:text-4xl">{t("title")}</h1>
      <p className="mt-3 max-w-3xl text-muted">{t("lead")}</p>
      <div className="mt-6">
        <ScopeFilter pathname="/legends" metagames={metagames} meta={meta} kind={kind} />
      </div>
      {legends.length === 0 ? (
        <p className="mt-12 rounded-xl border border-border bg-surface p-6 text-muted">{tc("noData")}</p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((l) => {
            const s = bySlug.get(l.slug);
            return (
              <li key={l.slug}>
                <Link
                  href={{ pathname: `/legends/${l.slug}`, query: { set: meta, kind } }}
                  className={`flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition hover:border-accent ${s ? "" : "opacity-60"}`}
                >
                  <LegendAvatar cardId={l.cardId} champion={l.champion} domains={l.domains} size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{l.champion}</span>
                    <span className="block truncate text-xs text-muted">{l.title}</span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-muted">
                      <DomainDots domains={l.domains} />
                      {s ? `${f.pct(s.winRate)} · ${f.pct(s.share)}` : t("noStats")}
                    </span>
                  </span>
                  {s && <TierBadge tier={s.tier} />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
