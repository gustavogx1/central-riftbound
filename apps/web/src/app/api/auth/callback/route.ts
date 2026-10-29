import { NextResponse, type NextRequest } from "next/server";
import { authEnabled } from "@/lib/auth/config";
import { displayNameOf, ensureProfile, supabaseServer } from "@/lib/auth/server";
import { safeNext } from "@/lib/auth/next";

/** Volta do provedor (Discord/Google): troca o código pela sessão e cria o perfil. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  if (!authEnabled || !code) return NextResponse.redirect(new URL(next, url.origin));
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    const back = new URL(next, url.origin);
    back.searchParams.set("login", "error");
    return NextResponse.redirect(back);
  }
  await ensureProfile(data.user.id, displayNameOf(data.user.user_metadata));
  return NextResponse.redirect(new URL(next, url.origin));
}
