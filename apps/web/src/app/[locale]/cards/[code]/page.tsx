import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fullName, isBanned } from "@cr/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DomainDots } from "@/components/DomainDots";
import { LegendAvatar } from "@/components/LegendAvatar";
import { RulesText } from "@/components/RulesText";
import { Link } from "@/i18n/navigation";
import { getCardTournamentUse } from "@/lib/card-stats";
import { makeFormat } from "@/lib/format";
import { priceLinks } from "@/lib/price-links";
import { cardImage } from "@/lib/images";
import { getCardByCode, getLegendsBySlugs, PRINT_VERSIONS, type PrintVersion } from "@/lib/queries";

export const revalidate = 3600;

function variantKey(v: string): PrintVersion {
  if (v === "alt art") return "altArt";
  return (PRINT_VERSIONS as readonly string[]).includes(v) ? (v as PrintVersion) : "special";
}

export async function generateMetadata({ params }: PageProps<"/[locale]/cards/[code]">): Promise<Metadata> {
  const { code } = await params;
  const hit = await getCardByCode(decodeURIComponent(code));
  return hit ? { title: fullName(hit.card), description: hit.card.rulesText || undefined } : { robots: { index: false } };
}

/** Uma carta: texto, impressões e como ela aparece nas decklists de torneio. */
export default async function CardPage({ params }: PageProps<"/[locale]/cards/[code]">) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const hit = await getCardByCode(decodeURIComponent(code));
  if (!hit) notFound();
  const { card, prints, base, legendSlug } = hit;
  const t = await getTranslations("CardPage");
  const tt = await getTranslations("Types");
  const tv = await getTranslations("PrintVersions");
  const ts = await getTranslations("Sets");
  const tcs = await getTranslations("CardStats");
  const tc = await getTranslations("Common");
  const f = makeFormat(locale);
  const use = await getCardTournamentUse(card.id);
  const legends = await getLegendsBySlugs([...use.byLegend.map((l) => l.legend), ...use.recent.map((r) => r.legend).filter((s): s is string => Boolean(s))]);
  const img = cardImage(base.id, 744);
  const landscape = card.type === "Battlefield";
  const banned = isBanned(card);
  const stats: [string, string][] = [
    [t("type"), card.type ? tt(card.type) : "—"],
    ...(card.energyCost !== null ? [[t("energy"), String(card.energyCost)] as [string, string]] : []),
    ...(card.powerCost !== null ? [[t("power"), String(card.powerCost)] as [string, string]] : []),
    ...(card.might !== null ? [[t("might"), String(card.might)] as [string, string]] : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-muted">
        <Link href="/cards" className="hover:text-text">{t("allCards")}</Link> / {base.code}
      </p>
      <div className="mt-4 flex flex-col gap-8 md:flex-row md:items-start">
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={fullName(card)} width={landscape ? 520 : 372} height={landscape ? 372 : 519} className={`shrink-0 rounded-xl ${landscape ? "w-full md:w-[30rem]" : "w-56 md:w-72"}`} />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-bold md:text-4xl">{card.name}</h1>
          {card.subtitle && <p className="mt-1 text-lg text-muted">{card.subtitle}</p>}
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <DomainDots domains={card.domains} /> {card.domains.join(" · ") || t("colorless")}
            {card.tags.length > 0 && <span>· {card.tags.join(", ")}</span>}
            {card.supertypes.length > 0 && <span>· {card.supertypes.join(", ")}</span>}
          </p>
          {banned && <p className="mt-3 inline-block rounded bg-bad/15 px-2 py-1 text-sm text-bad">{t("banned")}</p>}
          <dl className="mt-4 flex flex-wrap gap-3">
            {stats.map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border bg-surface px-3 py-2">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="font-display text-lg font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          {card.rulesText && (
            <p className="mt-4 max-w-2xl rounded-lg border border-border bg-surface p-3 text-sm leading-relaxed">
              <RulesText text={card.rulesText} />
            </p>
          )}
          <p className="mt-4 flex flex-wrap gap-3 text-sm">
            {legendSlug && <Link href={`/legends/${legendSlug}`} className="text-accent underline">{t("legendPage")}</Link>}
            <Link href={{ pathname: "/cards", query: { q: card.name } }} className="text-accent underline">{t("sameName")}</Link>
          </p>

          <h2 className="mt-8 font-display text-xl font-semibold">{t("pricesTitle")}</h2>
          <p className="mt-1 text-sm text-muted">{t("pricesNote")}</p>
          <p className="mt-2 flex flex-wrap gap-2 text-sm">
            {priceLinks(card.name).map((l) => (
              <a key={l.store} href={l.href} target="_blank" rel="noopener noreferrer nofollow" className="rounded-md border border-border bg-surface px-3 py-1.5 hover:border-accent">
                {t("seePriceAt", { store: l.store })} ↗
              </a>
            ))}
          </p>

          <h2 className="mt-8 font-display text-xl font-semibold">{t("prints")}</h2>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {prints.map((p) => (
              <li key={p.id} className="rounded-md border border-border bg-surface px-2.5 py-1">
                {p.publicCode} · {ts(p.setId as "all")}
                {p.variant && <span className="text-muted"> · {p.variant.split(",").map((v) => tv(variantKey(v.trim()))).join(", ")}</span>}
                {p.rarity && <span className="text-muted"> · {p.rarity}</span>}
              </li>
            ))}
          </ul>
          {base.artist && <p className="mt-2 text-xs text-muted">{t("artist", { artist: base.artist })}</p>}
        </div>
      </div>

      <section className="mt-12" aria-labelledby="use-h">
        <h2 id="use-h" className="font-display text-2xl font-semibold">{t("tournamentTitle")}</h2>
        {use.decks === 0 ? (
          <p className="mt-2 text-sm text-muted">{use.total ? t("notPlayed", { total: use.total }) : tcs("none")}</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">{t("playedIn", { count: use.decks, total: use.total })}</p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-surface text-left text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">{tc("legend")}</th>
                    <th className="px-3 py-2 font-medium">{tcs("inclusion")}</th>
                    <th className="px-3 py-2 text-right font-medium">{tcs("copies")}</th>
                  </tr>
                </thead>
                <tbody>
                  {use.byLegend.slice(0, 20).map((u) => {
                    const l = legends.get(u.legend);
                    const share = u.decks / u.total;
                    return (
                      <tr key={u.legend} className="border-t border-border">
                        <td className="px-3 py-2">
                          <Link href={`/legends/${u.legend}`} className="flex items-center gap-2 hover:text-accent">
                            {l && <LegendAvatar cardId={l.cardId} champion={l.champion} domains={l.domains} size={24} />}
                            {l?.champion ?? u.legend}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 w-24 rounded-full bg-surface-2">
                              <span className="block h-full rounded-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${share * 100}%` }} />
                            </span>
                            <span className="tabular-nums">{f.pct(share, 0)}</span>
                            <span className="text-xs text-muted tabular-nums">{tcs("ofDecks", { count: u.decks, total: u.total })}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{f.dec(u.avgCopies, 1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <h3 className="mt-8 font-display text-lg font-semibold">{t("recentDecks")}</h3>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {use.recent.map((d) => {
                const l = d.legend ? legends.get(d.legend) : undefined;
                return (
                  <li key={`${d.eventId}-${d.key}`}>
                    <Link href={`/events/${d.eventId}/decks/${encodeURIComponent(d.key)}`} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-sm hover:border-accent">
                      {l && <LegendAvatar cardId={l.cardId} champion={l.champion} domains={l.domains} size={32} />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{d.hidden ? tc("hiddenPlayer") : d.name}</span>
                        <span className="block truncate text-muted">{d.rank !== null ? t("place", { rank: d.rank, event: d.eventName }) : d.eventName}</span>
                        <span className="block text-xs text-muted">{f.date(new Date(d.startsAt))} · {t("copiesIn", { copies: d.copies, zone: tcs(`zones.${d.zone}`) })}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
