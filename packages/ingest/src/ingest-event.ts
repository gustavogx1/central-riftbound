import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { type Db, type EventKind, schema } from "@cr/db";
import {
  createLegendResolver,
  detectMetagame,
  eventRow,
  matchRow,
  playerFromStanding,
  playersFromMatch,
  roundRows,
  standingRow,
  type LegendRef,
} from "./normalize";
import type { UvsClient } from "./uvs/client";
import { page, uvsEvent, uvsMatch, uvsStanding } from "./uvs/schemas";

const PAGE_SIZE = 500;
const BATCH = 500;

export async function loadLegendRefs(db: Db): Promise<LegendRef[]> {
  return db
    .select({
      slug: schema.legend.slug,
      champion: schema.legend.champion,
      title: schema.legend.title,
      setId: schema.cardPrint.setId,
    })
    .from(schema.legend)
    .innerJoin(schema.cardPrint, eq(schema.cardPrint.id, schema.legend.cardId));
}

async function fetchAll<T>(client: UvsClient, path: string, parse: (d: unknown) => { results: T[]; next: number | null }) {
  const out: T[] = [];
  for (let p = 1; ; p++) {
    const data = await client.get(`${path}?page=${p}&page_size=${PAGE_SIZE}`, parse);
    out.push(...data.results);
    if (!data.next) return out;
  }
}

function chunks<T>(rows: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += BATCH) out.push(rows.slice(i, i + BATCH));
  return out;
}

const ex = (col: string) => sql.raw(`excluded.${col}`);

/** Só troca o nick se este evento for o mais recente em que ele apareceu. */
const newerNick = sql`excluded.nick is not null and (player.nick_at is null or excluded.nick_at >= player.nick_at)`;
export const nickSet = {
  nick: sql`case when ${newerNick} then excluded.nick else player.nick end`,
  nickAt: sql`case when ${newerNick} then excluded.nick_at else player.nick_at end`,
};

export interface IngestOptions {
  kind: EventKind;
  metagameOverride?: string | null;
  /** Rodadas já completas e gravadas são puladas, a menos que force=true. */
  force?: boolean;
  log?: (msg: string) => void;
}

