import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { decodeDeck, emptyDeck, encodeDeck, validateDeck, type DeckFormat, type DeckList, type PoolCard } from "@cr/core";
import { schema } from "@cr/db";
import { getDb } from "./db";
import { getCardPool } from "./queries";

export type Visibility = "private" | "unlisted" | "public";
export const VISIBILITIES: Visibility[] = ["private", "unlisted", "public"];
/** Limites para ninguém lotar o banco grátis (500 MB). */
export const MAX_DECKS_PER_USER = 200;
export const MAX_NAME = 80;
export const MAX_DESCRIPTION = 2000;

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
export function newDeckId(): string {
  return [...randomBytes(10)].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

export async function poolMap(): Promise<Map<string, PoolCard>> {
  return new Map((await getCardPool()).map((c) => [c.id, c]));
}

export interface DeckInput {
  id?: string | null;
  name: string;
  code: string;
  format: DeckFormat;
  visibility: Visibility;
  description?: string;
}

export type SaveResult = { ok: true; id: string } | { ok: false; error: "login" | "invalid" | "limit" | "notFound" | "unavailable" };

/** Grava (ou atualiza) um deck do usuário. O código é relido aqui: o servidor não confia no navegador. */
export async function saveUserDeck(userId: string, input: DeckInput): Promise<SaveResult> {
  const db = getDb();
  if (!db) return { ok: false, error: "unavailable" };
  const pool = await poolMap();
  let deck: DeckList;
  try {
    deck = input.code ? decodeDeck(input.code, pool).deck : emptyDeck();
  } catch {
    return { ok: false, error: "invalid" };
  }
  const code = encodeDeck(deck, pool);
  if (!code) return { ok: false, error: "invalid" };
  const format: DeckFormat = input.format === "casual" ? "casual" : "constructed";
  const values = {
    name: input.name.trim().slice(0, MAX_NAME) || "Deck",
    code,
    format,
    legendCardId: deck.legend,
    legal: validateDeck(deck, pool, format).every((i) => i.severity !== "error"),
    visibility: VISIBILITIES.includes(input.visibility) ? input.visibility : "private",
    updatedAt: new Date(),
    // Sem descrição no pedido (o deckbuilder não edita), a atual fica como está.
    ...(input.description !== undefined ? { description: input.description.trim().slice(0, MAX_DESCRIPTION) } : {}),
  };
  if (input.id) {
    const updated = await db
      .update(schema.userDeck)
      .set(values)
      .where(and(eq(schema.userDeck.id, input.id), eq(schema.userDeck.userId, userId)))
      .returning({ id: schema.userDeck.id });
    if (updated.length) return { ok: true, id: updated[0]!.id };
    return { ok: false, error: "notFound" };
  }
  const [count] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.userDeck).where(eq(schema.userDeck.userId, userId));
  if ((count?.n ?? 0) >= MAX_DECKS_PER_USER) return { ok: false, error: "limit" };
  const id = newDeckId();
  await db.insert(schema.userDeck).values({ id, userId, ...values });
  return { ok: true, id };
}

export async function deleteUserDeck(userId: string, id: string) {
  const db = getDb();
  if (!db) return;
  await db.delete(schema.userDeck).where(and(eq(schema.userDeck.id, id), eq(schema.userDeck.userId, userId)));
}

const deckColumns = {
  id: schema.userDeck.id,
  userId: schema.userDeck.userId,
  name: schema.userDeck.name,
  code: schema.userDeck.code,
  format: schema.userDeck.format,
  legal: schema.userDeck.legal,
  visibility: schema.userDeck.visibility,
  description: schema.userDeck.description,
  legendCardId: schema.userDeck.legendCardId,
  updatedAt: schema.userDeck.updatedAt,
  createdAt: schema.userDeck.createdAt,
  author: schema.profile.displayName,
};


/** Um deck. Privado só aparece para o dono. */
export async function getUserDeck(id: string, viewerId: string | null) {
  const db = getDb();
  if (!db) return null;
  const [row] = await db.select(deckColumns).from(schema.userDeck).innerJoin(schema.profile, eq(schema.profile.userId, schema.userDeck.userId)).where(eq(schema.userDeck.id, id)).limit(1);
  if (!row) return null;
  if (row.visibility === "private" && row.userId !== viewerId) return null;
  return row;
}

export async function listMyDecks(userId: string) {
  const db = getDb();
  if (!db) return [];
  return db.select(deckColumns).from(schema.userDeck).innerJoin(schema.profile, eq(schema.profile.userId, schema.userDeck.userId)).where(eq(schema.userDeck.userId, userId)).orderBy(desc(schema.userDeck.updatedAt));
}

/** Biblioteca pública: só decks públicos e válidos, mais novos primeiro. */
export async function listPublicDecks(opts: { legendCardId?: string; page: number; pageSize: number }) {
  const db = getDb();
  if (!db) return { rows: [], total: 0 };
  const where = and(eq(schema.userDeck.visibility, "public"), eq(schema.userDeck.legal, true), opts.legendCardId ? eq(schema.userDeck.legendCardId, opts.legendCardId) : undefined);
  const [count] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.userDeck).where(where);
  const rows = await db
    .select(deckColumns)
    .from(schema.userDeck)
    .innerJoin(schema.profile, eq(schema.profile.userId, schema.userDeck.userId))
    .where(where)
    .orderBy(desc(schema.userDeck.updatedAt))
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize);
  return { rows, total: count?.n ?? 0 };
}
