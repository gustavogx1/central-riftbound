import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { schema } from "@cr/db";
import { getDb } from "./db";

/** Nome que o site mostra: o nick da inscrição mais recente, ou o nome da UVS. */
const shownName = sql<string>`coalesce(${schema.player.nick}, ${schema.player.name})`;

export const METAGAMES = ["RAD", "VEN", "UNL", "SFD", "OGN"] as const;
export type Kind = "main" | "all";

export interface LegendInfo {
  slug: string;
  champion: string;
  title: string;
  domains: string[];
  cardId: string;
}

export async function getLegends(): Promise<LegendInfo[]> {
  const db = getDb();
  if (!db) return [];
  return db
    .select({ slug: schema.legend.slug, champion: schema.legend.champion, title: schema.legend.title, domains: schema.legend.domains, cardId: schema.legend.cardId })
    .from(schema.legend)
    .orderBy(asc(schema.legend.champion), asc(schema.legend.title));
}

/** Metagames que têm estatística calculada, do mais novo ao mais antigo. */
export async function getAvailableMetagames(): Promise<string[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.selectDistinct({ scope: schema.legendStats.scope }).from(schema.legendStats);
  const metas = new Set(rows.map((r) => r.scope.split(":")[0]!));
  return METAGAMES.filter((m) => metas.has(m));
}

export type LegendStatRow = typeof schema.legendStats.$inferSelect & LegendInfo & { prevPower: number | null };

export async function getLegendStats(scope: string): Promise<LegendStatRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({
      stats: schema.legendStats,
      champion: schema.legend.champion,
      title: schema.legend.title,
      domains: schema.legend.domains,
      cardId: schema.legend.cardId,
    })
    .from(schema.legendStats)
    .innerJoin(schema.legend, eq(schema.legend.slug, schema.legendStats.legend))
    .where(eq(schema.legendStats.scope, scope))
    .orderBy(desc(schema.legendStats.power), desc(schema.legendStats.shrunkWinRate));

  // Poder no snapshot anterior (para a tendência "subiu / caiu").
  const prev = await db.execute(sql`
    select distinct on (legend) legend, power from power_snapshot
    where scope = ${scope} and taken_at < (select max(taken_at) from power_snapshot where scope = ${scope})
    order by legend, taken_at desc
  `);
  const prevBy = new Map((prev as unknown as { legend: string; power: number }[]).map((p) => [p.legend, p.power]));
  return rows.map((r) => ({ ...r.stats, slug: r.stats.legend, champion: r.champion, title: r.title, domains: r.domains, cardId: r.cardId, prevPower: prevBy.get(r.stats.legend) ?? null }));
}

export async function getScopeTotals(scope: string) {
  const db = getDb();
  if (!db) return { events: 0, matches: 0, lastEvent: null as Date | null };
  const [meta, kind] = scope.split(":") as [string, Kind];
  const where: SQL[] = [];
  if (meta !== "all") where.push(eq(schema.event.metagame, meta));
  if (kind === "main") where.push(eq(schema.event.kind, "main"));
  const [row] = await db
    .select({
      events: sql<number>`count(distinct ${schema.event.id})::int`,
      matches: sql<number>`count(${schema.match.id})::int`,
      lastEvent: sql<Date | null>`max(${schema.event.startsAt})`,
    })
    .from(schema.event)
    .leftJoin(schema.match, and(eq(schema.match.eventId, schema.event.id), eq(schema.match.isBye, false)))
    .where(where.length ? and(...where) : undefined);
  return { events: row?.events ?? 0, matches: row?.matches ?? 0, lastEvent: row?.lastEvent ? new Date(row.lastEvent) : null };
}

export async function getMatchups(scope: string, legend?: string) {
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(schema.matchupStats)
    .where(legend ? and(eq(schema.matchupStats.scope, scope), eq(schema.matchupStats.legend, legend)) : eq(schema.matchupStats.scope, scope));
}

