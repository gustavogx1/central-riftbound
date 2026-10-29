import type { EventKind } from "@cr/db";
import type { UvsEvent, UvsMatch, UvsStanding } from "./uvs/schemas";

/** Sets na ordem de lançamento. OGS (Proving Grounds) saiu junto com Origins. */
export const SET_ORDER = ["OGS", "OGN", "SFD", "UNL", "VEN", "RAD"] as const;

export interface LegendRef {
  slug: string;
  champion: string;
  title: string;
  setId: string;
}

function key(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Casa "Nasus, Curator of the Sands" (UVS) com a lenda do catálogo. */
export function createLegendResolver(legends: LegendRef[]) {
  const byFull = new Map<string, string>();
  const byTitle = new Map<string, string[]>();
  for (const l of legends) {
    byFull.set(key(`${l.champion} ${l.title}`), l.slug);
    byTitle.set(key(l.title), [...(byTitle.get(key(l.title)) ?? []), l.slug]);
  }
  return (uvsName: string | null | undefined): string | null => {
    if (!uvsName) return null;
    const full = byFull.get(key(uvsName));
    if (full) return full;
    // Alguns nomes vêm só com o título; usa se não for ambíguo.
    const title = uvsName.includes(",") ? uvsName.split(",").slice(1).join(",") : uvsName;
    const candidates = byTitle.get(key(title)) ?? [];
    return candidates.length === 1 ? candidates[0]! : null;
  };
}

export type LegendResolver = ReturnType<typeof createLegendResolver>;

export function eventRow(e: UvsEvent, kind: EventKind, metagame: string | null) {
  return {
    id: e.id,
    name: e.name,
    kind,
    startsAt: new Date(e.start_datetime),
    timezone: e.timezone,
    address: e.full_address ?? null,
    playerCount: e.starting_player_count ?? 0,
    status: e.display_status,
    metagame,
    timerEndsAt: e.timer_end_datetime ? new Date(e.timer_end_datetime) : null,
    timerPausedAt: e.timer_paused_at_datetime ? new Date(e.timer_paused_at_datetime) : null,
    timerRunning: e.timer_is_running ?? false,
    plannedRounds: e.number_of_rounds ?? null,
    topCutSize: e.top_cut_size ?? null,
    fetchedAt: new Date(),
  };
}

export function roundRows(e: UvsEvent) {
  const phases = [...e.tournament_phases].sort((a, b) => a.order_in_phases - b.order_in_phases);
  return phases.flatMap((p) =>
    p.rounds.map((r) => ({
      id: r.id,
      eventId: e.id,
      phaseId: p.id,
      phaseName: p.phase_name,
      phaseOrder: p.order_in_phases,
      phaseType: p.round_type,
      roundNumber: r.round_number,
      status: r.status,
      isFinalRound: r.final_round_in_event,
      pairingsReady: r.pairings_status === "GENERATED",
      standingsReady: r.standings_status === "GENERATED",
    })),
  );
}

export function matchRow(m: UvsMatch, roundId: number, eventId: number, resolve: LegendResolver) {
  const rel = [...m.player_match_relationships].sort((a, b) => (a.player_order ?? 99) - (b.player_order ?? 99));
  const p1 = rel[0];
  const p2 = rel[1];
  return {
    id: m.id,
    roundId,
    eventId,
    tableNumber: m.table_number,
    status: m.status,
    player1Id: p1?.player.id ?? null,
    player2Id: p2?.player.id ?? null,
    legend1: resolve(p1?.user_event_status?.deck_defining_card?.name),
    legend2: resolve(p2?.user_event_status?.deck_defining_card?.name),
    winnerId: m.winning_player,
    gamesWinner: m.games_won_by_winner ?? 0,
    gamesLoser: m.games_won_by_loser ?? 0,
    gamesDrawn: m.games_drawn ?? 0,
    isBye: m.match_is_bye || rel.length < 2,
    isDraw: m.match_is_intentional_draw || m.match_is_unintentional_draw,
  };
}

/** Nick da inscrição; vazio ou igual ao nome conta como sem nick. */
export function nickOf(name: string, uvsNick: string | null | undefined): string | null {
  const nick = uvsNick?.trim();
  return nick && nick !== name.trim() ? nick : null;
}

export function playersFromMatch(m: UvsMatch, eventStart: Date) {
  return m.player_match_relationships.map((r) => {
    const nick = nickOf(r.player.best_identifier, r.user_event_status?.best_identifier);
    return {
      id: r.player.id,
      name: r.player.best_identifier,
      nick,
      nickAt: nick ? eventStart : null,
      countryCode: r.player.country_code ?? null,
    };
  });
}

export function playerFromStanding(s: UvsStanding, eventStart: Date) {
  const nick = nickOf(s.player.best_identifier, s.user_event_status?.best_identifier);
  return { id: s.player.id, name: s.player.best_identifier, nick, nickAt: nick ? eventStart : null };
}

/** "5-1-0" → vitórias, derrotas, empates. */
export function parseRecord(record: string): { wins: number; losses: number; draws: number } {
  const [w = 0, l = 0, d = 0] = record.split("-").map((n) => Number.parseInt(n, 10) || 0);
  return { wins: w, losses: l, draws: d };
}

export function standingRow(s: UvsStanding, roundId: number, eventId: number, resolve: LegendResolver) {
  return {
    roundId,
    eventId,
    playerId: s.player.id,
    rank: s.rank,
    ...parseRecord(s.match_record),
    points: s.match_points,
    omw: s.opponent_match_win_percentage,
    gw: s.game_win_percentage,
    ogw: s.opponent_game_win_percentage,
    legend: resolve(s.user_event_status?.deck_defining_card?.name),
  };
}

/**
 * Metagame do evento = set mais novo entre as lendas usadas por pelo menos
 * `minShare` dos jogadores (filtra erro de cadastro de um ou outro jogador).
 */
export function detectMetagame(legendCounts: Map<string, number>, setOf: (slug: string) => string | undefined, minShare = 0.01): string | null {
  const total = [...legendCounts.values()].reduce((a, b) => a + b, 0);
  let best = -1;
  for (const [slug, count] of legendCounts) {
    if (total === 0 || count / total < minShare) continue;
    const idx = SET_ORDER.indexOf((setOf(slug) ?? "") as (typeof SET_ORDER)[number]);
    if (idx > best) best = idx;
  }
  return best === -1 ? null : SET_ORDER[best]!;
}
