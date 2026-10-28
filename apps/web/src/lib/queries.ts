import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { schema } from "@cr/db";
import { getDb } from "./db";

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
    .select({ stats: schema.pilotStats, name: schema.player.name, hidden: schema.player.hidden, country: schema.player.countryCode })
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
      w.legend as "winnerLegend", p.name as "winnerName", p.hidden as "winnerHidden"
    from event e
    left join lateral (
      select s.legend, s.player_id from standing s join event_round r on r.id = s.round_id
      where s.event_id = e.id order by r.phase_order desc, r.round_number desc, s.rank asc limit 1
    ) w on true
    left join player p on p.id = w.player_id
    order by e.starts_at desc
  `);
  return rows as unknown as {
    id: number; name: string; kind: string; startsAt: string; playerCount: number; metagame: string | null; status: string; address: string | null;
    winnerLegend: string | null; winnerName: string | null; winnerHidden: boolean | null;
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
  return { ...ev, rounds, standingRounds: rounds.filter((r) => standingIds.has(r.id)) };
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
  const where = and(eq(schema.standing.roundId, roundId), opts.q ? ilike(schema.player.name, `%${opts.q}%`) : undefined);
  const [count] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.standing).innerJoin(schema.player, eq(schema.player.id, schema.standing.playerId)).where(where);
  const rows = await db
    .select({ s: schema.standing, name: schema.player.name, hidden: schema.player.hidden })
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
  const filter = q ? sql`and (p1.name ilike ${q} or p2.name ilike ${q})` : sql``;
  const rows = (await db.execute(sql`
    select m.id, m.table_number as "table", m.status, m.is_bye as "isBye", m.is_draw as "isDraw", m.winner_id as "winnerId",
      m.games_winner as "gamesWinner", m.games_loser as "gamesLoser",
      m.player1_id as "p1Id", p1.name as "p1Name", p1.hidden as "p1Hidden", m.legend1 as "l1",
      m.player2_id as "p2Id", p2.name as "p2Name", p2.hidden as "p2Hidden", m.legend2 as "l2",
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
