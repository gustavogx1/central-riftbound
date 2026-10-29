import "server-only";
import { sql, type SQL } from "drizzle-orm";
import type { Db } from "@cr/db";
import { getDb } from "./db";

/**
 * Decklists de torneio: as do TopDeck.gg (migração 0006) e as enviadas pela comunidade e
 * aprovadas na moderação (migração 0007). Enquanto uma migração não rodar em produção, a tabela
 * não existe: as consultas devolvem vazio (ou só o TopDeck) em vez de quebrar a página.
 */
function missingTable(err: unknown): boolean {
  for (let e = err as { code?: string; cause?: unknown } | undefined; e; e = e.cause as typeof e) if (e.code === "42P01") return true;
  return false;
}
export async function safe<T>(fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (missingTable(err)) return fallback;
    throw err;
  }
}

const tableCache = globalThis as unknown as { crSubmissionsTable?: { at: number; ok: boolean } };

/** A tabela de envios já existe? Conferido a cada 5 min por processo. */
export async function hasSubmissions(db: Db): Promise<boolean> {
  const hit = tableCache.crSubmissionsTable;
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.ok;
  const [row] = (await db.execute(sql`select to_regclass('public.deck_submission') is not null as ok`)) as unknown as { ok: boolean }[];
  tableCache.crSubmissionsTable = { at: Date.now(), ok: Boolean(row?.ok) };
  return Boolean(row?.ok);
}

/** Prefixo da chave das listas da comunidade na URL (/events/<id>/decks/cr-<id do envio>). */
export const COMMUNITY_PREFIX = "cr-";

/**
 * Todas as decklists publicadas, como uma tabela `d`. Quando o TopDeck já tem a lista do jogador
 * no evento, a enviada pela comunidade fica de fora (não conta duas vezes nas estatísticas).
 */
