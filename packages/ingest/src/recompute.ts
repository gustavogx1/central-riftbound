import { sql } from "drizzle-orm";
import { type Db, schema } from "@cr/db";
import {
  MIN_ENTRIES,
  MIN_PILOT_MATCHES,
  TOP_FRACTION,
  computePower,
  conversionRate,
  pilotScore,
  shrunkConversion,
  shrunkWinRate,
  wilson,
  winRate,
  type Placement,
} from "@cr/core";


interface MatchFact {
  eventId: number;
  metagame: string | null;
  kind: string;
  p1: number | null;
  p2: number | null;
  l1: string | null;
  l2: string | null;
  winner: number | null;
  isDraw: boolean;
}

interface Entry {
  eventId: number;
  metagame: string | null;
  kind: string;
  playerId: number;
  legend: string;
  rank: number;
  fieldSize: number;
}

type Rec = { wins: number; losses: number; draws: number };
const rec = (): Rec => ({ wins: 0, losses: 0, draws: 0 });

export function scopesFor(metagame: string | null, kind: string): string[] {
  const metas = metagame ? [metagame, "all"] : ["all"];
  const kinds = kind === "main" ? ["main", "all"] : ["all"];
  return metas.flatMap((m) => kinds.map((k) => `${m}:${k}`));
}

/** Resultado para o jogador `side` (1 ou 2). Byes não entram. */
function outcome(m: MatchFact, side: 1 | 2): keyof Rec | null {
  const me = side === 1 ? m.p1 : m.p2;
  if (m.isDraw || m.winner === null) return "draws";
  return m.winner === me ? "wins" : "losses";
}

export function aggregate(matches: MatchFact[], entries: Entry[]) {
  type ScopeData = {
    legends: Map<string, Rec>;
    matchups: Map<string, Rec>;
    pilots: Map<string, { legend: string; playerId: number; perEvent: Map<number, Rec>; bestRank: number | null }>;
    entries: Entry[];
  };
  const scopes = new Map<string, ScopeData>();
  const get = (s: string) => {
    let d = scopes.get(s);
    if (!d) scopes.set(s, (d = { legends: new Map(), matchups: new Map(), pilots: new Map(), entries: [] }));
    return d;
  };

  for (const m of matches) {
    if (m.p1 === null || m.p2 === null) continue;
    for (const scope of scopesFor(m.metagame, m.kind)) {
      const d = get(scope);
      for (const side of [1, 2] as const) {
        const legend = side === 1 ? m.l1 : m.l2;
        const opp = side === 1 ? m.l2 : m.l1;
        const player = side === 1 ? m.p1 : m.p2;
        const o = outcome(m, side);
        if (!legend || !o) continue;
        // Pilotos contam todas as partidas; win rate da lenda e matchups excluem espelhos.
        const pk = `${legend}|${player}`;
        const pilot = d.pilots.get(pk) ?? { legend, playerId: player, perEvent: new Map(), bestRank: null };
        const pe = pilot.perEvent.get(m.eventId) ?? rec();
        pe[o]++;
        pilot.perEvent.set(m.eventId, pe);
        d.pilots.set(pk, pilot);
        if (!opp || opp === legend) continue;
        const lr = d.legends.get(legend) ?? rec();
        lr[o]++;
        d.legends.set(legend, lr);
        const mk = `${legend}|${opp}`;
        const mr = d.matchups.get(mk) ?? rec();
        mr[o]++;
        d.matchups.set(mk, mr);
      }
    }
  }

  for (const e of entries) {
    for (const scope of scopesFor(e.metagame, e.kind)) {
      const d = get(scope);
      d.entries.push(e);
      const p = d.pilots.get(`${e.legend}|${e.playerId}`);
      if (p) p.bestRank = p.bestRank === null ? e.rank : Math.min(p.bestRank, e.rank);
    }
  }

  const result = new Map<string, {
    legendRows: (typeof schema.legendStats.$inferInsert)[];
    matchupRows: (typeof schema.matchupStats.$inferInsert)[];
    pilotRows: (typeof schema.pilotStats.$inferInsert)[];
  }>();

  for (const [scope, d] of scopes) {
    const placements: Placement[] = d.entries.map((e) => ({ eventId: String(e.eventId), legend: e.legend, rank: e.rank, fieldSize: e.fieldSize }));
    const conv = conversionRate(placements, TOP_FRACTION);
    const entriesBy = new Map<string, { pilots: number; events: Set<number>; expected: number }>();
    for (const e of d.entries) {
      const s = entriesBy.get(e.legend) ?? { pilots: 0, events: new Set<number>(), expected: 0 };
      s.pilots++;
      s.events.add(e.eventId);
      s.expected += Math.max(1, Math.floor(e.fieldSize * TOP_FRACTION)) / e.fieldSize;
      entriesBy.set(e.legend, s);
    }
    const totalEntries = d.entries.length;
    const eligible = [...entriesBy.entries()].filter(([, s]) => s.pilots >= MIN_ENTRIES).map(([l]) => l);

    const base = eligible.map((legend) => {
      const r = d.legends.get(legend) ?? rec();
      const s = entriesBy.get(legend)!;
      const c = conv.get(legend) ?? { hits: 0 };
      return {
        legend,
        r,
        s,
        hits: c.hits,
        shrunkWr: shrunkWinRate(r),
        shrunkConv: shrunkConversion(c.hits, s.expected, 20, TOP_FRACTION),
      };
    });
    const power = computePower(base.map((b) => ({ id: b.legend, shrunkWinRate: b.shrunkWr, conversion: b.shrunkConv })));

    const legendRows = base.map((b) => {
      const n = b.r.wins + b.r.losses;
      const w = wilson(b.r.wins, n);
      const p = power.get(b.legend)!;
      return {
        scope,
        legend: b.legend,
        pilots: b.s.pilots,
        events: b.s.events.size,
        ...b.r,
        share: totalEntries ? b.s.pilots / totalEntries : 0,
        winRate: winRate(b.r),
        wilsonLow: n ? w.low : null,
        wilsonHigh: n ? w.high : null,
        shrunkWinRate: b.shrunkWr,
        conversion: b.shrunkConv,
        topCutHits: b.hits,
        power: p.power,
        tier: p.tier,
      };
    });

    const eligibleSet = new Set(eligible);
    const matchupRows = [...d.matchups.entries()]
      .map(([k, r]) => {
        const [legend, opponent] = k.split("|") as [string, string];
        return { scope, legend, opponent, ...r };
      })
      .filter((r) => eligibleSet.has(r.legend) && eligibleSet.has(r.opponent));

    const pilotRows = [...d.pilots.values()]
      .map((p) => {
        const perEvent = [...p.perEvent.values()];
        const tot = perEvent.reduce((a, e) => ({ wins: a.wins + e.wins, losses: a.losses + e.losses, draws: a.draws + e.draws }), rec());
        return {
          scope,
          legend: p.legend,
          playerId: p.playerId,
          events: perEvent.length,
          ...tot,
          bestRank: p.bestRank,
          score: pilotScore(perEvent),
        };
      })
      .filter((p) => p.wins + p.losses >= MIN_PILOT_MATCHES && eligibleSet.has(p.legend));

    result.set(scope, { legendRows, matchupRows, pilotRows });
  }
  return result;
}