export async function ingestEvent(db: Db, client: UvsClient, uvsEventId: number, opts: IngestOptions) {
  const log = opts.log ?? (() => {});
  const ev = await client.get(`events/${uvsEventId}/`, (d) => uvsEvent.parse(d));
  const legendRefs = await loadLegendRefs(db);
  const resolve = createLegendResolver(legendRefs);
  const unknown = new Map<string, number>();
  const resolveTracking = (name: string | null | undefined) => {
    const slug = resolve(name);
    if (!slug && name) unknown.set(name, (unknown.get(name) ?? 0) + 1);
    return slug;
  };

  const startsAt = new Date(ev.start_datetime);
  const rounds = roundRows(ev);
  // Resumo de tudo o que a tela mostra; se mudar, o pulso ao vivo sobe de versão.
  const fp = createHash("sha1");
  fp.update(JSON.stringify([ev.display_status, ev.timer_end_datetime, ev.timer_paused_at_datetime, ev.timer_is_running]));
  for (const r of rounds) fp.update(`|r${r.id}:${r.status}:${r.pairingsReady}:${r.standingsReady}`);
  await db
    .insert(schema.event)
    .values(eventRow(ev, opts.kind, null))
    .onConflictDoUpdate({
      target: schema.event.id,
      set: { name: ex("name"), kind: ex("kind"), startsAt: ex("starts_at"), playerCount: ex("player_count"), status: ex("status"),
        timerEndsAt: ex("timer_ends_at"), timerPausedAt: ex("timer_paused_at"), timerRunning: ex("timer_running"),
        plannedRounds: ex("planned_rounds"), topCutSize: ex("top_cut_size"), fetchedAt: ex("fetched_at") },
    });

  const existing = new Map(
    (await db.select({ id: schema.eventRound.id, ingestedAt: schema.eventRound.ingestedAt }).from(schema.eventRound).where(eq(schema.eventRound.eventId, ev.id))).map(
      (r) => [r.id, r.ingestedAt],
    ),
  );
  if (rounds.length) {
    await db
      .insert(schema.eventRound)
      .values(rounds.map(({ pairingsReady: _p, standingsReady: _s, ...r }) => r))
      .onConflictDoUpdate({ target: schema.eventRound.id, set: { status: ex("status"), isFinalRound: ex("is_final_round") } });
  }

  // Standings: só a última rodada de cada fase (a classificação final da fase).
  const lastOfPhase = new Map<number, number>();
  for (const r of rounds) if (r.standingsReady) lastOfPhase.set(r.phaseId, r.id);

  let matchCount = 0;
  let standingCount = 0;
  for (const r of rounds) {
    const done = Boolean(existing.get(r.id)) && r.status === "COMPLETE";
    if (done && !opts.force) continue;

    if (r.pairingsReady) {
      const matches = await fetchAll(client, `tournament-rounds/${r.id}/matches/paginated/`, (d) => page(uvsMatch).parse(d));
      const players = new Map(matches.flatMap((m) => playersFromMatch(m, startsAt)).map((p) => [p.id, p]));
      for (const rows of chunks([...players.values()])) {
        await db
          .insert(schema.player)
          .values(rows)
          .onConflictDoUpdate({ target: schema.player.id, set: { name: ex("name"), countryCode: ex("country_code"), ...nickSet } });
      }
      const rows = matches.map((m) => matchRow(m, r.id, ev.id, resolveTracking));
      // Rodada fechada já entra no resumo pelo status; só a aberta precisa dos detalhes.
      if (r.status !== "COMPLETE") for (const m of rows) fp.update(`|m${m.id}:${m.status}:${m.winnerId}:${m.gamesWinner}:${m.gamesLoser}:${m.isDraw}:${m.tableNumber}`);
      for (const batch of chunks(rows)) {
        await db
          .insert(schema.match)
          .values(batch)
          .onConflictDoUpdate({
            target: schema.match.id,
            set: Object.fromEntries(
              ["status", "legend1", "legend2", "winner_id", "games_winner", "games_loser", "games_drawn", "is_bye", "is_draw", "table_number"].map((c) => [
                c.replace(/_(\w)/g, (_, x: string) => x.toUpperCase()),
                ex(c),
              ]),
            ),
          });
      }
      matchCount += rows.length;
    }

    if (lastOfPhase.get(r.phaseId) === r.id) {
      const standings = await fetchAll(client, `tournament-rounds/${r.id}/standings/paginated/`, (d) => page(uvsStanding).parse(d));
      const players = new Map(standings.map((s) => [s.player.id, playerFromStanding(s, startsAt)]));
      for (const rows of chunks([...players.values()])) {
        await db.insert(schema.player).values(rows).onConflictDoUpdate({ target: schema.player.id, set: { name: ex("name"), ...nickSet } });
      }
      const rows = standings.map((s) => standingRow(s, r.id, ev.id, resolveTracking));
      if (r.status !== "COMPLETE") for (const s of rows) fp.update(`|s${s.playerId}:${s.rank}:${s.points}`);
      for (const batch of chunks(rows)) {
        await db
          .insert(schema.standing)
          .values(batch)
          .onConflictDoUpdate({
            target: [schema.standing.roundId, schema.standing.playerId],
            set: { rank: ex("rank"), wins: ex("wins"), losses: ex("losses"), draws: ex("draws"), points: ex("points"), omw: ex("omw"), gw: ex("gw"), ogw: ex("ogw"), legend: ex("legend") },
          });
      }
      standingCount += rows.length;
    }
    if (r.status === "COMPLETE") {
      await db.update(schema.eventRound).set({ ingestedAt: new Date() }).where(eq(schema.eventRound.id, r.id));
    }
    log(`  rodada ${r.phaseName} #${r.roundNumber} ok`);
  }

  // Metagame pelo set mais novo entre as lendas usadas (ou o valor forçado).
  const counts = await db
    .select({ legend: schema.match.legend1, n: sql<number>`count(*)::int` })
    .from(schema.match)
    .where(sql`${schema.match.eventId} = ${ev.id} and ${schema.match.legend1} is not null`)
    .groupBy(schema.match.legend1);
  const setOf = new Map(legendRefs.map((l) => [l.slug, l.setId]));
  const metagame = opts.metagameOverride ?? detectMetagame(new Map(counts.map((c) => [c.legend!, c.n])), (s) => setOf.get(s));
  await db.update(schema.event).set({ metagame }).where(eq(schema.event.id, ev.id));

  for (const [name, seen] of unknown) {
    await db
      .insert(schema.unknownLegendName)
      .values({ name, seen })
      .onConflictDoUpdate({ target: schema.unknownLegendName.name, set: { seen: sql`${schema.unknownLegendName.seen} + ${seen}` } });
  }

  return { event: ev.name, status: ev.display_status, startsAt: new Date(ev.start_datetime), fingerprint: fp.digest("hex"), metagame, matches: matchCount, standings: standingCount, unknownLegends: [...unknown.keys()] };
}
