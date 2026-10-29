import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { authEnabled, SUPABASE_KEY, SUPABASE_URL } from "./lib/auth/config";

const intl = createMiddleware(routing);

/** Idioma pelo next-intl; com login ligado, renova a sessão do Supabase de quem já está logado. */
export default async function proxy(req: NextRequest) {
  if (!authEnabled || !req.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return intl(req);
  const fresh: { name: string; value: string; options: Record<string, unknown> }[] = [];
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const c of list) {
          req.cookies.set(c.name, c.value);
          fresh.push(c);
        }
      },
    },
  });
  await supabase.auth.getUser();
  const res = intl(req);
  for (const c of fresh) res.cookies.set(c.name, c.value, c.options);
  return res;
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
