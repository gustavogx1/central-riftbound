/**
 * Reprodução de um evento gravado (pnpm record) como se estivesse acontecendo,
 * para testar o ao vivo sem esperar um campeonato. Cada rodada passa por quatro
 * passos: pairings saem, metade dos resultados, todos os resultados, rodada fechada.
 * Os dados são os gravados; o simulador só esconde o que ainda "não aconteceu".
 */
import type { UvsEvent } from "./uvs/schemas";

/** Formato do arquivo gravado: respostas da UVS como vieram, por rodada. */
export interface Recording {
  event: UvsEvent & Record<string, unknown>;
  rounds: Record<string, { matches: RawMatch[]; standings: unknown[] }>;
}

type RawMatch = Record<string, unknown> & {
  id: number;
  table_number: number | null;
  status: string;
  match_is_bye: boolean;
};

export const STEPS_PER_ROUND = 4;
const ROUND_MINUTES = 50;

export interface ReplayState {
  event: Record<string, unknown>;
  matches: Map<number, RawMatch[]>;
  standings: Map<number, unknown[]>;
  finished: boolean;
}

function orderedRounds(ev: UvsEvent) {
  return [...ev.tournament_phases]
    .sort((a, b) => a.order_in_phases - b.order_in_phases)
    .flatMap((p) => [...p.rounds].sort((a, b) => a.round_number - b.round_number).map((r) => ({ phaseId: p.id, id: r.id })));
}

export function totalSteps(rec: Recording) {
  return orderedRounds(rec.event).length * STEPS_PER_ROUND;
}

function unreported(m: RawMatch): RawMatch {
  return {
    ...m,
    status: "IN_PROGRESS",
    winning_player: null,
    games_won_by_winner: null,
    games_won_by_loser: null,
    games_drawn: null,
    match_is_intentional_draw: false,
    match_is_unintentional_draw: false,
  };
}

/** `stepStartedAt` = quando o passo começou; o relógio da rodada parte dele. */
export function replayState(rec: Recording, step: number, stepStartedAt = new Date()): ReplayState {
  const now = stepStartedAt;
  const order = orderedRounds(rec.event);
  const finished = step >= order.length * STEPS_PER_ROUND;
  const current = finished ? order.length : Math.floor(Math.max(0, step) / STEPS_PER_ROUND);
  const sub = finished ? STEPS_PER_ROUND - 1 : Math.max(0, step) % STEPS_PER_ROUND;
  const visible = new Set(order.slice(0, current + 1).map((r) => r.id));
  const index = new Map(order.map((r, i) => [r.id, i]));

  const matches = new Map<number, RawMatch[]>();
  const standings = new Map<number, unknown[]>();
  for (const [i, r] of order.entries()) {
    if (i > current) break;
    const data = rec.rounds[String(r.id)] ?? { matches: [], standings: [] };
    if (i < current || sub >= 2) {
      matches.set(r.id, data.matches);
      standings.set(r.id, data.standings);
      continue;
    }
    // Rodada atual antes de todos reportarem: byes já valem; o resto vai saindo por mesa.
    const playable = data.matches.filter((m) => !m.match_is_bye).sort((a, b) => (a.table_number ?? 0) - (b.table_number ?? 0));
    const reported = new Set(playable.slice(0, sub === 1 ? Math.floor(playable.length / 2) : 0).map((m) => m.id));
    matches.set(r.id, data.matches.map((m) => (m.match_is_bye || reported.has(m.id) ? m : unreported(m))));
    // Standings da rodada anterior da mesma fase até os resultados entrarem.
    const prev = order[i - 1];
    if (prev && prev.phaseId === r.phaseId) standings.set(r.id, rec.rounds[String(prev.id)]?.standings ?? []);
  }

  const timerEnd = new Date(now.getTime() + (sub === 0 ? ROUND_MINUTES : ROUND_MINUTES / 2) * 60_000);
  const event = {
    ...rec.event,
    display_status: finished ? "complete" : "inProgress",
    timer_end_datetime: finished ? null : timerEnd.toISOString(),
    timer_paused_at_datetime: !finished && sub >= 2 ? now.toISOString() : null,
    timer_is_running: !finished && sub < 2,
    tournament_phases: rec.event.tournament_phases.map((p) => ({
      ...p,
      rounds: p.rounds
        .filter((r) => visible.has(r.id))
        .map((r) => {
          const i = index.get(r.id)!;
          const isCurrent = i === current && !finished;
          return {
            ...r,
            status: isCurrent && sub < 3 ? "IN_PROGRESS" : "COMPLETE",
            pairings_status: "GENERATED",
            standings_status: standings.has(r.id) && standings.get(r.id)!.length ? "GENERATED" : null,
          };
        }),
    })),
  };
  return { event, matches, standings, finished };
}

/** Uma página no formato paginado da UVS (`next` = número da próxima página). */
export function paginate<T>(rows: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return { count: rows.length, next: start + pageSize < rows.length ? page + 1 : null, results: rows.slice(start, start + pageSize) };
}
