import type { Metadata } from "next";
import { MIN_COMPLEXITY_VOTES } from "@cr/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegendAvatar } from "@/components/LegendAvatar";
import { MetaChart, type ChartPoint } from "@/components/MetaChart";
import { ScopeFilter } from "@/components/ScopeFilter";
import { TierBadge } from "@/components/TierBadge";
import { Trend } from "@/components/Trend";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { makeFormat } from "@/lib/format";
import { legendAvatar } from "@/lib/images";
import { getLegendStats, getMatchups, getScopeTotals, METAGAMES } from "@/lib/queries";
import { resolveScope } from "@/lib/scope";
import { getComplexity } from "@/lib/votes";

export const revalidate = 3600;
const MATRIX_SIZE = 14;
const MATRIX_MIN = 30;

export async function generateMetadata({ params }: PageProps<"/[locale]/meta">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return { title: t("title"), description: t("lead") };
}

export default async function MetaPage({ params, searchParams }: PageProps<"/[locale]/meta">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("Meta");
  const tc = await getTranslations("Common");
  const f = makeFormat(locale);
  const { metagames, meta, kind, scope } = await resolveScope(sp);
  const voteSet = meta === "all" ? (metagames[0] ?? METAGAMES[0]) : meta;
  const [stats, totals, matchups, complexity] = await Promise.all([getLegendStats(scope), getScopeTotals(scope), getMatchups(scope), getComplexity(voteSet)]);

  const legendHref = (slug: string) => getPathname({ locale: locale as Locale, href: { pathname: `/legends/${slug}`, query: { set: meta, kind } } });
  const points: ChartPoint[] = stats.map((s) => ({
    slug: s.slug,
    champion: s.champion,
    title: s.title,
    power: s.power,
    tier: s.tier,
    share: s.share,
    matches: s.wins + s.losses,
    winRate: s.winRate,
    low: s.wilsonLow,
    high: s.wilsonHigh,
    avatar: legendAvatar(s.cardId),
    domains: s.domains,
    href: legendHref(s.slug),
    complexity: complexity.get(s.slug)?.score ?? null,
  }));

  const matrixLegends = [...stats].sort((a, b) => b.share - a.share).slice(0, MATRIX_SIZE);
  const mu = new Map(matchups.map((m) => [`${m.legend}|${m.opponent}`, m]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold md:text-4xl">{t("title")}</h1>
      <p className="mt-3 max-w-3xl text-muted">{t("lead")}</p>
      <div className="mt-6">
        <ScopeFilter pathname="/meta" metagames={metagames} meta={meta} kind={kind} />
      </div>

      {stats.length === 0 ? (
        <p className="mt-12 rounded-xl border border-border bg-surface p-6 text-muted">{tc("noData")}</p>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">
            {tc("basedOn", { matches: f.num(totals.matches), events: totals.events })}
            {totals.lastEvent && <> · {tc("updated", { date: f.date(totals.lastEvent) })}</>}
            {" · "}
            <Link href="/about/methodology" className="underline decoration-dotted underline-offset-4 hover:text-text">{t("methodology")}</Link>
          </p>

          <section className="mt-6 hidden rounded-xl border border-border bg-surface p-4 md:block" aria-label={t("chartLabel")}>
            <MetaChart
              points={points}
              locale={locale}
              labels={{
                chart: t("chartLabel"),
                yAxis: t("yAxis"),
                xLabel: t("xAxis"),
                xShare: t("xShare"),
                xComplexity: t("xComplexity"),
                xComplexityOff: t("xComplexityOff", { min: MIN_COMPLEXITY_VOTES }),
                complexity: t("complexity"),
                missingVotes: t("missingVotes", { count: points.filter((p) => p.complexity === null).length, min: MIN_COMPLEXITY_VOTES }),
                share: tc("share"),
                winRate: tc("winRate"),
                matches: tc("matches"),
                power: tc("power"),
              }}
            />
          </section>
          <p className="mt-6 text-sm text-muted md:hidden">{t("mobileHint")}</p>

          <section className="mt-10" aria-labelledby="table-h">
            <h2 id="table-h" className="font-display text-2xl font-semibold">{t("tableTitle")}</h2>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-surface text-left text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">{tc("legend")}</th>
                    <th className="px-3 py-2 font-medium">{tc("tier")}</th>
                    <th className="px-3 py-2 text-right font-medium">{tc("power")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("trend")}</th>
                    <th className="px-3 py-2 text-right font-medium">{tc("winRate")}</th>
                    <th className="px-3 py-2 text-right font-medium">{tc("matches")}</th>
                    <th className="px-3 py-2 text-right font-medium">{tc("share")}</th>
                    <th className="px-3 py-2 text-right font-medium" title={t("conversionHint")}>{t("conversion")}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s, i) => (
                    <tr key={s.slug} className="border-t border-border hover:bg-surface/60">
                      <td className="px-3 py-2 text-muted">{i + 1}</td>
                      <td className="px-3 py-2">
                        <Link href={{ pathname: `/legends/${s.slug}`, query: { set: meta, kind } }} className="flex items-center gap-3 hover:text-accent">
                          <LegendAvatar cardId={s.cardId} champion={s.champion} domains={s.domains} size={34} />
                          <span>
                            <span className="block font-semibold">{s.champion}</span>
                            <span className="block text-xs text-muted">{s.title}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-2"><TierBadge tier={s.tier} size="sm" /></td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{s.power}</td>
                      <td className="px-3 py-2 text-right tabular-nums"><Trend power={s.power} prev={s.prevPower} /></td>
                      <td className="px-3 py-2 text-right tabular-nums" title={s.wilsonLow !== null ? tc("confidence", { low: f.pct(s.wilsonLow), high: f.pct(s.wilsonHigh) }) : undefined}>
                        {f.pct(s.winRate)}
                        {s.wilsonLow !== null && <span className="block text-xs text-muted">{f.pct(s.wilsonLow, 0)}–{f.pct(s.wilsonHigh, 0)}</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{f.num(s.wins + s.losses)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{f.pct(s.share)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{f.dec(s.conversion)}×</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {matrixLegends.length > 1 && (
            <section className="mt-12" aria-labelledby="mu-h">
              <h2 id="mu-h" className="font-display text-2xl font-semibold">{t("matchupsTitle")}</h2>
              <p className="mt-2 text-sm text-muted">{t("matchupsLead", { min: MATRIX_MIN })}</p>
              <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                <table className="text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-surface p-2" />
                      {matrixLegends.map((c) => (
                        <th key={c.slug} className="bg-surface p-2" title={`${c.champion}, ${c.title}`}>
                          <span className="flex justify-center"><LegendAvatar cardId={c.cardId} champion={c.champion} domains={c.domains} size={28} /></span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixLegends.map((r) => (
                      <tr key={r.slug}>
                        <th className="sticky left-0 z-10 whitespace-nowrap bg-surface px-3 py-1.5 text-left font-medium">{r.champion}</th>
                        {matrixLegends.map((c) => {
                          if (r.slug === c.slug) return <td key={c.slug} className="border-l border-t border-border px-2 py-1.5 text-center text-muted">—</td>;
                          const m = mu.get(`${r.slug}|${c.slug}`);
                          const n = m ? m.wins + m.losses : 0;
                          const wr = n ? m!.wins / n : null;
                          const strength = wr === null ? 0 : Math.min(1, Math.abs(wr - 0.5) * 4);
                          const bg = wr === null ? "transparent" : wr >= 0.5 ? `color-mix(in oklab, var(--tier-c) ${strength * 55}%, transparent)` : `color-mix(in oklab, var(--tier-s) ${strength * 55}%, transparent)`;
                          return (
                            <td
                              key={c.slug}
                              className="border-l border-t border-border px-2 py-1.5 text-center tabular-nums"
                              style={{ background: bg, opacity: n < MATRIX_MIN ? 0.45 : 1 }}
                              title={`${r.champion} vs ${c.champion}: ${f.pct(wr)} (${f.num(n)})`}
                            >
                              {wr === null ? "" : f.pct(wr, 0)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
