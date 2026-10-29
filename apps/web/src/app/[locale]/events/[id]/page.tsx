import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CrownIcon } from "@/components/Honors";
import { LegendAvatar } from "@/components/LegendAvatar";
import { LiveRefresher } from "@/components/live/LiveRefresher";
import { MyMatch } from "@/components/live/MyMatch";
import { RoundTimer } from "@/components/live/RoundTimer";
import { Pagination } from "@/components/Pagination";
import { Link } from "@/i18n/navigation";
import { getEventDecks, getTopdeckLink, topdeckDeckUrl, topdeckEventUrl } from "@/lib/event-decks";
import { makeFormat } from "@/lib/format";
import { getEvent, getEventBestOf, getEventMeta, getLegendsBySlugs, getPairings, getRoundPlayers, getStandings, type LegendInfo } from "@/lib/queries";

const PAGE_SIZE = 50;

function LegendCell({ slug, legends }: { slug: string | null; legends: Map<string, LegendInfo> }) {
  const l = slug ? legends.get(slug) : undefined;
  if (!l) return <span className="text-muted">—</span>;
  return (
    <Link href={`/legends/${l.slug}`} className="flex items-center gap-2 hover:text-accent">
      <LegendAvatar cardId={l.cardId} champion={l.champion} domains={l.domains} size={24} />
      <span className="truncate">{l.champion}</span>
    </Link>
  );
}

export async function generateMetadata({ params }: PageProps<"/[locale]/events/[id]">): Promise<Metadata> {
  const { id } = await params;
  const ev = await getEvent(Number(id));
  return { title: ev?.name };
}

