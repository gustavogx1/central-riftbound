import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { decodeDeck, encodeDeck, textToDeck, validateDeck, type DeckIssue, type DeckList, type PoolCard } from "@cr/core";
import { schema } from "@cr/db";
import type { SessionUser } from "./auth/server";
import { getDb } from "./db";
import { newDeckId, poolMap } from "./decks";
import { hasSubmissions, safe } from "./event-decks";
import { getLegends } from "./queries";

/** Limites para ninguém lotar o banco grátis nem a fila de moderação. */
export const MAX_PENDING_PER_USER = 20;
export const MAX_LIST = 6000;
export const MAX_NOTE = 500;
export const MAX_URL = 300;
export const REJECT_REASONS = ["wrongPlayer", "wrongList", "duplicate", "spam", "other"] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];
export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface Entrant {
  playerId: number;
  name: string;
  rank: number;
  /** Lenda que a UVS registrou para o jogador no evento. */
  legend: string | null;
  wins: number;
  losses: number;
  draws: number;
}

/** Classificação final de cada jogador (última rodada com standings em que ele aparece). */
const finalStandings = (eventId: number) => sql`
  select distinct on (s.player_id) s.player_id, s.rank, s.legend, s.wins, s.losses, s.draws
  from standing s join event_round r on r.id = s.round_id
  where s.event_id = ${eventId}
  order by s.player_id, r.phase_order desc, r.round_number desc`;

/** Jogadores do evento para quem envia escolher. Quem pediu para ocultar o nome fica de fora. */
export async function searchEntrants(eventId: number, q: string | undefined, limit = 20): Promise<Entrant[]> {
  const db = getDb();
  if (!db) return [];
  const like = q ? `%${q}%` : null;
  const filter = like ? sql`and (p.name ilike ${like} or p.nick ilike ${like})` : sql``;
  return (await db.execute(sql`
    select f.player_id as "playerId", coalesce(p.nick, p.name) as name, f.rank, f.legend, f.wins, f.losses, f.draws
    from (${finalStandings(eventId)}) f join player p on p.id = f.player_id
    where not p.hidden ${filter}
    order by f.rank limit ${limit}
  `)) as unknown as Entrant[];
}

export async function getEntrant(eventId: number, playerId: number): Promise<Entrant | null> {
  const db = getDb();
  if (!db) return null;
  const rows = (await db.execute(sql`
    select f.player_id as "playerId", coalesce(p.nick, p.name) as name, f.rank, f.legend, f.wins, f.losses, f.draws
    from (${finalStandings(eventId)}) f join player p on p.id = f.player_id
    where f.player_id = ${playerId} and not p.hidden
  `)) as unknown as Entrant[];
  return rows[0] ?? null;
}

/** O jogador já tem lista publicada no evento (TopDeck ou comunidade aprovada)? */
export async function hasPublishedDeck(eventId: number, playerId: number): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const community = (await hasSubmissions(db))
    ? sql`or exists (select 1 from deck_submission s where s.event_id = ${eventId} and s.player_id = ${playerId} and s.status = 'approved')`
    : sql``;
  const [row] = (await db.execute(sql`
    select (exists (select 1 from event_deck d where d.event_id = ${eventId} and d.player_id = ${playerId} and d.code is not null) ${community}) as yes
  `)) as unknown as { yes: boolean }[];
  return Boolean(row?.yes);
}

/** Lê o que a pessoa colou: código de deck (uma palavra só) ou lista em texto. */
export function parseList(input: string, pool: Map<string, PoolCard>): { deck: DeckList; unknown: string[] } | null {
  const text = input.trim();
  if (!text) return null;
  if (!/\s/.test(text)) {
    try {
      const { deck, unknown } = decodeDeck(text, pool);
      return { deck, unknown };
    } catch {
      // Não é código: tenta como texto (uma carta só, por exemplo).
    }
  }
  return textToDeck(text, pool);
}

/**
 * Problemas que impedem o envio. A lista de banidas muda com o tempo, então uma carta banida
 * depois do evento não barra a lista.
 */
export function blockingIssues(deck: DeckList, pool: Map<string, PoolCard>): DeckIssue[] {
  return validateDeck(deck, pool, "constructed").filter((i) => i.severity === "error" && i.code !== "banned");
}

export function cleanUrl(raw: string | undefined): string | null | false {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (v.length > MAX_URL) return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : false;
  } catch {
    return false;
  }
}

export interface SubmitInput {
  eventId: number;
  playerId: number;
  list: string;
  sourceUrl?: string;
  note?: string;
}