export async function getLegend(slug: string): Promise<LegendInfo | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select({ slug: schema.legend.slug, champion: schema.legend.champion, title: schema.legend.title, domains: schema.legend.domains, cardId: schema.legend.cardId })
    .from(schema.legend)
    .where(eq(schema.legend.slug, slug));
  return row ?? null;
}

export async function getLegendCard(cardId: string) {
  const db = getDb();
  if (!db) return null;
  const [row] = await db.select().from(schema.card).where(eq(schema.card.id, cardId));
  return row ?? null;
}

export async function getTopPilots(scope: string, legend: string, limit = 20) {
  const db = getDb();
  if (!db) return [];
  return db
    .select({ stats: schema.pilotStats, name: shownName, hidden: schema.player.hidden, country: schema.player.countryCode })
    .from(schema.pilotStats)
    .innerJoin(schema.player, eq(schema.player.id, schema.pilotStats.playerId))
    .where(and(eq(schema.pilotStats.scope, scope), eq(schema.pilotStats.legend, legend)))
    .orderBy(desc(schema.pilotStats.score))
    .limit(limit);
}

export async function getEvents() {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    select e.id, e.name, e.kind, e.starts_at as "startsAt", e.player_count as "playerCount", e.metagame, e.status, e.address,
      w.legend as "winnerLegend", coalesce(p.nick, p.name) as "winnerName", p.hidden as "winnerHidden", coalesce(t.live, false) as live
    from event e
    left join tracked_event t on t.uvs_event_id = e.id
    left join lateral (
      select s.legend, s.player_id from standing s join event_round r on r.id = s.round_id
      where s.event_id = e.id order by r.phase_order desc, r.round_number desc, s.rank asc limit 1
    ) w on true
    left join player p on p.id = w.player_id
    order by e.starts_at desc
  `);
  return rows as unknown as {
    id: number; name: string; kind: string; startsAt: string; playerCount: number; metagame: string | null; status: string; address: string | null;
    winnerLegend: string | null; winnerName: string | null; winnerHidden: boolean | null; live: boolean;
  }[];
}

export async function getEvent(id: number) {
  const db = getDb();
  if (!db) return null;
  const [ev] = await db.select().from(schema.event).where(eq(schema.event.id, id));
  if (!ev) return null;
  const rounds = await db.select().from(schema.eventRound).where(eq(schema.eventRound.eventId, id)).orderBy(asc(schema.eventRound.phaseOrder), asc(schema.eventRound.roundNumber));
  const withStandings = await db.selectDistinct({ roundId: schema.standing.roundId }).from(schema.standing).where(eq(schema.standing.eventId, id));
  const standingIds = new Set(withStandings.map((r) => r.roundId));
  const [live] = await db
    .select({ live: schema.trackedEvent.live, version: schema.liveState.version, changedAt: schema.liveState.changedAt, checkedAt: schema.liveState.checkedAt })
    .from(schema.trackedEvent)
    .leftJoin(schema.liveState, eq(schema.liveState.eventId, schema.trackedEvent.uvsEventId))
    .where(eq(schema.trackedEvent.uvsEventId, id));
  return {
    ...ev,
    rounds,
    standingRounds: rounds.filter((r) => standingIds.has(r.id)),
    live: { on: live?.live ?? false, version: live?.version ?? 0, changedAt: live?.changedAt ?? null, checkedAt: live?.checkedAt ?? null },
  };
}

/** Versão do pulso ao vivo de um evento (a página recarrega quando muda). */
export async function getLivePulse(id: number) {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select({ live: schema.trackedEvent.live, version: schema.liveState.version, changedAt: schema.liveState.changedAt })
    .from(schema.trackedEvent)
    .leftJoin(schema.liveState, eq(schema.liveState.eventId, schema.trackedEvent.uvsEventId))
    .where(eq(schema.trackedEvent.uvsEventId, id));
  return row ? { live: row.live, version: row.version ?? 0, changedAt: row.changedAt?.toISOString() ?? null } : null;
}

export interface MyMatchRow {
  playerId: number;
  name: string;
  realName: string;
  table: number | null;
  status: string;
  isBye: boolean;
  result: "win" | "loss" | "draw" | null;
  games: string | null;
  legend: string | null;
  opponentId: number | null;
  opponent: string | null;
  opponentLegend: string | null;
  rank: number | null;
  record: string | null;
}

/**
 * Uma linha por jogador na rodada atual (mesa, adversário, resultado) com a
 * posição mais recente, para o "achar minha mesa" do ao vivo.
 */
export async function getRoundPlayers(eventId: number, roundId: number, standingRoundId: number | null): Promise<MyMatchRow[]> {
  const db = getDb();
  if (!db) return [];
  const rows = (await db.execute(sql`
    with sides as (
      select m.*, m.player1_id as me, m.player2_id as opp, m.legend1 as my_legend, m.legend2 as opp_legend from match m where m.round_id = ${roundId}
      union all
      select m.*, m.player2_id, m.player1_id, m.legend2, m.legend1 from match m where m.round_id = ${roundId} and m.player2_id is not null
    )
    select s.me as "playerId", coalesce(p.nick, p.name) as name, p.name as "realName", s.table_number as "table", s.status, s.is_bye as "isBye", s.is_draw as "isDraw",
      s.winner_id as "winnerId", s.games_winner as "gamesWinner", s.games_loser as "gamesLoser",
      s.my_legend as legend, s.opp as "opponentId", case when o.hidden then null else coalesce(o.nick, o.name) end as opponent, s.opp_legend as "opponentLegend",
      st.rank, case when st.player_id is null then null else st.wins || '-' || st.losses || '-' || st.draws end as record
    from sides s
    join player p on p.id = s.me and not p.hidden
    left join player o on o.id = s.opp
    left join standing st on st.round_id = ${standingRoundId ?? -1} and st.player_id = s.me and st.event_id = ${eventId}
    order by lower(coalesce(p.nick, p.name))
  `)) as unknown as {
    playerId: number; name: string; realName: string; table: number | null; status: string; isBye: boolean; isDraw: boolean; winnerId: number | null;
    gamesWinner: number; gamesLoser: number; legend: string | null; opponentId: number | null; opponent: string | null; opponentLegend: string | null;
    rank: number | null; record: string | null;
  }[];
  return rows.map((r) => {
    const reported = r.status === "COMPLETE" || r.winnerId !== null || r.isDraw;
    const result = r.isBye ? "win" : !reported ? null : r.isDraw ? "draw" : r.winnerId === r.playerId ? "win" : "loss";
    const games = !reported || r.isBye ? null : result === "loss" ? `${r.gamesLoser}–${r.gamesWinner}` : `${r.gamesWinner}–${r.gamesLoser}`;
    return {
      playerId: r.playerId, name: r.name, realName: r.realName, table: r.table, status: r.status, isBye: r.isBye, result, games, legend: r.legend,
      opponentId: r.opponentId, opponent: r.opponent, opponentLegend: r.opponentLegend, rank: r.rank, record: r.record,
    };
  });
}

// ---------------------------------------------------------------------------
// Jogadores
// ---------------------------------------------------------------------------

export async function searchPlayers(q: string, limit = 50) {
  const db = getDb();
  if (!db || q.length < 2) return [];
  const rows = await db.execute(sql`
    select p.id, coalesce(p.nick, p.name) as name, p.name as "realName", p.country_code as country, count(distinct m.event_id)::int as events
    from player p join match m on m.player1_id = p.id or m.player2_id = p.id
    where not p.hidden and (p.name ilike ${`%${q}%`} or p.nick ilike ${`%${q}%`})
    group by p.id order by events desc, name limit ${limit}
  `);
  return rows as unknown as { id: number; name: string; realName: string; country: string | null; events: number }[];
}

export async function getPlayer(id: number) {
  const db = getDb();
  if (!db) return null;
  const [p] = await db.select().from(schema.player).where(eq(schema.player.id, id));
  // `name` vira o nome mostrado (nick); o nome da UVS fica em `realName`.
  return p && !p.hidden ? { ...p, name: p.nick ?? p.name, realName: p.name } : null;
}

/** Resultado do jogador em cada evento: lenda, posição final da primeira fase e campanha total. */
export async function getPlayerEvents(id: number) {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    with mine as (
      select m.event_id, m.is_bye, m.is_draw, m.winner_id, m.status,
        case when m.player1_id = ${id} then m.legend1 else m.legend2 end as legend
      from match m where m.player1_id = ${id} or m.player2_id = ${id}
    ), rec as (
      select event_id,
        count(*) filter (where status = 'COMPLETE' and not is_draw and winner_id = ${id})::int as wins,
        count(*) filter (where status = 'COMPLETE' and not is_draw and not is_bye and winner_id is distinct from ${id})::int as losses,
        count(*) filter (where status = 'COMPLETE' and is_draw)::int as draws,
        mode() within group (order by legend) as legend
      from mine group by event_id
    ), final as (
      select distinct on (s.event_id) s.event_id, s.rank, r.phase_order
      from standing s join event_round r on r.id = s.round_id
      where s.player_id = ${id}
      order by s.event_id, r.phase_order desc, r.round_number desc
    )
    select e.id, e.name, e.starts_at as "startsAt", e.kind, e.metagame, e.player_count as "playerCount", e.status,
      rec.wins, rec.losses, rec.draws, rec.legend, final.rank
    from rec join event e on e.id = rec.event_id left join final on final.event_id = rec.event_id
    order by e.starts_at desc
  `);
  return rows as unknown as {
    id: number; name: string; startsAt: string; kind: string; metagame: string | null; playerCount: number; status: string;
    wins: number; losses: number; draws: number; legend: string | null; rank: number | null;
  }[];
}

