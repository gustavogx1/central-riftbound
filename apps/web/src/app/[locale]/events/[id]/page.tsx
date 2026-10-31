import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Bracket } from "@/components/Bracket";
import { FollowingTab, MetaTab, PlayersTab } from "@/components/event/EventTabs";
import { FollowButton } from "@/components/event/FollowButton";
import { LegendCell } from "@/components/event/LegendCell";
import { MatchupMatrix, type MatrixLegend } from "@/components/MatchupMatrix";
import { EventClock } from "@/components/EventClock";
import { CrownIcon } from "@/components/Honors";
import { LiveRefresher } from "@/components/live/LiveRefresher";
import { MyMatch } from "@/components/live/MyMatch";
import { RoundTimer } from "@/components/live/RoundTimer";
import { Pagination } from "@/components/Pagination";
import { StandingRow } from "@/components/StandingRow";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getEventDecks, getTopdeckLink, topdeckDeckUrl, topdeckEventUrl } from "@/lib/event-decks";
import { eventStatusKey, eventTag, venueDateTime } from "@/lib/event-tag";
import { FOLLOW_COOKIE, parseFollow } from "@/lib/follow";
import { makeFormat } from "@/lib/format";
import { getBracket, getEvent, getEventBestOf, getEventMatchups, getEventMeta, getEventPlayers, getLegendStandings, getLegendsBySlugs, getPairings, getRoundPlayers, getStandings, isEliminationPhase } from "@/lib/queries";