export type SubmitError =
  | { error: "login" | "unavailable" | "notComplete" | "notEntrant" | "empty" | "alreadyPublished" | "limit" | "badUrl" }
  | { error: "unknownCards"; lines: string[] }
  | { error: "invalid"; issue: DeckIssue }
  | { error: "legendMismatch"; list: string; registered: string };

export type SubmitResult = ({ ok: true; id: string; status: SubmissionStatus } | ({ ok: false } & SubmitError));

/**
 * Grava um envio. Tudo é conferido aqui (o servidor não confia no navegador): o evento acabou,
 * o jogador está na classificação, a lista é válida e a lenda bate com a que a UVS registrou.
 * Envios de moderadores já entram aprovados (listas publicadas por organizadores, com o link).
 */
export async function submitDeck(user: SessionUser, input: SubmitInput): Promise<SubmitResult> {
  const db = getDb();
  if (!db || !(await hasSubmissions(db))) return { ok: false, error: "unavailable" };
  const [ev] = await db.select({ status: schema.event.status }).from(schema.event).where(eq(schema.event.id, input.eventId));
  if (!ev) return { ok: false, error: "notEntrant" };
  if (ev.status !== "complete") return { ok: false, error: "notComplete" };
  const entrant = await getEntrant(input.eventId, input.playerId);
  if (!entrant) return { ok: false, error: "notEntrant" };

  const sourceUrl = cleanUrl(input.sourceUrl);
  if (sourceUrl === false) return { ok: false, error: "badUrl" };
  const pool = await poolMap();
  const parsed = parseList(input.list.slice(0, MAX_LIST), pool);
  if (parsed?.unknown.length) return { ok: false, error: "unknownCards", lines: parsed.unknown.slice(0, 5) };
  if (!parsed || (!parsed.deck.legend && !Object.keys(parsed.deck.main).length)) return { ok: false, error: "empty" };
  const issue = blockingIssues(parsed.deck, pool)[0];
  if (issue) return { ok: false, error: "invalid", issue };

  const legends = await getLegends();
  const listLegend = legends.find((l) => l.cardId === parsed.deck.legend) ?? null;
  if (entrant.legend && listLegend?.slug !== entrant.legend) {
    const registered = legends.find((l) => l.slug === entrant.legend);
    return { ok: false, error: "legendMismatch", list: listLegend?.champion ?? "—", registered: registered?.champion ?? entrant.legend };
  }
  if (await hasPublishedDeck(input.eventId, input.playerId)) return { ok: false, error: "alreadyPublished" };

  const code = encodeDeck(parsed.deck, pool);
  const status: SubmissionStatus = user.admin ? "approved" : "pending";
  const values = {
    code,
    legend: listLegend?.slug ?? null,
    expectedLegend: entrant.legend,
    rank: entrant.rank,
    sourceUrl,
    note: (input.note ?? "").trim().slice(0, MAX_NOTE),
    status,
    updatedAt: new Date(),
    ...(user.admin ? { reviewedBy: user.id, reviewedAt: new Date() } : {}),
  };

  // Um envio pendente da mesma pessoa para o mesmo jogador é substituído, não duplicado.
  const mine = and(
    eq(schema.deckSubmission.eventId, input.eventId),
    eq(schema.deckSubmission.playerId, input.playerId),
    eq(schema.deckSubmission.userId, user.id),
    eq(schema.deckSubmission.status, "pending"),
  );
  const [existing] = await db.select({ id: schema.deckSubmission.id }).from(schema.deckSubmission).where(mine).limit(1);
  if (existing) {
    await db.update(schema.deckSubmission).set(values).where(eq(schema.deckSubmission.id, existing.id));
    return { ok: true, id: existing.id, status };
  }
  if (!user.admin) {
    const [count] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.deckSubmission)
      .where(and(eq(schema.deckSubmission.userId, user.id), eq(schema.deckSubmission.status, "pending")));
    if ((count?.n ?? 0) >= MAX_PENDING_PER_USER) return { ok: false, error: "limit" };
  }
  const id = newDeckId();
  await db.insert(schema.deckSubmission).values({ id, eventId: input.eventId, playerId: input.playerId, userId: user.id, ...values });
  return { ok: true, id, status };
}