/** Campanha por lenda (sem byes; empates à parte). */
export async function getPlayerLegends(id: number) {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    with mine as (
      select m.event_id, m.is_draw, m.winner_id, case when m.player1_id = ${id} then m.legend1 else m.legend2 end as legend
      from match m where (m.player1_id = ${id} or m.player2_id = ${id}) and m.status = 'COMPLETE' and not m.is_bye
    )
    select legend, count(distinct event_id)::int as events,
      count(*) filter (where not is_draw and winner_id = ${id})::int as wins,
      count(*) filter (where not is_draw and winner_id is distinct from ${id})::int as losses,
      count(*) filter (where is_draw)::int as draws
    from mine where legend is not null group by legend order by count(*) desc
  `);
  return rows as unknown as { legend: string; events: number; wins: number; losses: number; draws: number }[];
}

export interface PlayerMatch {
  id: number;
  eventId: number;
  eventName: string;
  startsAt: string;
  phaseName: string;
  roundNumber: number;
  legend: string | null;
  opponentId: number | null;
  opponent: string | null;
  opponentHidden: boolean | null;
  opponentLegend: string | null;
  isBye: boolean;
  result: "win" | "loss" | "draw" | null;
  games: string | null;
}

/** Partidas do jogador, mais recentes primeiro; com `vs`, só contra esse adversário. */
export async function getPlayerMatches(id: number, opts: { vs?: number; limit?: number } = {}): Promise<PlayerMatch[]> {
  const db = getDb();
  if (!db) return [];
  const vs = opts.vs ? sql`and (case when m.player1_id = ${id} then m.player2_id else m.player1_id end) = ${opts.vs}` : sql``;
  const rows = (await db.execute(sql`
    select m.id, m.event_id as "eventId", e.name as "eventName", e.starts_at as "startsAt", r.phase_name as "phaseName", r.round_number as "roundNumber",
      case when m.player1_id = ${id} then m.legend1 else m.legend2 end as legend,
      case when m.player1_id = ${id} then m.player2_id else m.player1_id end as "opponentId",
      coalesce(o.nick, o.name) as opponent, o.hidden as "opponentHidden",
      case when m.player1_id = ${id} then m.legend2 else m.legend1 end as "opponentLegend",
      m.is_bye as "isBye", m.is_draw as "isDraw", m.winner_id as "winnerId", m.status, m.games_winner as "gamesWinner", m.games_loser as "gamesLoser"
    from match m
    join event e on e.id = m.event_id
    join event_round r on r.id = m.round_id
    left join player o on o.id = case when m.player1_id = ${id} then m.player2_id else m.player1_id end
    where (m.player1_id = ${id} or m.player2_id = ${id}) ${vs}
    order by e.starts_at desc, r.phase_order desc, r.round_number desc
    limit ${opts.limit ?? 200}
  `)) as unknown as (Omit<PlayerMatch, "result" | "games"> & { isDraw: boolean; winnerId: number | null; status: string; gamesWinner: number; gamesLoser: number })[];
  return rows.map(({ isDraw, winnerId, status, gamesWinner, gamesLoser, ...r }) => {
    const reported = status === "COMPLETE";
    const result = r.isBye ? "win" : !reported ? null : isDraw ? "draw" : winnerId === id ? "win" : "loss";
    const games = !reported || r.isBye ? null : result === "loss" ? `${gamesLoser}–${gamesWinner}` : `${gamesWinner}–${gamesLoser}`;
    return { ...r, result, games };
  });
}

/** Lendas no evento, pela classificação da primeira fase (todos os jogadores). */
export async function getEventMeta(eventId: number) {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    with fr as (
      select r.id from event_round r where r.event_id = ${eventId}
        and exists (select 1 from standing s where s.round_id = r.id)
      order by r.phase_order asc, r.round_number desc limit 1
    )
    select s.legend, count(*)::int as players, min(s.rank)::int as "bestRank"
    from standing s join fr on fr.id = s.round_id
    where s.legend is not null group by s.legend order by players desc
  `);
  return rows as unknown as { legend: string; players: number; bestRank: number }[];
}

