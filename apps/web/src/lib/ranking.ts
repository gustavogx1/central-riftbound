import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "drizzle-orm";
import { rankPlayers, type RankedPlayer, type RankingResult } from "@cr/core";
import { getDb } from "./db";
import { METAGAMES } from "./queries";

/** "12m" = últimos 12 meses; um código de set = só aquele metagame; "all" = desde sempre. */
export type RankingPeriod = "12m" | "all" | (typeof METAGAMES)[number];
export const RANKING_PERIODS: RankingPeriod[] = ["12m", ...METAGAMES, "all"];

export function parsePeriod(v: unknown): RankingPeriod {
  return RANKING_PERIODS.includes(v as RankingPeriod) ? (v as RankingPeriod) : "12m";
}

interface RankingEvent {
  id: number;
  kind: string;
  name: string;
  players: number;
  startsAt: string;
  metagame: string | null;
}

/** Formato compacto para caber no cache: resultados como [jogador, evento, posição]. */
interface RankingBase {
  events: RankingEvent[];
  players: [id: number, name: string, country: string | null][];
  results: [playerId: number, eventId: number, rank: number][];
}

/**
 * Posições finais que podem pontuar (primeiro quarto, mínimo top 8) em todos os
 * eventos encerrados. Classificação final = última rodada com standings.
 */
const loadBase = unstable_cache(
  async (): Promise<RankingBase> => {
    const db = getDb();
    if (!db) return { events: [], players: [], results: [] };
    const rows = (await db.execute(sql`
      with fr as (
        select distinct on (r.event_id) r.event_id, r.id as round_id
        from event_round r join event e on e.id = r.event_id and e.status = 'complete'
        where r.id in (select distinct round_id from standing)
        order by r.event_id, r.phase_order desc, r.round_number desc
      )
      select s.player_id as "playerId", s.rank, e.id as "eventId", e.kind, e.name as "eventName", e.player_count as "players",
        e.starts_at as "startsAt", e.metagame, coalesce(p.nick, p.name) as "playerName", p.country_code as country
      from fr join standing s on s.round_id = fr.round_id
      join event e on e.id = fr.event_id
      join player p on p.id = s.player_id and not p.hidden
      where s.rank >= 1 and s.rank <= greatest(8, ceil(e.player_count / 4.0))
    `)) as unknown as {
      playerId: number; rank: number; eventId: number; kind: string; eventName: string; players: number;
      startsAt: string | Date; metagame: string | null; playerName: string; country: string | null;
    }[];
    const events = new Map<number, RankingEvent>();
    const players = new Map<number, [number, string, string | null]>();
    for (const r of rows) {
      if (!events.has(r.eventId)) {
        events.set(r.eventId, { id: r.eventId, kind: r.kind, name: r.eventName, players: r.players, startsAt: new Date(r.startsAt).toISOString(), metagame: r.metagame });
      }
      if (!players.has(r.playerId)) players.set(r.playerId, [r.playerId, r.playerName, r.country]);
    }
    return { events: [...events.values()], players: [...players.values()], results: rows.map((r) => [r.playerId, r.eventId, r.rank]) };
  },
  ["player-ranking-base"],
  { revalidate: 3600 },
);

export interface RankingRow extends RankedPlayer {
  name: string;
  country: string | null;
}

export interface Ranking {
  rows: RankingRow[];
  /** Países com jogador pontuando no período, do mais comum ao menos. */
  countries: { code: string; players: number }[];
  events: number;
}

const YEAR_MS = 365 * 24 * 3600 * 1000;

/** Ranking do período, opcionalmente só com jogadores de um país. */
export async function getRanking(period: RankingPeriod, country?: string): Promise<Ranking> {
  let base: RankingBase;
  try {
    base = await loadBase();
  } catch (err) {
    console.error("ranking indisponível", err);
    return { rows: [], countries: [], events: 0 };
  }
  const since = Date.now() - YEAR_MS;
  const inPeriod = new Map(
    base.events
      .filter((e) => (period === "all" ? true : period === "12m" ? new Date(e.startsAt).getTime() >= since : e.metagame === period))
      .map((e) => [e.id, e]),
  );
  const info = new Map(base.players.map(([id, name, c]) => [id, { name, country: c }]));
  const results: RankingResult[] = [];
  for (const [playerId, eventId, rank] of base.results) {
    const e = inPeriod.get(eventId);
    if (e) results.push({ playerId, eventId, kind: e.kind, eventName: e.name, players: e.players, rank });
  }
  const ranked = rankPlayers(results);

  const countryCount = new Map<string, number>();
  for (const p of ranked) {
    const c = info.get(p.playerId)?.country;
    if (c) countryCount.set(c, (countryCount.get(c) ?? 0) + 1);
  }
  const countries = [...countryCount].map(([code, players]) => ({ code, players })).sort((a, b) => b.players - a.players || a.code.localeCompare(b.code));

  // No filtro por país a posição é recontada só entre os jogadores daquele país.
  const filtered = country ? rankPlayers(results.filter((r) => info.get(r.playerId)?.country === country)) : ranked;
  return {
    rows: filtered.map((p) => ({ ...p, ...(info.get(p.playerId) ?? { name: String(p.playerId), country: null }) })),
    countries,
    events: new Set(results.map((r) => r.eventId)).size,
  };
}

/** Posição do jogador no ranking dos últimos 12 meses (null se não pontuou). */
export async function getPlayerRanking(playerId: number) {
  const { rows } = await getRanking("12m");
  const row = rows.find((r) => r.playerId === playerId);
  return row ? { position: row.position, points: row.points, of: rows.length } : null;
}
