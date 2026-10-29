import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { COMPLEXITY_MAX, COMPLEXITY_MIN, complexityScore } from "@cr/core";
import { schema } from "@cr/db";
import { getDb } from "./db";
import { METAGAMES } from "./queries";

/** Vota (ou apaga o voto, com null) na complexidade de uma lenda num set. */
export async function castComplexityVote(userId: string, legend: string, metagame: string, value: number | null): Promise<boolean> {
  const db = getDb();
  if (!db || !(METAGAMES as readonly string[]).includes(metagame)) return false;
  const [exists] = await db.select({ slug: schema.legend.slug }).from(schema.legend).where(eq(schema.legend.slug, legend)).limit(1);
  if (!exists) return false;
  const key = and(eq(schema.complexityVote.userId, userId), eq(schema.complexityVote.legend, legend), eq(schema.complexityVote.metagame, metagame));
  if (value === null) {
    await db.delete(schema.complexityVote).where(key);
    return true;
  }
  if (!Number.isInteger(value) || value < COMPLEXITY_MIN || value > COMPLEXITY_MAX) return false;
  await db
    .insert(schema.complexityVote)
    .values({ userId, legend, metagame, value })
    .onConflictDoUpdate({ target: [schema.complexityVote.userId, schema.complexityVote.legend, schema.complexityVote.metagame], set: { value, updatedAt: new Date() } });
  return true;
}

export interface ComplexityRow {
  legend: string;
  votes: number;
  average: number;
  /** Média puxada para o meio com poucos votos; null abaixo do mínimo para aparecer no gráfico. */
  score: number | null;
}

/** Complexidade de todas as lendas de um set. */
export async function getComplexity(metagame: string): Promise<Map<string, ComplexityRow>> {
  const db = getDb();
  if (!db) return new Map();
  const rows = await db
    .select({ legend: schema.complexityVote.legend, votes: sql<number>`count(*)::int`, sum: sql<number>`sum(${schema.complexityVote.value})::int` })
    .from(schema.complexityVote)
    .where(eq(schema.complexityVote.metagame, metagame))
    .groupBy(schema.complexityVote.legend);
  return new Map(rows.map((r) => [r.legend, { legend: r.legend, votes: r.votes, average: r.sum / r.votes, score: complexityScore(r.sum, r.votes) }]));
}

export async function getMyVote(userId: string, legend: string, metagame: string): Promise<number | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select({ value: schema.complexityVote.value })
    .from(schema.complexityVote)
    .where(and(eq(schema.complexityVote.userId, userId), eq(schema.complexityVote.legend, legend), eq(schema.complexityVote.metagame, metagame)))
    .limit(1);
  return row?.value ?? null;
}