export async function getStandings(roundId: number, opts: { q?: string; page: number; pageSize: number }) {
  const db = getDb();
  if (!db) return { rows: [], total: 0 };
  const where = and(eq(schema.standing.roundId, roundId), opts.q ? or(ilike(schema.player.name, `%${opts.q}%`), ilike(schema.player.nick, `%${opts.q}%`)) : undefined);
  const [count] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.standing).innerJoin(schema.player, eq(schema.player.id, schema.standing.playerId)).where(where);
  const rows = await db
    .select({ s: schema.standing, name: shownName, hidden: schema.player.hidden })
    .from(schema.standing)
    .innerJoin(schema.player, eq(schema.player.id, schema.standing.playerId))
    .where(where)
    .orderBy(asc(schema.standing.rank))
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize);
  return { rows, total: count?.n ?? 0 };
}

export async function getPairings(roundId: number, opts: { q?: string; page: number; pageSize: number }) {
  const db = getDb();
  if (!db) return { rows: [], total: 0 };
  const q = opts.q ? `%${opts.q}%` : null;
  const filter = q ? sql`and (p1.name ilike ${q} or p1.nick ilike ${q} or p2.name ilike ${q} or p2.nick ilike ${q})` : sql``;
  const rows = (await db.execute(sql`
    select m.id, m.table_number as "table", m.status, m.is_bye as "isBye", m.is_draw as "isDraw", m.winner_id as "winnerId",
      m.games_winner as "gamesWinner", m.games_loser as "gamesLoser",
      m.player1_id as "p1Id", coalesce(p1.nick, p1.name) as "p1Name", p1.hidden as "p1Hidden", m.legend1 as "l1",
      m.player2_id as "p2Id", coalesce(p2.nick, p2.name) as "p2Name", p2.hidden as "p2Hidden", m.legend2 as "l2",
      count(*) over ()::int as total
    from match m left join player p1 on p1.id = m.player1_id left join player p2 on p2.id = m.player2_id
    where m.round_id = ${roundId} ${filter}
    order by m.table_number nulls last, m.id
    limit ${opts.pageSize} offset ${(opts.page - 1) * opts.pageSize}
  `)) as unknown as {
    id: number; table: number | null; status: string; isBye: boolean; isDraw: boolean; winnerId: number | null; gamesWinner: number; gamesLoser: number;
    p1Id: number | null; p1Name: string | null; p1Hidden: boolean | null; l1: string | null;
    p2Id: number | null; p2Name: string | null; p2Hidden: boolean | null; l2: string | null; total: number;
  }[];
  return { rows, total: rows[0]?.total ?? 0 };
}

