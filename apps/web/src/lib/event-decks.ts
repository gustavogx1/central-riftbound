import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "./db";

/**
 * Decklists de torneio vindas do TopDeck.gg (migração 0006). Enquanto a migração não
 * rodar em produção, as tabelas não existem: as consultas devolvem vazio em vez de quebrar a página.
 */
function missingTable(err: unknown): boolean {
  for (let e = err as { code?: string; cause?: unknown } | undefined; e; e = e.cause as typeof e) if (e.code === "42P01") return true;
  return false;
}
async function safe<T>(fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (missingTable(err)) return fallback;
    throw err;
  }
}

export const topdeckEventUrl = (tid: string) => `https://topdeck.gg/event/${encodeURIComponent(tid)}`;
export const topdeckDeckUrl = (tid: string, playerId: string) => `https://topdeck.gg/deck/${encodeURIComponent(tid)}/${encodeURIComponent(playerId)}`;

export interface TopdeckLink {
  tid: string;
  /** O evento inteiro veio do TopDeck (não estava na UVS). */
  own: boolean;
}

export async function getTopdeckLink(eventId: number): Promise<TopdeckLink | null> {
  const db = getDb();
  if (!db) return null;
  return safe(null, async () => {
    const rows = (await db.execute(sql`select tid, own from topdeck_event where event_id = ${eventId} limit 1`)) as unknown as TopdeckLink[];
    return rows[0] ?? null;
  });
}

export interface EventDeckRow {
  topdeckPlayerId: string;
  tid: string;
  playerId: number | null;
  name: string;
  hidden: boolean;
  rank: number | null;
  legend: string | null;
  code: string | null;
}

const deckCols = sql`d.topdeck_player_id as "topdeckPlayerId", d.tid, d.player_id as "playerId",
  coalesce(p.nick, p.name, d.player_name) as name, coalesce(p.hidden, false) as hidden, d.rank, d.legend, d.code`;

export async function getEventDecks(eventId: number, opts: { q?: string; page: number; pageSize: number }) {
  const db = getDb();
  if (!db) return { rows: [] as EventDeckRow[], total: 0 };
  const q = opts.q ? `%${opts.q}%` : null;
  const filter = q ? sql`and (d.player_name ilike ${q} or p.name ilike ${q} or p.nick ilike ${q})` : sql``;
  return safe({ rows: [] as EventDeckRow[], total: 0 }, async () => {
    const [count] = (await db.execute(sql`
      select count(*)::int as n from event_deck d left join player p on p.id = d.player_id where d.event_id = ${eventId} ${filter}
    `)) as unknown as { n: number }[];
    const rows = (await db.execute(sql`
      select ${deckCols} from event_deck d left join player p on p.id = d.player_id
      where d.event_id = ${eventId} ${filter}
      order by d.rank asc nulls last, d.player_name
      limit ${opts.pageSize} offset ${(opts.page - 1) * opts.pageSize}
    `)) as unknown as EventDeckRow[];
    return { rows, total: count?.n ?? 0 };
  });
}

export async function getEventDeck(eventId: number, topdeckPlayerId: string) {
  const db = getDb();
  if (!db) return null;
  return safe(null, async () => {
    const rows = (await db.execute(sql`
      select ${deckCols}, e.name as "eventName", e.starts_at as "startsAt", e.player_count as "playerCount"
      from event_deck d join event e on e.id = d.event_id left join player p on p.id = d.player_id
      where d.event_id = ${eventId} and d.topdeck_player_id = ${topdeckPlayerId}
    `)) as unknown as (EventDeckRow & { eventName: string; startsAt: string; playerCount: number })[];
    return rows[0] ?? null;
  });
}

export interface LegendDeckRow extends EventDeckRow {
  eventId: number;
  eventName: string;
  startsAt: string;
  playerCount: number;
}

/** Decklists mais bem colocadas da lenda, dos eventos mais recentes primeiro. */
export async function getLegendDecks(legend: string, limit = 12): Promise<LegendDeckRow[]> {
  const db = getDb();
  if (!db) return [];
  return safe([], async () => {
    return (await db.execute(sql`
      select ${deckCols}, d.event_id as "eventId", e.name as "eventName", e.starts_at as "startsAt", e.player_count as "playerCount"
      from event_deck d join event e on e.id = d.event_id left join player p on p.id = d.player_id
      where d.legend = ${legend} and d.code is not null and d.rank <= greatest(8, e.player_count / 16)
      order by e.starts_at desc, d.rank asc
      limit ${limit}
    `)) as unknown as LegendDeckRow[];
  });
}
