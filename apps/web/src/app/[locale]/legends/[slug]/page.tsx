import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MIN_COMPLEXITY_VOTES, MIN_PILOT_MATCHES } from "@cr/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ComplexityVote } from "@/components/ComplexityVote";
import { DomainDots } from "@/components/DomainDots";
import { LegendAvatar } from "@/components/LegendAvatar";
import { RulesText } from "@/components/RulesText";
import { ScopeFilter } from "@/components/ScopeFilter";
import { TierBadge } from "@/components/TierBadge";
import { Link } from "@/i18n/navigation";
import { makeFormat } from "@/lib/format";
import { cardImage } from "@/lib/images";
import { type LegendInfo, getLegend, getLegendCard, getLegendsBySlugs, getLegendStats, getMatchups, getTopPilots, METAGAMES } from "@/lib/queries";
import { resolveScope } from "@/lib/scope";
import { getComplexity } from "@/lib/votes";

export const revalidate = 3600;
const MATCHUP_MIN = 20;

type RatedMatchup = { opponent: string; wr: number; n: number };

function MatchupList({ title, rows, opponents, meta, kind, locale }: { title: string; rows: RatedMatchup[]; opponents: Map<string, LegendInfo>; meta: string; kind: string; locale: string }) {
  const f = makeFormat(locale);
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="font-display font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map((m) => {
          const o = opponents.get(m.opponent);
          return (
            <li key={m.opponent} className="flex items-center gap-3">
              {o && <LegendAvatar cardId={o.cardId} champion={o.champion} domains={o.domains} size={28} />}
              <Link href={{ pathname: `/legends/${m.opponent}`, query: { set: meta, kind } }} className="flex-1 truncate hover:text-accent">{o?.champion ?? m.opponent}</Link>
              <span className="tabular-nums font-semibold">{f.pct(m.wr)}</span>
              <span className="w-14 text-right tabular-nums text-xs text-muted">{f.num(m.n)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export async function generateMetadata({ params }: PageProps<"/[locale]/legends/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const legend = await getLegend(slug);
  return { title: legend ? `${legend.champion}, ${legend.title}` : undefined };
}

export default async function LegendPage({ params, searchParams }: PageProps<"/[locale]/legends/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const legend = await getLegend(slug);
  if (!legend) notFound();
  const t = await getTranslations("Legend");
  const tc = await getTranslations("Common");
  const f = makeFormat(locale);
  const sp = await searchParams;
  const resolved = await resolveScope(sp);
  const { metagames, kind } = resolved;
  let { meta, scope } = resolved;
  let all = await getLegendStats(scope);
  // Sem set escolhido e sem dados no set padrão: usa o set mais novo em que a lenda tem resultados.
  if (!sp.set && !all.some((x) => x.slug === slug)) {
    for (const m of [...metagames, "all"]) {
      const candidate = await getLegendStats(`${m}:${kind}`);
      if (candidate.some((x) => x.slug === slug)) {
        meta = m;
        scope = `${m}:${kind}`;
        all = candidate;
        break;
      }
    }
  }
  const [card, matchups, pilots] = await Promise.all([getLegendCard(legend.cardId), getMatchups(scope, slug), getTopPilots(scope, slug)]);
  const s = all.find((x) => x.slug === slug);
  const opponents = await getLegendsBySlugs(matchups.map((m) => m.opponent));
  const rated = matchups
    .filter((m) => m.wins + m.losses >= MATCHUP_MIN)
    .map((m) => ({ ...m, wr: m.wins / (m.wins + m.losses), n: m.wins + m.losses }))
    .sort((a, b) => b.wr - a.wr);
  const best = rated.slice(0, 5);
  const worst = [...rated].reverse().slice(0, 5);
  const img = cardImage(legend.cardId, 372);
  // Voto por set; em "todos os sets" vale o set mais novo.
  const voteSet = meta === "all" ? (metagames[0] ?? METAGAMES[0]) : meta;
  const complexity = (await getComplexity(voteSet)).get(slug);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={`${legend.champion}, ${legend.title}`} width={186} height={260} className="w-40 shrink-0 rounded-xl md:w-48" />
        ) : (
          <LegendAvatar cardId={legend.cardId} champion={legend.champion} domains={legend.domains} size={96} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            {s && <TierBadge tier={s.tier} />}
            <h1 className="font-display text-3xl font-bold md:text-4xl">{legend.champion}</h1>
          </div>
          <p className="mt-1 text-lg text-muted">{legend.title}</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted"><DomainDots domains={legend.domains} /> {legend.domains.join(" · ")}</p>
          {card?.rulesText && (
            <p className="mt-4 max-w-2xl rounded-lg border border-border bg-surface p-3 text-sm leading-relaxed">
              <span className="mb-1 block text-xs uppercase tracking-wider text-muted">{t("rulesText")}</span>
              <RulesText text={card.rulesText} />
            </p>
          )}
          <ComplexityVote legend={slug} metagame={voteSet} votes={complexity?.votes ?? 0} average={complexity?.average ?? null} min={MIN_COMPLEXITY_VOTES} />
          <p className="mt-3 text-sm">
            <Link href={{ pathname: "/decks", query: { legend: slug } }} className="text-accent underline">{t("publicDecks")}</Link>
            {" · "}
            <Link href="/builder" className="text-accent underline">{t("buildDeck")}</Link>
          </p>
        </div>
      </div>

      <div className="mt-8">
        <ScopeFilter pathname={`/legends/${slug}`} metagames={metagames} meta={meta} kind={kind} />
      </div>

      {!s ? (
        <p className="mt-8 rounded-xl border border-border bg-surface p-6 text-muted">{tc("notEnough")}</p>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              [tc("power"), String(s.power)],
              [tc("winRate"), f.pct(s.winRate)],
              [tc("matches"), f.num(s.wins + s.losses)],
              [tc("share"), f.pct(s.share)],
              [t("entries"), f.num(s.pilots)],
              [t("topCut"), `${f.num(s.topCutHits)} · ${f.dec(s.conversion)}×`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-border bg-surface p-3">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="mt-1 font-display text-xl font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          {s.wilsonLow !== null && <p className="mt-2 text-xs text-muted">{tc("winRate")}: {tc("confidence", { low: f.pct(s.wilsonLow), high: f.pct(s.wilsonHigh) })}</p>}

          {rated.length > 0 && (
            <section className="mt-10 grid gap-4 md:grid-cols-2">
              <MatchupList title={t("bestMatchups")} rows={best} opponents={opponents} meta={meta} kind={kind} locale={locale} />
              <MatchupList title={t("worstMatchups")} rows={worst} opponents={opponents} meta={meta} kind={kind} locale={locale} />
            </section>
          )}

          <section className="mt-10" aria-labelledby="pilots-h">
            <h2 id="pilots-h" className="font-display text-2xl font-semibold">{t("pilotsTitle")}</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted">{t("pilotsLead")}</p>
            {pilots.length === 0 ? (
              <p className="mt-4 text-sm text-muted">{t("noPilots", { min: MIN_PILOT_MATCHES })}</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-surface text-left text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">{tc("player")}</th>
                      <th className="px-3 py-2 text-right font-medium">{tc("record")}</th>
                      <th className="px-3 py-2 text-right font-medium">{tc("winRate")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("eventsPlayed")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("bestRank")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("score")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pilots.map((p, i) => (
                      <tr key={p.stats.playerId} className="border-t border-border">
                        <td className="px-3 py-2 text-muted">{i + 1}</td>
                        <td className="px-3 py-2 font-semibold">{p.hidden ? tc("hiddenPlayer") : p.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.stats.wins}-{p.stats.losses}-{p.stats.draws}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{f.pct(p.stats.wins / Math.max(1, p.stats.wins + p.stats.losses))}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.stats.events}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.stats.bestRank ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{f.pct(p.stats.score)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