export interface CardFilters {
  q?: string;
  type?: string;
  domain?: string;
  set?: string;
  page: number;
  pageSize: number;
}

export async function searchCards(f: CardFilters) {
  const db = getDb();
  if (!db) return { rows: [], total: 0 };
  const where: SQL[] = [];
  if (f.q) {
    const like = `%${f.q}%`;
    where.push(or(ilike(schema.card.name, like), ilike(schema.card.rulesText, like), ilike(schema.card.subtitle, like))!);
  }
  if (f.type) where.push(eq(schema.card.type, f.type as "Unit"));
  if (f.domain) where.push(sql`${f.domain} = any(${schema.card.domains})`);
  if (f.set) where.push(sql`exists (select 1 from card_print p where p.card_id = ${schema.card.id} and p.set_id = ${f.set})`);
  const cond = where.length ? and(...where) : undefined;
  const [count] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.card).where(cond);
  const rows = await db
    .select({ card: schema.card, print: schema.cardPrint })
    .from(schema.card)
    .innerJoin(schema.cardPrint, eq(schema.cardPrint.id, schema.card.id))
    .where(cond)
    .orderBy(asc(schema.cardPrint.setId), asc(schema.cardPrint.collectorNumber))
    .limit(f.pageSize)
    .offset((f.page - 1) * f.pageSize);
  return { rows, total: count?.n ?? 0 };
}

