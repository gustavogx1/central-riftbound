import type { PoolCard } from "@cr/core";
import { and, between, eq, gt, inArray, sql } from "drizzle-orm";
import { type Db, type EventKind, schema } from "@cr/db";
import { loadLegendRefs } from "../ingest-event";
import { createLegendResolver, detectMetagame } from "../normalize";
import type { TopdeckClient } from "./client";
import {
  classifyTopdeck,
  convertDeck,
  MATCH_MAX_HOURS,
  matchPlayers,
  matchUvsEvent,
  ownKeys,
  ownRows,
  TOPDECK_MIN_PLAYERS,
} from "./normalize";
import { tdBulk, tdRounds, tdStandings, type TdStanding } from "./schemas";

const BATCH = 500;
const DAY = 86_400;
/** A busca em massa tem limite menor; janelas de 30 dias deixam cada resposta pequena. */
const WINDOW_DAYS = 30;

const ex = (col: string) => sql.raw(`excluded.${col}`);
function chunks<T>(rows: T[], size = BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

export interface TopdeckMajor {
  tid: string;
  name: string;
  startsAt: Date;
  players: number;
  kind: EventKind;
  swissNum: number | null;
  topCut: number | null;
  address: string | null;
}

/** Torneios de Riftbound construído terminados no período, só os grandes. */
export async function findTopdeckMajors(client: TopdeckClient, opts: { since: Date; until?: Date; ignore?: string[] }): Promise<TopdeckMajor[]> {
  const ignore = new Set(opts.ignore ?? []);
  const until = Math.floor((opts.until ?? new Date()).getTime() / 1000);
  const found = new Map<string, TopdeckMajor>();
  for (let start = Math.floor(opts.since.getTime() / 1000); start < until; start += WINDOW_DAYS * DAY) {
    const end = Math.min(until, start + WINDOW_DAYS * DAY);
    const res = await client.request("v2/tournaments", (d) => tdBulk.parse(d), {
      game: "Riftbound",
      format: "Constructed",
      start,
      end,
      participantMin: TOPDECK_MIN_PLAYERS,
      columns: ["id"],
    });
    for (const t of res) {
      const kind = classifyTopdeck(t.tournamentName, t.standings.length);
      if (!kind || ignore.has(t.TID)) continue;
      const place = [t.eventData?.city, t.eventData?.state].filter(Boolean).join(", ");
      found.set(t.TID, {
        tid: t.TID,
        name: t.tournamentName,
        startsAt: new Date(t.startDate * 1000),
        players: t.standings.length,
        kind,
        swissNum: t.swissNum ?? null,
        topCut: t.topCut || null,
        address: place || t.eventData?.address || null,
      });
    }
  }
  return [...found.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Cartas jogáveis com os códigos das impressões (o mesmo que o site usa). */
export async function loadPool(db: Db): Promise<Map<string, PoolCard>> {
  const rows = (await db.execute(sql`
    select c.id, c.name, c.subtitle, c.type, c.supertypes, c.tags, c.domains::text[] as domains,
      c.energy_cost as "energyCost", c.power_cost as "powerCost", c.might, c.rules_text as "rulesText",
      b.code, b.set_id as "setId", b.collector_number as "number", b.rarity,
      array_agg(p.code order by p.code) as codes
    from card c
    join card_print b on b.id = c.id
    join card_print p on p.card_id = c.id
    where c.type is not null and not ('Token' = any(c.supertypes))
    group by c.id, b.code, b.set_id, b.collector_number, b.rarity
  `)) as unknown as PoolCard[];
  return new Map(rows.map((c) => [c.id, c]));
}

/** Ids negativos estáveis para as chaves (cria os que faltam). */
export async function topdeckRefs(db: Db, keys: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const batch of chunks(keys, 1000)) {
    await db.insert(schema.topdeckRef).values(batch.map((key) => ({ key }))).onConflictDoNothing();
    const rows = await db.select().from(schema.topdeckRef).where(inArray(schema.topdeckRef.key, batch));
    for (const r of rows) out.set(r.key, r.id);
  }
  return out;
}

export interface TopdeckImportOptions {
  /** tid → id do evento da UVS, quando o casamento automático errar. */
  link?: Record<string, number>;
  log?: (msg: string) => void;
}

export interface TopdeckImportResult {
  eventId: number;
  own: boolean;
  decks: number;
  converted: number;
  linkedPlayers: number;
  unknownLines: number;
}

/**
 * Importa um torneio do TopDeck. Se o mesmo evento já veio da UVS, só anexa as
 * decklists aos jogadores dele; senão cria o evento inteiro (rodadas, partidas,
 * classificação) com ids negativos.
 */
export async function importTopdeckEvent(db: Db, client: TopdeckClient, t: TopdeckMajor, opts: TopdeckImportOptions = {}): Promise<TopdeckImportResult> {
  const log = opts.log ?? (() => {});
  const standings = await client.request(`v2/tournaments/${encodeURIComponent(t.tid)}/standings`, (d) => tdStandings.parse(d));
  const legendRefs = await loadLegendRefs(db);
  const resolve = createLegendResolver(legendRefs);
  const legendByCard = new Map((await db.select({ slug: schema.legend.slug, cardId: schema.legend.cardId }).from(schema.legend)).map((l) => [l.cardId, l.slug]));
  const pool = await loadPool(db);

  // Evento da UVS do mesmo fim de semana, ainda não ligado a outro torneio do TopDeck.
  const previous = (await db.select().from(schema.topdeckEvent).where(eq(schema.topdeckEvent.tid, t.tid)))[0];
  const forced = opts.link?.[t.tid];
  let uvsId: number | null = forced ?? null;
  if (!forced) {
    const window = MATCH_MAX_HOURS * 3_600_000;
    const candidates = await db
      .select({ id: schema.event.id, name: schema.event.name, startsAt: schema.event.startsAt, playerCount: schema.event.playerCount })
      .from(schema.event)
      .where(
        and(
          gt(schema.event.id, 0),
          between(schema.event.startsAt, new Date(t.startsAt.getTime() - window), new Date(t.startsAt.getTime() + window)),
          sql`not exists (select 1 from topdeck_event te where te.event_id = ${schema.event.id} and te.tid <> ${t.tid})`,
        ),
      );
    uvsId = matchUvsEvent({ name: t.name, startsAt: t.startsAt, players: t.players }, candidates)?.id ?? null;
  }

  // Um evento que antes era só do TopDeck e agora apareceu na UVS sai, para não contar duas vezes.
  if (previous?.own && uvsId !== null) {
    await db.delete(schema.event).where(eq(schema.event.id, previous.eventId));
    log(`  ${t.name}: agora casa com o evento ${uvsId} da UVS; o evento do TopDeck saiu`);
  }

  let eventId: number;
  let playerOf: (s: TdStanding) => number | null;
  if (uvsId !== null) {
    eventId = uvsId;
    // Última classificação de cada jogador no evento (o corte, quando houver).
    const uvsPlayers = (await db.execute(sql`
      select distinct on (s.player_id) s.player_id as "playerId", p.name, p.nick, s.rank, s.legend
      from standing s join player p on p.id = s.player_id
      where s.event_id = ${eventId}
      order by s.player_id, s.round_id desc
    `)) as unknown as { playerId: number; name: string; nick: string | null; rank: number; legend: string | null }[];
    const pairs = matchPlayers(
      standings.filter((s) => s.id).map((s) => ({ id: s.id!, name: s.name, rank: s.standing, legend: resolve(s.leader) })),
      uvsPlayers,
    );
    playerOf = (s) => (s.id ? (pairs.get(s.id) ?? null) : null);
  } else {
    const rounds = await client.request(`v2/tournaments/${encodeURIComponent(t.tid)}/rounds`, (d) => tdRounds.parse(d));
    const refs = await topdeckRefs(db, ownKeys(t.tid, rounds, standings));
    const ref = (k: string) => {
      const id = refs.get(k);
      if (id === undefined) throw new Error(`Sem id para ${k}`);
      return id;
    };
    const rows = ownRows(t.tid, rounds, standings, ref, resolve);
    eventId = rows.eventId;
    const counts = new Map<string, number>();
    for (const s of rows.standingRows) if (s.legend) counts.set(s.legend, (counts.get(s.legend) ?? 0) + 1);
    const setOf = new Map(legendRefs.map((l) => [l.slug, l.setId]));
    await db
      .insert(schema.event)
      .values({
        id: eventId,
        name: t.name,
        kind: t.kind,
        startsAt: t.startsAt,
        timezone: null,
        address: t.address,
        playerCount: t.players,
        status: "complete",
        metagame: detectMetagame(counts, (s) => setOf.get(s)),
        plannedRounds: rows.swissRounds || t.swissNum,
        topCutSize: t.topCut,
        fetchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.event.id,
        set: { name: ex("name"), kind: ex("kind"), startsAt: ex("starts_at"), address: ex("address"), playerCount: ex("player_count"), status: ex("status"),
          metagame: ex("metagame"), plannedRounds: ex("planned_rounds"), topCutSize: ex("top_cut_size"), fetchedAt: ex("fetched_at") },
      });
    for (const b of chunks(rows.playerRows)) {
      // O nome acompanha o TopDeck (inclusive "Deleted User", como os termos pedem).
      await db.insert(schema.player).values(b).onConflictDoUpdate({ target: schema.player.id, set: { name: ex("name") } });
    }
    // Rodadas refeitas do zero: partidas e classificação somem junto (cascade).
    await db.delete(schema.eventRound).where(eq(schema.eventRound.eventId, eventId));
    for (const b of chunks(rows.roundRows)) await db.insert(schema.eventRound).values(b.map((r) => ({ ...r, ingestedAt: new Date() })));
    for (const b of chunks(rows.matchRows)) await db.insert(schema.match).values(b);
    for (const b of chunks(rows.standingRows)) await db.insert(schema.standing).values(b);
    playerOf = (s) => (s.id ? ref(`p:${s.id}`) : null);
    log(`  ${rows.roundRows.length} rodadas, ${rows.matchRows.length} partidas`);
  }

  // Decklists: troca todas as do evento que vieram deste torneio.
  const deckRows = standings
    .filter((s) => s.id)
    .map((s) => {
      const d = convertDeck(s, pool);
      return {
        eventId,
        topdeckPlayerId: s.id!,
        tid: t.tid,
        playerId: playerOf(s),
        playerName: s.name,
        rank: s.standing,
        legend: resolve(s.leader) ?? (d.legendCardId ? (legendByCard.get(d.legendCardId) ?? null) : null),
        code: d.code,
        unknown: d.unknown.slice(0, 20),
        fetchedAt: new Date(),
      };
    })
    .filter((r) => r.code || r.legend);
  await db.delete(schema.eventDeck).where(eq(schema.eventDeck.tid, t.tid));
  for (const b of chunks(deckRows)) await db.insert(schema.eventDeck).values(b).onConflictDoNothing();

  await db
    .insert(schema.topdeckEvent)
    .values({ tid: t.tid, eventId, own: uvsId === null, name: t.name, startsAt: t.startsAt, playerCount: t.players, fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.topdeckEvent.tid,
      set: { eventId: ex("event_id"), own: ex("own"), name: ex("name"), startsAt: ex("starts_at"), playerCount: ex("player_count"), fetchedAt: ex("fetched_at") },
    });

  return {
    eventId,
    own: uvsId === null,
    decks: deckRows.length,
    converted: deckRows.filter((r) => r.code).length,
    linkedPlayers: deckRows.filter((r) => r.playerId !== null).length,
    unknownLines: deckRows.reduce((a, r) => a + r.unknown.length, 0),
  };
}

/** Torneios do TopDeck já importados (para pular na rodada diária). */
export async function importedTopdeckTids(db: Db): Promise<Set<string>> {
  return new Set((await db.select({ tid: schema.topdeckEvent.tid }).from(schema.topdeckEvent)).map((r) => r.tid));
}