const PAGE_SIZE = 50;
const EVENT_MATRIX_MIN = [0, 3, 5, 10, 20] as const;

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

  const isLive = ev.live.on && ev.status !== "complete";
  const currentRound = ev.rounds.at(-1);
  const bracketRounds = ev.rounds.filter((r) => isEliminationPhase(r.phaseType));
  // Ao vivo, com o top cut em andamento, a chave é o que todo mundo quer ver primeiro.
  const defaultView = isLive && currentRound && isEliminationPhase(currentRound.phaseType) ? "bracket" : "standings";
  const views = ["standings", "pairings", "following", "players", "meta", "decks", "bracket"] as const;
  const view = views.find((v) => v === sp.view && (v !== "bracket" || bracketRounds.length > 0)) ?? defaultView;
  const q = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim().slice(0, 60) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const pairingRounds = ev.rounds;
  const standingRounds = ev.standingRounds;
  const lastStanding = [...standingRounds].reverse()[0];
  const roundId = Number(sp.round) || (view === "pairings" ? [...pairingRounds].reverse()[0]?.id : lastStanding?.id);
  const round = ev.rounds.find((r) => r.id === roundId);
  const seedRound = [...standingRounds].reverse().find((r) => !isEliminationPhase(r.phaseType));
  const roundLabel = (r: { phaseName: string; roundNumber: number }) => `${r.phaseName} · ${t("round")} ${r.roundNumber}`;
  const followIds = parseFollow((await cookies()).get(FOLLOW_COOKIE)?.value);
  const followed = new Set(followIds);
  const playerOpts = { live: isLive, standingRoundId: lastStanding?.id ?? null };

  const [metaRows, standings, pairings, roundPlayers, bestOf, topdeck, decks, bracket] = await Promise.all([
    getEventMeta(ev.id),
    view === "standings" && round ? getStandings(round.id, { q, page, pageSize: PAGE_SIZE }) : Promise.resolve({ rows: [], total: 0 }),
    view === "pairings" && round ? getPairings(round.id, { q, page, pageSize: PAGE_SIZE }) : Promise.resolve({ rows: [], total: 0 }),
    isLive && currentRound ? getRoundPlayers(ev.id, currentRound.id, lastStanding?.id ?? null) : Promise.resolve([]),
    // "Best of" só existe com a classificação final fechada.
    view === "standings" && ev.status === "complete" ? getEventBestOf(ev.id) : Promise.resolve(new Map<number, string>()),
    getTopdeckLink(ev.id),
    view === "decks" ? getEventDecks(ev.id, { q, page, pageSize: PAGE_SIZE }) : Promise.resolve({ rows: [], total: 0 }),
    view === "bracket" ? getBracket(ev.id, bracketRounds.map((r) => r.id), seedRound?.id ?? null) : Promise.resolve({ matches: [], seeds: new Map<number, number>() }),
  ]);
  const metaSub = view === "meta" && sp.sub === "matchups" ? "matchups" : "legends";
  const metaLegend = view === "meta" && metaSub === "legends" ? (metaRows.find((m) => m.legend === sp.legend)?.legend ?? metaRows[0]?.legend ?? null) : null;
  const [players, followingRows, legendStandings] = await Promise.all([
    view === "players" ? getEventPlayers(ev.id, { ...playerOpts, q, page, pageSize: PAGE_SIZE, order: "name" }) : Promise.resolve([]),
    view === "following" ? getEventPlayers(ev.id, { ...playerOpts, ids: followIds, page: 1, pageSize: 200, order: "rank" }) : Promise.resolve([]),
    metaLegend && seedRound ? getLegendStandings(seedRound.id, metaLegend) : Promise.resolve([]),
  ]);
  const matchups = metaSub === "matchups" ? await getEventMatchups(ev.id) : null;
  const slugs = new Set<string>(metaRows.map((m) => m.legend));
  standings.rows.forEach((r) => r.s.legend && slugs.add(r.s.legend));
  pairings.rows.forEach((r) => { if (r.l1) slugs.add(r.l1); if (r.l2) slugs.add(r.l2); });
  roundPlayers.forEach((r) => { if (r.legend) slugs.add(r.legend); });
  bestOf.forEach((legend) => slugs.add(legend));
  decks.rows.forEach((d) => d.legend && slugs.add(d.legend));
  bracket.matches.forEach((m) => { if (m.l1) slugs.add(m.l1); if (m.l2) slugs.add(m.l2); });
  [...players, ...followingRows].forEach((r) => { if (r.legend) slugs.add(r.legend); if (r.opponentLegend) slugs.add(r.opponentLegend); });
  matchups?.totals.forEach((_, slug) => slugs.add(slug));
  const legends = await getLegendsBySlugs([...slugs]);
  const legendsLite = Object.fromEntries([...legends].map(([k, l]) => [k, { champion: l.champion, cardId: l.cardId, domains: l.domains }]));
  const standingsUnofficial = round?.status !== "COMPLETE" && view === "standings";

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
  const venueWhen = ev.timezone ? venueDateTime(locale, ev.startsAt, ev.timezone) : null;
  const statusKey = eventStatusKey(ev.status);
  const facts: [string, string][] = [
    [t("status"), statusKey ? te(statusKey) : ev.status],
    [t("players"), ev.playerCount > 0 ? f.num(ev.playerCount) : "—"],
  ];
  if (ev.format) facts.push([t("format"), ev.format]);
  if (ev.roundMinutes) facts.push([t("roundLength"), t("minutes", { n: ev.roundMinutes })]);
  if (ev.gameWins) facts.push([t("matchFormat"), t("bestOfN", { n: ev.gameWins * 2 - 1 })]);
  const tabs: [(typeof views)[number], string][] = [
    ["pairings", t("pairings")],
    ["standings", t("standings")],
    ["following", t("following")],
    ["players", t("players")],
    ["meta", t("metaTab")],
  ];
  if (bracketRounds.length > 0) tabs.push(["bracket", t("bracket")]);
  if (topdeck || ev.status === "complete") tabs.push(["decks", t("decks")]);
  const fieldSize = metaRows.reduce((a, m) => a + m.players, 0);
  const matrixLegends: MatrixLegend[] = matchups
    ? [...matchups.totals].flatMap(([slug, tot]) => {
        const l = legends.get(slug);
        if (!l) return [];
        const players = metaRows.find((m) => m.legend === slug)?.players ?? 0;
        const games = tot.wins + tot.losses;
        return [{ slug, champion: l.champion, title: l.title, cardId: l.cardId, domains: l.domains, share: fieldSize ? players / fieldSize : 0, winRate: games ? tot.wins / games : null, href: getPathname({ locale: locale as Locale, href: `/legends/${slug}` }) }];
      })
    : [];
  const tab = (active: boolean) => `rounded-md px-3 py-1.5 text-sm ${active ? "bg-surface-2 text-text" : "text-muted hover:text-text"}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-sm text-muted">
        <Link href="/events" className="hover:text-text">{te("title")}</Link> / {f.date(ev.startsAt)}
      </p>
      <header className="mt-3 rounded-xl border border-border bg-surface" aria-label={t("info")}>
        <div className="flex flex-col gap-x-6 gap-y-3 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold md:text-3xl">{ev.name}</h1>
            {ev.address && <p className="mt-1 text-sm text-muted">{ev.address}</p>}
            {ev.organizer && <p className="mt-0.5 text-sm text-muted">{t("organizedBy", { name: ev.organizer })}</p>}
            <p className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
              <span className="rounded bg-surface-2 px-1.5 py-px">{te(eventTag(ev.kind, ev.name))}</span>
              {ev.metagame && <span className="rounded bg-surface-2 px-1.5 py-px">{ts(ev.metagame as "all")}</span>}
            </p>
          </div>
          <div className="shrink-0 text-sm sm:text-right">
            <p className="font-semibold tabular-nums">{venueWhen ?? f.date(ev.startsAt)}</p>
            {venueWhen && ev.timezone && (
              <p className="mt-0.5 text-xs tabular-nums text-muted">
                <EventClock startsAt={ev.startsAt.toISOString()} timezone={ev.timezone} showNow={ev.status !== "complete"} />
              </p>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border p-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="mt-0.5 truncate font-medium" title={value}>{value}</dd>
            </div>
          ))}
        </dl>
        {ev.id > 0 && (
          <a
            href={`https://locator.riftbound.uvsgames.com/events/${ev.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between border-t border-border px-4 py-2.5 text-sm text-muted hover:text-text"
          >
            <span>{t("viewOnUvs")}</span>
            <span aria-hidden>↗</span>
          </a>
        )}
      </header>

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

      <section className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map(([v, label]) => (
            <Link key={v} href={{ pathname: `/events/${ev.id}`, query: { view: v } }} className={tab(view === v)} aria-current={view === v ? "page" : undefined}>
              {label}
              {v === "following" && followIds.length > 0 && <span className="ml-1.5 text-xs text-muted">{followIds.length}</span>}
            </Link>
          ))}
          {ev.status === "complete" && (
            <Link href={`/events/${ev.id}/submit`} className="ml-auto rounded-md border border-border px-3 py-1.5 text-sm hover:border-accent">{t("submitDeck")}</Link>
          )}
        </div>

        {view === "players" ? (
          <PlayersTab eventId={ev.id} rows={players} legends={legends} followed={followed} q={q} page={page} pageSize={PAGE_SIZE} />
        ) : view === "following" ? (
          <FollowingTab eventId={ev.id} rows={followingRows} legends={legends} followCount={followIds.length} roundLabels={Object.fromEntries(ev.rounds.map((r) => [r.id, roundLabel(r)]))} />
        ) : view === "meta" ? (
          <>
            <div className="mt-4 inline-flex rounded-lg border border-border p-0.5 text-sm" role="group" aria-label={t("metaTab")}>
              {(["legends", "matchups"] as const).map((sub) => (
                <Link
                  key={sub}
                  href={{ pathname: `/events/${ev.id}`, query: sub === "legends" ? { view: "meta" } : { view: "meta", sub } }}
                  scroll={false}
                  aria-current={metaSub === sub ? "page" : undefined}
                  className={`rounded-md px-3 py-1 ${metaSub === sub ? "bg-surface-2 text-text" : "text-muted hover:text-text"}`}
                >
                  {sub === "legends" ? t("metaByLegend") : t("metaMatchups")}
                </Link>
              ))}
            </div>
            {metaSub === "legends" ? (
              <MetaTab eventId={ev.id} metaRows={metaRows} legends={legends} selected={metaLegend} standings={legendStandings} f={f} unofficial={seedRound?.status !== "COMPLETE"} />
            ) : matrixLegends.length < 2 ? (
              <p className="mt-6 text-muted">{t("noMatchups")}</p>
            ) : (
              <>
                <p className="mt-3 text-sm text-muted">{t("matchupsLead")}</p>
                <MatchupMatrix legends={matrixLegends} cells={matchups?.cells ?? {}} locale={locale} defaultMin={3} minOptions={EVENT_MATRIX_MIN} />
              </>
            )}
          </>
        ) : view === "bracket" ? (
          <Bracket rounds={bracketRounds} matches={bracket.matches} seeds={bracket.seeds} legends={legends} />
        ) : view === "decks" ? (
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
            {view === "standings" && standings.rows.length > 0 && <p className="mt-3 text-sm text-muted">{t("expandHint")}</p>}
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
                      <StandingRow
                        key={r.s.playerId}
                        eventId={ev.id}
                        playerId={r.s.playerId}
                        playerName={name(r.name, r.hidden)}
                        roundId={round?.id}
                        roundNumber={round?.roundNumber}
                        multiPhase={new Set(ev.rounds.map((x) => x.phaseName)).size > 1}
                        cols={6}
                        expandable={!r.hidden}
                      >
                        <td className="px-3 py-2 tabular-nums text-muted">{r.s.rank}</td>
                        <td className="px-3 py-2 font-medium">
                          <span className="flex items-center gap-1.5">
                            {!r.hidden && <FollowButton playerId={r.s.playerId} name={r.name} followed={followed.has(r.s.playerId)} />}
                            {playerLink(r.s.playerId, r.name, r.hidden)}
                            {bestOfLabel(r.s.playerId)}
                          </span>
                        </td>
                        <td className="px-3 py-2"><LegendCell slug={r.s.legend} legends={legends} /></td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.s.wins}-{r.s.losses}-{r.s.draws}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.s.points}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{f.pct(r.s.omw)}</td>
                      </StandingRow>
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