export async function getSets() {
  const db = getDb();
  if (!db) return [];
  return db.select().from(schema.cardSet).orderBy(asc(schema.cardSet.id));
}

export async function getLegendsBySlugs(slugs: string[]) {
  const db = getDb();
  if (!db || !slugs.length) return new Map<string, LegendInfo>();
  const rows = await db
    .select({ slug: schema.legend.slug, champion: schema.legend.champion, title: schema.legend.title, domains: schema.legend.domains, cardId: schema.legend.cardId })
    .from(schema.legend)
    .where(inArray(schema.legend.slug, slugs));
  return new Map(rows.map((r) => [r.slug, r]));
}

/** Adversários mais enfrentados, com a campanha contra cada um. */
export async function getTopOpponents(id: number, limit = 10) {
  const db = getDb();
  if (!db) return [];
  const rows = await db.execute(sql`
    with mine as (
      select case when m.player1_id = ${id} then m.player2_id else m.player1_id end as opp, m.is_draw, m.winner_id
      from match m where (m.player1_id = ${id} or m.player2_id = ${id}) and m.status = 'COMPLETE' and not m.is_bye
    )
    select o.id, coalesce(o.nick, o.name) as name, count(*)::int as matches,
      count(*) filter (where not is_draw and winner_id = ${id})::int as wins,
      count(*) filter (where not is_draw and winner_id is distinct from ${id})::int as losses,
      count(*) filter (where is_draw)::int as draws
    from mine join player o on o.id = mine.opp and not o.hidden
    group by o.id having count(*) > 1 order by matches desc, wins desc limit ${limit}
  `);
  return rows as unknown as { id: number; name: string; matches: number; wins: number; losses: number; draws: number }[];
}