export interface SubmissionRow {
  id: string;
  eventId: number;
  eventName: string;
  startsAt: string;
  playerId: number;
  playerName: string;
  rank: number | null;
  legend: string | null;
  expectedLegend: string | null;
  code: string;
  sourceUrl: string | null;
  note: string;
  status: SubmissionStatus;
  rejectReason: RejectReason | null;
  author: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

const rowCols = sql`s.id, s.event_id as "eventId", e.name as "eventName", e.starts_at as "startsAt", s.player_id as "playerId",
  coalesce(p.nick, p.name) as "playerName", s.rank, s.legend, s.expected_legend as "expectedLegend", s.code, s.source_url as "sourceUrl",
  s.note, s.status, s.reject_reason as "rejectReason", pr.display_name as author, s.created_at as "createdAt", s.reviewed_at as "reviewedAt"`;
const rowFrom = sql`deck_submission s join event e on e.id = s.event_id join player p on p.id = s.player_id left join profile pr on pr.user_id = s.user_id`;

/** Fila da moderação: pendentes, mais antigos primeiro; os revisados, mais recentes primeiro. */
export async function listSubmissions(status: SubmissionStatus, limit = 50): Promise<SubmissionRow[]> {
  const db = getDb();
  if (!db) return [];
  const order = status === "pending" ? sql`s.created_at asc` : sql`s.reviewed_at desc nulls last, s.created_at desc`;
  return safe([], async () => (await db.execute(sql`select ${rowCols} from ${rowFrom} where s.status = ${status} order by ${order} limit ${limit}`)) as unknown as SubmissionRow[]);
}

export async function listMySubmissions(userId: string, limit = 50): Promise<SubmissionRow[]> {
  const db = getDb();
  if (!db) return [];
  return safe([], async () => (await db.execute(sql`select ${rowCols} from ${rowFrom} where s.user_id = ${userId} order by s.created_at desc limit ${limit}`)) as unknown as SubmissionRow[]);
}

export async function countPending(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  return safe(0, async () => {
    const [row] = (await db.execute(sql`select count(*)::int as n from deck_submission where status = 'pending'`)) as unknown as { n: number }[];
    return row?.n ?? 0;
  });
}

function pgCode(err: unknown): string | undefined {
  for (let e = err as { code?: string; cause?: unknown } | undefined; e; e = e.cause as typeof e) if (e.code) return e.code;
  return undefined;
}

export type ReviewResult = { ok: true; eventId: number; legend: string | null } | { ok: false; error: "notFound" | "duplicate" };

/**
 * Aprova ou recusa um envio (também serve para tirar do ar uma lista já aprovada). Ao aprovar,
 * os outros envios pendentes do mesmo jogador no mesmo evento são recusados como duplicados.
 */
export async function reviewSubmission(adminId: string, id: string, approve: boolean, reason: RejectReason | null): Promise<ReviewResult> {
  const db = getDb();
  if (!db) return { ok: false, error: "notFound" };
  const [row] = await db
    .select({ eventId: schema.deckSubmission.eventId, playerId: schema.deckSubmission.playerId, legend: schema.deckSubmission.legend })
    .from(schema.deckSubmission)
    .where(eq(schema.deckSubmission.id, id));
  if (!row) return { ok: false, error: "notFound" };
  const now = new Date();
  if (approve) {
    if (await hasPublishedDeck(row.eventId, row.playerId)) return { ok: false, error: "duplicate" };
    try {
      await db
        .update(schema.deckSubmission)
        .set({ status: "approved", rejectReason: null, reviewedBy: adminId, reviewedAt: now })
        .where(eq(schema.deckSubmission.id, id));
    } catch (err) {
      if (pgCode(err) === "23505") return { ok: false, error: "duplicate" };
      throw err;
    }
    await db
      .update(schema.deckSubmission)
      .set({ status: "rejected", rejectReason: "duplicate", reviewedBy: adminId, reviewedAt: now })
      .where(and(eq(schema.deckSubmission.eventId, row.eventId), eq(schema.deckSubmission.playerId, row.playerId), eq(schema.deckSubmission.status, "pending")));
  } else {
    await db
      .update(schema.deckSubmission)
      .set({ status: "rejected", rejectReason: reason ?? "other", reviewedBy: adminId, reviewedAt: now })
      .where(eq(schema.deckSubmission.id, id));
  }
  return { ok: true, eventId: row.eventId, legend: row.legend };
}

/** Quem enviou pode apagar o próprio envio enquanto estiver pendente ou recusado. */
export async function deleteMySubmission(userId: string, id: string) {
  const db = getDb();
  if (!db) return;
  await db
    .delete(schema.deckSubmission)
    .where(and(eq(schema.deckSubmission.id, id), eq(schema.deckSubmission.userId, userId), sql`${schema.deckSubmission.status} <> 'approved'`));
}
