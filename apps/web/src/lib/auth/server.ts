import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { schema } from "@cr/db";
import { getDb } from "../db";
import { authEnabled, SUPABASE_KEY, SUPABASE_URL } from "./config";

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Chamado de um Server Component: o proxy renova a sessão na próxima requisição.
        }
      },
    },
  });
}

export interface SessionUser {
  id: string;
  name: string;
}

/** Usuário logado (conferido no servidor do Supabase, não só pelo cookie), ou null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!authEnabled) return null;
  const store = await cookies();
  if (!store.getAll().some((c) => c.name.startsWith("sb-"))) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const db = getDb();
  const row = db ? (await db.select({ name: schema.profile.displayName }).from(schema.profile).where(eq(schema.profile.userId, data.user.id)).limit(1))[0] : undefined;
  return { id: data.user.id, name: row?.name ?? displayNameOf(data.user.user_metadata) };
}

export function displayNameOf(meta: Record<string, unknown> | undefined): string {
  const pick = ["full_name", "name", "user_name", "preferred_username", "global_name"].map((k) => meta?.[k]).find((v) => typeof v === "string" && v.trim());
  return ((pick as string | undefined) ?? "Player").trim().slice(0, 40);
}

/** Cria o perfil no primeiro login; depois não mexe no nome (o usuário pode ter trocado). */
export async function ensureProfile(id: string, name: string) {
  const db = getDb();
  if (!db) return;
  await db.insert(schema.profile).values({ userId: id, displayName: name }).onConflictDoNothing();
}
