import { getSessionUser } from "@/lib/auth/server";
import { getMyVote } from "@/lib/votes";

/** O voto de complexidade do usuário logado numa lenda (a página da lenda é a mesma para todos). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const legend = url.searchParams.get("legend") ?? "";
  const metagame = url.searchParams.get("metagame") ?? "";
  const user = await getSessionUser();
  const mine = user && legend && metagame ? await getMyVote(user.id, legend, metagame) : null;
  return Response.json({ loggedIn: !!user, mine }, { headers: { "Cache-Control": "private, no-store" } });
}
