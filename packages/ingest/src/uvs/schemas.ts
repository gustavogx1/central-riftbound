import { z } from "zod";

/**
 * Só os campos que usamos. Se a UVS mudar o formato, a validação falha com
 * uma mensagem clara em vez de gravar dado errado (teste de contrato).
 */
const deckDefiningCard = z.object({ name: z.string() }).nullable().optional();
/** Inscrição do jogador no evento; `best_identifier` aqui é o nick que ele usou. */
const userEventStatus = z
  .object({ deck_defining_card: deckDefiningCard, best_identifier: z.string().nullable().optional() })
  .nullable();

export const uvsEvent = z.object({
  id: z.number(),
  name: z.string(),
  start_datetime: z.string(),
  timezone: z.string().nullable(),
  full_address: z.string().nullable().optional(),
  starting_player_count: z.number().nullable(),
  display_status: z.string(),
  timer_end_datetime: z.string().nullable().optional(),
  timer_paused_at_datetime: z.string().nullable().optional(),
  timer_is_running: z.boolean().nullable().optional(),
  number_of_rounds: z.number().nullable().optional(),
  top_cut_size: z.number().nullable().optional(),
  gameplay_format: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
  settings: z
    .object({
      round_duration_in_minutes: z.number().nullable().optional(),
      maximum_number_of_game_wins_per_match: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
  store: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
  tournament_phases: z.array(
    z.object({
      id: z.number(),
      phase_name: z.string(),
      order_in_phases: z.number(),
      round_type: z.string(),
      rounds: z.array(
        z.object({
          id: z.number(),
          round_number: z.number(),
          final_round_in_event: z.boolean(),
          pairings_status: z.string().nullable(),
          standings_status: z.string().nullable(),
          status: z.string(),
        }),
      ),
    }),
  ),
});
export type UvsEvent = z.infer<typeof uvsEvent>;

const playerRef = z.object({
  id: z.number(),
  best_identifier: z.string(),
  country_code: z.string().nullable().optional(),
});

export const uvsMatch = z.object({
  id: z.number(),
  table_number: z.number().nullable(),
  status: z.string(),
  match_is_bye: z.boolean(),
  match_is_intentional_draw: z.boolean(),
  match_is_unintentional_draw: z.boolean(),
  games_won_by_winner: z.number().nullable(),
  games_won_by_loser: z.number().nullable(),
  games_drawn: z.number().nullable(),
  winning_player: z.number().nullable(),
  player_match_relationships: z.array(
    z.object({
      player_order: z.number().nullable(),
      player: playerRef,
      user_event_status: userEventStatus,
    }),
  ),
});
export type UvsMatch = z.infer<typeof uvsMatch>;

export const uvsStanding = z.object({
  rank: z.number(),
  player: z.object({ id: z.number(), best_identifier: z.string() }),
  match_record: z.string(),
  match_points: z.number(),
  opponent_match_win_percentage: z.number().nullable(),
  game_win_percentage: z.number().nullable(),
  opponent_game_win_percentage: z.number().nullable(),
  user_event_status: userEventStatus,
});
export type UvsStanding = z.infer<typeof uvsStanding>;

export function page<T extends z.ZodType>(item: T) {
  return z.object({
    count: z.number(),
    next: z.number().nullable(),
    results: z.array(item),
  });
}

export const uvsEventList = page(
  z.object({
    id: z.number(),
    name: z.string(),
    start_datetime: z.string(),
    starting_player_count: z.number().nullable(),
    display_status: z.string(),
  }),
);

/** Resultado da busca por nome, com o que a descoberta de Showdowns precisa. */
export const uvsEventSearch = page(
  z.object({
    id: z.number(),
    name: z.string(),
    // Eventos sem data ("open play" sem agenda) vêm com null.
    start_datetime: z.string().nullable(),
    starting_player_count: z.number().nullable(),
    registered_user_count: z.number().nullable().optional(),
    capacity: z.number().nullable().optional(),
    display_status: z.string(),
    game_type: z.string().nullable().optional(),
    is_test_event: z.boolean().nullable().optional(),
    gameplay_format: z.object({ name: z.string() }).nullable().optional(),
  }),
);
export type UvsEventSummary = z.infer<typeof uvsEventSearch>["results"][number];
