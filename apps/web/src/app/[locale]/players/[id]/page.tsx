import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MIN_BEST_OF_PILOTS } from "@cr/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CrownIcon, TrophyIcon } from "@/components/Honors";
import { LegendAvatar } from "@/components/LegendAvatar";
import { PlayerMatches, recordOf } from "@/components/PlayerMatches";
import { getPathname, Link } from "@/i18n/navigation";
import { eventTag } from "@/lib/event-tag";
import { makeFormat } from "@/lib/format";
import { getLegendsBySlugs, getPlayer, getPlayerEvents, getPlayerHonors, getPlayerLegends, getPlayerMatches, getTopOpponents } from "@/lib/queries";

export const revalidate = 600;

export async function generateMetadata({ params }: PageProps<"/[locale]/players/[id]">): Promise<Metadata> {
  const { id } = await params;
  const p = Number.isInteger(Number(id)) ? await getPlayer(Number(id)) : null;
  return { title: p?.name };
}

export default async function PlayerPage({ params }: PageProps<"/[locale]/players/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const player = Number.isInteger(Number(id)) ? await getPlayer(Number(id)) : null;
  if (!player) notFound();
  const t = await getTranslations("Player");
  const tc = await getTranslations("Common");
  const tp = await getTranslations("Players");
  const te = await getTranslations("Events");
  const f = makeFormat(locale);

  const [events, byLegend, matches, opponents, honors] = await Promise.all([
    getPlayerEvents(player.id),
    getPlayerLegends(player.id),
    getPlayerMatches(player.id, { limit: 30 }),
    getTopOpponents(player.id),
    getPlayerHonors(player.id),
  ]);
  const slugs = new Set<string>(byLegend.map((l) => l.legend));
  events.forEach((e) => e.legend && slugs.add(e.legend));
  honors.forEach((h) => h.legend && slugs.add(h.legend));
  matches.forEach((m) => { if (m.legend) slugs.add(m.legend); if (m.opponentLegend) slugs.add(m.opponentLegend); });
  const legends = await getLegendsBySlugs([...slugs]);
  const total = recordOf(byLegend);
  const decided = total.wins + total.losses;
  const wins = honors.filter((h) => h.won);
  const crowns = honors.filter((h) => h.bestOf && h.legend);
  const honorOf = new Map(honors.map((h) => [h.id, h]));
  const best = events.filter((e) => e.rank !== null).sort((a, b) => a.rank! - b.rank!)[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-muted"><Link href="/players" className="hover:text-text">{tp("title")}</Link></p>
      <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">{player.name}</h1>
      {player.nick && <p className="mt-1 text-sm text-muted">{t("realName", { name: player.realName })}</p>}

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [tc("events"), f.num(events.length)],
          [tc("record"), `${total.wins}-${total.losses}-${total.draws}`],
          [tc("winRate"), decided ? f.pct(total.wins / decided) : "—"],
          [t("bestFinish"), best ? t("rankOf", { rank: best.rank!, players: f.num(best.playerCount) }) : "—"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border bg-surface p-4">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="mt-1 font-display text-2xl font-bold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted">{t("recordNote")}</p>

      {honors.length > 0 && (
        <section className="mt-10" aria-labelledby="pl-honors">
          <h2 id="pl-honors" className="font-display text-xl font-semibold">{t("honors")}</h2>
          {wins.length > 0 && (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {wins.map((h) => {
                const l = h.legend ? legends.get(h.legend) : undefined;
                return (
                  <li key={h.id}>
                    <Link
                      href={`/events/${h.id}`}
                      className="flex h-full flex-col items-center gap-2 rounded-xl border border-gold/40 bg-gradient-to-b from-gold/15 to-surface px-4 py-5 text-center hover:border-gold"
                    >
                      <TrophyIcon size={44} />
                      <span className="text-xs font-semibold uppercase tracking-wide text-gold">{t("won")}</span>
                      <span className="font-display font-semibold leading-snug">{h.name}</span>
                      <span className="flex flex-wrap items-center justify-center gap-x-2 text-xs text-muted">
                        <span>{f.date(h.startsAt)}</span>
                        <span>{f.num(h.playerCount)} {tc("players").toLowerCase()}</span>
                      </span>
                      {l && (
                        <span className="flex items-center gap-2 text-sm">
                          <LegendAvatar cardId={l.cardId} champion={l.champion} domains={l.domains} size={24} />
                          {l.champion}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {crowns.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {crowns.map((h) => {
                const l = legends.get(h.legend!);
                return (
                  <li key={h.id}>
                    <Link href={`/events/${h.id}`} className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 text-sm hover:border-gold">
                      {l && <LegendAvatar cardId={l.cardId} champion={l.champion} domains={l.domains} size={28} />}
                      <CrownIcon size={16} />
                      <span>
                        <span className="font-semibold">{t("bestOf", { champion: l?.champion ?? h.legend! })}</span>
                        <span className="text-muted"> · {h.name}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted">{t("honorsNote", { min: MIN_BEST_OF_PILOTS })}</p>
        </section>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="pl-events" className="min-w-0">
          <h2 id="pl-events" className="font-display text-xl font-semibold">{tc("events")}</h2>
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
            {events.map((e) => {
              const l = e.legend ? legends.get(e.legend) : undefined;
              const h = honorOf.get(e.id);
              return (
                <li key={e.id}>
                  <Link href={{ pathname: `/events/${e.id}`, query: { q: player.name } }} className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-surface px-4 py-3 hover:bg-surface-2">
                    <span className="w-24 shrink-0 text-sm tabular-nums text-muted">{f.date(e.startsAt)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{e.name}</span>
                      <span className="text-xs text-muted">{te(eventTag(e.kind, e.name))}</span>
                    </span>
                    {l && (
                      <span className="flex items-center gap-2 text-sm">
                        <LegendAvatar cardId={l.cardId} champion={l.champion} domains={l.domains} size={24} />
                        {l.champion}
                      </span>
                    )}
                    <span className="w-28 text-right text-sm tabular-nums">
                      <span className="flex items-center justify-end gap-1 font-semibold">
                        {h?.won && <><TrophyIcon size={14} /><span className="sr-only">{t("won")}</span></>}
                        {h?.bestOf && h.legend && <><CrownIcon size={14} /><span className="sr-only">{t("bestOf", { champion: legends.get(h.legend)?.champion ?? h.legend })}</span></>}
                        {e.rank ? `#${e.rank}` : "—"}
                      </span>
                      <span className="text-xs text-muted">{e.wins}-{e.losses}-{e.draws}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="min-w-0 space-y-8">
          <section aria-labelledby="pl-legends">
            <h2 id="pl-legends" className="font-display text-xl font-semibold">{t("legends")}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {byLegend.map((r) => {
                const l = legends.get(r.legend);
                const n = r.wins + r.losses;
                return (
                  <li key={r.legend} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2.5">
                    {l && <LegendAvatar cardId={l.cardId} champion={l.champion} domains={l.domains} size={32} />}
                    <Link href={`/legends/${r.legend}`} className="min-w-0 flex-1 truncate hover:text-accent">{l?.champion ?? r.legend}</Link>
                    <span className="text-right tabular-nums">
                      <span className="block font-semibold">{n ? f.pct(r.wins / n) : "—"}</span>
                      <span className="text-xs text-muted">{r.wins}-{r.losses}-{r.draws}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="pl-h2h">
            <h2 id="pl-h2h" className="font-display text-xl font-semibold">{t("headToHead")}</h2>
            {opponents.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {opponents.map((o) => (
                  <li key={o.id}>
                    <Link href={`/players/${player.id}/vs/${o.id}`} className="flex justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-surface">
                      <span className="truncate">{o.name}</span>
                      <span className="tabular-nums text-muted">{o.wins}-{o.losses}-{o.draws}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <form action={getPathname({ href: "/players", locale })} method="get" className="mt-3 flex gap-2">
              <input type="hidden" name="vs" value={player.id} />
              <label className="flex-1">
                <span className="sr-only">{t("compareWith")}</span>
                <input name="q" placeholder={t("compareWith")} minLength={2} className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm" />
              </label>
              <button className="rounded-md bg-surface-2 px-3 py-1.5 text-sm">{tc("search")}</button>
            </form>
          </section>
        </aside>
      </div>

      <section className="mt-10" aria-labelledby="pl-matches">
        <h2 id="pl-matches" className="font-display text-xl font-semibold">{t("recentMatches")}</h2>
        <div className="mt-3"><PlayerMatches rows={matches} legends={legends} /></div>
      </section>
      <p className="mt-8 text-xs text-muted">{tp("privacy")}</p>
    </div>
  );
}