export default async function EventPage({ params, searchParams }: PageProps<"/[locale]/events/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const ev = Number.isInteger(Number(id)) ? await getEvent(Number(id)) : null;
  if (!ev) notFound();
  const sp = await searchParams;
  const t = await getTranslations("Event");
  const tl = await getTranslations("Live");
  const tc = await getTranslations("Common");
  const te = await getTranslations("Events");
  const ts = await getTranslations("Sets");
  const f = makeFormat(locale);

  const view = sp.view === "pairings" ? "pairings" : sp.view === "decks" ? "decks" : "standings";
  const q = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim().slice(0, 60) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const pairingRounds = ev.rounds;
  const standingRounds = ev.standingRounds;
  const lastStanding = [...standingRounds].reverse()[0];
  const roundId = Number(sp.round) || (view === "pairings" ? [...pairingRounds].reverse()[0]?.id : lastStanding?.id);
  const round = ev.rounds.find((r) => r.id === roundId);
  const isLive = ev.live.on && ev.status !== "complete";
  const currentRound = ev.rounds.at(-1);
  const roundLabel = (r: { phaseName: string; roundNumber: number }) => `${r.phaseName} · ${t("round")} ${r.roundNumber}`;

  const [metaRows, standings, pairings, roundPlayers, bestOf, topdeck, decks] = await Promise.all([
    getEventMeta(ev.id),
    view === "standings" && round ? getStandings(round.id, { q, page, pageSize: PAGE_SIZE }) : Promise.resolve({ rows: [], total: 0 }),
    view === "pairings" && round ? getPairings(round.id, { q, page, pageSize: PAGE_SIZE }) : Promise.resolve({ rows: [], total: 0 }),
    isLive && currentRound ? getRoundPlayers(ev.id, currentRound.id, lastStanding?.id ?? null) : Promise.resolve([]),
    // "Best of" só existe com a classificação final fechada.
    view === "standings" && ev.status === "complete" ? getEventBestOf(ev.id) : Promise.resolve(new Map<number, string>()),
    getTopdeckLink(ev.id),
    view === "decks" ? getEventDecks(ev.id, { q, page, pageSize: PAGE_SIZE }) : Promise.resolve({ rows: [], total: 0 }),
  ]);
  const slugs = new Set<string>(metaRows.map((m) => m.legend));
  standings.rows.forEach((r) => r.s.legend && slugs.add(r.s.legend));
  pairings.rows.forEach((r) => { if (r.l1) slugs.add(r.l1); if (r.l2) slugs.add(r.l2); });
  roundPlayers.forEach((r) => { if (r.legend) slugs.add(r.legend); });
  bestOf.forEach((legend) => slugs.add(legend));
  decks.rows.forEach((d) => d.legend && slugs.add(d.legend));
  const legends = await getLegendsBySlugs([...slugs]);
  const legendsLite = Object.fromEntries([...legends].map(([k, l]) => [k, { champion: l.champion, cardId: l.cardId, domains: l.domains }]));
  const standingsUnofficial = round?.status !== "COMPLETE" && view === "standings";
  const totalPlayers = metaRows.reduce((a, m) => a + m.players, 0);

  const name = (n: string | null, hidden: boolean | null) => (hidden ? tc("hiddenPlayer") : (n ?? "—"));
  const playerLink = (pid: number | null, n: string | null, hidden: boolean | null) =>
    pid && !hidden && n ? (
      <Link href={`/players/${pid}`} className="hover:text-accent">{n}</Link>
    ) : (
      name(n, hidden)
    );
  const bestOfLabel = (pid: number) => {
    const slug = bestOf.get(pid);
    if (!slug) return null;
    const label = t("bestOf", { champion: legends.get(slug)?.champion ?? slug });
    return (
      <span title={label} className="inline-flex">
        <CrownIcon size={15} />
        <span className="sr-only">{label}</span>
      </span>
    );
  };
  const tab = (active: boolean) => `rounded-md px-3 py-1.5 text-sm ${active ? "bg-surface-2 text-text" : "text-muted hover:text-text"}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-muted">
        <Link href="/events" className="hover:text-text">{te("title")}</Link> / {f.date(ev.startsAt)}
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold">{ev.name}</h1>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span>{te(ev.kind as "main")}</span>
        {ev.metagame && <span>{ts(ev.metagame as "all")}</span>}
        <span>{f.num(ev.playerCount)} {tc("players").toLowerCase()}</span>
        {ev.address && <span>{ev.address}</span>}
      </p>

      {isLive && (
        <section className="mt-6 grid gap-4" aria-label={tl("badge")}>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-live/40 bg-surface p-4">
            <div>
              <LiveRefresher eventId={ev.id} version={ev.live.version} changedAt={ev.live.changedAt?.toISOString() ?? null} />
              <p className="mt-1 font-display text-xl font-semibold">
                {currentRound ? roundLabel(currentRound) : tl("notStarted")}
                {currentRound && <span className="ml-2 text-sm font-normal text-muted">{currentRound.status === "COMPLETE" ? tl("roundDone") : tl("roundPlaying")}</span>}
              </p>
              <p className="mt-1 text-xs text-muted">{tl("howItWorks")}</p>
            </div>
            {currentRound?.status !== "COMPLETE" && (
              <RoundTimer endsAt={ev.timerEndsAt?.toISOString() ?? null} pausedAt={ev.timerPausedAt?.toISOString() ?? null} running={ev.timerRunning} />
            )}
          </div>
          {currentRound && roundPlayers.length > 0 && <MyMatch rows={roundPlayers} legends={legendsLite} round={roundLabel(currentRound)} />}
        </section>
      )}

      {metaRows.length > 0 && (
        <section className="mt-8" aria-labelledby="ev-meta">
          <h2 id="ev-meta" className="font-display text-xl font-semibold">{t("meta")}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {metaRows.slice(0, 12).map((m) => {
              const l = legends.get(m.legend);
              if (!l) return null;
              return (
                <li key={m.legend} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2.5 text-sm">
                  <LegendAvatar cardId={l.cardId} champion={l.champion} domains={l.domains} size={32} />
                  <span className="min-w-0 flex-1 truncate">{l.champion}</span>
                  <span className="tabular-nums font-semibold">{f.pct(m.players / totalPlayers)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={{ pathname: `/events/${ev.id}`, query: { view: "standings" } }} className={tab(view === "standings")} aria-current={view === "standings" ? "page" : undefined}>{t("standings")}</Link>
          <Link href={{ pathname: `/events/${ev.id}`, query: { view: "pairings" } }} className={tab(view === "pairings")} aria-current={view === "pairings" ? "page" : undefined}>{t("pairings")}</Link>
          {(topdeck || ev.status === "complete") && (
            <Link href={{ pathname: `/events/${ev.id}`, query: { view: "decks" } }} className={tab(view === "decks")} aria-current={view === "decks" ? "page" : undefined}>{t("decks")}</Link>
          )}
          {ev.status === "complete" && (
            <Link href={`/events/${ev.id}/submit`} className="ml-auto rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent">{t("submitDeck")}</Link>
          )}
        </div>

        {view === "decks" ? (
          <>
            <form className="mt-4 flex flex-wrap items-center gap-3" method="get">
              <input type="hidden" name="view" value="decks" />
              <label className="flex flex-1 items-center gap-2 text-sm">
                <span className="sr-only">{tc("searchPlayer")}</span>
                <input name="q" defaultValue={q} placeholder={tc("searchPlayer")} className="w-full max-w-xs rounded-md border border-border bg-surface px-3 py-1.5" />
              </label>
              <button className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink">{tc("search")}</button>
            </form>
            {decks.rows.length === 0 ? (
              <p className="mt-6 text-muted">
                {t("noDecks")}
                {ev.status === "complete" && (
                  <>
                    {" "}
                    <Link href={`/events/${ev.id}/submit`} className="text-accent underline">{t("submitYours")}</Link>
                  </>
                )}
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-surface text-left text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">{tc("rank")}</th>
                      <th className="px-3 py-2 font-medium">{tc("player")}</th>
                      <th className="px-3 py-2 font-medium">{tc("legend")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("decklist")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decks.rows.map((d) => (
                      <tr key={d.key} className="border-t border-border">
                        <td className="px-3 py-2 tabular-nums text-muted">{d.rank ?? "—"}</td>
                        <td className="px-3 py-2 font-medium">
                          <span className="flex items-center gap-2">
                            {playerLink(d.playerId, d.name, d.hidden)}
                            {d.source === "community" && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs font-normal text-muted" title={t("communityHint")}>{t("community")}</span>}
                          </span>
                        </td>
                        <td className="px-3 py-2"><LegendCell slug={d.legend} legends={legends} /></td>
                        <td className="px-3 py-2 text-right">
                          {d.code ? (
                            <Link href={`/events/${ev.id}/decks/${encodeURIComponent(d.key)}`} className="text-accent hover:underline">{t("viewDeck")}</Link>
                          ) : d.tid ? (
                            <a href={topdeckDeckUrl(d.tid, d.key)} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-text">TopDeck.gg ↗</a>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination pathname={`/events/${ev.id}`} query={{ view, q }} page={page} total={decks.total} pageSize={PAGE_SIZE} />
          </>
        ) : ev.rounds.length === 0 ? (
          <p className="mt-6 text-muted">{t("noRounds")}</p>
        ) : (
          <>
            <form className="mt-4 flex flex-wrap items-center gap-3" method="get">
              <input type="hidden" name="view" value={view} />
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted">{t("round")}</span>
                <select name="round" defaultValue={round?.id} className="rounded-md border border-border bg-surface px-2 py-1.5">
                  {(view === "pairings" ? pairingRounds : standingRounds).map((r) => (
                    <option key={r.id} value={r.id}>{r.phaseName} · {r.roundNumber}{r.status !== "COMPLETE" ? ` (${tl("roundPlaying")})` : ""}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-1 items-center gap-2 text-sm">
                <span className="sr-only">{tc("searchPlayer")}</span>
                <input name="q" defaultValue={q} placeholder={tc("searchPlayer")} className="w-full max-w-xs rounded-md border border-border bg-surface px-3 py-1.5" />
              </label>
              <button className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink">{tc("search")}</button>
            </form>

            {standingsUnofficial && round && <p className="mt-3 text-sm text-muted">{tl("unofficial")}</p>}
            {view === "standings" ? (
              <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="bg-surface text-left text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">{tc("rank")}</th>
                      <th className="px-3 py-2 font-medium">{tc("player")}</th>
                      <th className="px-3 py-2 font-medium">{tc("legend")}</th>
                      <th className="px-3 py-2 text-right font-medium">{tc("record")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("points")}</th>
                      <th className="px-3 py-2 text-right font-medium" title={t("omwHint")}>{t("omw")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.rows.map((r) => (
                      <tr key={r.s.playerId} className="border-t border-border">
                        <td className="px-3 py-2 tabular-nums text-muted">{r.s.rank}</td>
                        <td className="px-3 py-2 font-medium">
                          <span className="flex items-center gap-1.5">
                            {playerLink(r.s.playerId, r.name, r.hidden)}
                            {bestOfLabel(r.s.playerId)}
                          </span>
                        </td>
                        <td className="px-3 py-2"><LegendCell slug={r.s.legend} legends={legends} /></td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.s.wins}-{r.s.losses}-{r.s.draws}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.s.points}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{f.pct(r.s.omw)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-surface text-left text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t("table")}</th>
                      <th className="px-3 py-2 font-medium">{tc("player")} 1</th>
                      <th className="px-3 py-2 text-center font-medium" />
                      <th className="px-3 py-2 font-medium">{tc("player")} 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pairings.rows.map((m) => {
                      const score = m.isBye ? t("bye") : m.status !== "COMPLETE" ? t("inProgress") : m.isDraw ? t("draw") : `${m.gamesWinner}–${m.gamesLoser}`;
                      const won = (pid: number | null) => !m.isBye && !m.isDraw && m.winnerId !== null && m.winnerId === pid;
                      return (
                        <tr key={m.id} className="border-t border-border">
                          <td className="px-3 py-2 tabular-nums text-muted">{m.table ?? "—"}</td>
                          <td className={`px-3 py-2 ${won(m.p1Id) ? "font-semibold" : ""}`}>
                            <span className="block">{playerLink(m.p1Id, m.p1Name, m.p1Hidden)}</span>
                            <span className="mt-0.5 block text-xs"><LegendCell slug={m.l1} legends={legends} /></span>
                          </td>
                          <td className="px-3 py-2 text-center tabular-nums text-muted">{score}</td>
                          <td className={`px-3 py-2 ${won(m.p2Id) ? "font-semibold" : ""}`}>
                            {m.p2Id ? (
                              <>
                                <span className="block">{playerLink(m.p2Id, m.p2Name, m.p2Hidden)}</span>
                                <span className="mt-0.5 block text-xs"><LegendCell slug={m.l2} legends={legends} /></span>
                              </>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination
              pathname={`/events/${ev.id}`}
              query={{ view, round: round ? String(round.id) : undefined, q }}
              page={page}
              total={view === "standings" ? standings.total : pairings.total}
              pageSize={PAGE_SIZE}
            />
          </>
        )}
        <p className="mt-6 text-xs text-muted">
          {topdeck?.own ? t("sourceTopdeck") : t("source")}
          {topdeck && (
            <>
              {" "}
              {t.rich(topdeck.own ? "creditTopdeckOwn" : "creditTopdeck", {
                link: (c) => (
                  <a href={topdeckEventUrl(topdeck.tid)} target="_blank" rel="noopener noreferrer" className="text-accent underline">{c}</a>
                ),
              })}
            </>
          )}
        </p>
      </section>
    </div>
  );
}
