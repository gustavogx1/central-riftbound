"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { schema } from "@cr/db";
import { getSessionUser } from "./auth/server";
import { safeNext } from "./auth/next";
import { getDb } from "./db";
import { deleteUserDeck, MAX_DESCRIPTION, saveUserDeck, type DeckInput, type SaveResult } from "./decks";
import { castComplexityVote } from "./votes";

export async function saveDeckAction(input: DeckInput): Promise<SaveResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "login" };
  const res = await saveUserDeck(user.id, input);
  if (res.ok) revalidatePath(`/[locale]/decks/${res.id}`, "page");
  return res;
}

export async function deleteDeckAction(form: FormData) {
  const user = await getSessionUser();
  const next = safeNext(String(form.get("next") ?? "/"));
  if (user) await deleteUserDeck(user.id, String(form.get("id") ?? ""));
  redirect(next);
}

export async function renameAction(form: FormData) {
  const user = await getSessionUser();
  const name = String(form.get("name") ?? "").trim().slice(0, 40);
  const next = safeNext(String(form.get("next") ?? "/"));
  const db = getDb();
  if (user && db && name) await db.update(schema.profile).set({ displayName: name }).where(eq(schema.profile.userId, user.id));
  redirect(next);
}

export async function voteAction(input: { legend: string; metagame: string; value: number | null }): Promise<{ ok: boolean; error?: "login" }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "login" };
  const ok = await castComplexityVote(user.id, input.legend, input.metagame, input.value);
  return { ok };
}

export async function describeDeckAction(form: FormData) {
  const user = await getSessionUser();
  const next = safeNext(String(form.get("next") ?? "/"));
  const db = getDb();
  if (user && db) {
    const description = String(form.get("description") ?? "").trim().slice(0, MAX_DESCRIPTION);
    await db
      .update(schema.userDeck)
      .set({ description, updatedAt: new Date() })
      .where(and(eq(schema.userDeck.id, String(form.get("id") ?? "")), eq(schema.userDeck.userId, user.id)));
  }
  redirect(next);
}