export async function recomputeStats(db: Db, log: (m: string) => void = () => {}) {
  const matches = (await db.execute(sql`
    select m.event_id as "eventId", e.metagame, e.kind, m.player1_id as p1, m.player2_id as p2,
           m.legend1 as l1, m.legend2 as l2, m.winner_id as winner, m.is_draw as "isDraw"
    from match m join event e on e.id = m.event_id
    where not m.is_bye and m.status = 'COMPLETE'
  `)) as unknown as MatchFact[];

  // Classificação final da primeira fase (suíço): todos os jogadores estão nela.
  const entries = (await db.execute(sql`
    with first_phase as (
      select distinct on (event_id) event_id, phase_id
      from event_round order by event_id, phase_order
    ), final_round as (
      select r.event_id, max(r.id) as round_id
      from event_round r join first_phase f on f.phase_id = r.phase_id
      where exists (select 1 from standing s where s.round_id = r.id)
      group by r.event_id
    )
    select s.event_id as "eventId", e.metagame, e.kind, s.player_id as "playerId", s.legend, s.rank,
           count(*) over (partition by s.round_id)::int as "fieldSize"
    from standing s
    join final_round fr on fr.round_id = s.round_id
    join event e on e.id = s.event_id
    where s.legend is not null
  `)) as unknown as Entry[];

  log(`${matches.length} partidas, ${entries.length} entradas`);
  const result = aggregate(matches, entries);
  const takenAt = new Date();

  await db.transaction(async (tx) => {
    await tx.delete(schema.legendStats);
    await tx.delete(schema.matchupStats);
    await tx.delete(schema.pilotStats);
    for (const [scope, r] of result) {
      for (let i = 0; i < r.legendRows.length; i += 500) await tx.insert(schema.legendStats).values(r.legendRows.slice(i, i + 500));
      for (let i = 0; i < r.matchupRows.length; i += 500) await tx.insert(schema.matchupStats).values(r.matchupRows.slice(i, i + 500));
      for (let i = 0; i < r.pilotRows.length; i += 500) await tx.insert(schema.pilotStats).values(r.pilotRows.slice(i, i + 500));
      if (r.legendRows.length) {
        await tx.insert(schema.powerSnapshot).values(r.legendRows.map((l) => ({ scope, legend: l.legend, takenAt, power: l.power, tier: l.tier })));
      }
      log(`  ${scope}: ${r.legendRows.length} lendas, ${r.matchupRows.length} matchups, ${r.pilotRows.length} pilotos`);
    }
  });
  return result;
}
