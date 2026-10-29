"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authEnabled, enabledProviders, type Provider } from "./config";
import { safeNext } from "./next";
import { supabaseServer } from "./server";

async function origin() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signIn(form: FormData) {
  const provider = String(form.get("provider")) as Provider;
  const next = safeNext(String(form.get("next") ?? "/"));
  if (!authEnabled || !enabledProviders.includes(provider)) redirect(next);
  const supabase = await supabaseServer();
  const callback = new URL("/api/auth/callback", await origin());
  callback.searchParams.set("next", next);
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: callback.toString() } });
  if (error || !data.url) redirect(`${next}${next.includes("?") ? "&" : "?"}login=error`);
  redirect(data.url);
}

export async function signOut(form: FormData) {
  const next = safeNext(String(form.get("next") ?? "/"));
  if (authEnabled) {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  }
  redirect(next);
}
