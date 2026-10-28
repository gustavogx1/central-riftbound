import { z } from "zod";

/**
 * Só os campos que usamos. Se a UVS mudar o formato, a validação falha com
 * uma mensagem clara em vez de gravar dado errado (teste de contrato).
 */
const deckDefiningCard = z.object({ name: z.string() }).nullable().optional();

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
      user_event_status: z.object({ deck_defining_card: deckDefiningCard }).nullable(),
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
  user_event_status: z.object({ deck_defining_card: deckDefiningCard }).nullable(),
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