export async function allDecks(db: Db): Promise<SQL> {
  const topdeck = sql`select d.event_id, d.topdeck_player_id as key, 'topdeck'::text as source, d.tid, d.player_id, d.player_name, d.rank, d.legend, d.code, null::text as source_url
    from event_deck d`;
  if (!(await hasSubmissions(db))) return sql`(${topdeck}) d`;
  return sql`(${topdeck}
    union all
    select s.event_id, ${COMMUNITY_PREFIX} || s.id, 'community', null, s.player_id, pl.name, s.rank, s.legend, s.code, s.source_url
    from deck_submission s join player pl on pl.id = s.player_id
    where s.status = 'approved'
      and not exists (select 1 from event_deck x where x.event_id = s.event_id and x.player_id = s.player_id and x.code is not null)
  ) d`;
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

export type DeckSource = "topdeck" | "community";

export interface EventDeckRow {
  /** Id do jogador no TopDeck, ou "cr-<id do envio>" para listas da comunidade. */
  key: string;
  source: DeckSource;
  tid: string | null;
  playerId: number | null;
  name: string;
  hidden: boolean;
  rank: number | null;
  legend: string | null;
  code: string | null;
  sourceUrl: string | null;
}

const deckCols = sql`d.key, d.source, d.tid, d.player_id as "playerId",
  coalesce(p.nick, p.name, d.player_name) as name, coalesce(p.hidden, false) as hidden, d.rank, d.legend, d.code, d.source_url as "sourceUrl"`;

export async function getEventDecks(eventId: number, opts: { q?: string; page: number; pageSize: number }) {
  const db = getDb();
  if (!db) return { rows: [] as EventDeckRow[], total: 0 };
  const q = opts.q ? `%${opts.q}%` : null;
  const filter = q ? sql`and (d.player_name ilike ${q} or p.name ilike ${q} or p.nick ilike ${q})` : sql``;
  return safe({ rows: [] as EventDeckRow[], total: 0 }, async () => {
    const decks = await allDecks(db);
    const [count] = (await db.execute(sql`
      select count(*)::int as n from ${decks} left join player p on p.id = d.player_id where d.event_id = ${eventId} ${filter}
    `)) as unknown as { n: number }[];
    const rows = (await db.execute(sql`
      select ${deckCols} from ${decks} left join player p on p.id = d.player_id
      where d.event_id = ${eventId} ${filter}
      order by d.rank asc nulls last, d.player_name
      limit ${opts.pageSize} offset ${(opts.page - 1) * opts.pageSize}
    `)) as unknown as EventDeckRow[];
    return { rows, total: count?.n ?? 0 };
  });
}

export interface EventDeckDetail extends EventDeckRow {
  eventName: string;
  startsAt: string;
  playerCount: number;
  metagame: string | null;
  /** Só nas listas da comunidade: situação na moderação e quem enviou. */
  status: "pending" | "approved" | "rejected" | null;
  userId: string | null;
  note: string;
}

/**
 * Uma decklist do evento. As da comunidade voltam em qualquer situação (a página decide
 * quem pode ver uma pendente); as do TopDeck, como foram importadas.
 */
export async function getEventDeck(eventId: number, key: string): Promise<EventDeckDetail | null> {
  const db = getDb();
  if (!db) return null;
  return safe(null, async () => {
    const ev = sql`e.name as "eventName", e.starts_at as "startsAt", e.player_count as "playerCount", e.metagame`;
    if (key.startsWith(COMMUNITY_PREFIX)) {
      if (!(await hasSubmissions(db))) return null;
      const rows = (await db.execute(sql`
        select ${COMMUNITY_PREFIX} || s.id as key, 'community' as source, null as tid, s.player_id as "playerId",
          coalesce(p.nick, p.name) as name, p.hidden, s.rank, s.legend, s.code, s.source_url as "sourceUrl",
          s.status, s.user_id as "userId", s.note, ${ev}
        from deck_submission s join event e on e.id = s.event_id join player p on p.id = s.player_id
        where s.event_id = ${eventId} and s.id = ${key.slice(COMMUNITY_PREFIX.length)}
      `)) as unknown as EventDeckDetail[];
      return rows[0] ?? null;
    }
    const rows = (await db.execute(sql`
      select d.topdeck_player_id as key, 'topdeck' as source, d.tid, d.player_id as "playerId",
        coalesce(p.nick, p.name, d.player_name) as name, coalesce(p.hidden, false) as hidden, d.rank, d.legend, d.code,
        null as "sourceUrl", null as status, null as "userId", '' as note, ${ev}
      from event_deck d join event e on e.id = d.event_id left join player p on p.id = d.player_id
      where d.event_id = ${eventId} and d.topdeck_player_id = ${key}
    `)) as unknown as EventDeckDetail[];
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
    const decks = await allDecks(db);
    return (await db.execute(sql`
      select ${deckCols}, d.event_id as "eventId", e.name as "eventName", e.starts_at as "startsAt", e.player_count as "playerCount"
      from ${decks} join event e on e.id = d.event_id left join player p on p.id = d.player_id
      where d.legend = ${legend} and d.code is not null and d.rank <= greatest(8, e.player_count / 16)
      order by e.starts_at desc, d.rank asc
      limit ${limit}
    `)) as unknown as LegendDeckRow[];
  });
}

export interface PoolDeck {
  code: string;
  eventId: number;
  key: string;
  wins: number;
  losses: number;
}

/**
 * Todas as listas de uma lenda (num set, ou em todos), com a campanha do jogador no evento
 * (sem byes nem empates). Base das estatísticas por carta e do "tempero".
 */
export async function getLegendDeckPool(legend: string, metagame: string | null): Promise<PoolDeck[]> {
  const db = getDb();
  if (!db) return [];
  return safe([], async () => {
    const decks = await allDecks(db);
    const set = metagame ? sql`and e.metagame = ${metagame}` : sql``;
    return (await db.execute(sql`
      select d.code, d.event_id as "eventId", d.key, coalesce(r.wins, 0)::int as wins, coalesce(r.losses, 0)::int as losses
      from ${decks} join event e on e.id = d.event_id
      left join lateral (
        select count(*) filter (where not m.is_draw and m.winner_id = d.player_id) as wins,
          count(*) filter (where not m.is_draw and m.winner_id is not null and m.winner_id <> d.player_id) as losses
        from match m
        where m.event_id = d.event_id and m.status = 'COMPLETE' and not m.is_bye and d.player_id is not null
          and (m.player1_id = d.player_id or m.player2_id = d.player_id)
      ) r on true
      where d.legend = ${legend} and d.code is not null ${set}
    `)) as unknown as PoolDeck[];
  });
}

export interface AnyDeck {
  code: string;
  eventId: number;
  key: string;
  legend: string | null;
  rank: number | null;
  name: string;
  hidden: boolean;
  eventName: string;
  startsAt: string;
  playerCount: number;
  metagame: string | null;
}

/** Todas as decklists publicadas, dos eventos mais recentes primeiro. Base da página de cada carta. */
export async function getAllDecks(): Promise<AnyDeck[]> {
  const db = getDb();
  if (!db) return [];
  return safe([], async () => {
    const decks = await allDecks(db);
    return (await db.execute(sql`
      select d.code, d.event_id as "eventId", d.key, d.legend, d.rank,
        coalesce(p.nick, p.name, d.player_name) as name, coalesce(p.hidden, false) as hidden,
        e.name as "eventName", e.starts_at as "startsAt", e.player_count as "playerCount", e.metagame
      from ${decks} join event e on e.id = d.event_id left join player p on p.id = d.player_id
      where d.code is not null
      order by e.starts_at desc, d.rank asc nulls last
    `)) as unknown as AnyDeck[];
  });
}
