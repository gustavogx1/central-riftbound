import { authEnabled, enabledProviders } from "@/lib/auth/config";
import { getSessionUser } from "@/lib/auth/server";

/** Quem está logado. As páginas continuam estáticas; o cabeçalho pergunta aqui no navegador. */
export async function GET() {
  const user = await getSessionUser();
  return Response.json({ enabled: authEnabled && enabledProviders.length > 0, user: user ? { name: user.name } : null }, { headers: { "Cache-Control": "private, no-store" } });
}
