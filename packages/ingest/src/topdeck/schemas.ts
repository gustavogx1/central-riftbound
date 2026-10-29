import { z } from "zod";

/** Só os campos que usamos; o resto da resposta é ignorado. */
export const tdBulkTournament = z.object({
  TID: z.string(),
  tournamentName: z.string(),
  startDate: z.number(),
  game: z.string().optional(),
  format: z.string().optional(),
  swissNum: z.number().nullish(),
  topCut: z.number().nullish(),
  eventData: z.object({ city: z.string().nullish(), state: z.string().nullish(), address: z.string().nullish() }).partial().nullish(),
  standings: z.array(z.unknown()).default([]),
});
export type TdBulkTournament = z.infer<typeof tdBulkTournament>;
export const tdBulk = z.array(tdBulkTournament);

export const tdStanding = z.object({
  standing: z.number(),
  name: z.string(),
  id: z.string().nullish(),
  points: z.number().nullish(),
  winRate: z.number().nullish(),
  opponentWinRate: z.number().nullish(),
  leader: z.string().nullish(),
  decklist: z.string().nullish(),
  deckObj: z.record(z.string(), z.unknown()).nullish(),
});
export type TdStanding = z.infer<typeof tdStanding>;
export const tdStandings = z.array(tdStanding);

export const tdTablePlayer = z.object({ name: z.string(), id: z.string().nullish(), leader: z.string().nullish() });
export const tdTable = z.object({
  table: z.union([z.number(), z.string()]),
  players: z.array(tdTablePlayer).default([]),
  winner: z.string().nullish(),
  winner_id: z.string().nullish(),
  winner_games: z.number().nullish(),
  loser_games: z.number().nullish(),
  status: z.string(),
});
export type TdTable = z.infer<typeof tdTable>;
export const tdRound = z.object({ round: z.union([z.number(), z.string()]), tables: z.array(tdTable).default([]) });
export type TdRound = z.infer<typeof tdRound>;
export const tdRounds = z.array(tdRound);
